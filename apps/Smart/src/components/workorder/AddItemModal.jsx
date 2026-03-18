import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { dataClient } from "@/components/api/dataClient";
import { base44 } from "@/api/base44Client";
import { catalogCache } from "@/components/utils/dataCache";
import { supabase } from "../../../../../lib/supabase-client.js";
import { toast } from "sonner";
import QuickItemModal from "../inventory/QuickItemModal";
import {
  Plus,
  Search,
  X,
  ShoppingCart,
  Wrench,
  Box,
  Zap,
  Grid,
  List,
  Trash2,
  Minus,
  Package,
} from "lucide-react";

const IVU_RATE = 0.115;

function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("inventory_timeout")), ms);
    }),
  ]);
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getTenantId() {
  try {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.tenant_id) return session.tenant_id;
    }
    return localStorage.getItem("smartfix_tenant_id") || null;
  } catch {
    return localStorage.getItem("smartfix_tenant_id") || null;
  }
}

function normalizeInventoryItem(raw = {}, fallbackType = "product") {
  const type = raw.type || raw._type || fallbackType;
  const price = toNum(raw.price, 0);
  return {
    id: raw.id || `${type}-${raw.name || "item"}`,
    name: String(raw.name || "Item sin nombre"),
    sku: raw.sku || raw.code || "",
    price,
    stock: toNum(raw.stock, 0),
    part_type: raw.part_type || "",
    tipo_principal: raw.tipo_principal || "",
    category: raw.category || "",
    compatibility_models: Array.isArray(raw.compatibility_models) ? raw.compatibility_models : [],
    compatible_families: Array.isArray(raw.compatible_families) ? raw.compatible_families : [],
    compatible_brands: Array.isArray(raw.compatible_brands) ? raw.compatible_brands : [],
    device_category: raw.device_category || "",
    type,
    source: raw.source || null,
    is_manual: raw.is_manual === true,
    link_ref_id: raw.link_ref_id || null,
    link_url: raw.link_url || "",
  };
}

function normalizeCartItem(raw = {}) {
  const qty = Math.max(1, Math.round(toNum(raw.qty ?? raw.quantity, 1)));
  const discount = Math.max(0, Math.min(100, toNum(raw.discount_percentage ?? raw.discount_percent, 0)));
  return {
    id: raw.id || `cart-${Date.now()}`,
    name: String(raw.name || "Item sin nombre"),
    type: raw.type === "service" ? "service" : "product",
    __kind: raw.__kind || (raw.type === "service" ? "service" : "product"),
    __source_id: raw.__source_id || raw.id || null,
    from_inventory: raw.from_inventory === true,
    sku: raw.sku || "",
    stock: toNum(raw.stock, 0),
    source: raw.source || null,
    is_manual: raw.is_manual === true,
    link_ref_id: raw.link_ref_id || null,
    link_url: raw.link_url || "",
    part_type: raw.part_type || "",
    tipo_principal: raw.tipo_principal || "",
    category: raw.category || "",
    price: toNum(raw.price, 0),
    qty,
    discount_percentage: discount,
    taxable: raw.taxable !== false,
  };
}

function serializeOrderItem(raw = {}) {
  const item = normalizeCartItem(raw);
  const total = Number(
    (
      (toNum(item.price, 0) * toNum(item.qty, 1)) *
      (1 - toNum(item.discount_percentage, 0) / 100)
    ).toFixed(2)
  );

  return {
    id: item.id,
    name: item.name,
    type: item.type,
    source: item.source || (item.from_inventory ? "inventory" : "manual"),
    is_manual: item.is_manual === true,
    sku: item.sku || "",
    stock: toNum(item.stock, 0),
    price: toNum(item.price, 0),
    qty: toNum(item.qty, 1),
    discount_percentage: toNum(item.discount_percentage, 0),
    taxable: item.taxable !== false,
    total,
    ...(item.link_ref_id ? { link_ref_id: item.link_ref_id } : {}),
    ...(item.link_url ? { link_url: item.link_url } : {}),
    ...(item.part_type ? { part_type: item.part_type } : {}),
    ...(item.tipo_principal ? { tipo_principal: item.tipo_principal } : {}),
    ...(item.category ? { category: item.category } : {}),
  };
}

