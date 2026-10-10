import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Download,
  Eye,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  parseInsuranceFile,
  type ParsedTabularFile,
} from '../features/ai/file-parser.service';
import {
  buildMappingPreview,
  mappingQuality,
  type MappingItem,
  type MappingPreview,
} from '../features/ai/column-mapping.engine';
import { analyzeWithMapping } from '../features/ai/mapped-analysis.service';
import type { FileIntelligenceReport } from '../features/ai/file-analysis.engine';
import { downloadIntelligencePdf } from '../features/ai/report-pdf.service';
import '../theme/ai-file30.css';
import '../theme/ai-medical-bridge44.css';
import '../theme/ai-medical-bridge45.css';

const fmt = (v: number | null) =>
  v === null ? 'N/A' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);

function isMedical(cols: string[], rows: Record<string, unknown>[]) {
  const n = cols.join(' ').toLowerCase();
  const v = rows.slice(0, 30).flatMap((r) => Object.values(r).map(String)).join(' ').toLowerCase();
  return (
    /service_name|provider_eng_name|eng_member_name|card_no|tot_claimed_value|original_copay_value|due_limit/.test(n) ||
    /medication|chronic|consultation|radiology|laboratory|pharmacy/.test(v)
  );
}

export default function AIFileAnalysisPage() {
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedTabularFile | null>(null);
  const [previews, setPreviews] = useState<MappingPreview[]>([]);
  const [sheet, setSheet] = useState('');
  const [mapping, setMapping] = useState<MappingItem[]>([]);
  const [report, setReport] = useState<FileIntelligenceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState<'ar' | 'en'>(() =>
    localStorage.getItem('insurnex-ai-lang') === 'en' ? 'en' : 'ar',
  );

  const current = useMemo(() => previews.find((x) => x.sheet === sheet), [previews, sheet]);
  const quality = mappingQuality(mapping);
  const medical = !!current && isMedical(current.columns, current.rows);
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  async function pick(f?: File) {
    if (!f) return;
    try {
      setBusy(true);
      setError('');
      setReport(null);
      const p = await parseInsuranceFile(f);
      const pv = buildMappingPreview(p);
      setParsed(p);
      setPreviews(pv);
      setSheet(pv[0]?.sheet || '');
      setMapping(pv[0]?.mapping || []);
    } catch (e) {
      console.error(e);
      setError(tr('تعذر قراءة الملف.', 'Unable to read this file.'));
    } finally {
      setBusy(false);
    }
  }

  function changeSheet(v: string) {
    setSheet(v);
    setMapping(previews.find((x) => x.sheet === v)?.mapping || []);
    setReport(null);
  }

  function reset() {
    setParsed(null);
    setPreviews([]);
    setSheet('');
    setMapping([]);
    setReport(null);
    setError('');
    if (input.current) input.current.value = '';
  }

  const setLangSafe = (v: 'ar' | 'en') => {
    setLang(v);
    localStorage.setItem('insurnex-ai-lang', v);
  };

  return (
    <main className="mobile-page ai44" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="inx-container">
        {/* ===== Toolbar ===== */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <Link
            to="/analytics"
            className="inx-btn inx-btn-secondary inx-btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowRight size={14} />
            {tr('العودة للتحليلات', 'Back to Analytics')}
          </Link>
          <div className="inx-chips" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`inx-chip ${lang === 'ar' ? 'active' : ''}`}
              onClick={() => setLangSafe('ar')}
            >
              العربية
            </button>
            <button
              type="button"
              className={`inx-chip ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLangSafe('en')}
            >
              English
            </button>
          </div>
        </div>

        {/* ===== Hero ===== */}
        <section className="inx-card inx-card-lg" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="inx-icon-circle inx-icon-circle-lg tone-primary">
              <BrainCircuit size={22} />
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span className="eyebrow">InsurNex AI Studio</span>
              <h2 style={{ margin: '4px 0 6px', color: 'var(--inx-text)' }}>
                {tr('تحليل ملفات التأمين', 'Insurance File Intelligence')}
              </h2>
              <small style={{ color: 'var(--inx-muted)', lineHeight: 1.7 }}>
                {tr(
                  'ارفع ملف Excel أو CSV أو PDF للحصول على معاينة ذكية وتحليل تلقائي.',
                  'Upload an Excel, CSV or PDF file for intelligent preview and analysis.',
                )}
              </small>
            </div>
            <span className="inx-badge inx-badge-success">
              <ShieldCheck size={12} />
              {tr('معالجة آمنة', 'Secure')}
            </span>
          </div>
        </section>

        {/* ===== Drop zone ===== */}
        {!parsed && (
          <section
            className="inx-card inx-card-lg"
            onClick={() => !busy && input.current?.click()}
            style={{
              cursor: busy ? 'wait' : 'pointer',
              textAlign: 'center',
              padding: 40,
              marginBottom: 16,
              border: '2px dashed var(--inx-border)',
              background: 'var(--inx-bg)',
              transition: 'border-color 0.2s',
            }}
          >
            <input
              ref={input}
              hidden
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
            <span className="inx-icon-circle inx-icon-circle-lg tone-primary" style={{ margin: '0 auto 12px' }}>
              <UploadCloud size={24} />
            </span>
            <b style={{ display: 'block', fontSize: 16, marginBottom: 6, color: 'var(--inx-text)' }}>
              {busy
                ? tr('جاري قراءة الملف...', 'Reading file...')
                : tr('اختر ملف التأمين', 'Choose insurance file')}
            </b>
            <small style={{ color: 'var(--inx-muted)' }}>Excel · CSV · PDF</small>
          </section>
        )}

        {error && (
          <div className="inx-card" role="alert" style={{ marginBottom: 12, borderColor: 'var(--inx-danger)' }}>
            <span className="inx-badge inx-badge-danger">{error}</span>
          </div>
        )}

        {parsed && current && (
          <>
            {/* ===== Step 1: Preview ===== */}
            <div className="inx-section-head">
              <div>
                <span className="eyebrow">{tr('الخطوة 1', 'Step 1')}</span>
                <h2>{tr('معاينة البيانات', 'Data Preview')}</h2>
              </div>
              <button
                type="button"
                className="inx-btn inx-btn-secondary inx-btn-sm"
                onClick={reset}
              >
                <RefreshCw size={14} /> {tr('ملف جديد', 'New file')}
              </button>
            </div>

            <div
              className="inx-card"
              style={{ marginBottom: 16, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            >
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--inx-muted)' }}>Sheet</span>
                <select
                  value={sheet}
                  onChange={(e) => changeSheet(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    border: '1px solid var(--inx-border)',
                    borderRadius: 'var(--inx-radius-sm)',
                    background: 'var(--inx-surface)',
                    color: 'var(--inx-text)',
                  }}
                >
                  {previews.map((x) => (
                    <option key={x.sheet}>{x.sheet}</option>
                  ))}
                </select>
              </label>
              <span className="inx-badge inx-badge-neutral">
                {current.columns.length} {tr('أعمدة', 'columns')}
              </span>
            </div>

            <div className="ai44-table" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    {current.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.rows.slice(0, 6).map((row, i) => (
                    <tr key={i}>
                      {current.columns.map((c) => (
                        <td key={c}>{String(row[c] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ===== Medical Detection ===== */}
            {medical && (
              <section
                className="inx-card inx-card-lg"
                style={{ marginBottom: 16, borderColor: 'var(--inx-success)' }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="inx-icon-circle tone-success inx-icon-circle-lg">
                    <Stethoscope size={22} />
                  </span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <span className="eyebrow">{tr('كشف تلقائي', 'Auto detection')}</span>
                    <h3 style={{ margin: '4px 0 6px', color: 'var(--inx-text)' }}>
                      {tr('تم كشف ملف استخدامات طبية', 'Medical utilization detected')}
                    </h3>
                    <small style={{ color: 'var(--inx-muted)' }}>
                      {tr(
                        'استخدم محرك التحليل الطبي للحصول على رؤى الأعضاء ومقدمي الخدمة والاتجاهات.',
                        'Use the specialist medical engine for member, provider, and trend analytics.',
                      )}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="inx-btn inx-btn-primary"
                    onClick={() =>
                      nav('/analytics/medical', {
                        state: { medicalHandoff: { parsed, sheet } },
                      })
                    }
                  >
                    <Stethoscope size={16} />
                    {tr('فتح التحليل الطبي', 'Open Medical Intelligence')}
                  </button>
                </div>
              </section>
            )}

            {/* ===== Step 2: Mapping ===== */}
            <div className="inx-section-head">
              <div>
                <span className="eyebrow">{tr('الخطوة 2', 'Step 2')}</span>
                <h2>{tr('ضبط الأعمدة للتحليل', 'General Analysis Mapping')}</h2>
              </div>
              <span className="inx-badge inx-badge-primary">
                {tr('الثقة', 'Confidence')} {quality}%
              </span>
            </div>

            <div className="ai44-mapping" style={{ marginBottom: 16 }}>
              {mapping.map((x) => (
                <label key={x.field} className="inx-card" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 10 }}>
                    <div>
                      <b style={{ display: 'block', fontSize: 13, color: 'var(--inx-text)' }}>{x.label}</b>
                      <small style={{ color: 'var(--inx-muted)', fontSize: 11 }}>
                        {x.confidence
                          ? `${x.confidence}% ${tr('ثقة', 'confidence')}`
                          : tr('غير مكتشف', 'Not detected')}
                      </small>
                    </div>
                    <select
                      value={x.column}
                      onChange={(e) =>
                        setMapping((xs) =>
                          xs.map((v) =>
                            v.field === x.field
                              ? { ...v, column: e.target.value, confidence: e.target.value ? 100 : 0 }
                              : v,
                          ),
                        )
                      }
                      style={{
                        padding: '7px 10px',
                        border: '1px solid var(--inx-border)',
                        borderRadius: 'var(--inx-radius-sm)',
                        background: 'var(--inx-surface)',
                        color: 'var(--inx-text)',
                        maxWidth: 220,
                      }}
                    >
                      <option value="">{tr('غير معيّن', 'Not mapped')}</option>
                      {current.columns.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </label>
              ))}
            </div>

            <button
              type="button"
              className="inx-btn inx-btn-primary inx-btn-block"
              onClick={() => setReport(analyzeWithMapping(parsed, sheet, mapping))}
              style={{ marginBottom: 16 }}
            >
              <BrainCircuit size={16} />
              {tr('تشغيل التحليل العام', 'Run General Analysis')}
            </button>
          </>
        )}

        {/* ===== Report ===== */}
        {report && (
          <>
            <div className="inx-section-head">
              <div>
                <span className="eyebrow">{tr('النتيجة', 'Result')}</span>
                <h2>{tr('ملخص التحليل', 'Analysis Summary')}</h2>
              </div>
            </div>
            <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
              <article className="inx-kpi">
                <div className="inx-kpi-head"><span className="inx-icon-circle tone-primary"><Eye size={16} /></span></div>
                <div className="inx-kpi-value">{report.dataQuality}%</div>
                <small className="inx-kpi-label">Data Quality</small>
              </article>
              <article className="inx-kpi">
                <div className="inx-kpi-head"><span className="inx-icon-circle tone-cyan"><Download size={16} /></span></div>
                <div className="inx-kpi-value">{fmt(report.premium)}</div>
                <small className="inx-kpi-label">Premium</small>
              </article>
              <article className="inx-kpi">
                <div className="inx-kpi-head"><span className="inx-icon-circle tone-warning"><Eye size={16} /></span></div>
                <div className="inx-kpi-value">{fmt(report.claims)}</div>
                <small className="inx-kpi-label">Claims</small>
              </article>
              <article className="inx-kpi">
                <div className="inx-kpi-head"><span className="inx-icon-circle tone-danger"><Eye size={16} /></span></div>
                <div className="inx-kpi-value">
                  {report.lossRatio === null ? 'N/A' : `${report.lossRatio.toFixed(1)}%`}
                </div>
                <small className="inx-kpi-label">Loss Ratio</small>
              </article>
            </div>
            <button
              type="button"
              className="inx-btn inx-btn-primary inx-btn-block"
              onClick={() => void downloadIntelligencePdf(report)}
            >
              <Download size={16} /> PDF
            </button>
          </>
        )}
      </div>
    </main>
  );
}