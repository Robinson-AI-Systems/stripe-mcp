// G-1f — verify a completed report's exact Stripe file, in the
// connection's own mode, without sharing its URL.
import {allProfiles,client,fail,ref,local,reply} from './billing-shared.js';

const exactRun = value => typeof value === 'string' && /^frr_[A-Za-z0-9]{2,100}$/.test(value);
const exactFile = value => typeof value === 'string' && /^file_[A-Za-z0-9]{2,100}$/.test(value);
const date = value => Number.isSafeInteger(value) && value >= 946684800 && value <= 4102444800;
const invalid = message => { throw new TypeError(message); };

function safeArgs(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args) ||
      Object.keys(args).some(key => key !== 'runId') || !exactRun(args.runId)) {
    invalid('One exact Stripe report run ID is required');
  }
}

function resultFile(run,mode) {
  // The baseline check strictly required livemode===false; the
  // parameterized form keeps that exact set for TEST (and any
  // no-mode caller) and requires livemode===true for LIVE.
  if (run?.object !== 'reporting.report_run' || !exactRun(run.id) ||
      run.livemode !== (mode==='live') || !['pending', 'failed', 'succeeded'].includes(run.status)) {
    invalid('Authenticated TEST report run could not be verified');
  }
  if (run.status !== 'succeeded') {
    return {available:false,runId:run.id,runStatus:run.status,
      reason:run.status === 'pending' ? 'report_generation_pending' : 'report_generation_failed',
      downloadUrl:null};
  }
  const fileId=ref(run.result);
  if (!exactFile(fileId)) invalid('Succeeded TEST report lacks a verified result file ID');
  return {available:true,runId:run.id,runStatus:run.status,fileId};
}

function safeFile(file,expectedId,mode) {
  // The baseline check refused only a livemode===true file. With a
  // connection mode supplied, a present boolean livemode must equal
  // that mode (the fileSafe semantics, V2 Files family): the baseline
  // TEST read set is unchanged exactly (the historical fixture file
  // carries no livemode and still projects), and a LIVE connection
  // refuses a TEST file while verifying its own. The file's signed
  // contents URL is never projected, in either mode.
  const wrongMode=['test','live'].includes(mode)
    ? (typeof file?.livemode==='boolean'&&file.livemode!==(mode==='live'))
    : file?.livemode===true;
  if (file?.object !== 'file' || file.id !== expectedId ||
      file.purpose !== 'finance_report_run' || wrongMode ||
      !date(file.created) || !Number.isSafeInteger(file.size) ||
      file.size < 0 || file.size > 1000000000000) {
    invalid('Stripe report file identity, purpose or size could not be verified');
  }
  const filename=typeof file.filename === 'string' &&
    file.filename.length <= 255 && !/[\r\n\u0000]/.test(file.filename)
      ? file.filename : null;
  const type=typeof file.type === 'string' &&
    /^[a-zA-Z0-9/_.+-]{1,60}$/.test(file.type) ? file.type : null;
  return {fileId:expectedId,filename,type,sizeBytes:file.size,
    createdAt:local(file.created),createdUnix:file.created,
    purpose:'finance_report_run',downloadUrl:null,downloadUrlAvailable:false,
    delivery:'authenticated_Stripe_Dashboard_or_future_owner_only_proxy',
    note:'The provider file contents URL needs Stripe authentication. No signed or public URL was created or returned.'};
}

export const tools=[{
  name:'report_get_result_file',area:'reports',writes:false,profiles:allProfiles,
  description:'Verify completed TEST or LIVE report file and metadata; no contents URL.',
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:{
    runId:{type:'string',pattern:'^frr_[A-Za-z0-9]{2,100}$'}
  },required:['runId'],additionalProperties:false}
}];

export const handlers={
  async report_get_result_file(args,ctx) {
    try {
      safeArgs(args);
      const stripe=await client(ctx);
      const mode=ctx?.connection?.mode;
      const run=await stripe.reporting.reportRuns.retrieve(args.runId);
      if (run?.id !== args.runId) invalid('Provider returned a different report run');
      const result=resultFile(run,mode);
      if (!result.available) return reply(result);
      const file=await stripe.files.retrieve(result.fileId);
      return reply({...result,...safeFile(file,result.fileId,mode)});
    } catch(error) {
      if(error instanceof TypeError) return fail(error.message);
      throw error;
    }
  }
};
