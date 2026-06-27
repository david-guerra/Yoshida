"use server";

import { redirect } from "next/navigation";
import {
  authenticateCleaner,
  clearCleanerSession,
  setCleanerSession,
} from "@/src/lib/auth";

function requiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function safeNextPath(formData: FormData) {
  const next = formData.get("next");

  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export async function loginAction(formData: FormData) {
  const nextPath = safeNextPath(formData);

  try {
    const session = await authenticateCleaner(
      requiredValue(formData, "identity"),
      requiredValue(formData, "password"),
    );

    await setCleanerSession(session);
  } catch {
    redirect(
      `/login?error=${encodeURIComponent(
        "Check the cleaner email and password, then try again.",
      )}&next=${encodeURIComponent(nextPath)}`,
    );
  }

  redirect(nextPath);
}

export async function logoutAction() {
  await clearCleanerSession();
  redirect("/login");
}
