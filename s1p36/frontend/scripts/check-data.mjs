import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS, resolveDatasetPath } from '../src/utils/datasets.js';
import { adaptContract } from '../src/utils/adapters.js';
import { predict, defaultsFor } from '../src/utils/predict.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'public', 'data');
const CORE = ['kpis', 'charts', 'insights'];
let failed = false;

const line = (status, name, message) => console.log(status.padEnd(12) + name.padEnd(18) + (message || ''));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

const contractFile = path.join(dataDir, 'frontend_contract.json');
if (!fs.existsSync(contractFile)) {
  console.error('frontend_contract.json is missing from public/data. Run the backend steps, then npm run check again.');
  process.exit(1);
}
let contract;
try {
  contract = adaptContract(readJson(contractFile));
  line('OK', 'contract', 'schema version ' + contract.schemaVersion);
} catch (err) {
  console.error('INVALID contract: ' + err.message);
  process.exit(1);
}

const results = {};
for (const [name, def] of Object.entries(DATASETS)) {
  const rel = resolveDatasetPath(contract, def);
  const file = path.join(dataDir, rel.replace(/^\/data\//, ''));
  if (!fs.existsSync(file)) {
    results[name] = { status: 'MISSING' };
    line('MISSING', name, rel);
    if (CORE.includes(name)) failed = true;
    continue;
  }
  let raw;
  try {
    raw = readJson(file);
  } catch (err) {
    results[name] = { status: 'INVALID' };
    line('INVALID', name, 'not valid JSON: ' + rel);
    failed = true;
    continue;
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.status === 'skipped') {
    results[name] = { status: 'UNAVAILABLE' };
    line('UNAVAILABLE', name, 'skipped: ' + (raw.reason || 'no reason given'));
    continue;
  }
  try {
    results[name] = { status: 'OK', data: def.adapt(raw) };
    line('OK', name, rel);
  } catch (err) {
    results[name] = { status: 'INVALID' };
    line('INVALID', name, err.message + ' (' + rel + ')');
    failed = true;
  }
}

// Predict page: smoke test the scoring file and say which mode the page will use
let mode = 'unavailable';
const scorer = results.scorer && results.scorer.status === 'OK' ? results.scorer.data : null;
if (scorer) {
  try {
    const out = predict(scorer, defaultsFor(scorer.fields));
    const bad = !Number.isFinite(out.value) || (scorer.task === 'classification' && (out.value < 0 || out.value > 100));
    if (bad) throw new Error('prediction with default values is not a valid number');
    mode = scorer.type === 'linear' ? 'model scoring (linear)' : 'model scoring (nearest neighbour)';
    line('OK', 'predict', 'default prediction ' + out.value.toFixed(2));
    if (scorer.fidelity && scorer.fidelity.quality === 'low') console.log('WARNING     predict           fidelity is low: estimates will be rough');
  } catch (err) {
    line('INVALID', 'predict', err.message);
    failed = true;
  }
} else if (results.forecastLookup && results.forecastLookup.status === 'OK') {
  mode = 'lookup';
} else if (results.forecast && results.forecast.status === 'OK' && results.forecast.data.forecast.length > 0) {
  mode = 'forecast period';
}
console.log('Predict page mode: ' + mode);

// No absolute local paths anywhere in the data
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}
const pathLike = /(^|[^A-Za-z])[A-Za-z]:\\\\?[A-Za-z]|\/Users\/|\/home\//;
for (const file of walk(dataDir, [])) {
  if (pathLike.test(fs.readFileSync(file, 'utf8'))) {
    console.log('INVALID     paths             looks like a local path in ' + path.relative(dataDir, file));
    failed = true;
  }
}

if (failed) {
  console.error('');
  console.error('Data check failed. Fix the items marked INVALID or the missing core files (kpis, charts, insights).');
  process.exit(1);
}
console.log('');
console.log('Data check passed.');
