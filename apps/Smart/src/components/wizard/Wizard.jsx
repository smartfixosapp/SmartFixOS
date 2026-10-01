import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, Check, Loader2, BadgeCheck, UserRound, Smartphone, MessageSquareWarning, Camera, ListChecks, CircleDollarSign, PenLine, CheckCheck, ClipboardList, Zap } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { QuickPaySheet } from "@/components/orderDetail/Money";
import { fetchTenant, resolveCurrentEmployee } from "@/lib/orderDetailApi";
import { recordOrderPayment } from "@/lib/orderMoneyApi";
import { sendPaymentReceipt, remainingBalance, orderTotal } from "@/lib/orderEmails";
import { loadCatalog, buildSearchIndex, loadDeviceChips, loadProducts, createOrder, fetchCustomerById, refetchOrder, registerOpen } from "@/lib/wizard/api";
import { IOS, STEPS, TOTAL_STEPS, MODES, shouldSkipStep } from "@/lib/wizard/helpers";
import { listOffers, offerLive } from "@/lib/inicioApi";
import { offerIsDevice, resolveDeviceOffer, offerDeviceCtx } from "@/lib/wizard/offers";
import { useWizard, loadDraft, discardDraft, rememberMode } from "./state";
import { Overlay, W, Banner } from "./ui";
import StepCustomer, { runNewCustomerAdvance } from "./StepCustomer";
import StepDevice from "./StepDevice";
import StepProblem, { AddItemDialog, partNeedsOrder } from "./StepProblem";
import StepPhotos from "./StepPhotos";
import StepDetails from "./StepDetails";
import { StepEstimate, StepSignature, StepConfirm } from "./StepFinish";
import { RechargePage, UnlockPage, WarrantySearchDialog, ModeSelection } from "./SinglePage";

const STEP_ICON = { 1: UserRound, 2: Smartphone, 3: MessageSquareWarning, 4: Camera, 5: ListChecks, 7: CircleDollarSign, 9: PenLine, 10: CheckCheck };

