import { base44 } from "@/api/base44Client";

export const SafeOrderService = {
  async getById(id, opts = {}) {
    if (!id) throw new Error("missing-id");
    
    const startedAt = Date.now();
    try {
      console.log("[Order:getById] start", { 
        id, 
        type: typeof id,
        cleanId: String(id).trim()
      });
      
      const cleanId = String(id).trim();
      
      // Sin AbortController para evitar Network Errors prematuros
      const data = await base44.entities.Order.get(cleanId);
      
      console.log("[Order:getById] end", { 
        ms: Date.now() - startedAt, 
        ok: !!data,
        hasId: !!data?.id,
        orderNumber: data?.order_number
      });

      if (!data) throw new Error("not-found");
      return data;
    } catch (e) {
      console.error("[Order:getById] error", {
        id,
        error: e.message || String(e),
        ms: Date.now() - startedAt,
        stack: e.stack
      });
      throw e;
    }
  },

  async getByOrderNumber(order_number, opts = {}) {
    if (!order_number) throw new Error("missing-order-number");
    
    const startedAt = Date.now();
    console.log("[Order:getByOrderNumber] start", { order_number });

    try {
      const arr = await base44.entities.Order.filter({ order_number });
      
      console.log("[Order:getByOrderNumber] end", { 
        ms: Date.now() - startedAt, 
        count: arr?.length || 0,
        found: !!arr?.[0]
      });

      return Array.isArray(arr) && arr.length ? arr[0] : null;
    } catch (e) {
      console.error("[Order:getByOrderNumber] error", {
        order_number,
        error: e.message || String(e),
        stack: e.stack
      });
      throw e;
    }
  },

  async testConnection() {
    console.log("[Order:testConnection] start");
    try {
      const list = await base44.entities.Order.list("-created_date", 1);
      console.log("[Order:testConnection] success", {
        count: list?.length || 0,
        firstId: list?.[0]?.id
      });
      return { ok: true, firstOrder: list?.[0] };
    } catch (e) {
      console.error("[Order:testConnection] failed", e);
      return { ok: false, error: e.message || String(e) };
    }
  }
};
