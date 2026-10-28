const SENSITIVE_ROOTS = new Map([
  ['individual', 'identity_profile'],
  ['corporate', 'corporate_profile'],
  ['nationalId', 'identity'],
  ['taxId', 'identity'],
  ['commercialRegister', 'identity'],
  ['taxCard', 'identity'],
  ['authorizedSignatoryNid', 'identity'],
  ['passportNumber', 'identity'],
  ['dateOfBirth', 'identity'],
  ['address', 'contact_address'],
  ['riskData', 'risk_profile'],
  ['riskAssessment', 'derived_assessment'],
  ['aiAnalysis', 'derived_analysis'],
  ['documents', 'document_references'],
  ['notes', 'freeform_notes'],
  ['lifetimeValue', 'financial'],
]);

const KEY_CATEGORIES = [
  ['identity', /^(national.?id|tax.?id|commercial.?register|tax.?card|authorized.?signatory.?nid|passport(number)?|birth(date)?|date.?of.?birth|gender|marital.?status|signatory|identity(number)?|kyc)$/i],
  ['health', /^(health|medical|chronic.?conditions?|medications?|surgeries|smoker|height|weight|last.?checkup|diagnosis|treatment|disability|pre.?existing.?conditions?)$/i],
  ['family', /^(dependents?|spouse|children|family|beneficiaries|marital.?status)$/i],
  ['financial', /^(monthly.?income|annual.?salary|salary|income|capital|annual.?revenue|revenue|lifetime.?value|premium|commission|bank.?account|iban)$/i],
  ['derived_assessment', /^(risk.?assessment|risk.?score|risk.?factors|assessment)$/i],
  ['derived_analysis', /^(ai.?analysis|ai.?recommendations?|suggested.?products|prompt|model.?output)$/i],
  ['document_references', /^(documents?|download.?url|storage.?path|storage.?bucket|signed.?url|file.?url|file.?name|original.?file.?name)$/i],
  ['freeform_notes', /^(notes?|description|narrative|free.?text|comment|remarks)$/i],
  ['contact_address', /^(address|street|area|postal.?code|location|employer|occupation)$/i],
];

const PRIVATE_CONTAINERS = new Set([
  'individual',
  'corporate',
  'riskData',
  'riskAssessment',
  'aiAnalysis',
  'documents',
]);

function isPopulated(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function safeKey(key) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(key) ? key : '[field]';
}

function categoryForKey(key) {
  for (const [category, pattern] of KEY_CATEGORIES) {
    if (pattern.test(key)) return category;
  }
  return null;
}

/**
 * Returns only field names/paths and category counts. It never returns field
 * values, client names, contact details, document URLs or embedded file tokens.
 */
export function inspectClientSensitiveFieldPresence(data) {
  const pathCategories = new Map();
  const presentPaths = new Set();

  function add(path, category) {
    if (!path || !category) return;
    presentPaths.add(path);
    if (!pathCategories.has(path)) pathCategories.set(path, new Set());
    pathCategories.get(path).add(category);
  }

  function walk(value, path, inheritedCategory = null) {
    if (!isPopulated(value)) return;

    if (Array.isArray(value)) {
      for (const item of value) walk(item, path + '[]', inheritedCategory);
      return;
    }

    if (typeof value !== 'object') {
      if (inheritedCategory) add(path, inheritedCategory);
      return;
    }

    const entries = Object.entries(value);
    for (const [rawKey, child] of entries) {
      if (!isPopulated(child)) continue;
      const key = safeKey(rawKey);
      const childPath = path ? path + '.' + key : key;
      const mappedRootCategory = !path ? SENSITIVE_ROOTS.get(rawKey) : null;
      const mappedCategory = categoryForKey(rawKey) || mappedRootCategory || inheritedCategory;

      if (mappedRootCategory) add(childPath, mappedRootCategory);
      else if (categoryForKey(rawKey)) add(childPath, categoryForKey(rawKey));
      else if (inheritedCategory && (typeof child !== 'object' || child === null)) add(childPath, inheritedCategory);

      if (typeof child === 'object' && child !== null) {
        const nextInherited = mappedCategory || inheritedCategory;
        // Under a known sensitive root, keep field-path presence only. This
        // provides enough schema detail for planning a split without values.
        if (PRIVATE_CONTAINERS.has(rawKey) && !Array.isArray(child)) add(childPath, mappedRootCategory || 'private_profile');
        walk(child, childPath, nextInherited);
      }
    }
  }

  walk(data || {}, '');

  const paths = [...presentPaths].sort();
  const categories = [...new Set(paths.flatMap(path => [...(pathCategories.get(path) || [])]))].sort();
  return {
    paths,
    categories,
    pathCategories: Object.fromEntries(
      paths.map(path => [path, [...(pathCategories.get(path) || [])].sort()]),
    ),
  };
}

/**
 * Build a privacy-safe inventory from projected Firestore client records.
 * record.data values are inspected in-memory and never copied to the output.
 */
export function buildClientSensitiveDataInventory({
  projectId,
  records,
  generatedAt = new Date().toISOString(),
}) {
  const pathCounts = {};
  const categoryCounts = {};
  const inventoryRecords = [];

  for (const record of records) {
    const data = record?.data && typeof record.data === 'object' ? record.data : {};
    const inspected = inspectClientSensitiveFieldPresence(data);
    for (const path of inspected.paths) pathCounts[path] = (pathCounts[path] || 0) + 1;
    for (const category of inspected.categories) categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    if (inspected.paths.length === 0) continue;
    inventoryRecords.push({
      documentId: typeof record.id === 'string' ? record.id : null,
      organizationId: typeof data.organizationId === 'string' ? data.organizationId : null,
      categories: inspected.categories,
      fieldPaths: inspected.paths,
      pathCategories: inspected.pathCategories,
    });
  }

  return {
    schemaVersion: 1,
    projectId,
    generatedAt,
    sourceCollection: 'clients',
    mode: 'read-only-sensitive-field-inventory',
    noCloudChangesMade: true,
    rawFieldValuesIncluded: false,
    summary: {
      clientRecordsScanned: records.length,
      recordsWithSensitiveOrPrivateFields: inventoryRecords.length,
      fieldPathsFound: Object.keys(pathCounts).length,
      recordsByCategory: categoryCounts,
      pathPresenceCounts: Object.fromEntries(Object.entries(pathCounts).sort(([a], [b]) => a.localeCompare(b))),
    },
    records: inventoryRecords,
    limitations: [
      'Only Firestore field-name presence is inventoried; no field values are included.',
      'Freeform text may contain sensitive content even though its value is never read into the report.',
      'This inventory does not modify records, split fields, update security rules, or migrate data.',
      'Field classification is a review aid, not a legal or regulatory classification decision.',
    ],
  };
}
