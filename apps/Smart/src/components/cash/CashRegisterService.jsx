import { dataClient } from "@/components/api/dataClient";

const LOCAL_DRAWER_KEY = "smartfix_local_open_drawer";

function readLocalDrawer() {
  try {
    const raw = localStorage.getItem(LOCAL_DRAWER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalDrawer(drawer) {
  if (!drawer) {
    localStorage.removeItem(LOCAL_DRAWER_KEY);
    return;
  }
  localStorage.setItem(LOCAL_DRAWER_KEY, JSON.stringify(drawer));
}

function isLikelyTransportError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  const name = String(error?.name || "").toLowerCase();
  return (
    error instanceof SyntaxError ||
    error instanceof TypeError ||
    name.includes("syntaxerror") ||
    name.includes("typeerror") ||
    msg.includes("unrecognized token '<'") ||
    msg.includes("json parse error") ||
    msg.includes("unexpected token '<'") ||
    msg.includes("<!doctype") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("network request failed") ||
    msg.includes("network")
  );
}

let cashRegisterCache = {
  isOpen: false,
  drawer: null,
  lastCheck: 0,
  isInitialized: false // Added to distinguish initial state
};

const listeners = [];
let pollingInterval = null;
let visibilityHandler = null;

// ✅ NOTIFICAR A TODOS LOS LISTENERS
function notifyListeners() {
  listeners.forEach(fn => fn(cashRegisterCache));
}

function startPolling() {
  if (pollingInterval) return; // ya corriendo

  // Only poll when tab is visible to save energy
  const startIv = () => { if (!pollingInterval) pollingInterval = setInterval(() => checkCashRegisterStatus(), 60_000); };
  const stopIv = () => { if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; } };

  visibilityHandler = () => {
    if (document.visibilityState === "visible") { startIv(); checkCashRegisterStatus(); }
    else stopIv();
  };
  document.addEventListener("visibilitychange", visibilityHandler);
  if (!document.hidden) startIv();
}

function stopPolling() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}

// ✅ SUSCRIBIRSE A CAMBIOS
export function subscribeToCashRegister(callback) {
  listeners.push(callback);
  callback(cashRegisterCache);
  if (listeners.length === 1) startPolling(); // primer suscriptor → arrancar polling
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx > -1) listeners.splice(idx, 1);
    if (listeners.length === 0) stopPolling(); // sin suscriptores → parar polling
  };
}

// ✅ VERIFICAR ESTADO DE CAJA
export async function checkCashRegisterStatus() {
  const localDrawer = readLocalDrawer();
  try {
    const openDrawers = await dataClient.entities.CashRegister.filter({ status: "open" });

    const remoteIsOpen = openDrawers && openDrawers.length > 0;
    const remoteDrawer = remoteIsOpen ? openDrawers[0] : null;
    const fallbackLocalOpen = localDrawer?.status === "open";
    const isOpen = remoteIsOpen || fallbackLocalOpen;
    const drawer = remoteDrawer || (fallbackLocalOpen ? localDrawer : null);
    
    cashRegisterCache = {
      isOpen,
      drawer,
      lastCheck: Date.now(),
      isInitialized: true
    };

    // Si ya hay caja remota abierta, limpiamos la local para evitar estados duplicados.
    if (remoteIsOpen && localDrawer?.status === "open") {
      writeLocalDrawer(null);
    }
    
    notifyListeners();
    return cashRegisterCache;
  } catch (error) {
    if (!isLikelyTransportError(error)) {
      console.error("Error checking cash register:", error);
    }
    
    // Si falla la red pero tenemos estado local de "abierto", lo honramos para no bloquear al usuario
    if (localDrawer?.status === "open") {
      cashRegisterCache = {
        isOpen: true,
        drawer: localDrawer,
        lastCheck: Date.now(),
        isInitialized: true
      };
      notifyListeners();
      return cashRegisterCache;
    }

    // Si falló y no hay local, marcamos como inicializado para que el UI pueda reaccionar (ej. error de red)
    cashRegisterCache.isInitialized = true;
    notifyListeners();
    return cashRegisterCache;
  }
}

// ✅ OBTENER ESTADO EN CACHE
export function getCachedStatus() {
  return cashRegisterCache;
}

