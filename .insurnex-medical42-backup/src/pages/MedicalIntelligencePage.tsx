import { useState } from 'react';
import { BrainCircuit, Download, ShieldCheck, UploadCloud } from 'lucide-react';
import { parseInsuranceFile, type ParsedTabularFile } from '../features/ai/file-parser.service';
import { buildMappingPreview, type MappingItem } from '../features/ai/column-mapping.engine';
import { normalizeMedicalData } from '../features/medical-intelligence/medical-normalizer';
import { analyzeMedical } from '../features/medical-intelligence/medical-analytics.engine';
import { benchmarkDelta } from '../features/medical-intelligence/medical-benchmark';
import { downloadMedicalEnglishPdf } from '../features/medical-intelligence/medical-report.service';
import type { MedicalAnalyticsResult } from '../features/medical-intelligence/medical.types';
import '../theme/medical40.css';
import '../theme/medical41.css';

const formatNumber = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export default function MedicalIntelligencePage() {
  const [parsed, setParsed] = useState<ParsedTabularFile | null>(null);
  const [sheet, setSheet] = useState('');
  const [mapping, setMapping] = useState<MappingItem[]>([]);
  const [result, setResult] = useState<MedicalAnalyticsResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    try {
      const next = await parseInsuranceFile(file);
      const previews = buildMappingPreview(next);
      setParsed(next);
      setSheet(previews[0]?.sheet || '');
      setMapping(previews[0]?.mapping || []);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function run() {
    if (parsed && sheet) setResult(analyzeMedical(normalizeMedicalData(parsed, sheet, mapping)));
  }

  const delta = result ? benchmarkDelta(result) : null;
  const columns = parsed?.sheets.find((item) => item.name === sheet)?.rows[0]
    ? Object.keys(parsed.sheets.find((item) => item.name === sheet)!.rows[0])
    : [];

  return (
    <main className="mobile-page med40 med41" dir="rtl">
      <header className="med40-hero">
        <BrainCircuit />
        <div><small>INSURNEX MEDICAL INTELLIGENCE 4.1</small><h1>Medical Consumption Intelligence</h1><p>تحليل متخصص للاستهلاكات الطبية مع Member, Provider, Category, Concentration وEnglish Executive PDF.</p></div>
        <ShieldCheck />
      </header>
      <label className="med40-upload"><UploadCloud /><b>{busy ? 'Reading medical dataset...' : fileName || 'Upload medical consumption file'}</b><small>XLSX / XLS / CSV / PDF</small><input hidden type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={(event) => void pick(event.target.files?.[0])} /></label>
      {parsed && <><section className="med40-map"><h2>Confirm Medical Data Mapping</h2>{mapping.map((item) => <label key={item.field}><span>{item.label}</span><select value={item.column} onChange={(event) => setMapping((items) => items.map((value) => value.field === item.field ? { ...value, column: event.target.value } : value))}><option value="">Not mapped</option>{columns.map((column) => <option key={column}>{column}</option>)}</select></label>)}</section><button className="primary-button" onClick={run}><BrainCircuit /> Run Medical Intelligence</button></>}
      {result && <><section className="med40-kpis"><article><small>Total Consumption</small><b>{formatNumber(result.gross)}</b></article><article><small>Transactions</small><b>{formatNumber(result.records)}</b></article><article><small>Active Members</small><b>{formatNumber(result.members)}</b></article><article><small>Average / Member</small><b>{formatNumber(result.averageMember)}</b></article><article><small>Top 10 Concentration</small><b>{(result.top10Share * 100).toFixed(1)}%</b></article><article><small>Top 50 Concentration</small><b>{(result.top50Share * 100).toFixed(1)}%</b></article><article><small>Members above 50K</small><b>{result.highCost50k}</b></article><article><small>Members above 100K</small><b>{result.highCost100k}</b></article></section>
      {delta && <section className="med41-benchmark"><h2>Benchmark QA · Egyptian Association Report</h2><span>Transactions Δ {formatNumber(delta.records)}</span><span>Members Δ {formatNumber(delta.members)}</span><span>Gross Δ {formatNumber(delta.gross)}</span><span>Top 10 Δ {(delta.top10Share * 100).toFixed(1)} pp</span><small>Benchmark is used only for QA when analyzing the supplied association dataset, not as a production assumption for other clients.</small></section>}
      <section className="med40-grid"><article><h2>Top Categories</h2>{result.categories.slice(0, 10).map((item) => <p key={item.name}>{item.name}<b>{formatNumber(item.amount)} · {(item.share * 100).toFixed(1)}%</b></p>)}</article><article><h2>Top Providers</h2>{result.providersRanked.slice(0, 10).map((item) => <p key={item.name}>{item.name}<b>{formatNumber(item.amount)} · {item.count}</b></p>)}</article><article><h2>High-cost Members</h2>{result.membersRanked.slice(0, 10).map((item) => <p key={item.name}>{item.name}<b>{formatNumber(item.amount)} · {item.count}</b></p>)}</article></section>
      <section className="med40-insights"><h2>Intelligence Signals</h2>{result.insights.length ? result.insights.map((item) => <article key={item.title}><b>{item.title}</b><p>{item.detail}</p><small>{item.evidence.join(' · ')}</small></article>) : <p>No material automated signal was detected from the mapped fields.</p>}</section>
      <button className="primary-button" onClick={() => void downloadMedicalEnglishPdf(result, fileName)}><Download /> Download English Medical Intelligence Report</button></>}
    </main>
  );
}
