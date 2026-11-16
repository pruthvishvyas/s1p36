import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(root, '..', 'backend', 'output');
const target = path.resolve(root, 'public', 'data');

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(full) : 1;
  }
  return n;
}

function generatedAt(dir) {
  try {
    const text = fs.readFileSync(path.join(dir, 'frontend_contract.json'), 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(text).generated_at || 'unknown';
  } catch {
    return 'unknown';
  }
}

if (fs.existsSync(source)) {
  if (!target.endsWith(path.join('public', 'data'))) {
    console.error('Refusing to write outside public/data');
    process.exit(1);
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log('Data refreshed: ' + countFiles(target) + ' files, generated at ' + generatedAt(target));
} else if (fs.existsSync(path.join(target, 'frontend_contract.json'))) {
  console.log('Using the existing data copy (generated at ' + generatedAt(target) + ')');
} else {
  console.error('No data found.');
  console.error('In the backend folder run main.py and then export_for_frontend.py, then run this again.');
  process.exit(1);
}
