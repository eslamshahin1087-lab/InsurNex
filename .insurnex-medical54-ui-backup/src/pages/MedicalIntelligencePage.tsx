import { useEffect, useState } from 'react';
import { Activity, BrainCircuit, CheckCircle2, Download, LoaderCircle, UploadCloud } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { parseInsuranceFile, type ParsedTabularFile } from '../features/ai/file-parser.service';
import { detectMedical42Mapping } from '../features/medical-intelligence/medical42.schema';
import { analyze42, normalize42 } from '../features/medical-intelligence/medical42.engine';
import type { Medical42Mapping, Medical42Result } from '../features/medical-intelligence/medical42.types';
import { downloadMedical42Report } from '../features/medical-intelligence/medical42-report.service';
import {
  requestGeminiMedicalAnalysis,
  type GeminiMedicalAnalysis,
  type GeminiProgress,
} from '../features/medical-intelligence/gemini-medical.client';
import '../theme/medical40.css';
import '../theme/medical42.css';
import '../theme/ai-medical-bridge45.css';
import '../theme/gemini-medical50.css';
import '../theme/gemini-medical53.css';

const f = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export default function MedicalIntelligencePage() {
  const location = useLocation();
  const [p, setP] = useState<ParsedTabularFile | null>(null);
  const [sheet, setSheet] = useState('');
  const [map, setMap] = useState<Medical42Mapping | null>(null);
  const [r, setR] = useState<Medical42Result | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [geminiError, setGeminiError] = useState('');
  const [gemini, setGemini] = useState<GeminiMedicalAnalysis | null>(null);
  const [geminiProgress, setGeminiProgress] = useState<GeminiProgress | null>(null);
  const [lang, setLang] = useState<'ar' | 'en'>(() => localStorage.getItem('insurnex-medical-lang') === 'en' ? 'en' : 'ar');

  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;

  function changeLang(value: 'ar' | 'en') {
    setLang(value);
    localStorage.setItem('insurnex-medical-lang', value);
  }

  useEffect(() => {
    const handoff = (location.state as { medicalHandoff?: { parsed: ParsedTabularFile; sheet: string } } | null)?.medicalHandoff;
    if (!handoff?.parsed) return;
    const next = handoff.parsed;
    const selected = handoff.sheet || next.sheets[0]?.name || '';
    const row = next.sheets.find((item) => item.name === selected)?.rows[0];
    setP(next);
    setSheet(selected);
    setMap(detectMedical42Mapping(row ? Object.keys(row) : []));
    setR(null);
    window.history.replaceState({}, document.title, window.location.href);
  }, [location.state]);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    setName(file.name);
    setGemini(null);
    setGeminiError('');
    setGeminiProgress(null);
    try {
      const parsed = await parseInsuranceFile(file);
      const selectedSheet = parsed.sheets[0]?.name || '';
      const columns = parsed.sheets[0]?.rows[0] ? Object.keys(parsed.sheets[0].rows[0]) : [];
      setP(parsed);
      setSheet(selectedSheet);
      setMap(detectMedical42Mapping(columns));
      setR(null);
    } finally {
      setBusy(false);
    }
  }

  const cols = p?.sheets.find((item) => item.name === sheet)?.rows[0]
    ? Object.keys(p.sheets.find((item) => item.name === sheet)!.rows[0])
    : [];

  function run() {
    if (!p || !map) return;
    setR(analyze42(normalize42(p, sheet, map)));
    setGemini(null);
    setGeminiError('');
    setGeminiProgress(null);
  }

  async function runGemini() {
    if (!r || geminiBusy) return;
    setGeminiBusy(true);
    setGeminiError('');
    setGeminiProgress('connecting');
    try {
      const output = await requestGeminiMedicalAnalysis(r, lang, setGeminiProgress);
      setGemini(output);
      setGeminiProgress('complete');
    } catch (error) {
      console.error(error);
      setGeminiProgress(null);
      setGeminiError(tr(
        'تعذر إكمال تحليل Gemini الآن. التحليل المحلي ما زال متاحًا ويمكن إعادة المحاولة لاحقًا.',
        'Gemini could not complete the analysis right now. Deterministic analytics remain available and you can retry later.',
      ));
    } finally {
      setGeminiBusy(false);
    }
  }

  const progressText = geminiProgress === 'connecting'
    ? tr('جارٍ الاتصال بـ Gemini...', 'Connecting to Gemini...')
    : geminiProgress === 'retrying'
      ? tr('النموذج مشغول، تتم إعادة المحاولة تلقائيًا...', 'Model is busy, retrying automatically...')
      : geminiProgress === 'fallback'
        ? tr('جارٍ استخدام النموذج الاحتياطي السريع...', 'Using the fast fallback model...')
        : geminiProgress === 'complete'
          ? tr('اكتمل التحليل بنجاح.', 'Analysis completed successfully.')
          : '';

  return <main className="mobile-page med40 med42" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <div className="med43-lang">
      <button className={lang === 'ar' ? 'active' : ''} onClick={() => changeLang('ar')}>العربية</button>
      <button className={lang === 'en' ? 'active' : ''} onClick={() => changeLang('en')}>English</button>
    </div>

    <header className="med40-hero">
      <BrainCircuit />
      <div>
        <small>INSURNEX MEDICAL INTELLIGENCE 5.3</small>
        <h1>{tr('التحليل الذكي المتقدم للاستهلاكات الطبية', 'Advanced Medical Consumption Intelligence')}</h1>
        <p>{tr('تحليل الأعضاء ومقدمي الخدمة والخدمات والأدوية والتركيز والاتجاهات ومحركات التكلفة.', 'Schema-aware analytics for members, providers, services, medication, concentration, trends and cost drivers.')}</p>
      </div>
      <Activity />
    </header>

    <label className="med40-upload">
      <UploadCloud />
      <b>{busy ? tr('جارٍ تحليل بنية الملف...', 'Profiling medical dataset...') : name || tr('رفع ملف الاستهلاكات الطبية', 'Upload medical consumption file')}</b>
      <small>{tr('محسن لملفات الاستهلاكات الطبية التفصيلية', 'Optimized for detailed medical utilization files')}</small>
      <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void pick(event.target.files?.[0])} />
    </label>

    {p && map && <section className="med42-controls">
      <label>
        Sheet
        <select value={sheet} onChange={(event) => {
          const nextSheet = event.target.value;
          setSheet(nextSheet);
          const row = p.sheets.find((item) => item.name === nextSheet)?.rows[0];
          setMap(detectMedical42Mapping(row ? Object.keys(row) : []));
          setR(null);
          setGemini(null);
          setGeminiProgress(null);
        }}>
          {p.sheets.map((item) => <option key={item.name}>{item.name}</option>)}
        </select>
      </label>
      {(Object.keys(map) as (keyof Medical42Mapping)[]).map((key) => <label key={key}>
        <span>{key}</span>
        <select value={map[key]} onChange={(event) => setMap({ ...map, [key]: event.target.value })}>
          <option value="">Not mapped</option>
          {cols.map((column) => <option key={column}>{column}</option>)}
        </select>
      </label>)}
      <button className="primary-button" onClick={run}><BrainCircuit /> {tr('تحليل المحفظة الطبية', 'Analyze Medical Portfolio')}</button>
    </section>}

    {r && <>
      <section className="med42-kpis">
        {[
          ['Gross Consumption', f(r.gross)], ['Net Insurer Cost', f(r.net)], ['Copay Rate', `${(r.copayRate * 100).toFixed(1)}%`],
          ['Transactions', f(r.records)], ['Active Members', f(r.members)], ['Avg / Member', f(r.avgMember)],
          ['Top 10', `${(r.top10Share * 100).toFixed(1)}%`], ['Top 50', `${(r.top50Share * 100).toFixed(1)}%`],
          ['Members above 50K', String(r.above50k)], ['Members above 100K', String(r.above100k)],
        ].map(([label, value]) => <article key={label}><small>{label}</small><b>{value}</b></article>)}
      </section>

      <section className="med42-grid">
        <article><h2>{tr('محركات التكلفة', 'Cost Drivers')}</h2>{r.costDrivers.map((item) => <p key={item.name}><span>{item.name}</span><b>{f(item.amount)} · {(item.share * 100).toFixed(1)}%</b></p>)}</article>
        <article><h2>{tr('أعلى مقدمي الخدمة', 'Top Providers')}</h2>{r.providersRanked.slice(0, 10).map((item) => <p key={item.name}><span>{item.name}</span><b>{f(item.gross)} · {item.count}</b></p>)}</article>
        <article><h2>{tr('أعلى المستفيدين تكلفة', 'High-cost Members')}</h2>{r.membersRanked.slice(0, 10).map((item) => <p key={item.name}><span>{item.name}</span><b>{f(item.gross)} · {item.count}</b></p>)}</article>
        <article><h2>{tr('أعلى الخدمات / الأدوية', 'Top Activities / Drugs')}</h2>{r.activities.slice(0, 12).map((item) => <p key={item.name}><span>{item.name}</span><b>{f(item.gross)} · {item.count}</b></p>)}</article>
      </section>

      <section className="med42-trend">
        <h2>{tr('الاتجاه الشهري', 'Monthly Trend')}</h2>
        {r.trend.map((item) => <div key={item.month}><span>{item.month}{item.partial ? tr(' · فترة جزئية', ' · PARTIAL') : ''}</span><b>{f(item.gross)}</b><small>{item.count} tx · {item.members} members · severity {f(item.severity)}</small></div>)}
      </section>

      <section className="med42-signals">
        <h2>{tr('المؤشرات التأمينية الذكية', 'Insurance Intelligence')}</h2>
        {r.signals.map((item) => <article className={`is-${item.level}`} key={item.title}><b>{item.title}</b><p>{item.finding}</p><small>{item.evidence.join(' · ')}</small><strong>{tr('الإجراء المقترح: ', 'Recommended action: ')}{item.action}</strong></article>)}
      </section>

      <section className="gemini50 gemini53">
        <div className="gemini50-head">
          <div>
            <small>GEMINI AI</small>
            <h2>{tr('التحليل التنفيذي بالذكاء الاصطناعي', 'AI Executive Intelligence')}</h2>
            <p>{tr('يستخدم Gemini النتائج المحسوبة فقط لتفسير محركات التكلفة والمخاطر وفرص إدارة الحالات والتجديد.', 'Gemini interprets the validated metrics to explain cost drivers, risks, case-management opportunities and renewal considerations.')}</p>
          </div>
          <button disabled={geminiBusy} onClick={() => void runGemini()}>
            {geminiBusy ? <LoaderCircle className="gemini53-spin" /> : geminiProgress === 'complete' ? <CheckCircle2 /> : <BrainCircuit />}
            {geminiBusy ? tr('جارٍ التحليل...', 'Analyzing...') : tr('تحليل بواسطة Gemini AI', 'Analyze with Gemini AI')}
          </button>
        </div>

        {geminiProgress && <div className={`gemini53-progress state-${geminiProgress}`} role="status" aria-live="polite">
          <div className="gemini53-progress-line"><span /> <span /> <span /> <span /></div>
          <strong>{progressText}</strong>
          {geminiProgress === 'retrying' && <small>{tr('لا تحتاج إلى الضغط مرة أخرى. سيواصل InsurNex المحاولة تلقائيًا.', 'No action is needed. InsurNex will continue retrying automatically.')}</small>}
          {geminiProgress === 'fallback' && <small>{tr('تم الانتقال إلى Gemini Flash-Lite للحفاظ على استمرارية التحليل.', 'Switched to Gemini Flash-Lite to keep the analysis available.')}</small>}
        </div>}

        {geminiError && <div className="gemini50-error">{geminiError}</div>}

        {gemini && <div className="gemini50-result">
          <article className="wide"><h3>{tr('الملخص التنفيذي', 'Executive Summary')}</h3><p>{gemini.executiveSummary}</p></article>
          {[
            [tr('أهم النتائج', 'Key Findings'), gemini.keyFindings], [tr('محركات التكلفة', 'Cost Drivers'), gemini.costDrivers],
            [tr('تحليل المستفيدين', 'Member Insights'), gemini.memberInsights], [tr('تحليل مقدمي الخدمة', 'Provider Insights'), gemini.providerInsights],
            [tr('تحليل الاتجاهات', 'Trend Insights'), gemini.trendInsights], [tr('إشارات المخاطر', 'Risk Signals'), gemini.riskSignals],
            [tr('فرص إدارة الحالات', 'Case Management Opportunities'), gemini.caseManagementOpportunities],
            [tr('اعتبارات التجديد', 'Renewal Considerations'), gemini.renewalConsiderations],
            [tr('الإجراءات المقترحة', 'Recommended Actions'), gemini.recommendedActions], [tr('قيود البيانات', 'Data Limitations'), gemini.dataLimitations],
          ].map(([title, items]) => <article key={title as string}><h3>{title as string}</h3>{(items as string[]).map((item, index) => <p key={index}>• {item}</p>)}</article>)}
        </div>}
      </section>

      <button className="primary-button" onClick={() => void downloadMedical42Report(r, name)}><Download /> {tr('تحميل التقرير الطبي المتقدم (PDF بالإنجليزية)', 'Download Advanced English Medical Report')}</button>
    </>}
  </main>;
}
