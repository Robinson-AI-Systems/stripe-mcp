// Guard Stripe records owned by applications that run their own billing.
// Prior to Batch P, this is the verified Appliance Desk metadata-key list.
export const APP_METADATA_KEYS = Object.freeze([
  'agreementId', 'estimateId', 'depositId', 'invoiceId', 'refundId',
  'creditId', 'rentalLineId', 'customerId', 'sessionId', 'kind',
  'rdf_record_id', 'rdf_payload_hash', 'rateVersionId', 'firstDeliveredOn'
]);
export const APP_NAME = 'Robinson Appliance Rentals';
const customerRef = object => object?.customer ?? object?.customer_id ?? object?.customerId;
const completeCustomer = customer => customer && typeof customer === 'object' &&
  !Array.isArray(customer) && customer.deleted !== true &&
  customer.metadata && typeof customer.metadata === 'object' &&
  !Array.isArray(customer.metadata);

function markerOf(object) {
  const m=object?.metadata;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const key=APP_METADATA_KEYS.find(k=>Object.hasOwn(m,k));
  return key ? {key,value:String(m[key] ?? ''),agreementId:typeof m.agreementId==='string'
    ? m.agreementId : null} : null;
}

/**
 * Return an app marker or { unknown:true } when a customer relationship cannot
 * be safely checked. Unknown ownership is NEVER permission to write.
 */
export async function findAppOwnership(before, ctx = {}) {
  if (!before || typeof before !== 'object' || Array.isArray(before)) {
    return {unknown:true,reason:'Stripe target could not be read'};
  }
  const own=markerOf(before);
  if (own) return {app:APP_NAME,recordId:before.id ?? null,...own,via:'object'};
  const customer=customerRef(before);
  if (customer == null) return null;
  if (typeof customer==='object') {
    if (!completeCustomer(customer)) {
      return {unknown:true,reason:'Expanded customer metadata is missing or deleted'};
    }
    const m=markerOf(customer);
    return m ? {app:APP_NAME,recordId:before.id ?? customer.id ?? null,...m,
      via:'customer'} : null;
  }
  if (typeof customer!=='string' || !customer.startsWith('cus_')) {
    return {unknown:true,reason:'Cannot verify Stripe customer ownership'};
  }
  if (typeof ctx.getCustomer !== 'function') {
    return {unknown:true,reason:'Customer ownership lookup is unavailable'};
  }
  try {
    const record=await ctx.getCustomer(customer);
    if (!completeCustomer(record)) throw Error('Incomplete or deleted customer');
    const m=markerOf(record);
    return m ? {app:APP_NAME,recordId:before.id ?? customer,...m,via:'customer'} : null;
  } catch {
    return {unknown:true,reason:'Customer ownership verification failed'};
  }
}
export function ownerScreen(marker) {
  return ['agreementId','rentalLineId','firstDeliveredOn'].includes(marker?.key)
    ? '/desk/rentals' : '/desk/billing';
}
export function appOwnedDenial(marker) {
  if (marker?.unknown) return marker.reason+'; action refused until ownership is known';
  const label=marker.agreementId ? ' agreement '+marker.agreementId : '';
  return marker.app+' owns Stripe record '+(marker.recordId ?? '(unknown ID)')+
    label+'. Changing it outside the rental app could desynchronize billing. Use '+
    ownerScreen(marker)+' instead, or explicitly set outsideApp: true if appropriate.';
}
export async function protectAppOwnedTarget(args, ctx, before,
  {refundException=false, returnOwnership=false}={}) {
  const ownership=await findAppOwnership(before,ctx);
  if (!ownership) return true;
  if (ownership.unknown) return appOwnedDenial(ownership);
  if (refundException) return returnOwnership ?
    {allowed:true,ownership} : true; // B-1 owner money grant remains mandatory.
  if (args?.outsideApp === true) return true;
  return appOwnedDenial(ownership);
}
export async function annotateAppRead(object,ctx) {
  const marker=await findAppOwnership(object,ctx);
  if (!marker || marker.unknown) return object;
  return {...object,appRecord:{app:marker.app,
    ...(marker.agreementId?{agreementId:marker.agreementId}:{}),
    recordId:marker.recordId,metadataKey:marker.key}};
}
