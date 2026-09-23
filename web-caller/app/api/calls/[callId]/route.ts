import { callHttp } from '@/lib/call-http';
import { callService } from '@/lib/livekit-dispatch';
export const runtime = 'nodejs';
type Context = {params: Promise<{callId: string}>};
export async function GET(request: Request, context: Context) {return callHttp(request,callService,(await context.params).callId);}
export async function POST(request: Request, context: Context) {return callHttp(request,callService,(await context.params).callId);}
