// === PurchaseOrderDialog.jsx — Wizard lineal para Órdenes de Compra ===

import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import { toast } from "sonner";
import {
  Calendar,
  ClipboardList,
  FileText,
  Package,
  PackageSearch,
  Truck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Link2,
  Zap,
  AlertCircle,
  Wrench,
  Sparkles } from
"lucide-react";

import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradePrompt } from "@/components/plan/UpgradePrompt";
// IA dedicada SOLO a Órdenes de Compra (escaneo de facturas).
// Es el único punto del app donde la IA está activa.
import POInvoiceScannerDialog from "./POInvoiceScannerDialog";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function PurchaseOrderDialog({
  open,
  onClose,
  purchaseOrder,
  suppliers = [],
  products = [],
  workOrders = [],
  initialProducts = []
}) {
  const { can: canPlan } = usePlanLimits();
  const isEditing = Boolean(purchaseOrder?.id);

  console.log("🔍 PurchaseOrderDialog abierto:", {
    open,
    isEditing,
    purchaseOrderId: purchaseOrder?.id,
    purchaseOrder
  });

  const [step, setStep] = useState(1);
  const [poNumber, setPoNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [status, setStatus] = useState("draft");
  const [defaultWorkOrderId, setDefaultWorkOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  // Scanner IA — solo cuando se está creando una PO nueva.
  const [showAIScanner, setShowAIScanner] = useState(false);
  const [aiAttachmentUrl, setAiAttachmentUrl] = useState(null);

  // Aplica los datos extraídos por IA a los campos del formulario.
  // No guarda — el usuario revisa/edita y luego presiona Guardar.
  const handleAIExtracted = (extracted) => {
    if (!extracted) return;
    if (extracted.supplier_name) setSupplierName(extracted.supplier_name);
    if (extracted.order_date)    setOrderDate(extracted.order_date);
    if (extracted.shipping_cost) setShippingCost(Number(extracted.shipping_cost) || 0);
    if (extracted.invoice_number) {
      // Si la PO aún no tiene número, usar el de la factura como referencia.
      setNotes((n) =>
        (n ? n + "\n" : "") + `Factura del proveedor: ${extracted.invoice_number}`
      );
    }
    if (Array.isArray(extracted.line_items) && extracted.line_items.length > 0) {
      setItems(extracted.line_items.map((it) => ({
        product_id: null,
        product_name: it.product_name || "",
        quantity: Number(it.quantity || 1),
        unit_cost: Number(it.unit_cost || 0),
        line_total: Number(it.line_total || (Number(it.unit_cost || 0) * Number(it.quantity || 1))),
        is_ai_imported: true,
      })));
    }
    if (extracted.file_url) setAiAttachmentUrl(extracted.file_url);
  };

  const generatePONumber = () => {
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 900 + 100);
    return `PO-${datePart}-${rand}`;
  };

  useEffect(() => {
    if (!open) return;

    const init = async () => {
      setStep(1);

      if (isEditing && purchaseOrder?.id) {
        console.log("📦 Cargando orden existente:", purchaseOrder.id);
        setLoadingPO(true);
        try {
          const full = await base44.entities.PurchaseOrder.get(purchaseOrder.id);
          const po = full || purchaseOrder;
          console.log("✅ Orden cargada:", po);

          setPoNumber(po.po_number || po.poNumber || purchaseOrder.po_number || "");
          setSupplierId(po.supplier_id || "");
          setSupplierName(po.supplier_name || "");
          setOrderDate(po.order_date || "");
          setExpectedDate(po.expected_date || "");
          setStatus(po.status || "ordered");
          setDefaultWorkOrderId(po.work_order_id || "");
          setNotes(po.notes || "");
          setShippingCost(Number(po.shipping_cost || 0));

          const rawItems = po.items || po.line_items || purchaseOrder.items || purchaseOrder.line_items || [];
          console.log("📦 Items crudos:", rawItems);

          const mappedItems = rawItems.map((it) => {
            const prodId = it.product_id || it.inventory_item_id;
            const prod = products.find((p) => p.id === prodId);
            return {
              product_id: prodId,
              product_name: it.product_name || prod?.name || "",
              quantity: Number(it.quantity || 1),
              unit_cost: Number(it.unit_cost || it.cost || prod?.cost || 0),
              work_order_id: it.work_order_id || it.linked_work_order_id || po.work_order_id || ""
            };
          });

          setItems(mappedItems);
          console.log("✅ Items mapeados:", mappedItems);
        } catch (err) {
          console.error("❌ Error cargando PurchaseOrder:", err);
          const rawItems = purchaseOrder.items || purchaseOrder.line_items || [];
          const mappedItems = rawItems.map((it) => {
            const prodId = it.product_id || it.inventory_item_id;
            const prod = products.find((p) => p.id === prodId);
            return {
              product_id: prodId,
              product_name: it.product_name || prod?.name || "",
              quantity: Number(it.quantity || 1),
              unit_cost: Number(it.unit_cost || it.cost || prod?.cost || 0),
              work_order_id: it.work_order_id || it.linked_work_order_id || ""
            };
          });

          setPoNumber(purchaseOrder.po_number || "");
          setSupplierId(purchaseOrder.supplier_id || "");
          setSupplierName(purchaseOrder.supplier_name || "");
          setOrderDate(purchaseOrder.order_date || "");
          setExpectedDate(purchaseOrder.expected_date || "");
          setStatus(purchaseOrder.status || "ordered");
          setDefaultWorkOrderId(purchaseOrder.work_order_id || "");
          setNotes(purchaseOrder.notes || "");
          setShippingCost(Number(purchaseOrder.shipping_cost || 0));
          setItems(mappedItems);
        } finally {
          setLoadingPO(false);
        }
      } else {
        console.log("➕ Creando orden nueva");
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        setOrderDate(todayStr);
        setExpectedDate("");
        setPoNumber(generatePONumber());

        const initial = (initialProducts || []).map((prod) => ({
          product_id: prod.id,
          product_name: prod.name,
          quantity: 1,
          unit_cost: Number(prod.cost || 0),
          work_order_id: ""
        }));
        setItems(initial);

        setSupplierId("");
        setSupplierName("");
        setStatus("draft");
        setDefaultWorkOrderId("");
        setNotes("");
        setShippingCost(0);
        setLoadingPO(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, purchaseOrder?.id]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId),
    [supplierId, suppliers]
  );

  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedSupplier) {
      list = list.filter(
        (p) => p.supplier_id === selectedSupplier.id || !p.supplier_id
      );
    }

    if (searchProduct.trim()) {
      const t = searchProduct.toLowerCase();
      list = list.filter(
        (p) =>
        String(p.name || "").toLowerCase().includes(t) ||
        String(p.compatibility_models || "").toLowerCase().includes(t)
      );
    }

    return list.slice(0, 50);
  }, [products, selectedSupplier, searchProduct]);

  const subtotalAmount = useMemo(
    () =>
    items.reduce(
      (sum, it) =>
      sum + Number(it.unit_cost || 0) * Number(it.quantity || 0),
      0
    ),
    [items]
  );

  const totalAmount = useMemo(
    () => subtotalAmount + Number(shippingCost || 0),
    [subtotalAmount, shippingCost]
  );

  const handleAddProduct = (product) => {
    setItems((prev) => {
      const existing = prev.find((it) => it.product_id === product.id);
      if (existing) {
        return prev.map((it) =>
        it.product_id === product.id ?
        { ...it, quantity: Number(it.quantity || 0) + 1 } :
        it
        );
      }
      return [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_cost: Number(product.cost || 0),
        work_order_id: defaultWorkOrderId || ""
      }];

    });
  };

  const handleChangeItemQty = (productId, qty) => {
    const n = Math.max(1, Number(qty || 1));
    setItems((prev) =>
    prev.map((it) =>
    it.product_id === productId ? { ...it, quantity: n } : it
    )
    );
  };

  const handleChangeItemCost = (productId, cost) => {
    const n = Math.max(0, Number(cost || 0));
    setItems((prev) =>
    prev.map((it) =>
    it.product_id === productId ? { ...it, unit_cost: n } : it
    )
    );
  };

  const handleChangeItemWO = (productId, workOrderId) => {
    setItems((prev) =>
    prev.map((it) =>
    it.product_id === productId ?
    { ...it, work_order_id: workOrderId } :
    it
    )
    );
  };

  const handleRemoveItem = (productId) => {
    setItems((prev) => prev.filter((it) => it.product_id !== productId));
  };

  const applyDefaultWorkOrderToItems = (woId) => {
    setItems((prev) =>
    prev.map((it) => ({
      ...it,
      work_order_id: woId
    }))
    );
  };

  const canGoNext = () => {
    if (step === 1) {
      return !!supplierId || !!supplierName.trim();
    }
    if (step === 2) {
      return items.length > 0;
    }
    if (step === 3) {
      return !!orderDate;
    }
    return true;
  };

  const handleNext = () => {
    if (!canGoNext()) {
      if (step === 1) toast.error("Selecciona un suplidor o escribe un nombre");
      if (step === 2) toast.error("Añade al menos un producto");
      if (step === 3) toast.error("La fecha de orden es requerida");
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const handlePrev = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSave = async () => {
    try {
      if (!supplierId && !supplierName.trim()) {
        toast.error("Debes seleccionar o escribir un suplidor");
        setStep(1);
        return;
      }
      if (items.length === 0) {
        toast.error("La orden debe tener al menos un producto");
        setStep(2);
        return;
      }
      if (!orderDate) {
        toast.error("La fecha de orden es requerida");
        setStep(3);
        return;
      }

      const finalPoNumber = poNumber || generatePONumber();

      const payload = {
        po_number: finalPoNumber,
        supplier_id: supplierId || null,
        supplier_name: selectedSupplier?.name || supplierName || "",
        status,
        order_date: orderDate || null,
        expected_date: expectedDate || null,
        work_order_id: defaultWorkOrderId || null,
        notes: notes || "",
        shipping_cost: Number(shippingCost || 0),
        total_amount: Number(totalAmount || 0),
        items: items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: Number(it.quantity || 1),
          unit_cost: Number(it.unit_cost || 0),
          work_order_id: it.work_order_id || defaultWorkOrderId || null
        }))
      };

      if (isEditing) {
        await base44.entities.PurchaseOrder.update(purchaseOrder.id, payload);
        toast.success("Orden de compra actualizada");
      } else {
        await base44.entities.PurchaseOrder.create(payload);
        toast.success("Orden de compra creada");
      }

      onClose?.(true);
    } catch (err) {
      console.error("Error guardando orden de compra:", err);
      toast.error("No se pudo guardar la orden de compra");
    }
  };

  // ── Work Order helpers ─────────────────────────────────────────────────────
  const WO_PARTS_STATUSES = ['waiting_parts', 'waiting_order', 'pending_order'];

  const woLabel = (wo) => {
    const num = wo.order_number || `#${String(wo.id).slice(-6).toUpperCase()}`;
    const device = [wo.device_brand, wo.device_model].filter(Boolean).join(' ') || wo.device_type || '';
    return { num, device };
  };

  const woStatusInfo = (status) => {
    const map = {
      waiting_parts:     { label: 'Esp. piezas',   color: 'text-apple-orange bg-apple-orange/15 border-amber-500/20' },
      waiting_order:     { label: 'Esp. orden',    color: 'text-apple-orange bg-apple-orange/15 border-amber-500/20' },
      pending_order:     { label: 'Pedido pend.',  color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      in_progress:       { label: 'En progreso',   color: 'text-apple-blue bg-apple-blue/15' },
      diagnosing:        { label: 'Diagnóstico',   color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      awaiting_approval: { label: 'Esp. aprobación', color: 'text-apple-blue bg-apple-blue/15' },
      intake:            { label: 'Recibido',      color: 'apple-label-tertiary bg-gray-sys6 dark:bg-gray-sys5 border-0' },
    };
    return map[status] || { label: status || '—', color: 'apple-label-tertiary bg-gray-sys6 dark:bg-gray-sys5 border-0' };
  };

  // Órdenes que están esperando piezas — candidatas a sugerir
  const suggestedWorkOrders = workOrders.filter(wo =>
    WO_PARTS_STATUSES.includes(wo.status)
  );

  // ── Step indicator ─────────────────────────────────────────────────────────
  const StepIndicator = () => {
    const steps = [
      { id: 1, label: "Suplidor", icon: Truck },
      { id: 2, label: "Productos", icon: Package },
      { id: 3, label: "Fechas", icon: Calendar },
      { id: 4, label: "Órdenes", icon: ClipboardList },
      { id: 5, label: "Resumen", icon: CheckCircle2 }
    ];

    return (
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => done && setStep(s.id)}
                className={[
                  "flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-apple-sm border text-xs font-bold transition-all",
                  active
                    ? "bg-white text-gray-900 border-transparent shadow-lg"
                    : done
                    ? "bg-apple-green/15 text-apple-green cursor-pointer hover:bg-apple-green/20"
                    : "apple-card border-0 apple-label-tertiary"
                ].join(" ")}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="w-full h-1 bg-gray-sys6 dark:bg-gray-sys5 rounded-full overflow-hidden">
          <div
            className="h-full apple-btn apple-btn-primary bg-apple-green transition-all duration-500"
            style={{ width: `${(step - 1) * 25}%` }}
          />
        </div>
      </div>
    );
  };

  // ── Step 1: Supplier ───────────────────────────────────────────────────────
  const Step1Supplier = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <p className="apple-text-caption2 font-semibold apple-label-tertiary">Selecciona el suplidor</p>
        {poNumber && (
          <span className="text-[11px] apple-label-tertiary font-mono">
            <span className="apple-label-tertiary mr-1">PO:</span>{poNumber}
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
        {suppliers.length === 0 && (
          <p className="text-xs apple-label-tertiary">No hay suplidores. Crea uno primero.</p>
        )}
        {suppliers
          .filter((s) => s.active !== false)
          .map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSupplierId(s.id);
                setSupplierName(s.name || "");
              }}
              className={[
                "flex items-center gap-3 p-4 rounded-apple-md border text-left transition-all",
                supplierId === s.id
                  ? "bg-apple-green/12"
                  : "apple-card border-0 hover:bg-gray-sys6 dark:bg-gray-sys5"
              ].join(" ")}
            >
              <div className="w-8 h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 text-apple-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm truncate ${supplierId === s.id ? "text-white" : "apple-label-secondary"}`}>{s.name}</p>
                {s.website && <p className="text-[10px] apple-label-tertiary truncate">{s.website}</p>}
              </div>
              {supplierId === s.id && <div className="w-2 h-2 rounded-full bg-apple-green shrink-0" />}
            </button>
          ))}
      </div>

      <div>
        <label className="apple-text-caption2 font-semibold apple-label-tertiary block mb-1.5">Nombre manual (opcional)</label>
        <input
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="Ej: Proveedor nuevo sin registrar"
          className="w-full apple-input rounded-apple-sm px-4 py-3 text-white text-sm placeholder:apple-label-tertiary focus:outline-none focus:ring-apple-green "
        />
        <p className="text-[11px] apple-label-tertiary mt-1">
          Si seleccionas un suplidor de la lista, este nombre se rellenará automáticamente.
        </p>
      </div>
    </div>
  );

  // ── Step 2: Products ───────────────────────────────────────────────────────
  const Step2Products = () => (
    <div className="space-y-4">
      <input
        value={searchProduct}
        onChange={(e) => setSearchProduct(e.target.value)}
        placeholder="Buscar producto por nombre, modelo compatible..."
        className="w-full apple-input rounded-apple-sm px-4 py-3 text-white text-sm placeholder:apple-label-tertiary focus:outline-none focus:ring-apple-green"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="apple-card border-0 rounded-apple-md p-3 max-h-60 overflow-y-auto">
          <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-2">
            Disponibles ({filteredProducts.length})
          </p>
          {filteredProducts.length === 0 ? (
            <p className="text-xs apple-label-tertiary py-4 text-center">No se encontraron productos.</p>
          ) : (
            <ul className="space-y-1">
              {filteredProducts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-xs bg-gray-sys6 dark:bg-gray-sys5 hover:bg-gray-sys5 dark:bg-gray-sys4 rounded-apple-sm px-3 py-2 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold apple-label-primary truncate">{p.name}</p>
                    <p className="text-[10px] apple-label-tertiary truncate">
                      Costo: {money(p.cost || 0)} · Stock: {p.stock ?? 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    className="w-7 h-7 rounded-lg bg-apple-green/15 flex items-center justify-center text-apple-green hover:bg-apple-green/20 transition-all font-bold text-base"
                  >
                    +
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="apple-card border-0 rounded-apple-md p-3 max-h-60 overflow-y-auto">
          <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-2">
            En la orden ({items.length})
          </p>
          {items.length === 0 ? (
            <p className="text-xs apple-label-tertiary py-4 text-center">Aún no has añadido productos.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="apple-label-tertiary">
                <tr>
                  <th className="text-left pb-1">Producto</th>
                  <th className="text-right pb-1">Cant.</th>
                  <th className="text-right pb-1">Costo</th>
                  <th className="text-right pb-1">Total</th>
                  <th className="text-right pb-1"></th>
                </tr>
              </thead>
              <tbody className="apple-label-secondary">
                {items.map((it) => (
                  <tr key={it.product_id} className="border-t border-gray-sys5 dark:border-gray-sys4">
                    <td className="py-1.5 pr-2 max-w-[120px] truncate font-bold">{it.product_name}</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => handleChangeItemQty(it.product_id, e.target.value)}
                        className="h-7 w-14 text-right bg-gray-sys6 dark:bg-gray-sys5 rounded-lg text-white text-xs focus:outline-none focus:ring-apple-green px-1"
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={it.unit_cost}
                        onChange={(e) => handleChangeItemCost(it.product_id, e.target.value)}
                        className="h-7 w-20 text-right bg-gray-sys6 dark:bg-gray-sys5 rounded-lg text-white text-xs focus:outline-none focus:ring-apple-green px-1"
                      />
                    </td>
                    <td className="py-1.5 text-right apple-label-secondary">
                      {money((it.unit_cost || 0) * (it.quantity || 0))}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.product_id)}
                        className="w-6 h-6 rounded-lg bg-apple-red/15 flex items-center justify-center text-apple-red hover:bg-apple-red/20 transition-all text-xs ml-auto"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 text-right apple-label-tertiary font-bold">Subtotal:</td>
                  <td className="pt-2 text-right font-bold apple-label-secondary">
                    {money(subtotalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  // ── Step 3: Dates & Status ─────────────────────────────────────────────────
  const Step3DatesStatus = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="apple-text-caption2 font-semibold apple-label-tertiary block mb-1.5">Fecha de orden *</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full apple-input rounded-apple-sm px-4 py-3 text-white text-sm focus:outline-none focus:ring-apple-green"
          />
        </div>
        <div>
          <label className="apple-text-caption2 font-semibold apple-label-tertiary block mb-1.5">Fecha estimada de entrega</label>
          <input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="w-full apple-input rounded-apple-sm px-4 py-3 text-white text-sm focus:outline-none focus:ring-apple-green"
          />
        </div>
      </div>

      <div>
        <label className="apple-text-caption2 font-semibold apple-label-tertiary block mb-2">Estado</label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "draft", label: "Borrador", active: "bg-gray-sys3 text-white", inactive: "apple-card border-0 apple-label-tertiary" },
            { value: "ordered", label: "Ordenado", active: "bg-apple-blue text-white", inactive: "apple-card border-0 apple-label-tertiary" },
            { value: "received", label: "Recibido", active: "bg-apple-green text-white", inactive: "apple-card border-0 apple-label-tertiary" },
            { value: "cancelled", label: "Cancelado", active: "bg-apple-red text-white", inactive: "apple-card border-0 apple-label-tertiary" }
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={[
                "px-4 py-2 rounded-apple-sm text-sm font-bold border transition-all",
                status === opt.value ? opt.active : opt.inactive
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="apple-text-caption2 font-semibold apple-label-tertiary block mb-1.5">Costo de envío (opcional)</label>
        <input
          type="number"
          step="0.01"
          min={0}
          value={shippingCost}
          onChange={(e) => setShippingCost(Number(e.target.value) || 0)}
          placeholder="0.00"
          className="w-full apple-input rounded-apple-sm px-4 py-3 text-white text-sm placeholder:apple-label-tertiary focus:outline-none focus:ring-apple-green"
        />
        <p className="text-[11px] apple-label-tertiary mt-1">Se sumará al total de la orden</p>
      </div>

      <div>
        <label className="apple-text-caption2 font-semibold apple-label-tertiary block mb-1.5">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Comentarios adicionales sobre la orden (opcional)"
          className="w-full apple-input rounded-apple-sm px-4 py-3 text-white text-sm placeholder:apple-label-tertiary focus:outline-none focus:ring-apple-green resize-none"
        />
      </div>
    </div>
  );

  // ── Step 4: Work Orders ────────────────────────────────────────────────────
  const Step4WorkOrders = () => (
    <div className="space-y-4">

      {/* ─ Sugerencias automáticas ─────────────────────────────────── */}
      {suggestedWorkOrders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-apple-orange" />
            <p className="apple-text-caption2 font-semibold text-apple-orange">
              Órdenes esperando piezas ({suggestedWorkOrders.length})
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
            {suggestedWorkOrders.map((wo) => {
              const { num, device } = woLabel(wo);
              const { label: sLabel, color: sColor } = woStatusInfo(wo.status);
              const isLinkedToAny = items.some(it => it.work_order_id === wo.id);
              return (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => applyDefaultWorkOrderToItems(isLinkedToAny ? "" : wo.id)}
                  className={`flex items-start gap-3 p-3 rounded-apple-md border text-left transition-all ${
                    isLinkedToAny
                      ? 'bg-apple-indigo/12'
                      : 'apple-card hover:bg-apple-orange/12'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-apple-sm flex items-center justify-center flex-shrink-0 ${isLinkedToAny ? 'bg-apple-indigo/15' : 'bg-apple-orange/15'}`}>
                    {isLinkedToAny
                      ? <Link2 className="w-3.5 h-3.5 text-apple-indigo" />
                      : <AlertCircle className="w-3.5 h-3.5 text-apple-orange" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-white">{num}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sColor}`}>{sLabel}</span>
                      {isLinkedToAny && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border text-apple-indigo bg-apple-indigo/15">Enlazada ✓</span>}
                    </div>
                    <p className="text-[11px] apple-label-secondary font-semibold truncate mt-0.5">{wo.customer_name || '—'}</p>
                    {device && <p className="text-[10px] apple-label-tertiary truncate">{device}</p>}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] apple-label-tertiary mt-1.5">Toca una tarjeta para enlazar/desenlazar todos los productos a esa orden.</p>
        </div>
      )}

      {suggestedWorkOrders.length === 0 && (
        <div className="flex items-center gap-3 p-3 apple-card border-0 rounded-apple-md">
          <Wrench className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
          <p className="text-xs apple-label-tertiary">No hay órdenes de trabajo esperando piezas en este momento.</p>
        </div>
      )}

      {/* ─ Aplicar a todos ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-3 apple-card border-0 rounded-apple-md">
        <Link2 className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">Aplicar a todos los productos</p>
          <select
            value={defaultWorkOrderId}
            onChange={(e) => {
              setDefaultWorkOrderId(e.target.value);
              applyDefaultWorkOrderToItems(e.target.value);
            }}
            className="w-full h-8 rounded-apple-sm apple-input text-xs px-2 focus:outline-none focus:ring-apple-green"
          >
            <option value="">Sin enlace global</option>
            {workOrders.map((wo) => {
              const { num, device } = woLabel(wo);
              const { label: sLabel } = woStatusInfo(wo.status);
              return (
                <option key={wo.id} value={wo.id}>
                  {num} · {wo.customer_name || 'Cliente'}{device ? ` · ${device}` : ''} [{sLabel}]
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* ─ Por producto ────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div>
          <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-2">Enlace individual por producto</p>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {items.map((it) => {
              const linkedWO = workOrders.find(wo => wo.id === it.work_order_id);
              const { num: linkedNum } = linkedWO ? woLabel(linkedWO) : {};
              const { color: linkedColor } = linkedWO ? woStatusInfo(linkedWO.status) : {};
              return (
                <div key={it.product_id} className="flex items-center gap-3 p-3 apple-card border-0 rounded-apple-md">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{it.product_name}</p>
                    <p className="text-[10px] apple-label-tertiary">Cant: {it.quantity}</p>
                  </div>
                  {it.work_order_id && linkedWO ? (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${linkedColor}`}>
                      {linkedNum}
                    </span>
                  ) : null}
                  <select
                    value={it.work_order_id || ""}
                    onChange={(e) => handleChangeItemWO(it.product_id, e.target.value)}
                    className="h-8 rounded-apple-sm apple-input apple-text-caption1 px-2 focus:outline-none focus:ring-apple-green flex-shrink-0 max-w-[180px]"
                  >
                    <option value="">Sin enlace</option>
                    {workOrders.map((wo) => {
                      const { num, device } = woLabel(wo);
                      return (
                        <option key={wo.id} value={wo.id}>
                          {num} · {wo.customer_name || 'Cliente'}{device ? ` · ${device}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 5: Summary ────────────────────────────────────────────────────────
  const Step5Summary = () => (
    <div className="space-y-3">
      <div className="apple-card border-0 rounded-apple-md p-4">
        <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1.5">Número de PO</p>
        <p className="text-sm text-white font-mono">{poNumber || "Se generará automáticamente"}</p>
      </div>

      <div className="apple-card border-0 rounded-apple-md p-4">
        <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1.5">Suplidor</p>
        <p className="text-sm text-white font-bold">{selectedSupplier?.name || supplierName || "Sin suplidor definido"}</p>
      </div>

      <div className="apple-card border-0 rounded-apple-md p-4">
        <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-2">Productos ({items.length})</p>
        {items.length === 0 ? (
          <p className="text-xs apple-label-tertiary">No hay productos.</p>
        ) : (
          <ul className="space-y-1 text-xs apple-label-secondary max-h-40 overflow-y-auto">
            {items.map((it) => (
              <li
                key={it.product_id}
                className="flex items-center justify-between gap-2 border-b border-gray-sys5 dark:border-gray-sys4 pb-1.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-bold apple-label-primary">{it.product_name}</p>
                  <p className="text-[10px] apple-label-tertiary">
                    Cant: {it.quantity} · Costo: {money(it.unit_cost)} · Total:{" "}
                    {money((it.unit_cost || 0) * (it.quantity || 0))}
                  </p>
                </div>
                {it.work_order_id && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-apple-indigo/15 text-apple-indigo font-bold shrink-0">
                    OT #{it.work_order_id}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1 mt-3 text-sm border-t border-gray-sys5 dark:border-gray-sys4 pt-3">
          <div className="flex items-center justify-between">
            <span className="apple-label-tertiary font-bold">Subtotal:</span>
            <span className="apple-label-secondary">{money(subtotalAmount)}</span>
          </div>
          {shippingCost > 0 && (
            <div className="flex items-center justify-between">
              <span className="apple-label-tertiary font-bold">Envío:</span>
              <span className="apple-label-secondary">{money(shippingCost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-bold">
            <span className="apple-label-tertiary">Total:</span>
            <span className="text-apple-green text-lg">{money(totalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="apple-card border-0 rounded-apple-md p-4">
          <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1.5">Fechas</p>
          <p className="text-[11px] apple-label-secondary">Orden: {orderDate || "—"}</p>
          <p className="text-[11px] apple-label-secondary">Estimada: {expectedDate || "—"}</p>
        </div>
        <div className="apple-card border-0 rounded-apple-md p-4">
          <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1.5">Estado</p>
          <p className="text-[11px] apple-label-secondary capitalize">
            {status === "draft" ? "Borrador" : status === "ordered" ? "Ordenado" : status === "received" ? "Recibido" : status === "cancelled" ? "Cancelado" : status}
          </p>
          {defaultWorkOrderId && (
            <p className="text-[11px] apple-label-tertiary mt-1">OT general: #{defaultWorkOrderId}</p>
          )}
        </div>
      </div>

      {notes && (
        <div className="apple-card border-0 rounded-apple-md p-4">
          <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1.5">Notas</p>
          <p className="text-[11px] apple-label-secondary whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  );

  if (!canPlan('inventory_purchase_orders')) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose?.(false)}>
        <DialogContent className="apple-type max-w-md apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden apple-label-primary">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Órdenes de Compra</DialogTitle>
          </DialogHeader>
          <UpgradePrompt feature="inventory_purchase_orders" message="Órdenes de compra disponibles en el plan Pro" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.(false)}>
      <DialogContent className="apple-surface-elevated border-0 max-w-4xl text-white p-0 overflow-hidden">
        <div className="p-6 pb-0">
          <DialogHeader className="mb-4">
            <DialogTitle className="apple-text-headline font-semibold flex items-center gap-2 apple-label-primary">
              <div className="w-8 h-8 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                <FileText className="w-4 h-4 text-apple-green" />
              </div>
              {isEditing ? "Editar Orden de Compra" : "Nueva Orden de Compra"}
            </DialogTitle>
          </DialogHeader>

          {loadingPO ? (
            <div className="py-10 text-center text-sm apple-label-tertiary">
              Cargando orden de compra...
            </div>
          ) : (
            <>
              <StepIndicator />

              <div className="mt-2 max-h-[55vh] overflow-y-auto pr-1 pb-2">
                {step === 1 && <Step1Supplier />}
                {step === 2 && <Step2Products />}
                {step === 3 && <Step3DatesStatus />}
                {step === 4 && <Step4WorkOrders />}
                {step === 5 && <Step5Summary />}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 apple-surface-elevated flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <div className="flex items-center gap-2 text-xs apple-label-tertiary">
            <ClipboardList className="w-3 h-3" />
            <span>
              Paso {step} de 5 · Productos:{" "}
              <span className="text-apple-green font-bold">{items.length}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onClose?.(false)}
              className="px-4 py-2 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary text-sm font-bold hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>

            {step > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Atrás
              </button>
            )}

            {step < 5 && (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-apple-sm apple-btn apple-btn-primary bg-apple-green text-white text-sm font-bold hover:opacity-90 transition-all active:scale-95 flex items-center gap-1"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-apple-sm apple-btn apple-btn-primary bg-apple-green text-white text-sm font-bold hover:opacity-90 transition-all active:scale-95"
              >
                Guardar Orden
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
