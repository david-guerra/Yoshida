import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type Receipt = { booking_id: string; submission_id: string; status: 'created'; booking_status: 'requested'; tentative: true };
type SubmissionState = 'not_sent' | 'saving' | 'unclear' | 'saved' | 'rejected';
type CallRecord = {
  callId: string; browserHash: string; workerToken: string; phone: string; room: string;
  ended: boolean; dispatchClaimed: boolean; submissionId: string; submissionToken: string;
  state: SubmissionState; payload?: string; receipt?: Receipt; attempts: number;
  event?: string; ready?: boolean;
};
type Dispatch = { id: string; agentName: string; metadata?: string };
export type CallOptions = {
  databasePath: string; serverUrl: string; callServerUrl: string; callerPhone: string;
  listDispatch: (room: string) => Promise<Dispatch[]>;
  createDispatch: (room: string, metadata: Record<string, string>) => Promise<Dispatch>;
  deleteRoom: (room: string) => Promise<unknown>;
  mintToken: (room: string, metadata: Record<string, string>) => Promise<string>;
  backend: (path: string, init: RequestInit) => Promise<Response>;
};
export class CallError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function validateReference(id: string, token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) || !/^[\w-]{32,128}$/.test(token)) throw new CallError(400, 'Invalid call reference');
}

