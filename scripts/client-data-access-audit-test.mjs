import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditClientDataAccessFiles } from './client-data-access-audit.mjs';

const fixtures = [
  {
    path: 'src/features/clients/client.service.ts',
    content: `
      import { collection, addDoc, getDocs } from 'firebase/firestore';
      const source = collection(db, 'clients');
      const data = {
        nationalId: 'RAW_PRIVATE_SENTINEL',
        riskData: { healthStatus: 'RAW_MEDICAL_SENTINEL' },
        notes: 'RAW_NOTES_SENTINEL'
      };
      await addDoc(source, data);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    `,
  },
  {
    path: 'src/features/documents/client-documents-v8.service.ts',
    content: `
      const snapshot = await getDocs(query(collection(db, 'documents'), where('organizationId', '==', organizationId)));
      return snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
        .filter(item => item.relatedType === 'client' && item.relatedId === clientId);
    `,
  },
  {
    path: 'supabase/functions/copilot-chat/index.ts',
    content: 'const policy = { allowClientContext: false };',
  },
];

const report = auditClientDataAccessFiles(fixtures);
assert.equal(report.mode, 'static-client-data-access-audit');
assert.equal(report.noCloudAccess, true);
assert.equal(report.noCustomerDocumentsRead, true);
assert.equal(report.noFieldValuesIncluded, true);
assert.equal(report.summary.filesReferencingClientsCollection, 1);
assert.equal(report.summary.fullDocumentSnapshotSpreadFiles, 1);
assert.equal(report.summary.inMemoryDocumentRelationFilterFindings, 1);

const clientFile = report.findings.find(item => item.path.endsWith('client.service.ts'));
assert.ok(clientFile);
assert.ok(clientFile.sensitiveFieldSignals.includes('nationalId'));
assert.ok(clientFile.sensitiveFieldSignals.includes('riskData'));
assert.ok(clientFile.findings.includes('client_write_path_has_sensitive_field_signals'));
assert.equal(JSON.stringify(report).includes('RAW_PRIVATE_SENTINEL'), false);
assert.equal(JSON.stringify(report).includes('RAW_MEDICAL_SENTINEL'), false);
assert.equal(JSON.stringify(report).includes('RAW_NOTES_SENTINEL'), false);

const fixedDocumentFixture = auditClientDataAccessFiles([{
  path: 'src/features/documents/client-documents-v8.service.ts',
  content: `
    const constraints = [
      where('organizationId', '==', organizationId),
      where('relatedType', '==', 'client'),
      where('relatedId', '==', clientId),
    ];
    const snapshot = await getDocs(query(collection(db, 'documents'), ...constraints));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  `,
}]);
assert.equal(fixedDocumentFixture.summary.inMemoryDocumentRelationFilterFindings, 0);

const actualDocumentService = await readFile(
  new URL('../src/features/documents/client-documents-v8.service.ts', import.meta.url),
  'utf8',
);
assert.match(actualDocumentService, /where\('relatedType',\s*'==',\s*'client'\)/);
assert.match(actualDocumentService, /where\('relatedId',\s*'==',\s*clientId\)/);
assert.doesNotMatch(actualDocumentService, /\.filter\(item\s*=>\s*item\.relatedType\s*===\s*'client'/);

console.log('Client data-access audit and document-query minimization tests passed.');
