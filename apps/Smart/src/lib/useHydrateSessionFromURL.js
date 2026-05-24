import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client.js";

let __sfosHydrationStarted = false;

export function useHydrateSessionFromURL() {
  const [hydrated, setHydrated] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || __sfosHydrationStarted) {
      setHydrated(true);
      return;
    }
    startedRef.current = true;
    __sfosHydrationStarted = true;

    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get("t");
      const refreshToken = params.get("r");

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
