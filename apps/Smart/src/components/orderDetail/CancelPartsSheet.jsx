import { useEffect, useState } from "react";
import { C, Sheet, Btn, money } from "./ui";

function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="flex-shrink-0" style={{ width: 51, height: 31, borderRadius: 999, background: on ? C.green : "#39393D", position: "relative", transition: "background 0.2s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
    </button>
  );
}

function Header({ color, children }) {
  return (
    <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: C.sub, textTransform: "uppercase", margin: "18px 4px 8px" }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />{children}
    </p>
  );
}

function Footer({ children }) {
  return <p style={{ fontSize: 12, color: C.sub, margin: "6px 4px 0" }}>{children}</p>;
}

function Line({ name, detail, quantity, right }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "11px 14px" }}>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: 15 }}>{name}</span>
        <span className="block" style={{ fontSize: 12, color: C.sub }}>{detail}</span>
      </span>
      {quantity !== undefined && quantity !== null && <span style={{ fontSize: 14, color: C.sub, fontVariantNumeric: "tabular-nums" }}>{Number(quantity).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>}
      {right}
    </div>
  );
}

function Group({ children }) {
  return <div style={{ borderRadius: 14, background: C.card2, overflow: "hidden" }} className="flex flex-col">{children}</div>;
}

export default function CancelPartsSheet({ open, plan, busy, onClose, onConfirm }) {
  const [draft, setDraft] = useState(plan);
  useEffect(() => { if (open) setDraft(plan); }, [open, plan]);
  if (!draft) return null;

  const patch = (key, id, changes) => setDraft((d) => ({ ...d, [key]: d[key].map((x) => (x.id === id ? { ...x, ...changes } : x)) }));
  const arrivedCost = draft.arrivedParts.reduce((s, p) => s + p.cost, 0);
  const title = draft.alreadyCancelled ? `Piezas de ${draft.orderNumber}` : `Cancelar ${draft.orderNumber}`;

  return (
    <Sheet
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      width={560}
      dismissable={!busy}
      footer={(
        <div className="flex flex-col gap-2">
          <Btn onClick={() => onConfirm(draft)} disabled={busy} color={C.red}>{busy ? "Un momento…" : draft.alreadyCancelled ? "Acomodar piezas" : "Cancelar orden"}</Btn>
          <p className="text-center" style={{ fontSize: 11, color: C.sub }}>Después de esto no sale &ldquo;Deshacer&rdquo;. Revisa aquí antes.</p>
        </div>
      )}
    >
      <p style={{ fontSize: 14, color: C.sub }}>
        {draft.alreadyCancelled
          ? "Esta orden ya está cancelada, pero quedaron piezas pendientes. Revisa qué pasa con cada una."
          : "Esta orden tiene piezas. Revisa qué pasa con cada una antes de cancelar."}
      </p>

      {draft.stockReturns.length > 0 && (
        <>
          <Header color={C.green}>Vuelven a tu inventario</Header>
          <Group>
            {draft.stockReturns.map((r) => (
              <Line key={r.id} name={r.name} detail="Salió de tu inventario para esta orden" quantity={r.quantity} right={<Switch on={r.include} label={`Devolver ${r.name}`} onChange={(v) => patch("stockReturns", r.id, { include: v })} />} />
            ))}
          </Group>
          <Footer>Apaga la que ya se instaló o se dañó: esa no vuelve.</Footer>
        </>
      )}

      {draft.arrivedParts.length > 0 && (
        <>
          <Header color={C.green}>Llegó para esta orden</Header>
          <Group>
            {draft.arrivedParts.map((p) => (
              <Line key={p.id} name={p.name} detail={`Compra ${p.purchaseNumber}`} quantity={p.quantity} right={<Switch on={p.include} label={`Ingresar ${p.name}`} onChange={(v) => patch("arrivedParts", p.id, { include: v })} />} />
            ))}
          </Group>
          <Footer>{arrivedCost > 0 ? `Entra a tu inventario. El gasto de ${money(arrivedCost)} se queda: ese dinero sí salió.` : "Entra a tu inventario. Su gasto se queda: ese dinero sí salió."}</Footer>
        </>
      )}

      {draft.pendingPurchases.length > 0 && (
        <>
          <Header color={C.amber}>Pedida, todavía no llega</Header>
          <Group>
            {draft.pendingPurchases.map((p) => (
              <div key={p.id} style={{ padding: "11px 14px" }} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ fontSize: 15 }}>{p.itemsLabel}</span>
                    <span className="block" style={{ fontSize: 12, color: C.sub }}>{`Compra ${p.purchaseNumber} · ${money(p.amount)}`}</span>
                  </span>
                  <span style={{ fontSize: 14, color: C.sub, fontVariantNumeric: "tabular-nums" }}>{p.quantity}</span>
                </div>
                <div className="grid grid-cols-2 gap-1" style={{ padding: 3, borderRadius: 10, background: "#1C1C1E" }}>
                  {[[true, "Cancelar la compra"], [false, "Dejarla"]].map(([v, l]) => (
                    <button key={l} onClick={() => patch("pendingPurchases", p.id, { cancelPurchase: v })} className="apple-press" style={{ padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, background: p.cancelPurchase === v ? "#fff" : "transparent", color: p.cancelPurchase === v ? "#000" : C.sub }}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
          </Group>
          <Footer>Cancelar la compra anula su gasto; avísale al suplidor. Si la dejas, cuando llegue entra a tu inventario.</Footer>
        </>
      )}

      {draft.sharedPurchases.length > 0 && (
        <>
          <Header color={C.sub}>Compras que no se cancelan</Header>
          <Group>{draft.sharedPurchases.map((p) => <Line key={p.id} name={p.itemsLabel} detail={`Compra ${p.purchaseNumber}`} />)}</Group>
          <Footer>Traen piezas de otras órdenes o ya llegaron a medias. Lo que falta entra a tu inventario cuando llegue, y su gasto se queda.</Footer>
        </>
      )}

      {draft.draftRemovals.length > 0 && (
        <>
          <Header color={C.sub}>Se sacan del pedido abierto</Header>
          <Group>{draft.draftRemovals.map((p) => <Line key={p.id} name={p.itemsLabel} detail={`Pedido abierto ${p.purchaseNumber}`} />)}</Group>
          <Footer>Ese pedido no se había enviado, así que no hay gasto que anular.</Footer>
        </>
      )}

      {draft.manualParts.length > 0 && (
        <>
          <Header color={C.sub}>Se quedan igual</Header>
          <Group>{draft.manualParts.map((p) => <Line key={p.id} name={p.name} detail="No está en tu inventario" quantity={p.quantity} />)}</Group>
          <Footer>{draft.manualExpenseTotal > 0 ? `Su gasto de ${money(draft.manualExpenseTotal)} se queda: esas piezas se compraron y son tuyas.` : "Su gasto se queda: esas piezas se compraron y son tuyas."}</Footer>
        </>
      )}
    </Sheet>
  );
}
