import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileClock, X, CalendarCheck } from "lucide-react";
import { AlertDialog } from "@/components/pos/native/posUi";
import { OpenCashSheet, CloseCashSheet } from "@/components/cash/CashSheets";
import { fetchTenant, resolveCurrentEmployee } from "@/lib/orderDetailApi";
import { fetchOpenRegister, canCloseCashRegister, isAdminOrOwner } from "@/lib/cashRegisterApi";
import { safeTZ, zonedParts } from "@/lib/finance/tz";
import { money } from "@/components/finanzas/ui";
import { FP } from "@/lib/finance/ledger";
import {
  fetchDashboardOrders, fetchTodayTotals, subscribeDashboard, activeWarrantyOrders, isMonthlyLimitReached, trialInfo, leftOpenYesterday,
  listOffers, listActiveProducts, fetchAppointments, num, quoteSummary,
} from "@/lib/inicioApi";
import { fetchOpenEntry, fetchOpenTenantEntries, todayOverview, matchIdsFor, currentAuthUid, closeIfOverdue, isFromEarlierDay, subscribeTimeEntries } from "@/lib/punchApi";
import InicioHeader from "@/components/inicio/Header";
import { HeroRevenue, ActionTiles, Watchdog, LeftOpenYesterday, EnTurnoAhora, ShiftControls, TrialBanner, WelcomeCard, ErrorBanner, WarrantiesCard, OrderCreatedToast } from "@/components/inicio/Cards";
import { PartSearchBar, QuickQuoteDialog } from "@/components/inicio/PartSearch";
import { QuotesListDialog } from "@/components/inicio/Quotes";
import { WarrantiesDialog, UpcomingVisitsCard, AppointmentsDialog } from "@/components/inicio/Extras";
import HoyBriefing, { shouldAutoBriefing } from "@/components/inicio/Hoy";
import { ActiveOffersCard, OffersDialog } from "@/components/inicio/Offers";
import { PrimerosPasosCard, WelcomeOnboarding, PaywallDialog, welcomeSeen } from "@/components/inicio/Onboarding";
import PunchKiosk from "@/components/punch/PunchKiosk";
import NewOrderWizard from "@/components/wizard/Wizard";
import { loadDraft, discardDraft, draftSummary } from "@/components/wizard/state";
import { fetchTenant as fetchTenantFresh } from "@/lib/orderDetailApi";


function storedTenantId() {
  try {
    return localStorage.getItem("smartfix_tenant_id") || "";
  } catch {
    return "";
  }
}