// ✅ ABRIR CAJA
export async function openCashRegister(denominations, user) {
  const total = Object.entries(denominations).reduce((sum, [key, qty]) => {
    const value = parseFloat(key.replace('bills_', '').replace('coins_', '').replace('050', '0.50').replace('025', '0.25').replace('010', '0.10').replace('005', '0.05').replace('001', '0.01'));
    return sum + (value * qty);
  }, 0);

  const localExisting = readLocalDrawer();
  if (localExisting?.status === "open") {
    throw new Error("Ya existe una caja abierta");
  }

  let existing = [];
  try {
    existing = await dataClient.entities.CashRegister.filter({ status: "open" });
  } catch (error) {
    if (!isLikelyTransportError(error)) {
      console.error("Error checking existing open drawer:", error);
      throw error;
    }
  }
  if (existing && existing.length > 0) {
    throw new Error("Ya existe una caja abierta");
  }

  let drawer = null;
  try {
    const tenantId = localStorage.getItem("smartfix_tenant_id") || null;
    const response = await fetch("/api/cash-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open", denominations, user, tenantId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "Error al abrir caja");
    }
    drawer = payload.drawer;
  } catch (error) {
    const msg = String(error?.message || error || "").toLowerCase();
    if (msg.includes("ya existe una caja abierta")) {
      console.error("Error opening cash register:", error);
      throw error;
    }

    drawer = {
      id: `local-drawer-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      opening_balance: total,
      status: "open",
      opened_by: user?.full_name || user?.email || "Sistema",
      final_count: { denominations, total },
      is_local: true,
      created_date: new Date().toISOString()
    };
    writeLocalDrawer(drawer);
  }

  if (!drawer?.is_local) {
    // movement is created server-side with service role
  }

  // Guardamos espejo local para que el estado no se pierda entre vistas/recargas.
  writeLocalDrawer({
    ...drawer,
    status: "open",
    is_local: !!drawer?.is_local
  });

  cashRegisterCache = {
    isOpen: true,
    drawer,
    lastCheck: Date.now()
  };

  notifyListeners();
  window.dispatchEvent(new CustomEvent("drawer-opened", { detail: { drawer } }));

  return drawer;
}

// ✅ CERRAR CAJA
export async function closeCashRegister(drawer, denominations, user, summaryOverrides = null) {
  try {
    if (!drawer || drawer.status !== "open") {
      throw new Error("No hay caja abierta para cerrar");
    }

    if (drawer?.is_local || String(drawer?.id || "").startsWith("local-drawer-")) {
      const countedTotal = Object.entries(denominations).reduce((sum, [key, qty]) => {
        const value = parseFloat(key.replace('bills_', '').replace('coins_', '').replace('050', '0.50').replace('025', '0.25').replace('010', '0.10').replace('005', '0.05').replace('001', '0.01'));
        return sum + (value * qty);
      }, 0);
      const expectedCash = drawer.opening_balance || 0;
      const difference = countedTotal - expectedCash;
      writeLocalDrawer(null);
      cashRegisterCache = {
        isOpen: false,
        drawer: null,
        lastCheck: Date.now()
      };
      notifyListeners();
      window.dispatchEvent(new CustomEvent("drawer-closed", { detail: { drawer_id: drawer.id } }));
      return { success: true, difference };
    }

    // Calcular total contado
    const countedTotal = Object.entries(denominations).reduce((sum, [key, qty]) => {
      const value = parseFloat(key.replace('bills_', '').replace('coins_', '').replace('050', '0.50').replace('025', '0.25').replace('010', '0.10').replace('005', '0.05').replace('001', '0.01'));
      return sum + (value * qty);
    }, 0);

    // Obtener valores (ya sea de overrides o calculados)
    let totalRevenue, totalCash, expectedCash, difference;

    if (summaryOverrides) {
        // Usar valores manuales si existen
        totalRevenue = summaryOverrides.totalRevenue;
        totalCash = summaryOverrides.totalCash;
        expectedCash = summaryOverrides.expectedCash;
        difference = countedTotal - expectedCash;
    } else {
        // Lógica original de cálculo
        const drawerOpenDate = new Date(drawer.created_date);
        const sales = await dataClient.entities.Sale.filter({}, "-created_date", 1000);
        
        const salesInDrawer = sales.filter(s => {
          if (s.voided) return false;
          try {
            return new Date(s.created_date) >= drawerOpenDate;
          } catch {
            return false;
          }
        });

        const methodsTotals = salesInDrawer.reduce((acc, sale) => {
          const methods = Array.isArray(sale?.payment_details?.methods) ? sale.payment_details.methods : [];
          if (!methods.length) {
            const amount = Number(sale?.amount_paid || sale?.total || 0);
            const method = sale?.payment_method;
            if (method === "cash") acc.cash += amount;
            if (method === "card") acc.card += amount;
            if (method === "ath_movil") acc.ath += amount;
            acc.total += amount;
            return acc;
          }
          methods.forEach((m) => {
            const amount = Number(m?.amount || 0);
            if (m?.method === "cash") acc.cash += amount;
            if (m?.method === "card") acc.card += amount;
            if (m?.method === "ath_movil") acc.ath += amount;
            acc.total += amount;
          });
          return acc;
        }, { cash: 0, card: 0, ath: 0, total: 0 });

        totalRevenue = methodsTotals.total || salesInDrawer.reduce((sum, s) => sum + (s.total || 0), 0);
        totalCash = methodsTotals.cash;

        expectedCash = drawer.opening_balance + totalCash;
        difference = countedTotal - expectedCash;
    }

    const tenantId = localStorage.getItem("smartfix_tenant_id") || null;
    const response = await fetch("/api/cash-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "close",
        drawerId: drawer.id,
        denominations,
        user,
        tenantId,
        summary: {
          ...(summaryOverrides || {}),
          totalRevenue,
          totalCash,
          expectedCash,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "Error al cerrar caja");
    }

    // Limpiar estado local al cerrar caja remota.
    writeLocalDrawer(null);

    // Actualizar cache
    cashRegisterCache = {
      isOpen: false,
      drawer: null,
      lastCheck: Date.now()
    };

    notifyListeners();
    
    // Disparar evento global
    window.dispatchEvent(new CustomEvent("drawer-closed", { detail: { drawer_id: drawer.id } }));

    return { success: true, difference };
  } catch (error) {
    if ((isLikelyTransportError(error) || String(error?.message || "").toLowerCase().includes("serverless function")) && (drawer?.is_local || String(drawer?.id || "").startsWith("local-drawer-"))) {
      writeLocalDrawer(null);
      cashRegisterCache = {
        isOpen: false,
        drawer: null,
        lastCheck: Date.now()
      };
      notifyListeners();
      return { success: true, difference: 0 };
    }
    console.error("Error closing cash register:", error);
    throw error;
  }
}
