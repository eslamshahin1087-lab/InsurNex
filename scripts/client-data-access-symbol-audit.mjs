import ts from 'typescript';
import { readdir } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_ROOTS = ['src', 'functions/src', 'supabase/functions'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const OMIT_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'lib']);
const LEGACY_CLIENT_APIS = new Set(['listClients', 'getClient', 'activateIssuedClientV978']);

function normalizePath(value) {
  return resolve(value).split(sep).join('/').toLowerCase();
}

async function walk(root, collected = []) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return collected;
    throw error;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!OMIT_DIRS.has(entry.name)) await walk(join(root, entry.name), collected);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name)) && !/(?:\.test|\.spec)\.[^.]+$/i.test(entry.name)) {
      collected.push(resolve(root, entry.name));
    }
  }
  return collected;
}

export async function collectClientDataSourceFiles(repositoryRoot = process.cwd()) {
  const root = resolve(repositoryRoot);
  const sourceFiles = [];
  for (const sourceRoot of SOURCE_ROOTS) await walk(join(root, sourceRoot), sourceFiles);
  return sourceFiles;
}

function unwrapSymbol(checker, initial) {
  let symbol = initial;
  const seen = new Set();
  while (symbol && (symbol.flags & ts.SymbolFlags.Alias) && !seen.has(symbol)) {
    seen.add(symbol);
    try {
      symbol = checker.getAliasedSymbol(symbol);
    } catch {
      return undefined;
    }
  }
  return symbol;
}

function getLegacyApi(checker, node, clientServicePath) {
  const symbol = unwrapSymbol(checker, checker.getSymbolAtLocation(node));
  if (!symbol || !LEGACY_CLIENT_APIS.has(symbol.getName())) return undefined;
  const target = (symbol.getDeclarations() || []).some(declaration =>
    normalizePath(declaration.getSourceFile().fileName) === clientServicePath,
  );
  return target ? symbol.getName() : undefined;
}

function callLocation(sourceFile, node, repositoryRoot) {
  return {
    path: relative(repositoryRoot, sourceFile.fileName).split(sep).join('/'),
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
  };
}

function literalClientCollection(node) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text === 'clients' || node.text.startsWith('clients/');
  }
  if (ts.isTemplateExpression(node)) {
    return node.head.text === 'clients/' || node.head.text === 'clients';
  }
  return false;
}

export function auditClientDataAccessSymbols(rootFiles, repositoryRoot = process.cwd()) {
  const root = resolve(repositoryRoot);
  const clientServicePath = normalizePath(join(root, 'src/features/clients/client.service.ts'));
  const program = ts.createProgram({
    rootNames: rootFiles.map(file => resolve(file)),
    options: {
      allowJs: true,
      checkJs: false,
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2023,
      jsx: ts.JsxEmit.ReactJSX,
      skipLibCheck: true,
      noEmit: true,
    },
  });
  const checker = program.getTypeChecker();
  const imports = [];
  const callSites = [];
  const dynamicClientServiceImports = [];
  const clientCollectionCallSites = [];

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.fileName);
    if (!filePath.startsWith(normalizePath(root) + '/')) continue;
    const repositoryPath = relative(root, sourceFile.fileName).split(sep).join('/');
    if (!SOURCE_ROOTS.some(sourceRoot => repositoryPath.startsWith(sourceRoot + '/'))) continue;
    if (/(?:\.test|\.spec)\.[^.]+$/i.test(sourceFile.fileName)) continue;

    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        const bindings = clause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const specifier of bindings.elements) {
            const api = getLegacyApi(checker, specifier.name, clientServicePath);
            if (api) imports.push({ ...callLocation(sourceFile, specifier.name, root), api, localName: specifier.name.text });
          }
        }
      }
    }

    function visit(node) {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const callee = ts.isPropertyAccessExpression(expression) ? expression.name : expression;
        const api = getLegacyApi(checker, callee, clientServicePath);
        if (api) callSites.push({ ...callLocation(sourceFile, node, root), api });

        const functionName = ts.isIdentifier(callee) ? callee.text : '';
        if ((functionName === 'collection' || functionName === 'doc')
          && node.arguments.slice(0, 2).some(literalClientCollection)) {
          clientCollectionCallSites.push({ ...callLocation(sourceFile, node, root), operation: functionName });
        }

        if (expression.kind === ts.SyntaxKind.ImportKeyword) {
          const specifier = node.arguments[0];
          if (specifier && ts.isStringLiteralLike(specifier) && /(?:^|\/)client\.service(?:\.[cm]?[jt]s)?$/.test(specifier.text)) {
            dynamicClientServiceImports.push(callLocation(sourceFile, node, root));
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  const sortLocations = values => values.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || (a.api || '').localeCompare(b.api || ''));
  return {
    schemaVersion: 1,
    mode: 'typescript-symbol-client-data-access-audit',
    sourceFiles: rootFiles.length,
    legacyApiImports: sortLocations(imports),
    legacyApiCallSites: sortLocations(callSites),
    dynamicClientServiceImports: sortLocations(dynamicClientServiceImports),
    clientCollectionCallSites: sortLocations(clientCollectionCallSites),
    limitations: [
      'The audit resolves static TypeScript/JavaScript symbols and literal collection paths; it does not prove runtime data flow.',
      'Dynamic imports, reflection, generated code, runtime aliases, and calls hidden behind non-TypeScript boundaries require manual review.',
      'A call-site inventory is evidence for review, not authorization to broaden access or migrate data.',
    ],
  };
}

async function main() {
  const root = resolve(process.cwd());
  const sourceFiles = await collectClientDataSourceFiles(root);
  const report = auditClientDataAccessSymbols(sourceFiles, root);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const safe = error instanceof Error ? error.message : 'Unknown error';
    console.error('Client data-access symbol audit failed: ' + safe.slice(0, 200));
    process.exitCode = 1;
  });
}