function isService(item) {
  const t = `${item.type} ${item.part_type} ${item.tipo_principal}`.toLowerCase();
  return t.includes("service") || t.includes("servicio") || t.includes("diagnostic");
}

function isAccessory(item) {
  const t = `${item.tipo_principal} ${item.category}`.toLowerCase();
  return t.includes("accesorio");
}

function uniqueByKey(items = []) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const linkRef = String(it?.link_ref_id || "").trim().toLowerCase();
    const sku = String(it?.sku || "").trim().toLowerCase();
    const name = String(it?.name || "").trim().toLowerCase();
    const price = String(toNum(it?.price, 0).toFixed(2));
    const type = String(it?.type || it?.__kind || "").trim().toLowerCase();
    const id = String(it?.id || "").trim().toLowerCase();

    const key = linkRef
      ? `link|${linkRef}`
      : sku
      ? `sku|${type}|${sku}|${price}`
      : `item|${type}|${name}|${price}|${id}`;

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export default function AddItemModal({
  open,
  onClose,
  onSave,
  order,
  onUpdate,
  onRemoteSaved,
  draftMode = false,
  initialItems = [],
  onApplyItems,
  autoOpenCart = false,
  deviceType = "",
  deviceBrand = "",
  deviceFamily = "",
  deviceModel = "",
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showQuickItem, setShowQuickItem] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDraftOrder = draftMode || !order?.id;

  // Enter key applies & saves when cart is visible and has items
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && showCart && cartItems.length > 0 && !saving) {
        e.preventDefault();
        saveToOrder();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showCart, cartItems.length, saving]);
  const liveSourceItems = useMemo(() => {
    if (isDraftOrder) {
      return Array.isArray(initialItems) ? initialItems : [];
    }
    if (Array.isArray(order?.order_items) && order.order_items.length > 0) {
      return order.order_items;
    }
    return Array.isArray(initialItems) ? initialItems : [];
  }, [initialItems, isDraftOrder, order?.order_items]);

  useEffect(() => {
    if (!open) return;
    setActiveCategory("all");
    setSearch("");
    setShowCart(Boolean(autoOpenCart));

    // Init cart desde props (rápido, cubre el caso donde ya están actualizados)
    const normalizedCart = Array.isArray(liveSourceItems)
      ? uniqueByKey(liveSourceItems.map((i) => normalizeCartItem(i)))
      : [];
    setCartItems(normalizedCart);

    if (!isDraftOrder && order?.id) {
      // Fetch fresco desde DB para resolver race condition: el parent puede no haber
      // terminado su handleRefresh cuando el modal abre, así que leemos nosotros directamente.
      dataClient?.entities?.Order?.get(order.id)
        .then((freshOrder) => {
          const propItems = Array.isArray(liveSourceItems) ? liveSourceItems : [];
          const freshItems = Array.isArray(freshOrder?.order_items) ? freshOrder.order_items : [];
          const mergedOrderItems = uniqueByKey([...propItems, ...freshItems]);

          if (mergedOrderItems.length > 0) {
            setCartItems(mergedOrderItems.map((i) => normalizeCartItem(i)));
          }

          // Mantener el preview local de links recién agregados aunque la base todavía no refleje el cambio.
          void loadInventory(mergedOrderItems);
        })
        .catch(() => {
          void loadInventory(Array.isArray(liveSourceItems) ? liveSourceItems : undefined);
        }); // fallback: inventario sin inyección fresca
    } else {
      void loadInventory();
    }
    // Cargamos una sola vez por apertura para evitar bucles de "loading" con props inestables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoOpenCart, isDraftOrder, order?.id]);

  useEffect(() => {
    if (!open) return;
    if (!Array.isArray(liveSourceItems) || liveSourceItems.length === 0) return;

    setCartItems((prev) => {
      const next = liveSourceItems.map((item) => normalizeCartItem(item));
      return uniqueByKey(next).map((item) => normalizeCartItem(item));
    });
  }, [open, liveSourceItems]);

  const loadInventory = async (freshOrderItems) => {
    const cachedProducts = catalogCache.get("pos-active-products") || [];
    const cachedServices = catalogCache.get("pos-active-services") || [];

    let products = Array.isArray(cachedProducts)
      ? cachedProducts.map((p) => normalizeInventoryItem(p, "product"))
      : [];
    let services = Array.isArray(cachedServices)
      ? cachedServices.map((s) => normalizeInventoryItem(s, "service"))
      : [];

    const cachedMerged = uniqueByKey([...products, ...services]);
    if (cachedMerged.length > 0) {
      setInventoryItems(cachedMerged);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const safeProductList = dataClient?.entities?.Product?.list
        ? withTimeout(Promise.resolve().then(() => dataClient.entities.Product.list("-updated_date", 500)), 5000).catch(() => [])
        : Promise.resolve([]);
      const safeServiceList = dataClient?.entities?.Service?.list
        ? withTimeout(Promise.resolve().then(() => dataClient.entities.Service.list("-updated_date", 500)), 5000).catch(() => [])
        : Promise.resolve([]);

      const [dbProducts, dbServices] = await Promise.all([safeProductList, safeServiceList]);

      const normalizedDbProducts = Array.isArray(dbProducts)
        ? dbProducts.map((p) => normalizeInventoryItem(p, "product"))
        : [];
      const normalizedDbServices = Array.isArray(dbServices)
        ? dbServices.map((s) => normalizeInventoryItem(s, "service"))
        : [];

      if (normalizedDbProducts.length > 0) products = normalizedDbProducts;
      if (normalizedDbServices.length > 0) services = normalizedDbServices;

      if (products.length === 0 && services.length === 0) {
        const [directProducts, directServices] = await Promise.all([
          supabase
            .from("product")
            .select("id, name, sku, price, stock, part_type, tipo_principal, category, type")
            .eq("active", true)
            .order("updated_at", { ascending: false })
            .limit(500),
          supabase
            .from("service")
            .select("id, code, name, description, category, price, active")
            .eq("active", true)
            .order("updated_at", { ascending: false })
            .limit(500)
        ]);

        if (!directProducts.error && Array.isArray(directProducts.data) && directProducts.data.length > 0) {
          products = directProducts.data.map((p) => normalizeInventoryItem(p, "product"));
        }

        if (!directServices.error && Array.isArray(directServices.data) && directServices.data.length > 0) {
          services = directServices.data.map((s) =>
            normalizeInventoryItem(
              {
                ...s,
                sku: s.code || "",
                type: "service",
                part_type: "service"
              },
              "service"
            )
          );
        }
      }

      catalogCache.set("pos-active-products", products, 60 * 1000);
      catalogCache.set("pos-active-services", services, 60 * 1000);
    } catch (error) {
      console.warn("[AddItemModal] loadInventory fallback cache:", error);
      if (products.length === 0 && services.length === 0) {
        toast.error("Inventario no disponible ahora. Puedes continuar con + Manual.");
      }
    } finally {
      let merged = uniqueByKey([...products, ...services]);

      // Inyectar links/manuales de order_items como entradas virtuales para que
      // aparezcan siempre en el catálogo, aunque haya inventario cargado.
      if (!isDraftOrder) {
        const baseItems = Array.isArray(freshOrderItems) ? freshOrderItems : (Array.isArray(order?.order_items) ? order.order_items : []);
        const linkedItems = baseItems
          .filter((item) => item?.link_ref_id || item?.is_manual || item?.source === "manual")
          .map((item) => normalizeInventoryItem({
            id: item.id || item.link_ref_id,
            name: item.name,
            price: item.price,
            type: item.type || "product",
            part_type: item.part_type || "",
            sku: item.sku || "",
            source: item.source || "manual",
            is_manual: item.is_manual === true,
            link_ref_id: item.link_ref_id || item.id || null,
            link_url: item.link_url || "",
            _linked: true,
          }, "product"));
        merged = uniqueByKey([...linkedItems, ...merged]);
      }

      setInventoryItems(merged);
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let base = [...inventoryItems];

    if (activeCategory === "services") base = base.filter(isService);
    if (activeCategory === "accessories") base = base.filter(isAccessory);
    if (activeCategory === "parts") base = base.filter((i) => !isService(i) && !isAccessory(i));

    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((i) =>
        [i.name, i.sku, i.part_type, i.tipo_principal].join(" ").toLowerCase().includes(q)
      );
    }

    const typeKey = String(deviceType || "").trim().toLowerCase();
    const brandKey = String(deviceBrand || "").trim().toLowerCase();
    const familyKey = String(deviceFamily || "").trim().toLowerCase();
    const modelKey = String(deviceModel || "").trim().toLowerCase();

    const categoryMatchesDevice = (item) => {
      if (!typeKey) return true;
      const haystack = [
        item?.device_category,
        item?.category,
        item?.part_type,
        item?.tipo_principal,
        item?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (typeKey.includes("tablet")) return haystack.includes("tablet") || haystack.includes("ipad");
      if (
        typeKey.includes("laptop") ||
        typeKey.includes("pc") ||
        typeKey.includes("desktop") ||
        typeKey.includes("computadora")
      ) {
        return haystack.includes("laptop") || haystack.includes("pc") || haystack.includes("desktop") || haystack.includes("computadora");
      }
      if (typeKey.includes("accesorio")) return haystack.includes("accesorio");
      return (
        haystack.includes("phone") ||
        haystack.includes("iphone") ||
        haystack.includes("galaxy") ||
        haystack.includes("celular") ||
        haystack.includes("smartphone")
      );
    };

    const matchesSpecificDevice = (item) => {
      if (!modelKey && !familyKey && !brandKey) return true;
      const name = String(item?.name || "").toLowerCase();
      const compatModels = Array.isArray(item?.compatibility_models) ? item.compatibility_models : [];
      const compatFamilies = Array.isArray(item?.compatible_families) ? item.compatible_families : [];
      const compatBrands = Array.isArray(item?.compatible_brands) ? item.compatible_brands : [];

      const modelMatch = modelKey
        ? name.includes(modelKey) || compatModels.some((m) => String(m || "").toLowerCase().includes(modelKey))
        : false;
      const familyMatch = familyKey
        ? name.includes(familyKey) || compatFamilies.some((f) => String(f || "").toLowerCase().includes(familyKey))
        : false;
      const brandMatch = brandKey
        ? name.includes(brandKey) || compatBrands.some((b) => String(b || "").toLowerCase().includes(brandKey))
        : false;

      return modelMatch || familyMatch || brandMatch;
    };

    if (typeKey || modelKey || familyKey || brandKey) {
      const byCategory = base.filter((item) => categoryMatchesDevice(item));
      if (modelKey || familyKey || brandKey) {
        const strictMatches = byCategory.filter((item) => matchesSpecificDevice(item));
        base = strictMatches.length > 0 ? strictMatches : byCategory;
      } else {
        base = byCategory;
      }
    }

    return base;
  }, [inventoryItems, activeCategory, search, deviceType, deviceBrand, deviceFamily, deviceModel]);

  const categoryCounts = useMemo(() => {
    const all = inventoryItems.length;
    const services = inventoryItems.filter(isService).length;
    const accessories = inventoryItems.filter(isAccessory).length;
    const parts = inventoryItems.filter((i) => !isService(i) && !isAccessory(i)).length;
    return { all, services, accessories, parts };
  }, [inventoryItems]);

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => {
      const base = toNum(item.price, 0) * toNum(item.qty, 1);
      const discount = toNum(item.discount_percentage, 0);
      const finalLine = base - base * (discount / 100);
      return sum + finalLine;
    }, 0);

    const taxableBase = cartItems.reduce((sum, item) => {
      if (item.taxable === false) return sum;
      const base = toNum(item.price, 0) * toNum(item.qty, 1);
      const discount = toNum(item.discount_percentage, 0);
      return sum + (base - base * (discount / 100));
    }, 0);

    const tax = taxableBase * IVU_RATE;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [cartItems]);

  const addToCart = (item) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((x) => String(x.id) === String(item.id) && x.type === item.type);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        normalizeCartItem({
          ...item,
          __kind: item.type === "service" ? "service" : "product",
          __source_id: item.id,
          from_inventory: true,
          qty: 1,
          taxable: item.type !== "service" ? true : true,
        }),
      ];
    });
    // Auto-show cart when adding an item
    setShowCart(true);
  };

  const changeQty = (idx, delta) => {
    setCartItems((prev) => {
      const next = [...prev];
      if (!next[idx]) return prev;
      const qty = Math.max(1, toNum(next[idx].qty, 1) + delta);
      next[idx] = { ...next[idx], qty };
      return next;
    });
  };

  const removeItem = (idx) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearCart = () => {
    setCartItems([]);
    toast.success("Orden limpia");
  };

  const saveToOrder = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const normalized = cartItems.map((raw) => {
        const item = normalizeCartItem(raw);
        return {
          id: item.id,
          name: item.name,
          price: toNum(item.price, 0),
          qty: toNum(item.qty, 1),
          type: item.type,
          __kind: item.__kind || item.type,
          __source_id: item.__source_id || item.id,
          from_inventory: item.from_inventory === true,
          stock: toNum(item.stock, 0),
          sku: item.sku || "",
          discount_percentage: toNum(item.discount_percentage, 0),
          taxable: item.taxable !== false,
          source: item.source || (item.from_inventory ? "inventory" : "manual"),
          is_manual: item.is_manual === true,
          ...(item.link_ref_id ? { link_ref_id: item.link_ref_id } : {}),
          ...(item.link_url ? { link_url: item.link_url } : {}),
          ...(item.part_type ? { part_type: item.part_type } : {}),
          ...(item.tipo_principal ? { tipo_principal: item.tipo_principal } : {}),
          ...(item.category ? { category: item.category } : {}),
        };
      });

      const currentPaid = Number(order?.total_paid || order?.amount_paid || 0);
      const balanceDue = Math.max(0, totals.total - currentPaid);

      const remoteUpdatePayload = {
        order_items: normalized,
        cost_estimate: totals.total,
        balance_due: balanceDue,
        tax_rate: IVU_RATE,
      };
      const localUpdatePayload = {
        ...remoteUpdatePayload,
        total: totals.total,
      };

      if (isDraftOrder) {
        onApplyItems?.(normalized);
        onSave?.(normalized);
        onClose?.();
        return;
      }

      // Actualización optimista: el usuario no debe quedar bloqueado por una sync remota.
      onSave?.(normalized);
      onUpdate?.({ id: order.id, ...localUpdatePayload });
      onClose?.();

      try {
        await dataClient.entities.Order.update(order.id, remoteUpdatePayload);
      } catch (primaryError) {
        console.warn("[AddItemModal] dataClient update failed, trying base44 fallback:", primaryError);
        try {
          await base44.entities.Order.update(order.id, remoteUpdatePayload);
        } catch (secondaryError) {
          console.warn("[AddItemModal] base44 update failed, trying direct supabase fallback:", secondaryError);
          let query = supabase
            .from("order")
            .update({
              ...remoteUpdatePayload,
              updated_date: new Date().toISOString(),
            })
            .eq("id", order.id);

          const tenantId = getTenantId();
          if (tenantId) {
            query = query.eq("tenant_id", tenantId);
          }

          const { error: directError } = await query.select("id").maybeSingle();
          if (directError) throw directError;
        }
      }

      await onRemoteSaved?.({
        id: order.id,
        ...localUpdatePayload,
      });

      toast.success("Items de la orden actualizados");
    } catch (error) {
      console.error("[AddItemModal] saveToOrder error:", error);
      toast.warning("Orden guardada localmente. Falta sincronizarla.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const countInCart = cartItems.reduce((sum, item) => sum + toNum(item.qty, 1), 0);

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md p-3 sm:p-5">
      <div className="relative mx-auto h-full w-full max-w-[1320px] rounded-[32px] border border-white/10 glass-panel shadow-[0_30px_100px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="relative flex items-center justify-between border-b border-white/[0.06] backdrop-blur-3xl px-8 py-5">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute left-0 top-0 h-24 w-64 rounded-full bg-cyan-500/5 blur-3xl" />

          <div className="flex items-center gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-cyan-400/25 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_8px_32px_rgba(34,211,238,0.2)]">
              <ShoppingCart className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tighter uppercase text-white">Catálogo de Items</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Inventario & Servicios</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/50 transition"
              onClick={() => setShowQuickItem(true)}
            >
              <Wrench className="w-4 h-4 mr-2" /> + Manual
            </Button>

            <Button
              variant="outline"
              className="rounded-xl border-red-500/25 bg-red-500/8 text-red-300/80 hover:bg-red-500/20 hover:text-red-200 transition"
              onClick={clearCart}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Limpiar
            </Button>

            <button
              onClick={() => setShowCart(true)}
              className={`relative flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                showCart
                  ? "border-emerald-500/50 bg-emerald-600/25 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  : "border-white/15 bg-white/5 text-white hover:border-emerald-500/30 hover:bg-emerald-500/10"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Orden
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-black text-white">
                {countInCart}
              </span>
            </button>

            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-1.5 transition ${viewMode === "grid" ? "bg-cyan-500/20 text-cyan-300" : "text-white/50 hover:text-white"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-1.5 transition ${viewMode === "list" ? "bg-cyan-500/20 text-cyan-300" : "text-white/50 hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 grid grid-cols-[240px_minmax(0,1fr)]">
          {/* Sidebar */}
          <div className="border-r border-white/8 bg-black/20 p-4 space-y-2">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-white/35">Categorías</p>
            {[
              { key: "all",         label: "Todas",      icon: Package, count: categoryCounts.all,         color: "cyan" },
              { key: "services",    label: "Servicios",  icon: Zap,     count: categoryCounts.services,    color: "violet" },
              { key: "accessories", label: "Accesorios", icon: Box,     count: categoryCounts.accessories, color: "amber" },
              { key: "parts",       label: "Piezas",     icon: Wrench,  count: categoryCounts.parts,       color: "emerald" },
            ].map((cat) => {
              const isActive = activeCategory === cat.key;
              const colorMap = {
                cyan:    { border: "border-cyan-400/35",    bg: "bg-cyan-500/12",    text: "text-cyan-200",    badge: "bg-cyan-500/20 text-cyan-200" },
                violet:  { border: "border-violet-400/35", bg: "bg-violet-500/12",  text: "text-violet-200", badge: "bg-violet-500/20 text-violet-200" },
                amber:   { border: "border-amber-400/35",  bg: "bg-amber-500/12",   text: "text-amber-200",  badge: "bg-amber-500/20 text-amber-200" },
                emerald: { border: "border-emerald-400/35",bg: "bg-emerald-500/12", text: "text-emerald-200",badge: "bg-emerald-500/20 text-emerald-200" },
              }[cat.color];
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`w-full flex items-center justify-between rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? `${colorMap.border} ${colorMap.bg} ${colorMap.text}`
                      : "border-white/8 bg-white/[0.02] text-white/65 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    isActive ? colorMap.badge : "bg-white/10 text-white/60"
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Main catalog area */}
          <div className="min-w-0 flex flex-col">
            {/* Search */}
            <div className="border-b border-white/8 p-4">
              <div className="relative max-w-xl">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pieza, servicio, SKU..."
                  className="pl-10 rounded-xl bg-white/[0.04] border-white/10 text-white placeholder-white/30 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {loading && filteredItems.length === 0 ? (
                <div className="h-52 grid place-items-center">
                  <div className="text-center space-y-2">
                    <div className="w-8 h-8 mx-auto rounded-full border-2 border-cyan-500/40 border-t-cyan-400 animate-spin" />
                    <p className="text-sm text-white/40">Cargando inventario...</p>
                  </div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="h-52 grid place-items-center text-white/35 text-sm">Sin items para esta categoría</div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredItems.map((item) => {
                    const svc = isService(item);
                    const acc = isAccessory(item);
                    const typeLabel = svc ? "Servicio" : acc ? "Accesorio" : "Pieza";
                    const typeCls = svc
                      ? "border-violet-400/25 bg-violet-500/10 text-violet-300"
                      : acc
                      ? "border-amber-400/25 bg-amber-500/10 text-amber-300"
                      : "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="group rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all duration-300 relative overflow-hidden"
                      >
                        <div className="absolute -right-16 -top-16 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-colors" />
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-white leading-tight text-sm line-clamp-2">{item.name}</p>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${typeCls}`}>
                            {typeLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/35 mt-1.5">{item.sku || "Sin código"}</p>
                        {item.stock > 0 && (
                          <p className="text-[11px] text-amber-300/70 mt-0.5">Stock: {item.stock}</p>
                        )}
                        <div className="mt-4 flex items-center justify-between">
                          <p className="text-2xl font-black text-white">${toNum(item.price).toFixed(2)}</p>
                          <button
                            onClick={() => addToCart(item)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/50 hover:shadow-[0_0_14px_rgba(34,211,238,0.2)] transition-all active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredItems.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => addToCart(item)}
                      className="w-full rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.06] hover:border-cyan-500/20 p-3 text-left flex items-center justify-between gap-4 transition-all group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                        <p className="text-xs text-white/35">{item.sku || "Sin código"}</p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-emerald-300">${toNum(item.price).toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* ── Floating Cart ── */}
        {showCart && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 px-4">
            <div className="pointer-events-auto ml-auto w-full max-w-[480px] rounded-2xl border border-emerald-500/30 bg-[rgba(3,12,10,0.97)] shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(16,185,129,0.08)] overflow-hidden">
              {/* Cart header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
                  Orden <span className="text-emerald-400">({countInCart})</span>
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-black text-emerald-300">${totals.total.toFixed(2)}</p>
                  <button
                    onClick={() => setShowCart(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/8 hover:bg-white/15 text-white/60 hover:text-white transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cart items */}
              {cartItems.length === 0 ? (
                <div className="mx-3 mb-3 rounded-xl border border-white/8 bg-black/20 p-3 text-center text-xs text-white/40">El carrito está vacío</div>
              ) : (
                <>
                  <div className="max-h-36 overflow-y-auto space-y-1 px-3">
                    {cartItems.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                          <p className="text-[11px] text-white/40">${toNum(item.price).toFixed(2)} c/u</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => changeQty(idx, -1)}
                            className="h-6 w-6 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 grid place-items-center transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-white">{item.qty}</span>
                          <button
                            onClick={() => changeQty(idx, 1)}
                            className="h-6 w-6 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 grid place-items-center transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeItem(idx)}
                            className="h-6 w-6 rounded-lg border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/25 grid place-items-center transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mx-3 mt-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2 space-y-1">
                    <div className="flex justify-between text-xs text-white/50">
                      <span>Subtotal</span>
                      <span className="font-semibold text-white/70">${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-white/50">
                      <span>IVU (11.5%)</span>
                      <span className="font-semibold text-white/70">${totals.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/8 pt-1">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-white/60">Total</span>
                      <span className="text-sm font-black text-emerald-300">${totals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Apply button */}
                  <div className="p-3">
                    <button
                      onClick={saveToOrder}
                      disabled={saving}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_6px_24px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] disabled:opacity-60"
                    >
                      {saving ? "Guardando..." : "Aplicar y Cerrar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showQuickItem && (
        <QuickItemModal
          open={showQuickItem}
          onClose={() => setShowQuickItem(false)}
          onSave={(newItem) => {
            const normalized = normalizeInventoryItem({ ...newItem, is_manual: true, source: "manual" });
            setInventoryItems((prev) => uniqueByKey([normalized, ...prev]));
            addToCart(normalized);
            setShowQuickItem(false);
          }}
        />
      )}
    </div>,
    document.body
  );
}
