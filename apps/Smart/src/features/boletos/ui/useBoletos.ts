import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyFilters, EMPTY_FILTERS } from "../domain/filters";
import type { FilterState, OrderRow } from "../domain/types";
import { listClosed, listOrders, loadSession, searchOrders, watchOrders } from "../data/api";
import type { SessionInfo } from "../data/api";

const CLOSED_PAGE = 200;

function mergeInto(base: OrderRow[], extra: readonly OrderRow[]): OrderRow[] {
  if (!extra.length) return base;
  const have = new Set(base.map((o) => o.id));
  const add = extra.filter((o) => !have.has(o.id));
  return add.length ? [...base, ...add] : base;
}

export interface BoletosData {
  orders: OrderRow[];
  visible: OrderRow[];
  loading: boolean;
  error: string;
  filters: FilterState;
  setFilters: (f: FilterState | ((prev: FilterState) => FilterState)) => void;
  session: SessionInfo;
  closedFull: boolean;
  loadMoreClosed: () => void;
  refresh: () => void;
  patchOrder: (o: OrderRow) => void;
}

export function useBoletos(): BoletosData {
  const [base, setBase] = useState<OrderRow[]>([]);
  const [closedRows, setClosedRows] = useState<OrderRow[]>([]);
  const [searchRows, setSearchRows] = useState<OrderRow[]>([]);
  const [patches, setPatches] = useState<Record<string, OrderRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [session, setSession] = useState<SessionInfo>({ tenant: null, employeeName: "" });
  const [closedLimit, setClosedLimit] = useState(CLOSED_PAGE);
  const [closedFull, setClosedFull] = useState(true);
  const seq = useRef(0);
  const last = useRef(0);

  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - last.current < 2500) return;
    last.current = now;
    const mine = ++seq.current;
    listOrders()
      .then((rows) => {
        if (mine !== seq.current) return;
        setBase(rows);
        setPatches({});
        setError("");
      })
      .catch((e: unknown) => {
        if (mine === seq.current) setError(e instanceof Error ? e.message : "No se pudieron cargar los boletos.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    last.current = 0;
    refresh();
    loadSession().then(setSession, () => {});
    const off = watchOrders(refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const poll = setInterval(onVisible, 45000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (filters.vista !== "cerradas") return undefined;
    let alive = true;
    listClosed(closedLimit)
      .then((rows) => {
        if (!alive) return;
        setClosedRows(rows);
        setClosedFull(rows.length < closedLimit);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [filters.vista, closedLimit]);

  useEffect(() => {
    const q = filters.query.trim();
    if (q.length < 3) {
      setSearchRows([]);
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(() => {
      searchOrders(q)
        .then((rows) => {
          if (alive) setSearchRows(rows);
        })
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters.query]);

  const orders = useMemo(() => {
    const merged = mergeInto(mergeInto([...base], closedRows), searchRows);
    return merged.map((o) => patches[o.id] ?? o);
  }, [base, closedRows, searchRows, patches]);

  const visible = useMemo(() => applyFilters(orders, filters), [orders, filters]);

  const patchOrder = useCallback((o: OrderRow) => {
    setPatches((p) => ({ ...p, [o.id]: { ...(p[o.id] ?? {}), ...o } }));
  }, []);

  const loadMoreClosed = useCallback(() => setClosedLimit((n) => n + CLOSED_PAGE), []);

  return { orders, visible, loading, error, filters, setFilters, session, closedFull, loadMoreClosed, refresh: () => { last.current = 0; refresh(); }, patchOrder };
}
