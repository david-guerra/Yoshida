type PocketBaseRequestOptions = {
  auth?: "optional" | "required" | "none";
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  params?: URLSearchParams;
};

const POCKETBASE_URL =
  process.env.POCKETBASE_URL ??
  process.env.NEXT_PUBLIC_POCKETBASE_URL ??
  "http://127.0.0.1:8090";

const PB_ADMIN_EMAIL =
  process.env.PB_ADMIN_EMAIL ?? process.env.POCKETBASE_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD =
  process.env.PB_ADMIN_PASSWORD ?? process.env.POCKETBASE_ADMIN_PASSWORD;

let adminToken: string | null | undefined;

function buildPocketBaseUrl(path: string, params?: URLSearchParams) {
  const url = new URL(path, POCKETBASE_URL);

  if (params) {
    url.search = params.toString();
  }

  return url;
}

async function authenticateSuperuser() {
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    return null;
  }

  const body = JSON.stringify({
    identity: PB_ADMIN_EMAIL,
    password: PB_ADMIN_PASSWORD,
  });

  const authPaths = [
    "/api/collections/_superusers/auth-with-password",
    "/api/admins/auth-with-password",
  ];

  for (const path of authPaths) {
    const res = await fetch(buildPocketBaseUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body,
      cache: "no-store",
    });

    if (res.ok) {
      const data = (await res.json()) as { token?: string };
      return data.token ?? null;
    }
  }

  throw new Error("PocketBase superuser authentication failed.");
}

async function getAdminToken(required: boolean) {
  if (adminToken === undefined) {
    adminToken = await authenticateSuperuser();
  }

  if (required && !adminToken) {
    throw new Error(
      "PocketBase writes require PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in dashboard/.env.local.",
    );
  }

  return adminToken;
}

export async function pocketBaseRequest<T>(
  path: string,
  options: PocketBaseRequestOptions = {},
) {
  const auth = options.auth ?? "optional";
  const token = auth === "none" ? null : await getAdminToken(auth === "required");
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(buildPocketBaseUrl(path, options.params), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `PocketBase ${options.method ?? "GET"} ${path} failed with ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as T;
}

