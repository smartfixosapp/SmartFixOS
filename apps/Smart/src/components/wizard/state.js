import { useCallback, useMemo, useRef, useState } from "react";
import { CHECKLIST_ITEMS, TOTAL_STEPS, shouldSkipStep, activeSteps, cartTotals, IVU } from "@/lib/wizard/helpers";
import { resolveDeviceOffer, offerDeviceCtx, applyOfferToLine } from "@/lib/wizard/offers";
import { discountEnded } from "@/lib/discounts";

export const DRAFT_KEY = "wizard.draft.v1";
const LAST_MODE_KEY = "wizard.lastOrderMode";
export const VISIT_TOGGLE_KEY = "wizard.showVisitaTecnica";

const readLS = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLS = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    return;
  }
};

export const showVisitMode = () => readLS(VISIT_TOGGLE_KEY) === "true";
export const lastUsedMode = () => (readLS(LAST_MODE_KEY) === "quick" ? "quick" : "regular");
export const rememberMode = (mode) => { if (mode === "regular" || mode === "quick") writeLS(LAST_MODE_KEY, mode); };

export function loadDraft() {
  try {
    const raw = readLS(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const discardDraft = () => writeLS(DRAFT_KEY, null);

export function draftSummary(d) {
  if (!d) return "";
  const nc = d.newCustomer || {};
  const full = [nc.name, nc.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const who = d.isAnonymousCustomer ? "Sin cliente" : d.selectedCustomerName || full || "Sin cliente";
  const device = d.selectedModelName || d.selectedFamilyName || d.selectedCategoryName || d.customModelText || null;
  return device ? `${who} · ${device}` : who;
}

const emptyNC = () => ({ name: "", lastName: "", phone: "", email: "", notes: "", language: "es", isB2b: false, companyName: "", taxId: "", billingEmail: "", hasSecondary: false, secondaryPhone: "", secondaryEmail: "" });
const emptySecurity = () => ({ device_pin: "", device_password: "", pattern_vector: [], device_imei: "", device_serial: "", notes: "", imei_check_result: "", photo_exception_reason: "" });

export function initialState({ prefill, draft }) {
  const skipMode = !showVisitMode();
  const base = {
    mode: skipMode ? lastUsedMode() : "regular",
    modeSelected: skipMode,
    serviceType: "workshop",
    step: 1,
    visited: [1],
    customerTab: 0,
    customer: null,
    anonymous: false,
    customerSearch: "",
    nc: emptyNC(),
    category: null, brand: null, family: null, model: null, customModelText: "", stoppedEarly: false,
    problem: "", autoQuickText: "",
    cart: [], pendingParts: [], offers: [], oosFor: null,
    photos: [],
    checklist: CHECKLIST_ITEMS.map(([id, label]) => ({ id, label, status: "not_tested" })),
    liquidDamage: false, liquidCorrosion: false, liquidHumidity: false, liquidDried: false,
    security: emptySecurity(),
    employee: null, employeeAuto: false, employeeTouched: false,
    estimateText: "", estimateSynced: null, highPriority: false, promisedDate: null, promisedSamples: 0, promisedInit: false,
    signatureBlob: null, signatureURL: null, termsAccepted: false,
    deposit: 0, appointmentDate: new Date(), appointmentLocation: "",
    imei: "", unlockBrand: "", unlockModel: "", unlockCarrier: "", unlockType: null, imeiAutoFilled: false, unlockPhotos: [],
    rechargePhone: "", rechargeCarrier: "", rechargeCarrierOther: "",
    draftRefs: null,
  };
  if (draft) {
    return {
      ...base,
      mode: draft.orderMode || "regular",
      serviceType: draft.serviceType || "workshop",
      modeSelected: true,
      step: draft.currentStep || 1,
      visited: Array.from({ length: draft.currentStep || 1 }, (_, i) => i + 1),
      customerTab: draft.customerTab || 0,
      anonymous: !!draft.isAnonymousCustomer,
      nc: { ...emptyNC(), ...(draft.newCustomer || {}) },
      customModelText: draft.customModelText || "",
      problem: draft.problemDescription || "",
      deposit: Number(draft.depositAmount) || 0,
      estimateText: draft.estimateText || "",
      draftRefs: {
        customerId: draft.selectedCustomerId || null, categoryId: draft.selectedCategoryId || null, brandId: draft.selectedBrandId || null,
        familyId: draft.selectedFamilyId || null, modelId: draft.selectedModelId || null,
      },
    };
  }
  if (prefill?.customer) return { ...base, customer: prefill.customer, customerTab: 0 };
  if (prefill?.quote) {
    const q = prefill.quote;
    const est = Number(q.total) || 0;
    return {
      ...base,
      customerSearch: q.customer_phone || q.customer_name || "",
      nc: { ...emptyNC(), name: q.customer_name || "", phone: q.customer_phone || "" },
      problem: q.summary || "",
      estimateText: est > 0 ? est.toFixed(2) : "",
    };
  }
  return base;
}

export function useWizard(init) {
  const [s, setS] = useState(() => initialState(init));
  const ref = useRef(s);
  ref.current = s;
  const set = useCallback((patch) => setS((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) })), []);

  const canAdvance = useCallback((step, st = ref.current) => {
    switch (step) {
      case 1:
        if (st.anonymous) return true;
        if (st.customerTab === 0) return !!st.customer;
        {
          const full = [st.nc.name.trim(), st.nc.lastName.trim()].filter(Boolean).join(" ");
          const valid = !!full && (!!st.nc.phone.trim() || !!st.nc.email.trim());
          return st.nc.isB2b ? valid && !!st.nc.companyName.trim() : valid;
        }
      case 2:
        if (st.mode === "unlock") return st.imei.replace(/\D/g, "").length >= 14;
        return !!st.category && !!st.brand;
      case 3:
        if (st.mode === "unlock") return !!st.unlockType && st.cart.length > 0;
        if (st.mode === "recharge") return st.rechargePhone.trim().length >= 7 && st.cart.length > 0;
        if (st.mode === "quick") return st.cart.length > 0;
        return true;
      case 4: return st.photos.length > 0 || !!st.security.photo_exception_reason;
      case 7: return (Number(String(st.estimateText).replace(",", ".")) || 0) >= 0;
      case 9: return st.termsAccepted;
      case 10: return st.serviceType !== "visit" || !!String(st.appointmentLocation || "").trim();
      default: return true;
    }
  }, []);

  const goTo = useCallback((step) => set((p) => ({ step, visited: p.visited.includes(step) ? p.visited : [...p.visited, step] })), [set]);

  const jumpForward = useCallback(() => {
    const st = ref.current;
    let next = st.step + 1;
    while (next <= TOTAL_STEPS && shouldSkipStep(next, st.mode)) next += 1;
    if (next <= TOTAL_STEPS) goTo(next);
  }, [goTo]);

  const goBack = useCallback(() => {
    const st = ref.current;
    let t = st.step - 1;
    while (t >= 1 && shouldSkipStep(t, st.mode)) t -= 1;
    if (t >= 1) goTo(t);
  }, [goTo]);

  const setCart = useCallback((updater) => set((p) => {
    const cart = typeof updater === "function" ? updater(p.cart) : updater;
    const patch = { cart };
    if (p.mode === "quick" && cart.length) {
      const trimmed = p.problem.trim();
      if (!trimmed || trimmed === p.autoQuickText) {
        const gen = `Servicio rápido: ${cart.map((l) => l.product.name).join(", ")}`;
        patch.problem = gen;
        patch.autoQuickText = gen;
      }
    }
    return patch;
  }), [set]);

  const addItem = useCallback((product, quantity = 1) => setCart((cart) => {
    const key = product.id || `manual-${Math.random().toString(36).slice(2)}`;
    const idx = product.id ? cart.findIndex((l) => l.product.id === product.id) : -1;
    if (idx >= 0) return cart.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + quantity } : l));
    const price = product.__manualPrice !== undefined ? product.__manualPrice : null;
    const line = { key, product, quantity, unitPrice: price !== null ? price : effectiveOf(product) };
    const res = price !== null ? null : resolveDeviceOffer(product, ref.current.offers, offerDeviceCtx(ref.current));
    return [...cart, res ? applyOfferToLine(line, res) : line];
  }), [setCart]);

  const reapplyOffers = useCallback(() => setCart((cart) => {
    const ctx = offerDeviceCtx(ref.current);
    let changed = false;
    const next = cart.map((l) => {
      if (l.product.__manualPrice !== undefined || !l.product.id) return l;
      const res = resolveDeviceOffer(l.product, ref.current.offers, ctx);
      if (!res && !l.offerId) return l;
      if (res && l.offerId === res.offer.id && Math.abs(l.unitPrice - res.promo) < 0.001) return l;
      changed = true;
      return applyOfferToLine(l, res);
    });
    return changed ? next : cart;
  }), [setCart]);

  const setQuantity = useCallback((key, qty) => setCart((cart) => (qty <= 0 ? cart.filter((l) => l.key !== key) : cart.map((l) => (l.key === key ? { ...l, quantity: qty } : l)))), [setCart]);

  const saveableProgress = (st) => !!(st.customer || st.anonymous || [st.nc.name, st.nc.lastName].some((x) => x.trim()) || st.category || st.model || st.customModelText);
  const hasAnyData = (st) => !!(st.customer || st.anonymous || st.nc.name || st.nc.phone || st.problem || st.photos.length || st.category || st.model || st.customModelText || st.cart.length || st.rechargePhone || st.imei || String(st.estimateText || "").trim());

  const saveDraft = useCallback(() => {
    const st = ref.current;
    if (!saveableProgress(st)) return false;
    writeLS(DRAFT_KEY, JSON.stringify({
      savedAt: new Date().toISOString(), orderMode: st.mode, serviceType: st.serviceType, currentStep: st.step, customerTab: st.customerTab,
      selectedCustomerId: st.customer?.id || null, selectedCustomerName: st.customer?.name || null, isAnonymousCustomer: st.anonymous, newCustomer: st.nc,
      selectedCategoryId: st.category?.id || null, selectedCategoryName: st.category?.name || null, selectedBrandId: st.brand?.id || null, selectedBrandName: st.brand?.name || null,
      selectedFamilyId: st.family?.id || null, selectedFamilyName: st.family?.name || null, selectedModelId: st.model?.id || null, selectedModelName: st.model?.name || null,
      customModelText: st.customModelText, problemDescription: st.problem, depositAmount: st.deposit, estimateText: st.estimateText,
    }));
    return true;
  }, []);

  const steps = useMemo(() => activeSteps(s.mode), [s.mode]);
  const logicalStep = steps.indexOf(s.step) + 1;
  const taxRate = Number.isFinite(Number(init?.taxRate)) ? Number(init.taxRate) : IVU;
  const totals = useMemo(() => cartTotals(s.cart, taxRate), [s.cart, taxRate]);

  return {
    s, set, ref, canAdvance, goTo, jumpForward, goBack, addItem, reapplyOffers, setQuantity, setCart, saveDraft, steps, logicalStep, totals,
    hasAnyData: () => hasAnyData(ref.current), saveable: () => saveableProgress(ref.current),
  };
}

function effectiveOf(p) {
  const price = Number(p?.price) || 0;
  const pct = Number(p?.discount_percentage) || 0;
  return p?.discount_active === true && pct > 0 && !discountEnded(p?.discount_end_date) ? price * (1 - pct / 100) : price;
}
