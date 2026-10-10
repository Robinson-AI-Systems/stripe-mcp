import { registry } from '../src/tools/index.js';
if (!registry.tools.length) {
  console.log('0 tools registered — nothing to check');
} else {
  const failures = [];
  for (const tool of registry.tools) {
    if (!tool.writes) continue;
    const p = tool.inputSchema?.properties;
    if (!p?.dryRun || !p?.confirm) failures.push(`${tool.name}: missing dryRun/confirm`);
    if (!tool.writeContract) failures.push(`${tool.name}: missing declared write contract`);
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log(`Write safety: ${registry.tools.length} tools checked`);
}
