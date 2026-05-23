import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase-client.js";

/**
 * useHydrateSessionFromURL
 *
 * Sprint 135 — iOS → Web handoff (Approach A: JWT in URL).
 *
 * When the iOS app opens a web URL via SFSafariViewController, it appends
 * the Supabase access + refresh tokens as query params:
 *
 *   /upgrade?plan=team&t=<access_token>&r=<refresh_token>
 *   /dashboard/billing?t=<access_token>&r=<refresh_token>
 *
 * This hook:
 *   1. On mount, reads `t` and `r` from the URL.
 *   2. If both are present, calls supabase.auth.setSession() to hydrate
 *      the web SDK with that session.
 *   3. ALWAYS strips `t` and `r` from the visible URL via
 *      window.history.replaceState — even if setSession fails — so the
 *      tokens never appear in browser history.
 *   4. Returns `hydrated` = true once the hydration attempt has
 *      completed (success or failure). Consumers should wait for
 *      `hydrated` before calling auth-dependent code.
 *
 * If the URL has no tokens, the hook resolves immediately to hydrated=true
 * (no-op path — the page can still proceed and check for an existing
 * session via getCurrentSession() if appropriate).
 *
 * Security: see SPEC_iOS_to_Web_Handoff.md §"Security considerations".
 */
export function useHydrateSessionFromURL() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get("t");
      const refreshToken = params.get("r");

      // Always remove the tokens from the visible URL first — even before
      // hitting the network — so a slow setSession can't accidentally leak
      // them via a screenshot or shoulder-surf.
      if (accessToken || refreshToken) {
        params.delete("t");
        params.delete("r");
        const search = params.toString();
        const cleanUrl =
          window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
        window.history.replaceState({}, "", cleanUrl);
      }

      if (!accessToken || !refreshToken) {
        if (!cancelled) setHydrated(true);
        return;
      }

      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error("[useHydrateSessionFromURL] setSession failed:", error);
        }
      } catch (err) {
        console.error("[useHydrateSessionFromURL] setSession exception:", err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return hydrated;
}
