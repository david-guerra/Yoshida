import { redirect } from "next/navigation";
import { Card } from "@/src/components/ui/Card";
import { TextField } from "@/src/components/ui/Field";
import { SparkleIcon, WarningIcon } from "@/src/components/ui/icons";
import { loginAction } from "@/src/app/login/actions";
import { getCleanerSession } from "@/src/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const existingSession = await getCleanerSession();

  if (existingSession) {
    redirect("/");
  }

  const { error, next } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-accent text-white shadow-raised">
            <SparkleIcon className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-[28px] font-semibold tracking-tight text-label">
            Yoshida
          </h1>
          <p className="mt-1.5 text-[15px] leading-6 text-secondary">
            Sign in to review the calls, clients, and bookings your voice agent
            handled.
          </p>
        </div>

        <Card>
          <form action={loginAction} className="space-y-4">
            <input name="next" type="hidden" value={next ?? "/"} />

            {error ? (
              <div className="flex items-center gap-2.5 rounded-group bg-red-soft px-4 py-3 text-[14px] font-medium text-red-ink">
                <WarningIcon className="h-5 w-5 shrink-0" />
                {error}
              </div>
            ) : null}

            <TextField
              autoComplete="username"
              label="Email"
              name="identity"
              required
              type="email"
            />
            <TextField
              autoComplete="current-password"
              label="Password"
              name="password"
              required
              type="password"
            />

            <button
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-accent text-[16px] font-semibold text-white shadow-sm transition hover:bg-accent-hover active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              type="submit"
            >
              Sign in
            </button>
          </form>
        </Card>

        <p className="mt-5 text-center text-[13px] text-tertiary">
          Use the cleaner account stored in PocketBase.
        </p>
      </div>
    </main>
  );
}
