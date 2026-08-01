import { lazy, type ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = { default: ComponentType<any> };

const RELOAD_KEY = "jikmis-chunk-reload-attempted";

/** Wraps React.lazy() so a stale/missing JS chunk — the classic cause of a
 *  totally blank white screen right after a new deploy, since the browser
 *  tab was already open with the OLD index.html and tries to fetch an OLD
 *  hashed chunk filename that Vercel just deleted when it shipped the new
 *  build — forces exactly one full page reload to pick up the fresh build,
 *  instead of throwing an uncaught error that unmounts the whole app with
 *  nothing on screen and no explanation.
 *
 *  sessionStorage guards against a reload loop: if the SAME session still
 *  fails to load the chunk after one reload (a genuine network/deploy
 *  problem, not a stale cache), it gives up and lets the error surface to
 *  the <ErrorBoundary> instead of reloading forever. */
export function lazyWithRetry<T extends AnyModule>(importer: () => Promise<T>) {
  return lazy(async () => {
    try {
      const mod = await importer();
      window.sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (error) {
      const alreadyRetried = window.sessionStorage.getItem(RELOAD_KEY) === "1";
      if (!alreadyRetried) {
        window.sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        // The reload is already in flight — never resolve so React doesn't
        // briefly render an error UI right before the page unloads.
        return new Promise<T>(() => {});
      }
      throw error;
    }
  });
}
