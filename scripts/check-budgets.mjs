import { registry } from '../src/tools/index.js';
const tools = registry.tools;
if (!tools.length) {
  console.log('0 tools registered — nothing to check');
} else {
  const failures = [];
  for (const t of tools) {
    if ((t.description || '').length > 160) failures.push(`${t.name} description >160 characters`);
  }
  const tokens = (obj) => Math.ceil(JSON.stringify(obj).length / 4);
  if (tokens(tools) > 20000) failures.push('Everyday tool catalog exceeds 20,000 estimated tokens');
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log(`Catalog budget passes for ${tools.length} tools`);
  if (process.argv.includes('--print')) console.log(`Catalog estimated tokens: ${tokens(tools)}`);
}
