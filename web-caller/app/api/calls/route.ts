import { callHttp } from '@/lib/call-http';
import { callService } from '@/lib/livekit-dispatch';
export const runtime = 'nodejs';
export function POST(request: Request) {return callHttp(request,callService);}
