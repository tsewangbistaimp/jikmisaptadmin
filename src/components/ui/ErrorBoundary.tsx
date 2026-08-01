import * as React from "react";
import { Building2, AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches any render-time crash anywhere below it (a bad API response
 *  shape, a chunk that failed to load twice even after lazy-retry, a bug in
 *  a page) and shows a recoverable screen instead of React's default
 *  behavior of unmounting the whole tree into a blank white page with
 *  nothing on screen and no way to recover short of knowing to hit refresh.
 *  Without this, the ENTIRE admin dashboard is one uncaught exception away
 *  from going blank for every user, with zero feedback. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Jikmis Apartment crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Jikmis Apartment</h1>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-500/20 dark:bg-red-500/10">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="space-y-3 text-sm text-red-900 dark:text-red-300">
                <p className="font-semibold">Something went wrong loading the dashboard.</p>
                <p>
                  This is usually a one-off — often a new update was published while this tab was already open. Reloading
                  almost always fixes it.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <RefreshCw className="h-4 w-4" /> Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
