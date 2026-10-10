import { registry } from '../src/tools/index.js';
import { validateWriteDeclarations } from '../src/core/write-contract-check.js';
const failures=validateWriteDeclarations(registry.tools);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode=1;
} else {
  console.log('Write safety: '+registry.tools.length+
    ' registered tools have explicit declarations and guarded write/money contracts');
}
