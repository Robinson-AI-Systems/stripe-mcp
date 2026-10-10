// Human-oriented Stripe output shaping: preserve the original fields and add
// display companions. Never silently truncate or expose credential-shaped data.
const ZONE = 'America/Denver';
const SECRET_FIELD = /^(?:client[_-]?secret|secret|api[_-]?key|stripe[_-]?key|private[_-]?key|webhook[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|passphrase|token[_-]?secret)$/i;
const SENSITIVE_TEXT = /\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]{6,}|\bwhsec_[A-Za-z0-9]{6,}|\bBearer\s+[A-Za-z0-9._-]{16,}/gi;
const DATE_FIELDS = /^(?:created|updated|timestamp|date|[a-z_]*(?:_at|_date|_timestamp|_start|_end)|current_period_start|current_period_end|trial_start|trial_end)$/i;
const AMOUNT_FIELDS = /^(?:amount|amount_[a-z_]+|unit_amount|unit_amount_decimal|subtotal|total|balance|fee|fee_amount|tax|tax_amount|net|money_limit_cents|money_used_today_cents|moneyLimitCents|moneyUsedTodayCents|[a-z_]+_amount|[a-z_]+Cents)$/;
const formatterCache = new Map();

function safeString(text) {
  return text.replace(SENSITIVE_TEXT, '[hidden]');
}
function decimalsFor(currency) {
  if (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency)) return null;
  const code=currency.toUpperCase();
  if (!formatterCache.has(code)) {
    try {
      const fmt=new Intl.NumberFormat('en-US',{style:'currency',currency:code});
      const digits=fmt.resolvedOptions().maximumFractionDigits;
      formatterCache.set(code,{fmt,digits});
    } catch { return null; }
  }
  return formatterCache.get(code);
}
export function displayCurrencyMinor(value,currency) {
  if (!Number.isSafeInteger(value)) return null;
  const options=decimalsFor(currency);
  if (!options) return null;
  const major=value / (10 ** options.digits);
  if (!Number.isFinite(major)) return null;
  return options.fmt.format(major);
}
export function denverLocalTime(value) {
  if (!Number.isSafeInteger(value) || value < 946684800 || value > 4102444800) return null;
  return new Intl.DateTimeFormat('en-US',{
    timeZone:ZONE,year:'numeric',month:'short',day:'2-digit',hour:'2-digit',
    minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'short'
  }).format(new Date(value*1000));
}
function isSecretKey(key) {
  // camelCase and kebab-case must receive the same protection.
  const normalized=key.replace(/([a-z])([A-Z])/g,'$1_$2');
  return SECRET_FIELD.test(normalized);
}
function amountField(key) {
  const normalized=key.replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase();
  return AMOUNT_FIELDS.test(normalized) && normalized!=='amount_refunded_count';
}
function dateField(key) {
  return DATE_FIELDS.test(key.replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase());
}
function walk(value,parentCurrency,seen) {
  if (typeof value==='string') return safeString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) throw new TypeError('Circular provider result cannot be safely displayed');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map(item=>walk(item,parentCurrency,seen));
    const currentCurrency=typeof value.currency==='string' ? value.currency : parentCurrency;
    const output={};
    for (const [key,item] of Object.entries(value)) {
      if (isSecretKey(key)) {
        output[key]='[hidden]';
        continue;
      }
      output[key]=walk(item,currentCurrency,seen);
      if (Number.isSafeInteger(item) && amountField(key) && currentCurrency) {
        const display=displayCurrencyMinor(item,currentCurrency);
        if (display!==null && !Object.hasOwn(value,key+'_display')) output[key+'_display']=display;
      }
      if (Number.isSafeInteger(item) && dateField(key)) {
        const local=denverLocalTime(item);
        if (local && !Object.hasOwn(value,key+'_local')) output[key+'_local']=local;
      }
    }
    return output;
  } finally { seen.delete(value); }
}
/**
 * Return a new value; preserve all original fields, add human-readable
 * companions, and redact credentials at every nesting level.
 */
export function compact(value,{mode=null,currency=null}={}) {
  const result=walk(value,currency,new WeakSet());
  if (mode==='live' || mode==='LIVE') {
    if (result && typeof result==='object' && !Array.isArray(result)) {
      return { ...result, mode:'LIVE' };
    }
    return {mode:'LIVE',value:result};
  }
  return result;
}
/**
 * Shape MCP result text without affecting tool metadata, non-text blocks,
 * or the caller's original object. This is an output-only safety layer.
 */
export function shapeToolResult(result,options={}) {
  if (!result || !Array.isArray(result.content)) return result;
  return {...result,content:result.content.map(part=>{
    if (part?.type!=='text' || typeof part.text!=='string') return part;
    let data;
    try { data=JSON.parse(part.text); }
    catch { return {...part,text:safeString(part.text)}; }
    return {...part,text:JSON.stringify(compact(data,options))};
  })};
}
