import type { ParsedTabularFile } from '../ai/file-parser.service';
import type { Medical42Mapping, Medical42Rank, Medical42Record, Medical42Result, Medical42Signal } from './medical42.types';

const num = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const txt = (value: unknown, fallback = 'Unknown') => String(value ?? '').trim() || fallback;

function excelSerialToDate(serial: number) {
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value: unknown) {
  const raw = String(value ?? '').trim().replace(/^\+/, '');
  if (/^\d{4,5}(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial >= 1 && serial <= 100000) return excelSerialToDate(serial);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return excelSerialToDate(value);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalize42(parsed: ParsedTabularFile, sheet: string, mapping: Medical42Mapping): Medical42Record[] {
  const rows = parsed.sheets.find((item) => item.name === sheet)?.rows || [];
  return rows.map((row) => {
    const gross = num(mapping.gross ? row[mapping.gross] : 0);
    const copay = num(mapping.copay ? row[mapping.copay] : 0);
    const net = mapping.net ? num(row[mapping.net]) : Math.max(0, gross - copay);
    const date = dateValue(mapping.date ? row[mapping.date] : null);
    return {
      member: txt(mapping.member ? row[mapping.member] : null),
      memberId: txt(mapping.memberId ? row[mapping.memberId] : null, ''),
      category: txt(mapping.category ? row[mapping.category] : null, 'Unclassified'),
      date: date ? date.toISOString().slice(0, 10) : '',
      provider: txt(mapping.provider ? row[mapping.provider] : null),
      activity: txt(mapping.activity ? row[mapping.activity] : null, 'Unclassified'),
      gross,
      copay,
      net,
    };
  });
}

const rank = (rows: Medical42Record[], key: (row: Medical42Record) => string, total: number): Medical42Rank[] => {
  const grouped: Record<string, { count: number; gross: number; copay: number; net: number; members: Set<string> }> = {};
  for (const row of rows) {
    const name = key(row) || 'Unknown';
    grouped[name] ??= { count: 0, gross: 0, copay: 0, net: 0, members: new Set() };
    const item = grouped[name];
    item.count += 1;
    item.gross += row.gross;
    item.copay += row.copay;
    item.net += row.net;
    item.members.add(row.member);
  }
  return Object.entries(grouped)
    .map(([name, item]) => ({
      name,
      count: item.count,
      members: item.members.size,
      gross: item.gross,
      copay: item.copay,
      net: item.net,
      share: total ? item.gross / total : 0,
      severity: item.count ? item.gross / item.count : 0,
    }))
    .sort((a, b) => b.gross - a.gross);
};

export function analyze42(rows: Medical42Record[]): Medical42Result {
  const gross = rows.reduce((sum, row) => sum + row.gross, 0);
  const copay = rows.reduce((sum, row) => sum + row.copay, 0);
  const net = rows.reduce((sum, row) => sum + row.net, 0);
  const categories = rank(rows, (row) => row.category, gross);
  const providersRanked = rank(rows, (row) => row.provider, gross);
  const membersRanked = rank(rows, (row) => row.member, gross);
  const activities = rank(rows, (row) => row.activity, gross);
  const pharmacy = activities.filter((item) => /tab|cap|mg|ml|syrup|cream|amp|sachet|inhal|insulin/i.test(item.name));

  const months: Record<string, { count: number; gross: number; members: Set<string>; dates: Date[] }> = {};
  for (const row of rows) {
    if (!row.date) continue;
    const date = new Date(`${row.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    const month = row.date.slice(0, 7);
    months[month] ??= { count: 0, gross: 0, members: new Set(), dates: [] };
    months[month].count += 1;
    months[month].gross += row.gross;
    months[month].members.add(row.member);
    months[month].dates.push(date);
  }

  const trend = Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => {
    const observedDays = [...new Set(value.dates.map((date) => date.getUTCDate()))];
    const lastObservedDay = observedDays.length ? Math.max(...observedDays) : 0;
    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const partial = lastObservedDay > 0 && lastObservedDay < daysInMonth * 0.65;
    return {
      month,
      count: value.count,
      members: value.members.size,
      gross: value.gross,
      severity: value.count ? value.gross / value.count : 0,
      partial,
      daysObserved: observedDays.length,
    };
  });

  const top10Share = gross ? membersRanked.slice(0, 10).reduce((sum, item) => sum + item.gross, 0) / gross : 0;
  const top50Share = gross ? membersRanked.slice(0, 50).reduce((sum, item) => sum + item.gross, 0) / gross : 0;
  const signals: Medical42Signal[] = [];

  if (top10Share >= 0.1) signals.push({ level: 'high', title: 'High-cost member concentration', finding: `Top 10 members contribute ${(top10Share * 100).toFixed(1)}% of total medical cost.`, evidence: [`Top 50 share ${(top50Share * 100).toFixed(1)}%`, `Members above EGP 50K: ${membersRanked.filter((item) => item.gross > 50000).length}`], action: 'Prioritize high-cost case review and member-level utilization management.' });
  const medicationCost = categories.filter((item) => /medication|chronic|pharm|دواء|أدوية/i.test(item.name)).reduce((sum, item) => sum + item.gross, 0);
  if (gross && medicationCost / gross > 0.3) signals.push({ level: 'high', title: 'Medication concentration', finding: `Medication categories represent ${(medicationCost / gross * 100).toFixed(1)}% of total cost.`, evidence: categories.filter((item) => /medication|chronic|pharm/i.test(item.name)).slice(0, 4).map((item) => `${item.name}: ${(item.share * 100).toFixed(1)}%`), action: 'Review chronic medication utilization, repeat dispensing, high-cost drugs and pharmacy concentration.' });
  if (providersRanked[0]?.share > 0.2) signals.push({ level: 'watch', title: 'Provider concentration', finding: `${providersRanked[0].name} represents ${(providersRanked[0].share * 100).toFixed(1)}% of medical cost.`, evidence: [`${providersRanked[0].count.toLocaleString()} transactions`, `Average severity EGP ${providersRanked[0].severity.toFixed(0)}`], action: 'Review provider mix, unit cost, category mix and member concentration at this provider.' });
  if (trend.some((item) => item.partial)) signals.push({ level: 'info', title: 'Partial period detected', finding: 'At least one monthly period appears incomplete and should not be compared directly with full months.', evidence: trend.filter((item) => item.partial).map((item) => `${item.month}: ${item.daysObserved} observed service days`), action: 'Normalize or exclude partial months in trend and renewal projections.' });

  const dataGaps: string[] = [];
  if (rows.every((row) => row.copay === 0)) dataGaps.push('Copay is unavailable or zero across mapped data.');
  if (rows.every((row) => row.provider === 'Unknown')) dataGaps.push('Provider mapping is unavailable.');
  if (rows.every((row) => !row.date)) dataGaps.push('Service date mapping is unavailable.');

  return { records: rows.length, members: new Set(rows.map((row) => row.member).filter((name) => name !== 'Unknown')).size, providers: new Set(rows.map((row) => row.provider).filter((name) => name !== 'Unknown')).size, gross, copay, net, copayRate: gross ? copay / gross : 0, avgTransaction: rows.length ? gross / rows.length : 0, avgMember: membersRanked.length ? gross / membersRanked.length : 0, top10Share, top50Share, above25k: membersRanked.filter((item) => item.gross > 25000).length, above50k: membersRanked.filter((item) => item.gross > 50000).length, above75k: membersRanked.filter((item) => item.gross > 75000).length, above100k: membersRanked.filter((item) => item.gross > 100000).length, under1k: membersRanked.filter((item) => item.gross < 1000).length, categories, providersRanked, membersRanked, activities, pharmacy, trend, signals, costDrivers: categories.slice(0, 8).map((item) => ({ name: item.name, amount: item.gross, share: item.share })), dataGaps };
}
