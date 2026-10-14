import type { Transaction } from './finance.types';

export interface InvoiceData {
  transaction: Transaction;
  organizationName?: string;
  organizationType?: string;
  organizationOwner?: string;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d?: Date): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

function invoiceNumber(code: string, date?: Date): string {
  const y = date?.getFullYear() ?? new Date().getFullYear();
  return `INV-${y}-${code.replace('INX-', '')}`;
}

export function renderInvoiceHTML(data: InvoiceData): string {
  const t = data.transaction;
  const invoiceNo = invoiceNumber(t.code, t.usedAt);
  const issuedAt = fmtDate(t.usedAt);
  const orgName = data.organizationName || 'غير محدد';

  return `
<div id="invoice-root" style="
  width: 794px;
  min-height: 1123px;
  padding: 50px 60px;
  background: #ffffff;
  color: #0A1929;
  font-family: 'Cairo', 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
  direction: rtl;
  box-sizing: border-box;
  position: relative;
">
  <!-- HEADER -->
  <header style="
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 24px;
    border-bottom: 3px solid #1E4272;
    margin-bottom: 32px;
  ">
    <div style="text-align: right;">
      <div style="
        font-size: 32px;
        font-weight: 900;
        color: #1E4272;
        letter-spacing: -0.5px;
        line-height: 1;
      ">InsurNex</div>
      <div style="
        font-size: 11px;
        color: #6B7F97;
        margin-top: 6px;
        letter-spacing: 3px;
        font-weight: 700;
      ">INSURANCE CRM PLATFORM</div>
    </div>

    <div style="text-align: left;">
      <div style="
        display: inline-block;
        background: #1E4272;
        color: #ffffff;
        padding: 8px 20px;
        border-radius: 6px;
        font-weight: 800;
        font-size: 15px;
        letter-spacing: 1px;
      ">فاتورة ضريبية</div>
      <div style="font-size: 12px; color: #6B7F97; margin-top: 10px;">
        رقم الفاتورة
      </div>
      <div style="font-size: 14px; font-weight: 800; color: #0A1929; font-family: monospace;">
        ${invoiceNo}
      </div>
    </div>
  </header>

  <!-- META -->
  <section style="
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
  ">
    <div style="
      background: #F4F6FA;
      padding: 18px 20px;
      border-radius: 12px;
      border-right: 4px solid #1E4272;
    ">
      <div style="
        font-size: 11px;
        color: #6B7F97;
        font-weight: 800;
        letter-spacing: 1px;
        margin-bottom: 6px;
      ">معلومات المؤسسة</div>
      <div style="font-size: 16px; font-weight: 800; color: #0A1929; margin-bottom: 4px;">
        ${orgName}
      </div>
      ${
        data.organizationType
          ? `<div style="font-size: 12px; color: #6B7F97;">النوع: ${data.organizationType}</div>`
          : ''
      }
      ${
        data.organizationOwner
          ? `<div style="font-size: 12px; color: #6B7F97;">المالك: ${data.organizationOwner}</div>`
          : ''
      }
    </div>

    <div style="
      background: #F4F6FA;
      padding: 18px 20px;
      border-radius: 12px;
      border-right: 4px solid #D4A017;
    ">
      <div style="
        font-size: 11px;
        color: #6B7F97;
        font-weight: 800;
        letter-spacing: 1px;
        margin-bottom: 6px;
      ">تاريخ الإصدار</div>
      <div style="font-size: 15px; font-weight: 800; color: #0A1929; margin-bottom: 4px;">
        ${issuedAt}
      </div>
      <div style="font-size: 12px; color: #6B7F97;">
        المستخدم: ${t.userName || '—'}
      </div>
      ${t.userEmail ? `<div style="font-size: 12px; color: #6B7F97;">${t.userEmail}</div>` : ''}
    </div>
  </section>

  <!-- ITEMS TABLE -->
  <table style="
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
    font-size: 14px;
  ">
    <thead>
      <tr style="background: #1E4272; color: #ffffff;">
        <th style="padding: 14px 16px; text-align: right; font-weight: 800; font-size: 13px;">البيان</th>
        <th style="padding: 14px 16px; text-align: center; font-weight: 800; font-size: 13px;">الخطة</th>
        <th style="padding: 14px 16px; text-align: center; font-weight: 800; font-size: 13px;">المدة</th>
        <th style="padding: 14px 16px; text-align: left; font-weight: 800; font-size: 13px;">السعر (ج.م)</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background: #ffffff; border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 16px; font-weight: 700; color: #0A1929;">
          اشتراك ${t.planName || t.planType || '—'}
          <div style="font-size: 11px; color: #6B7F97; font-family: monospace; margin-top: 4px;">
            كود: ${t.code}
          </div>
        </td>
        <td style="padding: 16px; text-align: center; color: #566A82;">
          ${t.planName || t.planType || '—'}
        </td>
        <td style="padding: 16px; text-align: center; color: #566A82;">
          ${t.duration || '—'} يوم
        </td>
        <td style="padding: 16px; text-align: left; font-weight: 800; color: #0A1929;">
          ${fmtNum(t.subtotal)}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- TOTALS -->
  <section style="
    display: flex;
    justify-content: flex-start;
    margin-bottom: 40px;
  ">
    <div style="width: 380px;">
      <div style="
        display: flex;
        justify-content: space-between;
        padding: 12px 20px;
        border-bottom: 1px solid #E2E8F0;
        font-size: 14px;
      ">
        <span style="color: #566A82;">المجموع الفرعي</span>
        <span style="font-weight: 700; color: #0A1929;">${fmtNum(t.subtotal)} ج.م</span>
      </div>
      <div style="
        display: flex;
        justify-content: space-between;
        padding: 12px 20px;
        border-bottom: 1px solid #E2E8F0;
        font-size: 14px;
      ">
        <span style="color: #566A82;">ضريبة القيمة المضافة (14%)</span>
        <span style="font-weight: 700; color: #0A1929;">${fmtNum(t.vatAmount)} ج.م</span>
      </div>
      <div style="
        display: flex;
        justify-content: space-between;
        padding: 16px 20px;
        background: #1E4272;
        color: #ffffff;
        border-radius: 10px;
        margin-top: 8px;
        font-size: 16px;
      ">
        <span style="font-weight: 800;">الإجمالي المستحق</span>
        <span style="font-weight: 900; font-size: 18px;">${fmtNum(t.total)} ج.م</span>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer style="
    position: absolute;
    bottom: 50px;
    left: 60px;
    right: 60px;
    padding-top: 20px;
    border-top: 2px solid #E2E8F0;
    font-size: 11px;
    color: #6B7F97;
    text-align: center;
    line-height: 1.8;
  ">
    <div style="font-weight: 800; color: #1E4272; font-size: 12px; margin-bottom: 4px;">
      InsurNex — منصة إدارة التأمين من الجيل القادم
    </div>
    <div>هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى ختم أو توقيع.</div>
    <div>للاستفسار: support@insurnex.com</div>
  </footer>
</div>
  `.trim();
}