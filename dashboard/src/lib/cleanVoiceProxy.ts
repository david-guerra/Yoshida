import { getCleanerSession } from "@/src/lib/auth";
import { pocketBaseResponse } from "@/src/lib/pocketbase";

export async function proxyCleanVoiceRequest(
  request: Request,
  path: string,
  method: "GET" | "POST",
) {
  const session = await getCleanerSession();
  if (!session) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  if (method === "POST") {
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "A JSON body is required." }, { status: 400 });
    }
  }

  try {
    const upstream = await pocketBaseResponse(path, {
      auth: "none",
      token: session.token,
      method,
      body,
      signal: request.signal,
    });
    const contentType = upstream.headers.get("content-type");

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: contentType ? { "Content-Type": contentType } : undefined,
    });
  } catch {
    return Response.json(
      { message: "The booking service could not be reached." },
      { status: 502 },
    );
  }
}
