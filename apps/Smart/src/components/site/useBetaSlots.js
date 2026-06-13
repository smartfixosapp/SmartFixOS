import { useEffect, useState } from "react";

const BETA_SLOTS_ENDPOINT = "https://idntuvtabecwubzswpwi.supabase.co/functions/v1/beta-slots";

export function useBetaSlots() {
  const [data, setData] = useState({ loading: true, error: false, slots: null });

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const fetchSlots = async () => {
      try {
        const res = await fetch(BETA_SLOTS_ENDPOINT, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        if (!cancelled) setData({ loading: false, error: false, slots: json });
      } catch (_e) {
        if (!cancelled) setData((prev) => ({ loading: false, error: true, slots: prev.slots }));
      }
    };

    fetchSlots();
    timer = setInterval(fetchSlots, 30000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, []);

  return data;
}
