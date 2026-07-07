import { Building2, AlertTriangle } from "lucide-react";

export default function MissingConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Jikmis Apartment</h1>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-3 text-sm text-amber-900">
              <p className="font-semibold">Supabase isn't connected yet.</p>
              <p>
                This app needs a <code className="rounded bg-amber-100 px-1 py-0.5">.env</code> file
                with your Supabase project's URL and anon key before it can run.
              </p>
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>
                  In the project folder, copy <code className="rounded bg-amber-100 px-1 py-0.5">.env.example</code> to{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5">.env</code>
                </li>
                <li>
                  Open your Supabase project → <strong>Settings → API</strong>, and copy the{" "}
                  <strong>Project URL</strong> and <strong>anon public key</strong> into that file
                </li>
                <li>
                  Stop the dev server and run{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5">npm run dev</code> again (Vite
                  only reads <code className="rounded bg-amber-100 px-1 py-0.5">.env</code> on startup)
                </li>
              </ol>
              <p>Full setup steps (database migrations, edge functions, admin login) are in README.md.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
