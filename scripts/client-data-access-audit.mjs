import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_ROOTS = ['src', 'functions/src', 'supabase/functions'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'lib']);
const EXCLUDED_FILE = /(?:\.test|\.spec)\.[^.]+$/i;

const SENSITIVE_FIELD_TOKENS = [
  'nationalId',
  'taxId',
  'commercialRegister',
  'taxCard',
  'authorizedSignatoryNid',
  'dateOfBirth',
  'monthlyIncome',
  'annualSalary',
  'healthStatus',
  'generalStatus',
  'chronicConditions',
  'medications',
  'surgeries',
  'smoker',
  'dependents',
  'individual',
  'corporate',
  'riskData',
  'riskAssessment',
  'aiAnalysis',
  'documents',
  'notes',
];

const FIRESTORE_READ_OPERATIONS = ['getDoc', 'getDocs', 'onSnapshot'];
const FIRESTORE_WRITE_OPERATIONS = ['addDoc', 'setDoc', 'updateDoc', 'deleteDoc', 'runTransaction', 'writeBatch'];
const FIRESTORE_OPERATIONS = [...FIRESTORE_READ_OPERATIONS, ...FIRESTORE_WRITE_OPERATIONS];

const CLIENT_COLLECTION_REFERENCE = /\b(?:collection|doc)\s*\([^)]{0,180}['"`]clients['"`]/s;
const DOCUMENT_COLLECTION_REFERENCE = /\bcollection\s*\([^)]{0,180}['"`]documents['"`]/s;
const FULL_DOCUMENT_SPREAD = /\.\.\.\s*[A-Za-z_$][\w$]*\.data\s*\(\s*\)/;
const IN_MEMORY_CLIENT_DOCUMENT_FILTER = /\.filter\s*\([^)]{0,500}\brelatedType\b[^)]{0,500}\brelatedId\b[^)]{0,500}\)/s;

function normalizePath(value) {
  return String(value || '').split(sep).join('/');
}

function collectTokens(content, tokens) {
  return tokens.filter(token => new RegExp("\\b" + token + "\\b").test(content));
}

