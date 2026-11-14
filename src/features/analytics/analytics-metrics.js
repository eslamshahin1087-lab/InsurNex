function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currencyCode(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'UNKNOWN';
}

function sumByCurrency(rows, field) {
  return rows.reduce((totals, row) => {
    const key = currencyCode(row.currency);
    totals[key] = (totals[key] || 0) + amount(row[field]);
    return totals;
  }, {});
}

export function buildAnalyticsSnapshot({ clients, policies, claims, leads, tasks }, generatedAt = new Date().toISOString()) {
  const stages = {};
  const sources = {};
  const insurers = {};
  const insuranceTypes = {};

  for (const lead of leads) {
    const stage = typeof lead.stage === 'string' && lead.stage ? lead.stage : 'unknown';
    const source = typeof lead.source === 'string' && lead.source ? lead.source : 'unknown';
    stages[stage] = (stages[stage] || 0) + 1;
    sources[source] = (sources[source] || 0) + 1;

    const type = typeof lead.insuranceType === 'string' && lead.insuranceType
      ? lead.insuranceType
      : 'غير محدد';
    const insurer = typeof lead.preferredInsurerName === 'string' && lead.preferredInsurerName
      ? lead.preferredInsurerName
      : 'غير محددة';
    const estimatedValue = amount(lead.estimatedValue);
    const isOpen = !['won', 'lost'].includes(stage);

    insuranceTypes[type] ||= { count: 0, pipeline: 0, won: 0, lost: 0 };
    insuranceTypes[type].count += 1;
    if (isOpen) {
      insuranceTypes[type].pipeline += estimatedValue;
      insurers[insurer] = (insurers[insurer] || 0) + estimatedValue;
    }
    if (stage === 'won') insuranceTypes[type].won += 1;
    if (stage === 'lost') insuranceTypes[type].lost += 1;
  }

  const won = stages.won || 0;
  const lost = stages.lost || 0;
  const openLeads = leads.filter((lead) => !['won', 'lost'].includes(lead.stage));
  const openTasks = tasks.filter((task) => task.status !== 'completed').length;

  return {
    clients: clients.length,
    activeClients: clients.filter((client) => client.status === 'active').length,
    policies: policies.length,
    activePolicies: policies.filter((policy) => policy.status === 'active').length,
    premiumByCurrency: sumByCurrency(policies, 'premium'),
    claims: claims.length,
    claimAmountByCurrency: sumByCurrency(claims, 'claimAmount'),
    leads: leads.length,
    pipeline: openLeads.reduce((total, lead) => total + amount(lead.estimatedValue), 0),
    won,
    lost,
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
    openTasks,
    stages,
    sources,
    insurers,
    insuranceTypes,
    generatedAt,
  };
}
