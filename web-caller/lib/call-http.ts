import { CallError, type createCallService } from './call-service.ts';

type Service = ReturnType<typeof createCallService>;
export async function callHttp(request: Request, service: () => Service, id?: string): Promise<Response> {
  const headers = {'Cache-Control':'no-store'};
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
    if (request.method === 'GET' && id) return Response.json(await service().status(id,token),{headers});
    const raw = await request.text();
    if (raw.length > 100_000) throw new CallError(413,'Request too large');
    let body;
    try {body=JSON.parse(raw);} catch {throw new CallError(400,'Invalid JSON');}
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CallError(400,'Invalid request');
    const api=service();
    if (!id) {
      if (typeof body.callId !== 'string' || (body.phone !== undefined && typeof body.phone !== 'string')) throw new CallError(400,'Invalid call identity');
      return Response.json(await api.start(body.callId,token,body.phone?.trim()),{headers});
    }
    if (body.action === 'end') return Response.json(await api.end(id,token),{headers});
    if (body.action === 'submit') return Response.json(await api.submit(id,token,body.payload),{headers});
    if (body.action === 'event') return Response.json(await api.event(id,token,body.event),{headers});
    throw new CallError(400,'Unknown action');
  } catch (error) {
    return Response.json({error:'Die Verbindung oder der Speicherstatus konnte nicht geprüft werden.'}, {status:error instanceof CallError ? error.status : 503,headers});
  }
}