function useWide() {
  const q = "(min-width: 768px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setV(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const wide = useWide();
  const tenantId = storedTenantId();
  const [tenant, setTenant] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [authUid, setAuthUid] = useState(null);
  const tz = safeTZ(tenant?.timezone);
  const [orders, setOrders] = useState([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [today, setToday] = useState({ revenue: 0, expenses: 0, net: 0 });
  const [register, setRegister] = useState(null);
  const [openEntry, setOpenEntry] = useState(null);
  const [overview, setOverview] = useState([]);
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [created, setCreated] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [cashSheet, setCashSheet] = useState(null);
  const [quoteSeed, setQuoteSeed] = useState(null);
  const [quotesKey, setQuotesKey] = useState(0);
  const [wizard, setWizard] = useState(null);
  const [draft, setDraft] = useState(() => loadDraft());
  const [quoteFromList, setQuoteFromList] = useState(false);
  const errorSeen = useRef(false);
  const [limitAlert, setLimitAlert] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [goalHit, setGoalHit] = useState(null);
  const closeCashDone = useRef(null);
  const adminLevel = isAdminOrOwner(employee);

  const flash = (msg, bad) => { setToast({ msg, bad }); setTimeout(() => setToast(null), 2600); };

  useEffect(() => {
    if (!tenantId) return;
    fetchTenant(tenantId).then(setTenant).catch(() => {});
    resolveCurrentEmployee(tenantId).then(setEmployee).catch(() => {});
    currentAuthUid().then(setAuthUid);
  }, [tenantId]);

  const matchIds = useMemo(() => matchIdsFor(employee, authUid), [employee, authUid]);

  const loadMain = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [o, t] = await Promise.all([fetchDashboardOrders(tenantId), fetchTodayTotals(tenantId, tz)]);
      setOrders(o);
      setToday(t);
      setOrdersLoaded(true);
      errorSeen.current = true;
      setError(null);
    } catch (e) {
      setOrdersLoaded(true);
      if (!errorSeen.current) setError((prev) => prev || e?.message || String(e));
    }
  }, [tenantId, tz]);

  const loadShift = useCallback(async () => {
    if (!tenantId) return;
    fetchOpenRegister(tenantId).then(setRegister).catch(() => {});
    if (!matchIds.length) return;
    try {
      let mine = await fetchOpenEntry(tenantId, matchIds);
      if (mine && isFromEarlierDay(mine, tz)) {
        const t = await fetchTenantFresh(tenantId);
        if (t) {
          const r = await closeIfOverdue(mine, t.settings?.business_hours, tz, tenantId, 0);
          if (r?.status === "closed") mine = null;
        }
      }
      setOpenEntry(mine);
    } catch {
      return;
    }
  }, [tenantId, matchIds, tz]);

  const loadOverview = useCallback(async () => {
    if (!tenantId || !adminLevel) { setOverview([]); return; }
    todayOverview(tenantId, tz).then(setOverview).catch(() => {});
    let last = 0;
    try { last = Number(localStorage.getItem(`punch.sweep.${tenantId}`)) || 0; } catch { last = 0; }
    if (Date.now() - last < 5 * 60000) return;
    try { localStorage.setItem(`punch.sweep.${tenantId}`, String(Date.now())); } catch { last = 0; }
    const open = await fetchOpenTenantEntries(tenantId).catch(() => []);
    const others = open.filter((e) => e.employee_id && !matchIds.includes(e.employee_id) && isFromEarlierDay(e, tz));
    let closed = false;
    if (others.length) {
      const t = await fetchTenantFresh(tenantId);
      if (t) {
        for (const e of others) {
          const r = await closeIfOverdue(e, t.settings?.business_hours, tz, tenantId, 2);
          if (r?.status === "closed") closed = true;
        }
      }
    }
    if (closed) todayOverview(tenantId, tz).then(setOverview).catch(() => {});
  }, [tenantId, adminLevel, tz, matchIds]);

  const loadExtras = useCallback(() => {
    if (!tenantId) return;
    Promise.all([listOffers(tenantId), listActiveProducts(tenantId)]).then(([o, p]) => { setOffers(o); setProducts(p); }).catch(() => {});
    fetchAppointments(tenantId, tz).then(setAppointments).catch(() => {});
  }, [tenantId, tz]);

  useEffect(() => { loadMain(); }, [loadMain]);
  useEffect(() => { loadShift(); }, [loadShift]);
  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadExtras(); }, [loadExtras]);
  useEffect(() => {
    if (!tenantId) return undefined;
    const a = subscribeDashboard(tenantId, () => { loadMain(); loadShift(); });
    const b = subscribeTimeEntries(tenantId, () => { loadShift(); loadOverview(); });
    const onVis = () => { if (document.visibilityState === "visible") { loadMain(); loadShift(); loadOverview(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { a(); b(); document.removeEventListener("visibilitychange", onVis); };
  }, [tenantId, loadMain, loadShift, loadOverview]);

  useEffect(() => {
    if (ordersLoaded && !welcomeSeen()) setShowWelcome(true);
  }, [ordersLoaded]);

  const goal = num(tenant?.settings?.daily_revenue_goal);
  useEffect(() => {
    if (!(goal > 0) || !(today.revenue >= goal) || !tenant) return;
    const p = zonedParts(new Date(), tz);
    const key = `dailyGoalNotifSent_${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setGoalHit(`Llegaste a ${money(goal)} hoy en ${tenant.name || "tu taller"}. ¡Excelente trabajo!`);
    setTimeout(() => setGoalHit(null), 5000);
  }, [goal, today.revenue, tenant, tz]);

  const requestNewOrder = (prefill = null, resume = false) => {
    if (isMonthlyLimitReached(tenant, orders, tz)) { setLimitAlert(true); return; }
    setWizard({ prefill, resume });
  };

  const requestCloseCash = (after) => {
    if (!register) { setCashSheet("open"); return; }
    if (!canCloseCashRegister({ register, employee, tenant })) { flash("Solo el dueño, un administrador o quien abrió la caja puede cerrarla.", true); return; }
    closeCashDone.current = after || null;
    setCashSheet("close");
  };

  const briefingTried = useRef(false);
  useEffect(() => {
    if (briefingTried.current || wide || !ordersLoaded || sheet || wizard || showWelcome || cashSheet) return;
    briefingTried.current = true;
    if (shouldAutoBriefing(tz)) setSheet("hoy");
  }, [wide, ordersLoaded, sheet, wizard, showWelcome, cashSheet, tz]);

  const warranties = useMemo(() => activeWarrantyOrders(orders), [orders]);
  const left = leftOpenYesterday(openEntry, register, tz);
  const trial = trialInfo(tenant);
  const shopName = String(tenant?.name || "").trim() || "Archilla OS";
  const openOrder = (id) => navigate(`/Orders/${id}`);
  const watchdog = today.expenses > 0 && today.net < 0;

  const primerosActions = {
    settings: (section) => navigate(section ? `/Settings?open=${section}` : "/Settings"),
    inventory: () => navigate("/Inventory"),
    newOrder: () => requestNewOrder(),
    pos: () => navigate("/POS"),
  };

  const hoyCard = (
    <button onClick={() => setSheet("hoy")} className="apple-press flex items-center gap-3 text-left" style={{ padding: 16, borderRadius: 16, background: "#1C1C1E" }}>
      <span style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(242,102,46,0.15)", color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CalendarCheck className="w-5 h-5" /></span>
      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Hoy</span><span className="block" style={{ fontSize: 12, color: "#8E8E93" }}>Lo que tienes por atender: órdenes, cobros, tareas e inventario</span></span>
      <span style={{ color: FP.brand, fontSize: 13, fontWeight: 700 }}>Ver mi día</span>
    </button>
  );

  const hero = <HeroRevenue revenue={today.revenue} expenses={today.expenses} net={today.net} goal={goal} onClick={() => navigate("/Financial")} />;
  const partSearch = <PartSearchBar tenantId={tenantId} tenant={tenant} onQuote={(seed) => { setQuoteFromList(false); setQuoteSeed(seed); setSheet("quote"); }} />;
  const shiftControls = <ShiftControls register={register} openEntry={openEntry} showPunch tz={tz} onCash={() => (register ? requestCloseCash() : setCashSheet("open"))} onPunch={() => setSheet("punch")} />;
  const warrantyCard = warranties.length > 0 && <WarrantiesCard list={warranties} tz={tz} onOpen={() => setSheet("warranties")} />;
  const offersCard = <ActiveOffersCard offers={offers} products={products} onOpen={() => setSheet("offers")} />;
  const visitsCard = <UpcomingVisitsCard orders={appointments} tz={tz} onOpenOrder={openOrder} onViewAll={() => setSheet("appointments")} />;

  return (
    <div className="apple-type min-h-dvh" style={{ background: "#000", color: "#fff", paddingBottom: 120 }}>
      <div className="mx-auto flex flex-col" style={{ maxWidth: 1600, padding: "16px 16px 0", gap: 24 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>Inicio</h1>
        <InicioHeader employee={employee} tenant={tenant} tz={tz} wide={wide} tenantId={tenantId} />
        {draft && !wizard && (
          <div className="flex items-center gap-3" style={{ padding: 16, borderRadius: 16, background: "#1C1C1E" }}>
            <span style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(242,102,46,0.15)", color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileClock className="w-5 h-5" /></span>
            <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Orden a medias</span><span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{draftSummary(draft)}</span></span>
            <button onClick={() => { discardDraft(); setDraft(null); }} aria-label="Descartar borrador" style={{ width: 28, height: 28, borderRadius: 999, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-3.5 h-3.5" /></button>
            <button onClick={() => requestNewOrder(null, true)} className="apple-press" style={{ padding: "8px 14px", borderRadius: 999, background: FP.brand, color: "#fff", fontSize: 12, fontWeight: 700 }}>Continuar</button>
          </div>
        )}
        {trial && <TrialBanner info={trial} onClick={() => setSheet("paywall")} />}
        <PrimerosPasosCard tenant={tenant} tenantId={tenantId} actions={primerosActions} />
        {hoyCard}
        {wide && hero}
        {wide && <ActionTiles wide onNewOrder={() => requestNewOrder()} onQuotes={() => setSheet("quotes")} />}
        {watchdog && <Watchdog net={today.net} />}
        {(left.punch || left.cash) && (
          <LeftOpenYesterday punchAt={left.punch} cashAt={left.cash} cashExpected={register ? num(register.opening_balance) : null} tz={tz}
            onPunch={() => setSheet("punch")} onCash={() => requestCloseCash()} />
        )}
        {adminLevel && overview.length > 0 && <EnTurnoAhora entries={overview} onClick={() => setSheet("punch")} />}
        {wide ? (
          <>
            {partSearch}
            {shiftControls}
            {warrantyCard}
            {offersCard}
            {visitsCard}
          </>
        ) : (
          <>
            {hero}
            <ActionTiles wide={false} onNewOrder={() => requestNewOrder()} />
            {partSearch}
            {shiftControls}
            {offersCard}
            {warrantyCard}
            {ordersLoaded && orders.length === 0 && <WelcomeCard onNewOrder={() => requestNewOrder()} />}
            {visitsCard}
          </>
        )}
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>

      <QuickQuoteDialog open={sheet === "quote"} seed={quoteSeed} onClose={() => { setSheet(quoteFromList ? "quotes" : null); setQuoteFromList(false); }} tenantId={tenantId} tenant={tenant} employeeName={employee?.full_name || ""}
        onSaved={() => { setQuotesKey((k) => k + 1); flash("Cotización guardada"); }} />
      <QuotesListDialog open={sheet === "quotes"} onClose={() => setSheet(null)} tenantId={tenantId} shopName={shopName} refreshKey={quotesKey}
        onNewQuote={() => { setQuoteFromList(true); setQuoteSeed(null); setSheet("quote"); }}
        onConvert={(q) => requestNewOrder({ quote: { customer_name: q.customer_name, customer_phone: q.customer_phone, total: q.total, summary: quoteSummary(q) } })} />
      <WarrantiesDialog open={sheet === "warranties"} onClose={() => setSheet(null)} tenantId={tenantId} tz={tz} shopName={shopName} onOpenOrder={openOrder} />
      <AppointmentsDialog open={sheet === "appointments"} onClose={() => setSheet(null)} tenantId={tenantId} tz={tz} onOpenOrder={openOrder} />
      <OffersDialog open={sheet === "offers"} onClose={() => setSheet(null)} tenantId={tenantId} products={products} onChanged={loadExtras} />
      <PaywallDialog open={sheet === "paywall"} onClose={() => setSheet(null)} onSubscribe={() => navigate("/dashboard/billing")} />
      <OpenCashSheet open={cashSheet === "open"} onClose={() => setCashSheet(null)} tenantId={tenantId} tenant={tenant} employee={employee} onOpened={(r) => setRegister(r)} />
      <CloseCashSheet open={cashSheet === "close"} onClose={() => setCashSheet(null)} register={register} tenantId={tenantId} tenant={tenant} employee={employee}
        onClosed={() => { setRegister(null); setCashSheet(null); const cb = closeCashDone.current; closeCashDone.current = null; cb?.(); loadMain(); }}
        onAlreadyClosed={() => { setRegister(null); setCashSheet(null); }} />
      <PunchKiosk open={sheet === "punch"} onClose={() => { setSheet(null); loadShift(); loadOverview(); }} tenantId={tenantId} tenant={tenant} sessionEmployee={employee}
        cashOpen={!!register} onOpenCloseCash={(done) => requestCloseCash(done)} onChanged={() => { loadShift(); loadOverview(); }} />
      <HoyBriefing open={sheet === "hoy"} onClose={() => setSheet(null)} tenant={tenant} tenantId={tenantId} tz={tz} employee={employee} orders={orders} products={products}
        hasPunch={!!openEntry} hasCash={!!register} onPunch={() => setSheet("punch")} onCash={() => (register ? requestCloseCash() : setCashSheet("open"))}
        onOpenOrder={openOrder} onPay={(id) => navigate(`/Orders/${id}?pay=1`)} />
      <WelcomeOnboarding open={showWelcome} tenant={tenant} onAction={(key) => { setShowWelcome(false); if (key) primerosActions[key]?.(); }} />
      <AlertDialog open={limitAlert} title="Límite del plan alcanzado" message="Alcanzaste el límite de 50 órdenes este mes. Actualiza a Plan Pro para crear órdenes sin límite." onClose={() => setLimitAlert(false)} actions={[{ label: "Entendido", bold: true }]} />
      {wizard && (
        <NewOrderWizard open prefill={wizard.prefill} resume={wizard.resume} tenant={tenant} employee={employee}
          onClose={() => { setWizard(null); setDraft(loadDraft()); }}
          onCreated={(order) => { setCreated(order); loadMain(); setTimeout(() => setCreated((c) => (c && c.id === order?.id ? null : c)), 4000); }} />
      )}
      <OrderCreatedToast order={created} onView={() => { const id = created?.id; setCreated(null); if (id) openOrder(id); }} />
      {toast && <div className="fixed left-1/2" style={{ zIndex: 480, bottom: 110, transform: "translateX(-50%)", padding: "10px 16px", borderRadius: 999, background: toast.bad ? FP.danger : "#2C2C2E", color: "#fff", fontSize: 14, fontWeight: 600, maxWidth: "calc(100vw - 32px)" }}>{toast.msg}</div>}
      {goalHit && (
        <div className="fixed left-1/2 flex flex-col items-center text-center" style={{ zIndex: 260, top: 20, transform: "translateX(-50%)", padding: "14px 20px", borderRadius: 18, background: FP.success, color: "#fff", maxWidth: "calc(100vw - 32px)" }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>¡Meta alcanzada!</span>
          <span style={{ fontSize: 14 }}>{goalHit}</span>
        </div>
      )}
    </div>
  );
}