function useNarrow() {
  const q = "(max-width: 899px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setV(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}

export default function NewOrderWizard({ open, onClose, onCreated, prefill = null, resume = false, tenant: tenantProp, employee: employeeProp }) {
  if (!open) return null;
  return <WizardInner onClose={onClose} onCreated={onCreated} prefill={prefill} resume={resume} tenantProp={tenantProp} employeeProp={employeeProp} />;
}

function WizardInner({ onClose, onCreated, prefill, resume, tenantProp, employeeProp }) {
  const navigate = useNavigate();
  const narrow = useNarrow();
  let tenantId = "";
  try { tenantId = localStorage.getItem("smartfix_tenant_id") || ""; } catch { tenantId = ""; }
  const draft = useMemo(() => (resume ? loadDraft() : null), [resume]);
  const w = useWizard({ prefill, draft });
  const { s, set } = w;
  const [tenant, setTenant] = useState(tenantProp || null);
  const [employee, setEmployee] = useState(employeeProp || null);
  const [cat, setCat] = useState(null);
  const [index, setIndex] = useState([]);
  const [chips, setChips] = useState([]);
  const [catError, setCatError] = useState(false);
  const [products, setProducts] = useState([]);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(null);
  const [error, setError] = useState(null);
  const [dup, setDup] = useState(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [newError, setNewError] = useState(null);
  const [autoAdv, setAutoAdv] = useState(false);
  const [advToken, setAdvToken] = useState(0);
  const overlayRef = useRef(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [created, setCreated] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [payOrder, setPayOrder] = useState(null);
  const [payPrefill, setPayPrefill] = useState(null);
  const [closedAlert, setClosedAlert] = useState(false);
  const [bgToast, setBgToast] = useState(null);
  const finishedRef = useRef(false);
  const paidRef = useRef(false);

  const createdByName = String(employee?.full_name || "").trim() || "Usuario";

  useEffect(() => {
    if (!tenantProp && tenantId) fetchTenant(tenantId).then(setTenant).catch(() => {});
    if (!employeeProp && tenantId) resolveCurrentEmployee(tenantId).then(setEmployee).catch(() => {});
  }, [tenantId]);

  const loadCat = useCallback(() => {
    setCatError(false);
    loadCatalog(tenantId).then((c) => { setCat(c); setIndex(buildSearchIndex(c)); }, () => setCatError(true));
  }, [tenantId]);
  useEffect(() => { loadCat(); loadProducts(tenantId).then(setProducts).catch(() => {}); registerOpen(tenantId).then(setCashOpen).catch(() => {}); }, [tenantId, loadCat]);
  useEffect(() => {
    if (!tenantId) return;
    listOffers(tenantId).then((rows) => set({ offers: rows.filter((o) => offerIsDevice(o) && offerLive(o)) })).catch(() => {});
  }, [tenantId, set]);
  const offerKey = `${s.brand?.name || ""}|${s.family?.name || ""}|${s.model?.name || s.customModelText || ""}|${s.offers.length}`;
  useEffect(() => { w.reapplyOffers(); }, [offerKey, w.reapplyOffers]);

  useEffect(() => {
    if (!cat || !s.draftRefs) return;
    const r = s.draftRefs;
    (async () => {
      const patch = { draftRefs: null };
      if (r.customerId) { const c = await fetchCustomerById(r.customerId).catch(() => null); if (c) patch.customer = c; }
      const category = r.categoryId ? cat.categories.find((x) => x.id === r.categoryId) : null;
      const brand = r.brandId ? cat.brands.find((x) => x.id === r.brandId) : null;
      const family = r.familyId ? cat.families.find((x) => x.id === r.familyId) : null;
      const model = r.modelId ? cat.models.find((x) => x.id === r.modelId) : null;
      if (category) patch.category = category;
      if (brand) patch.brand = brand;
      if (family) patch.family = family;
      if (model) patch.model = model;
      set(patch);
    })();
  }, [cat]);

  useEffect(() => { if (index.length && s.step === 2) loadDeviceChips(tenantId, s.customer?.id || null, index).then(setChips).catch(() => {}); }, [index, s.step, s.customer?.id]);

  useEffect(() => {
    const save = () => { if (!finishedRef.current) w.saveDraft(); };
    const onVis = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", save);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("beforeunload", save); };
  }, []);

  useEffect(() => {
    if (s.step !== 2) { if (advToken) setAdvToken(0); setAutoAdv(false); return undefined; }
    if (!advToken) { setAutoAdv(false); return undefined; }
    setAutoAdv(true);
    const t = setTimeout(() => {
      setAutoAdv(false);
      setAdvToken(0);
      if (w.ref.current.step === 2 && !overlayRef.current && w.ref.current.category && w.ref.current.brand && w.canAdvance(2)) w.jumpForward();
    }, 1100);
    return () => { clearTimeout(t); setAutoAdv(false); };
  }, [s.step, advToken]);

  useEffect(() => { if (bgToast) { const t = setTimeout(() => setBgToast(null), 6000); return () => clearTimeout(t); } return undefined; }, [bgToast]);

  const singlePage = s.mode === "recharge" || s.mode === "unlock";
  const step = s.step;
  const meta = STEPS[step];
  const StepIcon = STEP_ICON[step] || ListChecks;
  const modeColor = MODES[s.mode].color;
  const isLast = step === TOTAL_STEPS || (!singlePage && w.steps[w.steps.length - 1] === step);
  const catalogSel = { category: s.category, brand: s.brand, family: s.family, model: s.model };

  const dismiss = () => {
    finishedRef.current = true;
    onClose();
  };
  const requestClose = () => {
    if (busy || created || celebrate || payOrder || closedAlert) return;
    if (w.hasAnyData()) setConfirmClose(true); else dismiss();
  };

  const switchMode = (mode) => {
    set({ mode });
    rememberMode(mode);
  };

  const afterCreate = async (order, charge) => {
    finishedRef.current = true;
    discardDraft();
    setCreated(order);
    setCelebrate(true);
    await new Promise((r) => setTimeout(r, 1500));
    setCelebrate(false);
    const wantsCharge = charge === "deposit" ? s.deposit > 0 : charge === "full";
    if (!wantsCharge) { onCreated?.(order); dismiss(); return; }
    const open = await registerOpen(tenantId).catch(() => false);
    if (!open) { setClosedAlert(true); return; }
    const fresh = (await refetchOrder(order.id)) || order;
    setPayPrefill(charge === "deposit" ? s.deposit : null);
    setPayOrder(fresh);
  };

  const runCreate = async (charge) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const st = w.ref.current;
      const order = await createOrder({ s: st, tenantId, tenant, createdByName, onPhase: setPhase, onBackgroundError: setBgToast });
      setBusy(false);
      setPhase(null);
      await afterCreate(order, charge);
    } catch (e) {
      setBusy(false);
      setPhase(null);
      setError(e?.message || String(e));
    }
  };

  const submitPayment = async ({ amount, method, customLabel, label }) => {
    const res = await recordOrderPayment({ order: payOrder, amount, method, customLabel, by: createdByName });
    paidRef.current = true;
    const fresh = (await refetchOrder(payOrder.id)) || payOrder;
    if (String(fresh.customer_email || "").trim() && tenant) sendPaymentReceipt({ order: fresh, tenant, amount: res.applied, method, isFull: res.isPaidNow, transactionId: res.transactionId }).catch(() => {});
    return { label, settled: orderTotal(fresh) > 0 && remainingBalance(fresh) <= 0.004 };
  };

  const finishAfterPay = () => { setPayOrder(null); onCreated?.(created); dismiss(); };

  const onNext = async () => {
    if (busy || !w.canAdvance(step)) return;
    setError(null);
    if (step === 1 && s.customerTab === 1 && !s.anonymous) {
      await runNewCustomerAdvance({ mode: "start", tenantId, s: w.ref.current, set, jumpForward: w.jumpForward, setBusy, setDup, setCheckFailed, setNewError });
      return;
    }
    if (isLast) { runCreate("deposit"); return; }
    w.jumpForward();
  };

  const onAdvanceNew = (mode) => runNewCustomerAdvance({ mode, tenantId, s: w.ref.current, set, jumpForward: w.jumpForward, setBusy, setDup, setCheckFailed, setNewError });

  const pickWarrantyOrder = (o) => { finishedRef.current = true; setWarrantyOpen(false); dismiss(); navigate(`/Orders/${o.id}?warranty=1`); };

  const finalLabel = s.serviceType === "workshop" && s.deposit <= 0 ? "Crear sin depósito" : s.mode === "quick" ? "Finalizar Orden Rápida" : "Confirmar Orden";
  const nextEnabled = w.canAdvance(step) && !busy;

  if (!s.modeSelected) {
    return (
      <Overlay z={300} onEscape={requestClose}>
        <div className="flex-1 overflow-y-auto"><ModeSelection onCancel={dismiss} onWarranty={() => setWarrantyOpen(true)} onPick={(mode, service) => { set({ mode, serviceType: service, modeSelected: true }); rememberMode(mode); }} /></div>
        <WarrantySearchDialog open={warrantyOpen} tenantId={tenantId} onClose={() => setWarrantyOpen(false)} onPick={pickWarrantyOrder} />
      </Overlay>
    );
  }

  const body = (() => {
    if (singlePage) {
      const Page = s.mode === "recharge" ? RechargePage : UnlockPage;
      return <Page w={w} tenantId={tenantId} products={products} busy={busy} onCreate={(charge) => runCreate(charge ? "full" : "none")} hint={error && <Banner color={IOS.red} onDismiss={() => setError(null)}>{error}</Banner>} />;
    }
    if (!cat && step === 2 && !catError) return <div className="flex justify-center" style={{ padding: 60 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: W.sub }} /></div>;
    switch (step) {
      case 1: return <StepCustomer w={w} tenantId={tenantId} onOpenWarranty={() => setWarrantyOpen(true)} onSwitchMode={switchMode} onAdvanceNew={onAdvanceNew} dupAlert={dup} setDupAlert={setDup} checkFailed={checkFailed} setCheckFailed={setCheckFailed} newError={newError} setNewError={setNewError} busy={busy} />;
      case 2: return catError ? <div className="flex flex-col items-center" style={{ padding: 40, gap: 10 }}><p style={{ fontWeight: 700 }}>No se pudo cargar el catálogo</p><button onClick={loadCat} style={{ color: IOS.orange, fontWeight: 600 }}>Reintentar</button></div>
        : <StepDevice w={w} tenantId={tenantId} cat={cat} index={index} chips={chips} onCatalogChange={(c) => { setCat(c); setIndex(buildSearchIndex(c)); }} autoAdvancing={autoAdv} onPicked={() => setAdvToken((n) => n + 1)} onCancelAdvance={() => setAdvToken(0)} onOverlay={(v) => { overlayRef.current = v; if (v) setAdvToken(0); }} />;
      case 3: return <StepProblem w={w} tenantId={tenantId} products={products} catalogSel={catalogSel} onAddItemOpen={() => setAddItemOpen(true)} />;
      case 4: return <StepPhotos w={w} tenantId={tenantId} />;
      case 5: return <StepDetails w={w} tenantId={tenantId} currentEmployee={employee} />;
      case 7: return <StepEstimate w={w} tenantId={tenantId} goToProblem={() => w.goTo(3)} />;
      case 9: return <StepSignature w={w} tenant={tenant} />;
      case 10: return <StepConfirm w={w} cashOpen={cashOpen} />;
      default: return null;
    }
  })();

  const rail = (
    <div className="flex flex-col" style={{ width: 190, background: W.card, padding: "18px 12px", gap: 14, flexShrink: 0 }}>
      <div className="flex items-start gap-2">
        <span className="flex-1"><span className="block" style={{ fontSize: 17, fontWeight: 800 }}>Nueva orden</span><span className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 700, color: modeColor }}>{s.mode === "quick" ? <Zap className="w-3 h-3" /> : <ClipboardList className="w-3 h-3" />} {MODES[s.mode].label}</span></span>
        <button onClick={requestClose} aria-label="Cerrar" style={{ width: 30, height: 30, borderRadius: 999, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-4 h-4" /></button>
      </div>
      {!singlePage && <p style={{ fontSize: 12, color: W.sub }}>{w.logicalStep}/{w.steps.length}</p>}
      <div className="flex flex-col" style={{ gap: 2 }}>
        {!singlePage && w.steps.map((n, i) => {
          const cur = n === step;
          const done = w.ref.current.visited.includes(n) && n < step;
          const canJump = s.visited.includes(n) && !cur && (n < step || w.canAdvance(step));
          return (
            <button key={n} onClick={() => canJump && w.goTo(n)} disabled={!canJump && !cur} className="flex items-center gap-2 text-left" style={{ padding: "8px 8px", borderRadius: 10, background: cur ? tint(modeColor, 0.14) : "transparent" }} aria-current={cur ? "step" : undefined}>
              <span style={{ width: 26, height: 26, borderRadius: 999, background: cur ? modeColor : done ? tint(modeColor, 0.18) : "#3A3A3C", color: done ? modeColor : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {cur ? <span style={{ width: 8, height: 8, borderRadius: 999, background: "#fff" }} /> : done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span style={{ fontSize: 14, fontWeight: cur ? 700 : 500, color: cur || done ? "#fff" : W.sub }}>{STEPS[n].title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Overlay z={300} onEscape={requestClose}>
      {narrow && (
        <div style={{ padding: "12px 16px 8px", background: W.card }}>
          <div className="flex items-center gap-2">
            <span className="flex-1" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: modeColor, textTransform: "uppercase" }}>{singlePage ? MODES[s.mode].label : meta.title}</span>
            <button onClick={requestClose} aria-label="Cerrar"><X className="w-5 h-5" /></button>
          </div>
          {!singlePage && (
            <div className="flex items-center gap-1.5" style={{ marginTop: 8 }}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => s.visited.includes(n) && !shouldSkipStep(n, s.mode) && n !== step && (n < step || w.canAdvance(step)) && w.goTo(n)} aria-label={STEPS[n].title} style={{ flex: 1, height: 5, borderRadius: 999, background: n <= step ? modeColor : "#3A3A3C", opacity: shouldSkipStep(n, s.mode) ? 0.35 : 1 }} />
              ))}
              <span style={{ fontSize: 11, color: W.sub, marginLeft: 6 }}>{w.logicalStep}/{w.steps.length}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        {!narrow && rail}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto flex flex-col" style={{ maxWidth: 1100, padding: narrow ? "16px 16px 24px" : "24px 32px 32px", gap: 20 }}>
              {!singlePage && !narrow && (
                <div className="flex items-center gap-3">
                  <span style={{ width: 46, height: 46, borderRadius: 14, background: tint(meta.color, 0.15), color: meta.color, display: "flex", alignItems: "center", justifyContent: "center" }}><StepIcon className="w-6 h-6" /></span>
                  <span><span className="block" style={{ fontSize: 26, fontWeight: 800 }}>{meta.title}</span><span className="block" style={{ fontSize: 14, color: W.sub }}>{meta.subtitle}</span></span>
                </div>
              )}
              {singlePage && !narrow && (
                <div className="flex items-center gap-3"><span style={{ width: 42, height: 42, borderRadius: 12, background: modeColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList className="w-5 h-5" /></span><span><span className="block" style={{ fontSize: 24, fontWeight: 800 }}>{MODES[s.mode].label}</span><span className="block" style={{ fontSize: 14, color: W.sub }}>Una sola página</span></span></div>
              )}
              {body}
            </div>
          </div>
          {!singlePage && (
            <div style={{ borderTop: `0.5px solid ${W.sep}`, background: "rgba(28,28,30,0.95)", padding: "12px 24px" }}>
              {(error || busy) && (
                <div className="mx-auto" style={{ maxWidth: 1100, marginBottom: 10 }}>
                  {busy && phase ? <p className="flex items-center gap-2" style={{ fontSize: 14, color: W.sub }}><Loader2 className="w-4 h-4 animate-spin" /> {phase}</p> : error ? <Banner color={IOS.red} onDismiss={() => setError(null)}>{error}</Banner> : null}
                </div>
              )}
              <div className="mx-auto flex items-center" style={{ maxWidth: 1100, gap: 12 }}>
                {step > 1 && <button onClick={w.goBack} disabled={busy} className="apple-press flex items-center gap-1 disabled:opacity-40" style={{ height: 52, padding: "0 20px", borderRadius: 16, background: "#3A3A3C", fontSize: 16, fontWeight: 600 }}><ChevronLeft className="w-5 h-5" /> Atrás</button>}
                <span className="flex-1" />
                <button onClick={onNext} disabled={!nextEnabled} className="apple-press flex items-center justify-center gap-2" style={{ minWidth: 220, height: 52, padding: "0 24px", borderRadius: 16, background: nextEnabled ? `linear-gradient(135deg, ${modeColor}, ${tint(modeColor, 0.75)})` : "#3A3A3C", color: nextEnabled ? "#fff" : W.sub, fontSize: 17, fontWeight: 700 }}>
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : isLast ? <><BadgeCheck className="w-5 h-5" /> {finalLabel}</> : <>Siguiente <ChevronRight className="w-5 h-5" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {bgToast && <div className="fixed left-1/2" style={{ zIndex: 460, bottom: 90, transform: "translateX(-50%)", maxWidth: "calc(100vw - 32px)", padding: "10px 16px", borderRadius: 12, background: IOS.red, color: "#fff", fontSize: 14, fontWeight: 600 }}>{bgToast}</div>}
      <AddItemDialog open={addItemOpen} onClose={() => setAddItemOpen(false)} products={products} sel={catalogSel} onPick={(p) => { w.addItem(p); if (partNeedsOrder(p)) set({ oosFor: p }); }} resolvePromo={(p) => resolveDeviceOffer(p, s.offers, offerDeviceCtx({ ...catalogSel, customModelText: s.customModelText }))} />
      <WarrantySearchDialog open={warrantyOpen} tenantId={tenantId} onClose={() => setWarrantyOpen(false)} onPick={pickWarrantyOrder} />
      <AlertDialog open={confirmClose} title="¿Descartar orden?" message={w.saveable() ? "Las fotos nunca se subieron. También puedes guardar cliente y equipo para seguir después." : "Perderás los datos capturados. Las fotos nunca se subieron."} onClose={() => setConfirmClose(false)}
        actions={[
          { label: "Descartar", destructive: true, onPress: () => { discardDraft(); dismiss(); } },
          { label: "Continuar editando", bold: true },
          ...(w.saveable() ? [{ label: "Guardar y salir", onPress: () => { w.saveDraft(); dismiss(); } }] : []),
        ]} />
      {celebrate && created && (
        <div className="fixed inset-0 flex flex-col items-center justify-center text-center" style={{ zIndex: 470, background: "rgba(0,0,0,0.85)", gap: 10 }}>
          <BadgeCheck className="w-20 h-20" style={{ color: IOS.green }} />
          <p style={{ fontSize: 26, fontWeight: 800 }}>Orden confirmada</p>
          <p style={{ fontSize: 16, color: W.sub }}>{created.order_number} · {created.customer_name}</p>
        </div>
      )}
      <QuickPaySheet open={!!payOrder} order={payOrder} tenant={tenant} prefillAmount={payPrefill} onClose={finishAfterPay}
        onSubmit={async (p) => { await submitPayment(p); }} />
      <AlertDialog open={closedAlert} title="Caja cerrada" message="Abre la caja desde el Dashboard antes de registrar un cobro o depósito. La orden se creó, puedes cobrarla luego." onClose={() => { setClosedAlert(false); onCreated?.(created); dismiss(); }}
        actions={[{ label: "Ir al Inicio", bold: true, onPress: () => navigate("/Dashboard") }, { label: "Cancelar" }]} />
    </Overlay>
  );
}


