// Legacy orchestration is disabled: a call must have a durable recovery reference.
export function GET() {return Response.json({error:'Use the call start boundary.'},{status:410});}
