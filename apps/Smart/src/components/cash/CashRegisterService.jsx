import appClient from "@/api/appClient";

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
  lastCheck: 0
};

const listeners = [];

// ✅ NOTIFICAR A TODOS LOS LISTENERS
function notifyListeners() {
  listeners.forEach(fn => fn(cashRegisterCache));
}

// ✅ SUSCRIBIRSE A CAMBIOS
export function subscribeToCashRegister(callback) {
  listeners.push(callback);
  callback(cashRegisterCache);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

// ✅ VERIFICAR ESTADO DE CAJA
export async function checkCashRegisterStatus() {
  const localDrawer = readLocalDrawer();
  try {
    const openDrawers = await appClient.entities.CashRegister.filter({ status: "open" });

    const remoteIsOpen = openDrawers && openDrawers.length > 0;
    const remoteDrawer = remoteIsOpen ? openDrawers[0] : null;
    const fallbackLocalOpen = localDrawer?.status === "open";
    const isOpen = remoteIsOpen || fallbackLocalOpen;
    const drawer = remoteDrawer || (fallbackLocalOpen ? localDrawer : null);
    
    cashRegisterCache = {
      isOpen,
      drawer,
      lastCheck: Date.now()
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
    if (localDrawer?.status === "open") {
      cashRegisterCache = {
        isOpen: true,
        drawer: localDrawer,
        lastCheck: Date.now()
      };
      notifyListeners();
      return cashRegisterCache;
    }
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
    existing = await appClient.entities.CashRegister.filter({ status: "open" });
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
    drawer = await appClient.entities.CashRegister.create({
      date: new Date().toISOString().split('T')[0],
      opening_balance: total,
      status: "open",
      opened_by: user?.full_name || user?.email || "Sistema",
      final_count: { denominations, total }
    });
  } catch (error) {
    if (!isLikelyTransportError(error)) {
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
    try {
      await appClient.entities.CashDrawerMovement.create({
        drawer_id: drawer.id,
        type: "opening",
        amount: total,
        description: `Apertura de caja - $${total.toFixed(2)}`,
        employee: user?.full_name || user?.email || "Sistema",
        denominations
      });
    } catch (error) {
      if (!isLikelyTransportError(error)) {
        console.error("Error creating opening movement:", error);
      }
    }
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

  if (!drawer?.is_local) {
    appClient.functions.invoke("notifyCashRegister", {
      type: "opening",
      drawerData: drawer,
      performedBy: user
    }).catch((error) => {
      if (!isLikelyTransportError(error)) {
        console.error("Error notifying cash register opening:", error);
      }
    });
  }

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
        const sales = await appClient.entities.Sale.filter({}, "-created_date", 1000);
        
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

    // Actualizar registro de caja
    await appClient.entities.CashRegister.update(drawer.id, {
      status: "closed",
      closing_balance: countedTotal,
      total_revenue: totalRevenue,
      net_profit: totalRevenue,
      closed_by: user?.full_name || user?.email || "Sistema",
      final_count: { 
          denominations, 
          total: countedTotal, 
          expectedCash, 
          difference,
          overrides: summaryOverrides // Guardamos si hubo overrides para auditoría
      }
    });

    // Crear movimiento de cierre
    await appClient.entities.CashDrawerMovement.create({
      drawer_id: drawer.id,
      type: "closing",
      amount: countedTotal,
      description: `Cierre de caja - $${countedTotal.toFixed(2)} (Diferencia: $${difference.toFixed(2)})`,
      employee: user?.full_name || user?.email || "Sistema",
      denominations
    });

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

    // 🔔 Notificar admin
    appClient.functions.invoke("notifyCashRegister", { 
      type: "closing", 
      drawerData: { ...drawer, closing_balance: countedTotal, total_revenue: totalRevenue, final_count: { difference, expectedCash } }, 
      performedBy: user 
    }).catch(console.error);
    
    return { success: true, difference };
  } catch (error) {
    if (isLikelyTransportError(error) && (drawer?.is_local || String(drawer?.id || "").startsWith("local-drawer-"))) {
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
