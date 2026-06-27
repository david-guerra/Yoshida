import { redirect } from "next/navigation";
import { loginAction } from "@/src/app/login/actions";
import { getCleanerSession } from "@/src/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

const inputClass =
  "h-12 w-full rounded-md border border-[#dfe7e2] bg-white px-3 text-sm text-[#162018] outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#d9eadf]";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const existingSession = await getCleanerSession();

  if (existingSession) {
    redirect("/");
  }

  const { error, next } = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-6 text-[#162018] sm:px-8">
      <section className="mx-auto grid max-w-5xl gap-10 pt-10 lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[1fr_420px] lg:items-center lg:pt-0">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-[#2f6b4f]">
            CleanVoice
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-[#10231d] sm:text-5xl">
            Cleaner desk
          </h1>
          <p className="mt-4 text-base leading-7 text-[#53645a]">
            Sign in as the cleaner to review calls, clients, bookings, and the
            rules the voice agent uses before it accepts new work.
          </p>
        </div>

        <form
          action={loginAction}
          className="rounded-2xl border border-[#dfe7e2] bg-white p-6 shadow-sm"
        >
          <input name="next" type="hidden" value={next ?? "/"} />
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-[#10231d]">
              Log in
            </h2>
            <p className="mt-2 text-sm text-[#65756a]">
              Use the cleaner account stored in PocketBase.
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-md border border-[#f0c7b8] bg-[#fff4ee] px-4 py-3 text-sm font-semibold text-[#9d4327]">
              {error}
            </div>
          ) : null}

          <label className="mt-6 block">
            <span className="text-sm font-semibold text-[#344238]">Email</span>
            <input
              autoComplete="username"
              className={`${inputClass} mt-2`}
              name="identity"
              required
              type="email"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-[#344238]">Password</span>
            <input
              autoComplete="current-password"
              className={`${inputClass} mt-2`}
              name="password"
              required
              type="password"
            />
          </label>

          <button
            className="mt-6 h-12 w-full rounded-full bg-[#244f3b] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#1d3f30] focus:outline-none focus:ring-2 focus:ring-[#9dccac]"
            type="submit"
          >
            Log in to clients
          </button>
        </form>
      </section>
    </main>
  );
}
