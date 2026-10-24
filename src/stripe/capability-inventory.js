// CAP-1: conservative, offline capability evidence from the checksum-pinned Stripe API and actual tool registry.
// Listing an operation, finding a native tool name or identifying a universal candidate is NOT provider proof.
import { catalog, apiVersion } from './openapi-index.js';
import { preferredNative } from './hand-built-map.js';
import { financialDecision } from './money-operations.js';
import { registry } from '../tools/index.js';
import { SOURCE_GIT_BLOB, SOURCE_SHA256 } from '../../scripts/stripe-openapi.mjs';

export const CAPABILITY_SCHEMA_VERSION = 1;
export const CREDENTIAL_KINDS = Object.freeze([
  'account_secret', 'account_restricted', 'stripe_app_oauth',
  'connect_oauth', 'organization_secret'
]);
export const OUTSIDE_PINNED_SCHEMA = Object.freeze([
  { family: 'api_v2', disposition: 'not-in-this-pinned-v1-inventory',
    note: 'Inventory API v2 independently against its official versioned contract before claiming parity.' },
  { family: 'organization_context', disposition: 'not-in-this-pinned-v1-inventory',
    note: 'Organization-key routes, Stripe-Context and exact account entitlements need their own provider contract.' },
  { family: 'stripe_app_installation', disposition: 'not-in-this-pinned-v1-inventory',
    note: 'A Stripe App OAuth installation is not a user identity or a blanket API credential.' }
]);
const VERBS = new Set(['GET','POST','DELETE','PUT','PATCH']);
const SENSITIVE = /\b(secret|ephemeral_keys|tokens|person|bank_account|files|identity\/verification|issuing\/cardholders)\b/i;
const rowKey = record => record.method + ' ' + record.path;
const familyFor = path => path.split('/').filter(Boolean)[1] || 'unclassified';
const lexical = (a,b) => a.localeCompare(b,'en');
const compareRows = (a,b) => lexical(a.path,b.path) || lexical(a.method,b.method);
const invalid = message => { throw new TypeError('Capability inventory: ' + message); };
const credentialKinds = () => Object.fromEntries(CREDENTIAL_KINDS.map(kind => [kind, {
  disposition: 'unknown',
  note: 'Operation-specific grant, Stripe product/country entitlement and connected-account scope require reviewed provider evidence.'
}]));
function sourceStatus(record, names) {
  const claimed = preferredNative(record);
  if (claimed && names.has(claimed)) return { disposition: 'mapped-native-candidate',
    nativeTool: claimed, registeredHandler: true, providerVerified: false };
  // Universal execution checks request schema, profile, account, ownership, secrets,
  // money and provider readback at invocation time. GET eligibility is only a candidate.
  if (record.method === 'GET' && record.path.startsWith('/v1/') &&
      !SENSITIVE.test(record.path) && names.has('api_read'))
    return { disposition: 'guarded-universal-read-candidate',
      nativeTool: null, registeredHandler: true, providerVerified: false };
  // Do not claim unreviewed POST/DELETE support based on an OpenAPI schema or generic dispatcher.
  return { disposition: 'schema-discovery-only', nativeTool: null,
    registeredHandler: false, providerVerified: false };
}
export function buildCapabilityInventory({
  api = catalog(), tools = registry.tools, pinnedSha = SOURCE_SHA256
} = {}) {
  if (!api || !(api.operations instanceof Map) || api.operations.size === 0 ||
      !Array.isArray(tools) || typeof pinnedSha !== 'string' || !pinnedSha)
    invalid('a pinned catalog, tool registry and checksum are required');
  const names = new Set();
  for (const tool of tools) {
    if (typeof tool?.name !== 'string' || !tool.name || names.has(tool.name))
      invalid('tool registry has an invalid or duplicate name');
    names.add(tool.name);
  }
  const operations = [...api.operations.values()].map(record => {
    if (!record || typeof record.id !== 'string' || !record.id ||
        !VERBS.has(record.method) || typeof record.path !== 'string' ||
        !record.path.startsWith('/v1/')) invalid('malformed pinned operation');
    const financial = financialDecision(record);
    return {
      key: rowKey(record), operationId: record.id, method: record.method,
      path: record.path, family: familyFor(record.path), host: 'api.stripe.com',
      apiVersion, pinnedSourceSha256: pinnedSha,
      summary: String(record.summary || '').slice(0,180),
      effect: record.method === 'GET' ? 'read' :
        financial.financial ? 'conservatively-financial-or-irreversible' : 'unclassified-mutation',
      credentials: credentialKinds(),
      providerPermission: 'unknown',
      requiredAccountRole: 'unknown',
      productCountryEntitlement: 'unknown',
      selectedTenantAndResource: 'server-verification-required',
      source: sourceStatus(record,names),
      tests: { unit: [], mock: [], database: [], realProvider: [] },
      liveAcceptance: { disposition: 'not-linked-to-independent-ledger', deployedSource: null },
      note: 'Code-path candidate is not provider execution or permission evidence.'
    };
  }).sort(compareRows);
  // A named native tool does not prove a specific upstream operation. Expose every
  // unmatched registry entry explicitly so the next CAP work can review it.
  const nativeMap = new Map();
  for (const operation of operations) {
    if (!operation.source.nativeTool) continue;
    const existing = nativeMap.get(operation.source.nativeTool) || [];
    existing.push(operation.key);
    nativeMap.set(operation.source.nativeTool,existing);
  }
  const registeredTools = tools.map(tool => ({
    name:tool.name, area:tool.area || 'unclassified',
    writes:tool.writes === true,
    mappedPinnedOperations:[...(nativeMap.get(tool.name) || [])].sort(lexical),
    evidence:nativeMap.has(tool.name) ? 'source-native-name-mapping-only'
      : 'not-mapped-to-pinned-operation'
  })).sort((a,b)=>lexical(a.name,b.name));
  const tally = new Map();
  for (const row of operations) {
    let family = tally.get(row.family);
    if (!family) { family = {family:row.family,operations:0,mappedNativeCandidates:0,
      guardedUniversalReadCandidates:0,discoveryOnly:0,providerVerified:'not-measured'};tally.set(row.family,family); }
    family.operations++;
    if (row.source.disposition === 'mapped-native-candidate') family.mappedNativeCandidates++;
    else if (row.source.disposition === 'guarded-universal-read-candidate') family.guardedUniversalReadCandidates++;
    else family.discoveryOnly++;
  }
  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    source: { name:'pinned-stripe-sdk-openapi', apiVersion,
      sha256:pinnedSha, gitBlob:SOURCE_GIT_BLOB },
    interpretation: 'Offline coverage candidates only. No provider-backed operation, role or credential parity is inferred.',
    operations,
    registeredTools,
    families:[...tally.values()].sort((a,b) => lexical(a.family,b.family)),
    outsidePinnedSchema:OUTSIDE_PINNED_SCHEMA.map(x=>({...x})),
    independentLiveLedger:'docs/STATUS.md (not auto-joined; do not overwrite historical PASS records)'
  };
}
export function validateCapabilityInventory(inventory, {
  api = catalog(), tools = registry.tools, pinnedSha = SOURCE_SHA256
} = {}) {
  if (inventory?.schemaVersion !== CAPABILITY_SCHEMA_VERSION ||
      inventory?.source?.sha256 !== pinnedSha ||
      inventory?.source?.apiVersion !== apiVersion ||
      !Array.isArray(inventory.operations) ||
      inventory.operations.length !== api.operations.size) invalid('schema identity or complete operation count drift');
  const ids = new Set(), keys = new Set();
  const expected = new Map([...api.operations.values()].map(row => [rowKey(row),row]));
  for (const row of inventory.operations) {
    const original = expected.get(row?.key);
    if (!original || row.method !== original.method || row.path !== original.path ||
        row.operationId !== original.id ||
        row.pinnedSourceSha256 !== pinnedSha || ids.has(row.operationId) ||
        keys.has(row.key)) invalid('duplicate, orphan or mismatched method/path/operation ID');
    ids.add(row.operationId);keys.add(row.key);
    if (!CREDENTIAL_KINDS.every(k => ['unknown','supported','unsupported'].includes(row.credentials?.[k]?.disposition)) ||
        Object.keys(row.credentials || {}).length !== CREDENTIAL_KINDS.length ||
        typeof row.productCountryEntitlement !== 'string' ||
        typeof row.providerPermission !== 'string' ||
        typeof row.requiredAccountRole !== 'string' ||
        typeof row.effect !== 'string' ||
        !['mapped-native-candidate','guarded-universal-read-candidate','schema-discovery-only'].includes(row.source?.disposition) ||
        row.source?.providerVerified !== false ||
        !Array.isArray(row.tests?.realProvider) ||
        row.liveAcceptance?.disposition !== 'not-linked-to-independent-ledger')
      invalid('a required evidence/authority disposition is missing or asserts unverified provider execution');
  }
  if (new Set(inventory.operations.map(r=>r.key)).size !== expected.size ||
      inventory.operations.some((r,i) => i && compareRows(inventory.operations[i-1],r) > 0))
    invalid('missing or unsorted pinned operation');
  const regen = buildCapabilityInventory({api,tools,pinnedSha});
  if (JSON.stringify(inventory) !== JSON.stringify(regen))
    invalid('source registry, family counts or schema-derived report drift');
  return {operationCount:inventory.operations.length,familyCount:inventory.families.length,
    pinnedSha, verification:'offline-schema-and-source-consistency-only'};
}
