import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pocketBaseRequest } from "@/src/lib/pocketbase";

export const CLEANER_TOKEN_COOKIE = "cleanvoice_cleaner_token";
export const CLEANER_ID_COOKIE = "cleanvoice_cleaner_id";
export const CLEANER_NAME_COOKIE = "cleanvoice_cleaner_name";
export const CLEANER_EMAIL_COOKIE = "cleanvoice_cleaner_email";

export type CleanerSession = {
  token: string;
  cleanerId: string;
  cleanerName: string;
  cleanerEmail: string;
};

type CleanerAuthRecord = {
  id: string;
  name?: string;
  email?: string;
};

type PocketBaseList<T> = {
  items?: T[];
};

type UserAuthRecord = {
  id: string;
  email?: string;
  name?: string;
};

type CleanerAuthResponse = {
  token?: string;
  record?: UserAuthRecord;
};

const sessionCookieOptions = {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function authenticateCleaner(identity: string, password: string) {
  const result = await pocketBaseRequest<CleanerAuthResponse>(
    "/api/collections/users/auth-with-password",
    {
      auth: "none",
      body: { identity, password },
      method: "POST",
    },
  );

  if (!result.token || !result.record?.id) {
    throw new Error("PocketBase did not return a user session.");
  }

  const cleaner = await findCleanerForUser(result.record, result.token);

  return {
    token: result.token,
    cleanerId: cleaner.id,
    cleanerName:
      cleaner.name ?? result.record.name ?? result.record.email ?? identity,
    cleanerEmail: cleaner.email ?? result.record.email ?? identity,
  };
}

async function findCleanerForUser(user: UserAuthRecord, token: string) {
  const relationParams = new URLSearchParams({
    filter: `user = "${user.id}"`,
    perPage: "1",
  });

  const byRelation = await pocketBaseRequest<PocketBaseList<CleanerAuthRecord>>(
    "/api/collections/cleaners/records",
    {
      auth: "none",
      params: relationParams,
      token,
    },
  );

  if (byRelation.items?.[0]) {
    return byRelation.items[0];
  }

  if (user.email) {
    const emailParams = new URLSearchParams({
      filter: `email = "${user.email}"`,
      perPage: "1",
    });

    const byEmail = await pocketBaseRequest<PocketBaseList<CleanerAuthRecord>>(
      "/api/collections/cleaners/records",
      {
        auth: "none",
        params: emailParams,
        token,
      },
    );

    if (byEmail.items?.[0]) {
      return byEmail.items[0];
    }
  }

  throw new Error("No cleaner profile is linked to this user.");
}

export async function getCleanerSession(): Promise<CleanerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLEANER_TOKEN_COOKIE)?.value;
  const cleanerId = cookieStore.get(CLEANER_ID_COOKIE)?.value;

  if (!token || !cleanerId) {
    return null;
  }

  return {
    token,
    cleanerId,
    cleanerName: cookieStore.get(CLEANER_NAME_COOKIE)?.value ?? "Cleaner",
    cleanerEmail: cookieStore.get(CLEANER_EMAIL_COOKIE)?.value ?? "",
  };
}

export async function requireCleanerSession() {
  const session = await getCleanerSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function setCleanerSession(session: CleanerSession) {
  const cookieStore = await cookies();

  cookieStore.set(CLEANER_TOKEN_COOKIE, session.token, sessionCookieOptions);
  cookieStore.set(CLEANER_ID_COOKIE, session.cleanerId, sessionCookieOptions);
  cookieStore.set(CLEANER_NAME_COOKIE, session.cleanerName, sessionCookieOptions);
  cookieStore.set(CLEANER_EMAIL_COOKIE, session.cleanerEmail, sessionCookieOptions);
}

export async function clearCleanerSession() {
  const cookieStore = await cookies();

  cookieStore.delete(CLEANER_TOKEN_COOKIE);
  cookieStore.delete(CLEANER_ID_COOKIE);
  cookieStore.delete(CLEANER_NAME_COOKIE);
  cookieStore.delete(CLEANER_EMAIL_COOKIE);
}