function collectLineSignals(content) {
  const lines = content.split(/\r?\n/);
  const signals = new Map();
  const add = (line, signal) => {
    if (!signals.has(line)) signals.set(line, new Set());
    signals.get(line).add(signal);
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (/\b(?:collection|doc)\s*\([^)]{0,180}["']clients["']/.test(line)) {
      add(lineNumber, 'clients_collection_reference');
    }
    if (/\bcollection\s*\([^)]{0,180}["']documents["']/.test(line)) {
      add(lineNumber, 'documents_collection_reference');
    }
    if (/["']clients\//.test(line)) add(lineNumber, 'clients_document_path_reference');

    for (const operation of FIRESTORE_OPERATIONS) {
      if (new RegExp("\\b" + operation + "\\s*\\(").test(line)) {
        add(lineNumber, 'firestore_operation:' + operation);
      }
    }
    for (const field of SENSITIVE_FIELD_TOKENS) {
      if (new RegExp("\\b" + field + "\\b").test(line)) {
        add(lineNumber, 'sensitive_field_identifier:' + field);
      }
    }
  });

  return [...signals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([line, values]) => ({ line, signals: [...values].sort() }));
}
/**
 * Static, heuristic source audit. It reads source files only; it does not load
 * Firestore, Storage, customer documents, environment values or secrets.
 * Output contains source paths, API names and field identifiers, never values.
 */
export function auditClientDataAccessFiles(files) {
  const results = [];

  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') continue;
    const content = file.content;
    const clientCollectionReference = CLIENT_COLLECTION_REFERENCE.test(content);
    const documentCollectionReference = DOCUMENT_COLLECTION_REFERENCE.test(content);
    const sensitiveFieldSignals = collectTokens(content, SENSITIVE_FIELD_TOKENS);
    const firestoreOperations = collectTokens(content, FIRESTORE_OPERATIONS);
    const firestoreReadOperations = firestoreOperations.filter(token => FIRESTORE_READ_OPERATIONS.includes(token));
    const firestoreWriteOperations = firestoreOperations.filter(token => FIRESTORE_WRITE_OPERATIONS.includes(token));
    const clientAccessClassification = !clientCollectionReference
      ? 'no_client_collection_reference_detected'
      : firestoreReadOperations.length > 0 && firestoreWriteOperations.length > 0
        ? 'mixed_read_write_candidate'
        : firestoreReadOperations.length > 0
          ? 'read_candidate'
          : firestoreWriteOperations.length > 0
            ? 'write_candidate'
            : 'collection_reference_without_operation_signal';
    const lineSignals = collectLineSignals(content);
    const findings = [];

    if (clientCollectionReference && sensitiveFieldSignals.length > 0) {
      findings.push('client_collection_and_sensitive_field_signals_same_file');
    }
    if (clientCollectionReference && FULL_DOCUMENT_SPREAD.test(content)) {
      findings.push('full_document_snapshot_spread');
    }

    const relationFilteredInMemory = documentCollectionReference && IN_MEMORY_CLIENT_DOCUMENT_FILTER.test(content);
    const hasRelatedTypeQuery = /\bwhere\s*\(\s*['"`]relatedType['"`]\s*,\s*['"`]===?['"`]\s*,\s*['"`]client['"`]\s*\)/.test(content);
    const hasRelatedIdQuery = /\bwhere\s*\(\s*['"`]relatedId['"`]\s*,\s*['"`]===?['"`]\s*,\s*[A-Za-z_$][\w$]*\s*\)/.test(content);

    if (relationFilteredInMemory && !(hasRelatedTypeQuery && hasRelatedIdQuery)) {
      findings.push('client_document_relation_filter_after_fetch');
    }
    if (clientCollectionReference && sensitiveFieldSignals.some(token => [
      'nationalId', 'taxId', 'commercialRegister', 'taxCard', 'authorizedSignatoryNid',
      'dateOfBirth', 'monthlyIncome', 'annualSalary', 'healthStatus', 'generalStatus',
      'chronicConditions', 'medications', 'surgeries', 'smoker', 'dependents',
      'individual', 'corporate', 'riskData',
    ].includes(token)) && firestoreOperations.some(token => ['addDoc', 'setDoc', 'updateDoc'].includes(token))) {
      findings.push('client_write_path_has_sensitive_field_signals');
    }

    const isRelevant = clientCollectionReference || documentCollectionReference ||
      sensitiveFieldSignals.length > 0;
    if (!isRelevant) continue;

    results.push({
      path: normalizePath(file.path),
      clientCollectionReference,
      documentCollectionReference,
      firestoreOperations,
      firestoreReadOperations,
      firestoreWriteOperations,
      clientAccessClassification,
      operationScope: 'file-level-heuristic-not-proven-callsite-dataflow',
      lineSignals,
      sensitiveFieldSignals,
      findings,
    });
  }

  results.sort((a, b) => a.path.localeCompare(b.path));
  return {
    schemaVersion: 1,
    mode: 'static-client-data-access-audit',
    heuristicOnly: true,
    noCloudAccess: true,
    noCustomerDocumentsRead: true,
    noFieldValuesIncluded: true,
    summary: {
      sourceFilesAnalyzed: files.filter(file => file && typeof file.content === 'string').length,
      relevantFiles: results.length,
      filesReferencingClientsCollection: results.filter(item => item.clientCollectionReference).length,
      filesWithSensitiveFieldSignals: results.filter(item => item.sensitiveFieldSignals.length > 0).length,
      filesWithClientReadCandidates: results.filter(item => item.clientAccessClassification === 'read_candidate' || item.clientAccessClassification === 'mixed_read_write_candidate').length,
      filesWithClientWriteCandidates: results.filter(item => item.clientAccessClassification === 'write_candidate' || item.clientAccessClassification === 'mixed_read_write_candidate').length,
      filesWithClientMixedReadWriteCandidates: results.filter(item => item.clientAccessClassification === 'mixed_read_write_candidate').length,
      lineLevelSignalCount: results.reduce((total, item) => total + item.lineSignals.length, 0),
      filesWithFindings: results.filter(item => item.findings.length > 0).length,
      fullDocumentSnapshotSpreadFiles: results.filter(item => item.findings.includes('full_document_snapshot_spread')).length,
      inMemoryDocumentRelationFilterFindings: results.filter(item => item.findings.includes('client_document_relation_filter_after_fetch')).length,
    },
    findings: results,
    limitations: [
      'This is a heuristic source-code inventory, not an AST, data-flow, authorization or legal-compliance proof.',
      'A file-level signal does not prove that every named field flows through the detected operation.',
      'Review every production read/write caller and trusted endpoint before enabling separated collections or migrating records.',
    ],
  };
}

async function walk(root, base) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }

  const output = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      output.push(...await walk(join(root, entry.name), base));
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name)) || EXCLUDED_FILE.test(entry.name)) continue;
    const absolutePath = join(root, entry.name);
    output.push({
      path: normalizePath(relative(base, absolutePath)),
      content: await readFile(absolutePath, 'utf8'),
    });
  }
  return output;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--root' || arg.startsWith('--root=')) {
      const value = arg.startsWith('--root=') ? arg.slice('--root='.length) : argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--root requires a directory path');
      if (arg === '--root') index += 1;
      args.root = resolve(value);
      continue;
    }
    throw new Error('Unknown argument: ' + arg);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('InsurNex static client-data access audit (no cloud access)\n\nUsage: node scripts/client-data-access-audit.mjs [--root <repo-root>]\n\nOutput contains source paths, field identifiers and heuristic signals only; no customer values.');
    return;
  }

  const root = resolve(args.root);
  const files = [];
  for (const relativeRoot of SOURCE_ROOTS) {
    files.push(...await walk(join(root, relativeRoot), root));
  }
  const report = auditClientDataAccessFiles(files);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const safeMessage = message.split(String.fromCharCode(13)).join(' ').split(String.fromCharCode(10)).join(' ').slice(0, 220);
    console.error('Client data-access audit failed: ' + safeMessage);
    process.exitCode = 1;
  });
}
