import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./boletos.css";
import { ListPane } from "./ListPane";
import { DetailPane } from "./DetailPane";
import { NewTicket } from "./NewTicket";
import { useBoletos } from "./useBoletos";
import { addNote, changeStatus, getOrder, uploadDetailPhotos } from "../data/api";
import { canSeeCosts } from "../data/permissions";
import { statusLabel } from "../domain/statuses";
import { canTransition } from "../domain/transitions";
import type { OrderRow } from "../domain/types";

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const h = () => setOn(m.matches);
    h();
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, [query]);
  return on;
}

function useReparaTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      root.dataset.theme = root.classList.contains("app-light") ? "light" : "dark";
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      obs.disconnect();
      delete root.dataset.theme;
    };
  }, []);
}

interface Toast {
  text: string;
  error: boolean;
}

export default function BoletosPage() {
  useReparaTheme();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const wide = useMedia("(min-width: 1024px)");
  const data = useBoletos();
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [folded, setFolded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const costs = useMemo(() => canSeeCosts(), []);

  const flash = useCallback((text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const current = detail && detail.id === orderId ? detail : null;
  const listRow = useMemo(() => data.orders.find((o) => o.id === orderId) ?? null, [data.orders, orderId]);

  useEffect(() => {
    if (!orderId) {
      setDetail(null);
      return undefined;
    }
    let alive = true;
    getOrder(orderId)
      .then((o) => {
        if (alive) setDetail(o);
      })
      .catch(() => {
        if (alive) flash("No se pudo abrir el boleto.", true);
      });
    return () => {
      alive = false;
    };
  }, [orderId, listRow?.updated_date, flash]);

  const open = useCallback((id: string) => navigate(`/Boletos/${id}`), [navigate]);
  const back = useCallback(() => navigate("/Boletos"), [navigate]);

  const onChangeStatus = useCallback(
    async (key: string) => {
      if (!detail || busy) return;
      if (!canTransition(detail.status, key)) {
        flash("Ese cambio de estatus no está permitido desde aquí.", true);
        return;
      }
      setBusy(true);
      try {
        const fresh = await changeStatus(detail, key, data.session);
        setDetail(fresh);
        data.patchOrder(fresh);
        flash(`${fresh.order_number ?? "Boleto"} · ${statusLabel(key)}`);
        data.refresh();
      } catch (e) {
        flash(`No se pudo cambiar el estatus: ${e instanceof Error ? e.message : "error"}`, true);
      } finally {
        setBusy(false);
      }
    },
    [detail, busy, data, flash],
  );

  const onNote = useCallback(
    async (text: string) => {
      if (!detail) return;
      try {
        await addNote(detail, text, data.session);
        const fresh = await getOrder(detail.id);
        if (fresh) setDetail(fresh);
        flash("Nota guardada.");
      } catch (e) {
        flash(`No se pudo guardar la nota: ${e instanceof Error ? e.message : "error"}`, true);
        throw e;
      }
    },
    [detail, data.session, flash],
  );

  const onPhotos = useCallback(
    async (files: FileList) => {
      if (!detail) return;
      try {
        const res = await uploadDetailPhotos(detail, files, data.session);
        const fresh = await getOrder(detail.id);
        if (fresh) setDetail(fresh);
        flash(res.failed ? `${res.uploaded} subidas, ${res.failed} fallaron.` : `${res.uploaded} ${res.uploaded === 1 ? "foto subida" : "fotos subidas"}.`, res.failed > 0);
      } catch (e) {
        flash(`No se pudieron subir las fotos: ${e instanceof Error ? e.message : "error"}`, true);
      }
    },
    [detail, data.session, flash],
  );

  const onCreated = useCallback(
    (order: OrderRow) => {
      setCreating(false);
      data.patchOrder(order);
      data.refresh();
      flash(`Boleto ${order.order_number ?? ""} creado.`);
      navigate(`/Boletos/${order.id}`);
    },
    [data, flash, navigate],
  );

  const showDetail = !!orderId;
  const listNode = (
    <ListPane
      orders={data.orders}
      visible={data.visible}
      filters={data.filters}
      setFilters={data.setFilters}
      selectedId={orderId ?? null}
      stacked={!wide || !!orderId}
      loading={data.loading}
      error={data.error}
      closedFull={data.closedFull}
      onLoadMoreClosed={data.loadMoreClosed}
      onOpen={open}
      onNew={() => setCreating(true)}
    />
  );

  return (
    <div className="rb">
      {wide ? (
        <div className="rb-split">
          <div className={`rb-lp${showDetail ? (folded ? " fold" : "") : " full"}`} aria-hidden={showDetail && folded ? true : undefined}>{listNode}</div>
          {showDetail ? (
            current ? (
              <DetailPane order={current} canSeeCosts={costs} wide busy={busy} onBack={back} onToggleList={() => setFolded((f) => !f)} onChangeStatus={onChangeStatus} onNote={onNote} onPhotos={onPhotos} />
            ) : (
              <div className="rb-dp enter"><div className="rb-loading">Abriendo boleto...</div></div>
            )
          ) : null}
        </div>
      ) : null}
      {!wide && showDetail ? (
        current ? (
          <DetailPane order={current} canSeeCosts={costs} wide={false} busy={busy} onBack={back} onToggleList={() => {}} onChangeStatus={onChangeStatus} onNote={onNote} onPhotos={onPhotos} />
        ) : (
          <div className="rb-loading">Abriendo boleto...</div>
        )
      ) : null}
      {!wide && !showDetail ? listNode : null}
      {creating ? <NewTicket session={data.session} onClose={() => setCreating(false)} onCreated={onCreated} /> : null}
      {toast ? <div className={`rb-toast${toast.error ? " err" : ""}`} role="status">{toast.text}</div> : null}
    </div>
  );
}
