export type ParsedTabularFile = {
  name: string;
  kind: 'excel' | 'pdf';
  sheets: { name: string; rows: Record<string, unknown>[] }[];
  text?: string;
  warnings: string[];
};

type FileParserErrorCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'INVALID_FILE'
  | 'FILE_READ_FAILED'
  | 'TOO_MANY_SHEETS'
  | 'TOO_MANY_ROWS'
  | 'TOO_MANY_COLUMNS'
  | 'TOO_MANY_PDF_PAGES'
  | 'PDF_TEXT_TOO_LARGE';

export class FileParserError extends Error {
  public readonly code: FileParserErrorCode;

  constructor(code: FileParserErrorCode) {
    super(code);
    this.name = 'FileParserError';
    this.code = code;
  }
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_EXCEL_SHEETS = 20;
const MAX_ROWS_PER_SHEET = 10_000;
const MAX_COLUMNS_PER_SHEET = 200;
const MAX_TOTAL_ROWS = 50_000;
const MAX_PDF_PAGES = 100;
const MAX_PDF_TEXT_CHARS = 1_000_000;

const FILE_ERROR_MESSAGES: Record<
  FileParserErrorCode,
  { ar: string; en: string }
> = {
  EMPTY_FILE: {
    ar: 'الملف فارغ. اختر ملفًا يحتوي على بيانات.',
    en: 'The file is empty. Please choose a file containing data.',
  },
  FILE_TOO_LARGE: {
    ar: 'حجم الملف أكبر من الحد المسموح، وهو 10 ميجابايت.',
    en: 'The file exceeds the 10 MB size limit.',
  },
  UNSUPPORTED_FILE: {
    ar: 'نوع الملف غير مدعوم. استخدم XLSX أو XLS أو CSV أو PDF.',
    en: 'Unsupported file type. Use XLSX, XLS, CSV, or PDF.',
  },
  INVALID_FILE: {
    ar: 'تعذر التحقق من محتوى الملف. تأكد من أنه ملف صالح وغير تالف.',
    en: 'The file could not be validated. Ensure it is valid and not corrupted.',
  },
  FILE_READ_FAILED: {
    ar: 'تعذرت قراءة الملف. تحقق من سلامته ثم حاول مرة أخرى.',
    en: 'Unable to read the file. Check that it is valid and try again.',
  },
  TOO_MANY_SHEETS: {
    ar: 'يحتوي ملف Excel على أوراق أكثر من الحد المسموح، وهو 20 ورقة.',
    en: 'The Excel file exceeds the limit of 20 worksheets.',
  },
  TOO_MANY_ROWS: {
    ar: 'حجم بيانات Excel يتجاوز الحدود المسموحة. الحد 10,000 صف لكل ورقة و50,000 صف إجمالًا.',
    en: 'The Excel data exceeds the limit of 10,000 rows per sheet or 50,000 rows total.',
  },
  TOO_MANY_COLUMNS: {
    ar: 'تحتوي ورقة Excel على أعمدة أكثر من الحد المسموح، وهو 200 عمود.',
    en: 'An Excel worksheet exceeds the limit of 200 columns.',
  },
  TOO_MANY_PDF_PAGES: {
    ar: 'يتجاوز ملف PDF الحد المسموح، وهو 100 صفحة.',
    en: 'The PDF exceeds the limit of 100 pages.',
  },
  PDF_TEXT_TOO_LARGE: {
    ar: 'النص المستخرج من PDF يتجاوز الحد المسموح للتحليل.',
    en: 'The extracted PDF text exceeds the allowed processing limit.',
  },
};

export function getFileParserErrorMessage(
  error: unknown,
  language: 'ar' | 'en',
): string {
  const code =
    error instanceof FileParserError
      ? error.code
      : 'FILE_READ_FAILED';

  return FILE_ERROR_MESSAGES[code][language];
}

export async function parseInsuranceFile(
  file: File,
): Promise<ParsedTabularFile> {
  if (!file || file.size === 0) {
    throw new FileParserError('EMPTY_FILE');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileParserError('FILE_TOO_LARGE');
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

  if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();

      const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
        sheetRows: MAX_ROWS_PER_SHEET + 1,
      });

      if (workbook.SheetNames.length > MAX_EXCEL_SHEETS) {
        throw new FileParserError('TOO_MANY_SHEETS');
      }

      let totalRows = 0;

      const sheets = workbook.SheetNames.map((name) => {
        const worksheet = workbook.Sheets[name];

        if (!worksheet || !worksheet['!ref']) {
          return { name, rows: [] as Record<string, unknown>[] };
        }

        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const rowCount = range.e.r - range.s.r + 1;
        const columnCount = range.e.c - range.s.c + 1;

        if (rowCount > MAX_ROWS_PER_SHEET) {
          throw new FileParserError('TOO_MANY_ROWS');
        }

        if (columnCount > MAX_COLUMNS_PER_SHEET) {
          throw new FileParserError('TOO_MANY_COLUMNS');
        }

        totalRows += rowCount;

        if (totalRows > MAX_TOTAL_ROWS) {
          throw new FileParserError('TOO_MANY_ROWS');
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          { defval: null, raw: false },
        );

        if (rows.length > MAX_ROWS_PER_SHEET) {
          throw new FileParserError('TOO_MANY_ROWS');
        }

        return { name, rows };
      });

      return {
        name: file.name,
        kind: 'excel',
        warnings: [],
        sheets,
      };
    } catch (error) {
      if (error instanceof FileParserError) {
        throw error;
      }

      throw new FileParserError('INVALID_FILE');
    }
  }

  if (ext === 'pdf') {
    let loadingTask: ReturnType<
      (typeof import('pdfjs-dist'))['getDocument']
    > | undefined;
    let document: Awaited<
      ReturnType<
        (typeof import('pdfjs-dist'))['getDocument']
      >['promise']
    > | undefined;

    try {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import(
        'pdfjs-dist/build/pdf.worker.min.mjs?url'
      );

      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

      const data = new Uint8Array(await file.arrayBuffer());

      loadingTask = pdfjs.getDocument({ data });
      document = await loadingTask.promise;

      if (document.numPages > MAX_PDF_PAGES) {
        throw new FileParserError('TOO_MANY_PDF_PAGES');
      }

      let text = '';

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText =
          content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ') + '\n';

        if (text.length + pageText.length > MAX_PDF_TEXT_CHARS) {
          throw new FileParserError('PDF_TEXT_TOO_LARGE');
        }

        text += pageText;
      }

      return {
        name: file.name,
        kind: 'pdf',
        text,
        sheets: [],
        warnings: [
          'PDF text extraction preserves text, but complex tables or scanned PDFs may require OCR or template mapping for reliable numeric analysis.',
        ],
      };
    } catch (error) {
      if (error instanceof FileParserError) {
        throw error;
      }

      throw new FileParserError('FILE_READ_FAILED');
    } finally {
      if (document) {
        if (loadingTask) { await loadingTask.destroy(); }
      }
    }
  }

  throw new FileParserError('UNSUPPORTED_FILE');
}