import { base44 } from "@/api/base44Client";

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
  try {
    const openDrawers = await base44.entities.CashRegister.filter({ status: "open" });
    
    const isOpen = openDrawers && openDrawers.length > 0;
    const drawer = isOpen ? openDrawers[0] : null;
    
    cashRegisterCache = {
      isOpen,
      drawer,
      lastCheck: Date.now()
    };
    
    notifyListeners();
    return cashRegisterCache;
  } catch (error) {
    console.error("Error checking cash register:", error);
    return cashRegisterCache;
  }
}

// ✅ OBTENER ESTADO EN CACHE
export function getCachedStatus() {
  return cashRegisterCache;
}

// ✅ ABRIR CAJA
export async function openCashRegister(denominations, user) {
  try {
    // Verificar si ya hay una caja abierta
    const existing = await base44.entities.CashRegister.filter({ status: "open" });
    if (existing && existing.length > 0) {
      throw new Error("Ya existe una caja abierta");
    }

    // Calcular total
    const total = Object.entries(denominations).reduce((sum, [key, qty]) => {
      const value = parseFloat(key.replace('bills_', '').replace('coins_', '').replace('050', '0.50').replace('025', '0.25').replace('010', '0.10').replace('005', '0.05').replace('001', '0.01'));
      return sum + (value * qty);
    }, 0);

    // Crear registro de caja
    const drawer = await base44.entities.CashRegister.create({
      date: new Date().toISOString().split('T')[0],
      opening_balance: total,
      status: "open",
      opened_by: user?.full_name || user?.email || "Sistema",
      final_count: { denominations, total }
    });

    // Crear movimiento
    await base44.entities.CashDrawerMovement.create({
      drawer_id: drawer.id,
      type: "opening",
      amount: total,
      description: `Apertura de caja - $${total.toFixed(2)}`,
      employee: user?.full_name || user?.email || "Sistema",
      denominations
    });

    // Actualizar cache
    cashRegisterCache = {
      isOpen: true,
      drawer,
      lastCheck: Date.now()
    };

    notifyListeners();
    
    // Disparar evento global
    window.dispatchEvent(new CustomEvent("drawer-opened", { detail: { drawer } }));
    
    return drawer;
  } catch (error) {
    console.error("Error opening cash register:", error);
    throw error;
  }
}

// ✅ CERRAR CAJA
export async function closeCashRegister(drawer, denominations, user) {
  try {
    if (!drawer || drawer.status !== "open") {
      throw new Error("No hay caja abierta para cerrar");
    }

    // Calcular total contado
    const countedTotal = Object.entries(denominations).reduce((sum, [key, qty]) => {
      const value = parseFloat(key.replace('bills_', '').replace('coins_', '').replace('050', '0.50').replace('025', '0.25').replace('010', '0.10').replace('005', '0.05').replace('001', '0.01'));
      return sum + (value * qty);
    }, 0);

    // Obtener ventas del turno
    const drawerOpenDate = new Date(drawer.created_date);
    const sales = await base44.entities.Sale.list("-created_date", 500);
    const salesInDrawer = sales.filter(s => {
      if (s.voided) return false;
      try {
        return new Date(s.created_date) >= drawerOpenDate;
      } catch {
        return false;
      }
    });

    const totalRevenue = salesInDrawer.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalCash = salesInDrawer
      .filter(s => s.payment_method === "cash")
      .reduce((sum, s) => sum + (s.total || 0), 0);

    const expectedCash = drawer.opening_balance + totalCash;
    const difference = countedTotal - expectedCash;

    // Actualizar registro de caja
    await base44.entities.CashRegister.update(drawer.id, {
      status: "closed",
      closing_balance: countedTotal,
      total_revenue: totalRevenue,
      net_profit: totalRevenue,
      closed_by: user?.full_name || user?.email || "Sistema",
      final_count: { denominations, total: countedTotal, expectedCash, difference }
    });

    // Crear movimiento de cierre
    await base44.entities.CashDrawerMovement.create({
      drawer_id: drawer.id,
      type: "closing",
      amount: countedTotal,
      description: `Cierre de caja - $${countedTotal.toFixed(2)} (Diferencia: $${difference.toFixed(2)})`,
      employee: user?.full_name || user?.email || "Sistema",
      denominations
    });

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
    console.error("Error closing cash register:", error);
    throw error;
  }
}