/** Private, durable loopback demo ledger. Transactions never span network I/O. */
export function createCallService(options: CallOptions) {
  const databaseDirectory=dirname(options.databasePath);
  if (!existsSync(databaseDirectory)) {
    mkdirSync(databaseDirectory, {recursive: true, mode: 0o700});
    if (process.platform !== 'win32') chmodSync(databaseDirectory,0o700);
  } else if (process.platform !== 'win32' && (statSync(databaseDirectory).mode & 0o077) !== 0) {
    throw new Error('Call database directory must be private (0700)');
  }
  closeSync(openSync(options.databasePath,'a',0o600));
  if (process.platform !== 'win32') chmodSync(options.databasePath,0o600);
  const db = new DatabaseSync(options.databasePath);
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, record TEXT NOT NULL)');
  const read = (id: string): CallRecord | undefined => {
    const row = db.prepare('SELECT record FROM calls WHERE id=?').get(id) as {record: string} | undefined;
    return row && JSON.parse(row.record);
  };
  const write = (call: CallRecord) => db.prepare('INSERT OR REPLACE INTO calls VALUES (?,?)').run(call.callId, JSON.stringify(call));
  function transaction<T>(operation: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function register(id: string, token: string, phone?: string) {
    validateReference(id, token);
    return transaction(() => {
      const existing = read(id);
      if (existing) {
        if (existing.browserHash !== hash(token)) throw new CallError(403, 'Invalid call capability');
        if (phone && existing.phone !== phone) throw new CallError(409, 'Call identity is frozen');
        return existing;
      }
      const call: CallRecord = {callId:id, browserHash:hash(token),workerToken:secret(),phone:phone || options.callerPhone,
        room:`yoshida-${id}`,ended:false,dispatchClaimed:false,submissionId:randomUUID(),submissionToken:secret(),state:'not_sent',attempts:0};
      if (!/^\+[1-9]\d{6,14}$/.test(call.phone)) throw new CallError(400, 'Invalid synthetic phone');
      write(call); return call;
    });
  }
  function authorized(id: string, token: string, role: 'browser' | 'worker' | 'either' = 'either') {
    validateReference(id,token);
    const call = read(id);
    if (!call || !((role !== 'worker' && call.browserHash === hash(token)) || (role !== 'browser' && call.workerToken === token))) throw new CallError(403,'Invalid call capability');
    return call;
  }
  const metadata = (call: CallRecord) => ({call_id:call.callId,caller_phone:call.phone,identity:'caller',
    call_server_url:options.callServerUrl,worker_token:call.workerToken,submission_id:call.submissionId,submission_token:call.submissionToken});
  async function dispatches(call: CallRecord) {
    try { return await options.listDispatch(call.room); }
    catch (error) {
      if ((error as {code?:string}).code === 'not_found') return [];
      throw new CallError(503,'Assistant inspection unavailable');
    }
  }
  async function cleanup(call: CallRecord) {
    try { await options.deleteRoom(call.room); }
    catch (error) { if ((error as {code?:string}).code !== 'not_found') throw new CallError(503,'Call cleanup pending'); }
  }
  function acceptReceipt(id: string, value: unknown): Receipt {
    const call = read(id)!;
    const receipt = value as Receipt | null;
    if (!receipt || typeof receipt.booking_id !== 'string' || !receipt.booking_id.trim() || receipt.submission_id !== call.submissionId ||
        receipt.status !== 'created' || receipt.booking_status !== 'requested' || receipt.tentative !== true) throw new CallError(503,'Receipt unavailable');
    transaction(() => {
      const latest = read(id)!;
      latest.state = 'saved'; latest.receipt = receipt; write(latest);
    });
    return receipt;
  }
  async function reconcile(call: CallRecord) {
    if (!call.payload || call.receipt || call.state === 'rejected') return;
    try {
      const response = await options.backend(`/api/cleanvoice/submissions/${call.submissionId}`, {
        method:'GET',headers:{'X-Submission-Token':call.submissionToken},signal:AbortSignal.timeout(5000),cache:'no-store',
      });
      if (response.ok) acceptReceipt(call.callId,await response.json());
    } catch { /* An absent or unreachable receipt never proves non-persistence. */ }
  }
  const saves = new Map<string, Promise<Receipt>>();
  async function submit(id: string, token: string, payload: unknown): Promise<Receipt> {
    const call = authorized(id,token,'worker');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      (payload as Record<string,unknown>).reviewed !== true || (payload as Record<string,unknown>).submission_id !== call.submissionId) throw new CallError(422,'Reviewed intake and assigned submission identity required');
    const frozen = canonical(payload);
    if (frozen.length > 100_000) throw new CallError(413,'Intake too large');
    if (call.payload && call.payload !== frozen && call.state !== 'rejected') throw new CallError(409,'Resolve the earlier reviewed request');
    if (call.receipt) return call.receipt;
    if (saves.has(id)) return saves.get(id)!;
    const pending = transaction(() => {
      const latest = authorized(id,token,'worker');
      if (latest.ended && (!latest.payload || latest.state === 'rejected')) throw new CallError(410,'Call ended before submission');
      if (latest.state === 'rejected') latest.attempts = 0;
      if (latest.attempts >= 2) throw new CallError(409,'Retry limit reached; check status');
      latest.payload=frozen; latest.state='saving'; latest.attempts++; write(latest); return latest;
    });
    const operation = (async () => {
      try {
        const response = await options.backend('/api/cleanvoice/create-booking', {
          method:'POST',headers:{'Content-Type':'application/json','X-Submission-Token':pending.submissionToken},
          body:frozen,signal:AbortSignal.timeout(9000),
        });
        if (response.ok) return acceptReceipt(id,await response.json());
        if (response.status >= 400 && response.status < 500 && ![408,409,429].includes(response.status) && pending.attempts === 1) {
          transaction(() => { const latest=read(id)!; if (!latest.receipt) {latest.state='rejected';write(latest);} });
          throw new CallError(422,'Request was not saved; review the details');
        }
        throw new CallError(503,'Save outcome unclear');
      } catch (error) {
        transaction(() => {const latest=read(id)!;if (!latest.receipt && latest.state !== 'rejected') {latest.state='unclear';write(latest);} });
        if (read(id)!.receipt) return read(id)!.receipt!;
        if (error instanceof CallError) throw error;
        throw new CallError(503,'Save outcome unclear');
      } finally { saves.delete(id); }
    })();
    saves.set(id,operation);
    return operation;
  }
  return {
    close: () => db.close(),
    submit,
    async event(id: string, token: string, event: string) {
      if (!['ready','speech_error','lookup','listening','thinking','speaking'].includes(event)) throw new CallError(400,'Unknown event');
      transaction(() => {const call=authorized(id,token,'worker'); call.event=event;if(event==='ready')call.ready=true;write(call);});
      return {ok:true};
    },
    async end(id: string, token: string) {
      register(id,token);
      const call = transaction(() => {
        const latest = authorized(id,token,'browser');
        latest.ended = true; write(latest); return latest;
      });
      await cleanup(call);
      return {ended: true};
    },
    async status(id: string, token: string) {
      await reconcile(authorized(id,token));
      let call = authorized(id,token);
      if (call.state === 'saving' && !saves.has(id)) {
        call = transaction(() => {
          const latest=authorized(id,token);
          if (latest.state === 'saving' && !latest.receipt) {latest.state='unclear';write(latest);}
          return latest;
        });
      }
      return {callId:id,ended:call.ended,ready:call.ready===true,event:call.event,submission:{state:call.state,receipt:call.receipt}};
    },
    async start(id: string, token: string, phone?: string) {
      let call = register(id,token,phone);
      if (call.ended) throw new CallError(409,'Call ended');
      const existing = (await dispatches(call)).find(d => {
        try { return d.agentName === 'client-call-agent' && JSON.parse(d.metadata || '{}').call_id === id; }
        catch { return false; }
      });
      if (!existing) {
        call = transaction(() => {
          const latest = authorized(id,token,'browser');
          if (latest.ended) throw new CallError(409,'Call ended');
          if (latest.dispatchClaimed) throw new CallError(503,'Dispatch outcome pending; reconcile this call');
          latest.dispatchClaimed = true; write(latest); return latest;
        });
        try { await options.createDispatch(call.room,metadata(call)); }
        catch { throw new CallError(503,'Dispatch outcome pending; reconcile this call'); }
      }
      call = authorized(id,token,'browser');
      if (call.ended) { await cleanup(call); throw new CallError(409,'Call ended'); }
      const connectionToken = await options.mintToken(call.room,{call_id:id,caller_phone:call.phone});
      if (read(id)!.ended) { await cleanup(call); throw new CallError(409,'Call ended'); }
      return {callId:id,token:connectionToken,serverUrl:options.serverUrl};
    },
  };
}
