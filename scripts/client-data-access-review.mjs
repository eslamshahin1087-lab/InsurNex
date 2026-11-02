import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { auditClientDataAccessFiles } from './client-data-access-audit.mjs';
import { privacySafeReview } from './client-data-access-review-policy.mjs';

const SOURCE_ROOTS = ['src', 'functions/src', 'supabase/functions'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'lib']);
const EXCLUDED_FILE = /(?:\\.test|\\.spec)\\.[^.]+$/i;

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
      if (!EXCLUDED_DIRS.has(entry.name)) output.push(...await walk(join(root, entry.name), base));
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name)) || EXCLUDED_FILE.test(entry.name)) continue;
    const absolutePath = join(root, entry.name);
    output.push({ path: relative(base, absolutePath).split(sep).join('/'), content: await readFile(absolutePath, 'utf8') });
  }
  return output;
}

async function main() {
  const root = resolve(process.cwd());
  const files = [];
  for (const sourceRoot of SOURCE_ROOTS) files.push(...await walk(join(root, sourceRoot), root));
  const output = privacySafeReview(auditClientDataAccessFiles(files));
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const safe = error instanceof Error ? error.message : 'Unknown error';
    console.error('Client data-access review report failed: ' + safe.slice(0, 200));
    process.exitCode = 1;
  });
}
