// === PurchaseOrderDialog.jsx — Wizard lineal para Órdenes de Compra ===

import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  ClipboardList,
  FileText,
  PackageSearch,
  Truck,
  UserCircle2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function PurchaseOrderDialog({
  open,
  onClose,
  purchaseOrder,
  suppliers = [],
  products = [],
  workOrders = [],
  initialProducts = [],
}) {
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

          // Mapear items con soporte para ambos formatos
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
              work_order_id: it.work_order_id || it.linked_work_order_id || po.work_order_id || "",
            };
          });

          setItems(mappedItems);
          console.log("✅ Items mapeados:", mappedItems);
        } catch (err) {
          console.error("❌ Error cargando PurchaseOrder:", err);
          // Fallback a usar el objeto original si falla el get
          const rawItems = purchaseOrder.items || purchaseOrder.line_items || [];
          const mappedItems = rawItems.map((it) => {
            const prodId = it.product_id || it.inventory_item_id;
            const prod = products.find((p) => p.id === prodId);
            return {
              product_id: prodId,
              product_name: it.product_name || prod?.name || "",
              quantity: Number(it.quantity || 1),
              unit_cost: Number(it.unit_cost || it.cost || prod?.cost || 0),
              work_order_id: it.work_order_id || it.linked_work_order_id || "",
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
          work_order_id: "",
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
          it.product_id === product.id
            ? { ...it, quantity: Number(it.quantity || 0) + 1 }
            : it
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_cost: Number(product.cost || 0),
          work_order_id: defaultWorkOrderId || "",
        },
      ];
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
        it.product_id === productId
          ? { ...it, work_order_id: workOrderId }
          : it
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
        work_order_id: woId,
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
          work_order_id: it.work_order_id || defaultWorkOrderId || null,
        })),
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

  const StepIndicator = () => {
    const steps = [
      { id: 1, label: "Suplidor", icon: UserCircle2 },
      { id: 2, label: "Productos", icon: PackageSearch },
      { id: 3, label: "Fechas y costos", icon: Calendar },
      { id: 4, label: "Órdenes de trabajo", icon: ClipboardList },
      { id: 5, label: "Resumen", icon: CheckCircle2 },
    ];
    return (
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex justify-between gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div
                key={s.id}
                className="flex-1 flex flex-col items-center text-xs"
              >
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center border",
                    active
                      ? "bg-cyan-600 text-white border-cyan-400"
                      : done
                      ? "bg-emerald-600 text-white border-emerald-400"
                      : "bg-slate-900 text-slate-400 border-slate-700",
                  ].join(" ")}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="mt-1 text-[10px] text-slate-300">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
            style={{ width: `${(step - 1) * 25}%` }}
          />
        </div>
      </div>
    );
  };

  const Step1Supplier = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 mb-2">Selecciona el suplidor</p>
        {poNumber && (
          <span className="text-[11px] text-slate-300">
            <span className="text-slate-500 mr-1">PO:</span>
            <span className="font-mono">{poNumber}</span>
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
        {suppliers.length === 0 && (
          <p className="text-xs text-slate-500">No hay suplidores. Crea uno primero.</p>
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
                "flex flex-col items-start p-3 rounded-lg border text-left text-sm transition-all",
                supplierId === s.id
                  ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent shadow-lg"
                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800",
              ].join(" ")}
            >
              <span className="font-semibold truncate">{s.name}</span>
              {s.website && (
                <span className="text-[10px] opacity-70 truncate">{s.website}</span>
              )}
            </button>
          ))}
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-1">Nombre manual (opcional)</p>
        <Input
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="Ej: Proveedor nuevo sin registrar"
          className="bg-black/40 border-slate-700 text-sm"
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Si seleccionas un suplidor de la lista, este nombre se rellenará automáticamente.
        </p>
      </div>
    </div>
  );

  const Step2Products = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PackageSearch className="w-4 h-4 text-cyan-400" />
        <p className="text-xs text-slate-300">Añade productos a la orden (vista compacta).</p>
      </div>

      <Input
        value={searchProduct}
        onChange={(e) => setSearchProduct(e.target.value)}
        placeholder="Buscar producto por nombre, modelo compatible..."
        className="bg-black/40 border-slate-700 text-sm"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-slate-800 rounded-lg p-2 bg-black/40 max-h-64 overflow-y-auto">
          <p className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
            <PackageSearch className="w-3 h-3" />
            Productos disponibles ({filteredProducts.length})
          </p>
          {filteredProducts.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No se encontraron productos.</p>
          ) : (
            <ul className="space-y-1">
              {filteredProducts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-xs bg-slate-900/60 hover:bg-slate-900 rounded-md px-2 py-1"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Costo: {money(p.cost || 0)} • Stock: {p.stock ?? 0}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 border-cyan-600/60"
                    onClick={() => handleAddProduct(p)}
                  >
                    +
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-slate-800 rounded-lg p-2 bg-black/40 max-h-64 overflow-y-auto">
          <p className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
            <ClipboardList className="w-3 h-3" />
            Productos en la orden ({items.length})
          </p>
          {items.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Aún no has añadido productos.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left pb-1">Producto</th>
                  <th className="text-right pb-1">Cant.</th>
                  <th className="text-right pb-1">Costo</th>
                  <th className="text-right pb-1">Total</th>
                  <th className="text-right pb-1"></th>
                </tr>
              </thead>
              <tbody className="text-slate-100">
                {items.map((it) => (
                  <tr key={it.product_id} className="border-t border-slate-800">
                    <td className="py-1 pr-2 max-w-[140px] truncate">{it.product_name}</td>
                    <td className="py-1 text-right">
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) =>
                          handleChangeItemQty(it.product_id, e.target.value)
                        }
                        className="h-7 w-14 text-right bg-slate-900 border-slate-700"
                      />
                    </td>
                    <td className="py-1 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={it.unit_cost}
                        onChange={(e) =>
                          handleChangeItemCost(it.product_id, e.target.value)
                        }
                        className="h-7 w-20 text-right bg-slate-900 border-slate-700"
                      />
                    </td>
                    <td className="py-1 text-right">
                      {money((it.unit_cost || 0) * (it.quantity || 0))}
                    </td>
                    <td className="py-1 text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-red-400"
                        onClick={() => handleRemoveItem(it.product_id)}
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 text-right text-slate-400">Subtotal:</td>
                  <td className="pt-2 text-right font-semibold text-slate-100">
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

  const Step3DatesStatus = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Fecha de orden *</p>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="bg-black/40 border-slate-700 text-sm"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Fecha estimada de entrega</p>
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" />
            <Input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="bg-black/40 border-slate-700 text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-1">Estado</p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "draft", label: "Borrador" },
            { value: "ordered", label: "Ordenado" },
            { value: "received", label: "Recibido" },
            { value: "cancelled", label: "Cancelado" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={[
                "px-3 py-1.5 rounded-lg text-xs border",
                status === opt.value
                  ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent"
                  : "bg-black/40 border-slate-700 text-slate-200 hover:bg-slate-800",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-1">Costo de envío (opcional)</p>
        <Input
          type="number"
          step="0.01"
          min={0}
          value={shippingCost}
          onChange={(e) => setShippingCost(Number(e.target.value) || 0)}
          placeholder="0.00"
          className="bg-black/40 border-slate-700 text-sm"
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Se sumará al total de la orden
        </p>
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-1">Notas</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Comentarios adicionales sobre la orden (opcional)"
          className="bg-black/40 border-slate-700 text-sm"
        />
      </div>
    </div>
  );

  const Step4WorkOrders = () => (
    <div className="space-y-4">
      <div className="border border-slate-800 rounded-lg p-2 bg-black/40 max-h-56 overflow-y-auto">
        <p className="text-[11px] text-slate-400 mb-1">Enlace por producto (opcional)</p>
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No hay productos en la orden.</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left pb-1">Producto</th>
                <th className="text-center pb-1">Cant.</th>
                <th className="text-left pb-1">Orden de trabajo</th>
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {items.map((it) => (
                <tr key={it.product_id} className="border-t border-slate-800">
                  <td className="py-1 pr-2 max-w-[160px] truncate">{it.product_name}</td>
                  <td className="py-1 text-center">{it.quantity}</td>
                  <td className="py-1">
                    <select
                      value={it.work_order_id || ""}
                      onChange={(e) =>
                        handleChangeItemWO(it.product_id, e.target.value)
                      }
                      className="w-full h-8 rounded-md bg-slate-900 border border-slate-700 text-[11px]"
                    >
                      <option value="">Sin enlace</option>
                      {workOrders.map((wo) => (
                        <option key={wo.id} value={wo.id}>
                          #{wo.id} • {wo.customer_name || "Cliente"}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const Step5Summary = () => (
    <div className="space-y-4">
      <div className="border border-slate-800 rounded-lg p-3 bg-black/40">
        <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
          <FileText className="w-3 h-3 text-cyan-400" />
          Número de PO
        </p>
        <p className="text-sm text-slate-100 font-mono">
          {poNumber || "Se generará automáticamente"}
        </p>
      </div>

      <div className="border border-slate-800 rounded-lg p-3 bg-black/40">
        <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
          <UserCircle2 className="w-3 h-3 text-cyan-400" />
          Suplidor
        </p>
        <p className="text-sm text-slate-100">
          {selectedSupplier?.name || supplierName || "Sin suplidor definido"}
        </p>
      </div>

      <div className="border border-slate-800 rounded-lg p-3 bg-black/40">
        <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
          <PackageSearch className="w-3 h-3 text-emerald-400" />
          Productos ({items.length})
        </p>
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">No hay productos.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-100 max-h-40 overflow-y-auto">
            {items.map((it) => (
              <li
                key={it.product_id}
                className="flex items-center justify-between gap-2 border-b border-slate-800/70 pb-1"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{it.product_name}</p>
                  <p className="text-[10px] text-slate-400">
                    Cant: {it.quantity} • Costo: {money(it.unit_cost)} • Total:{" "}
                    {money((it.unit_cost || 0) * (it.quantity || 0))}
                  </p>
                </div>
                {it.work_order_id && (
                  <Badge className="bg-indigo-600/30 border-indigo-500/40 text-[10px]">
                    OT #{it.work_order_id}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1 mt-2 text-sm border-t border-slate-800 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Subtotal productos:</span>
            <span className="text-slate-100">{money(subtotalAmount)}</span>
          </div>
          {shippingCost > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Costo de envío:</span>
              <span className="text-slate-100">{money(shippingCost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-semibold">
            <span className="text-slate-400">Total de la orden:</span>
            <span className="text-emerald-400">{money(totalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border border-slate-800 rounded-lg p-3 bg-black/40">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-cyan-400" />
            Fechas
          </p>
          <p className="text-[11px] text-slate-100">Orden: {orderDate || "—"}</p>
          <p className="text-[11px] text-slate-100">Estimada: {expectedDate || "—"}</p>
        </div>
        <div className="border border-slate-800 rounded-lg p-3 bg-black/40">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <FileText className="w-3 h-3 text-emerald-400" />
            Estado
          </p>
          <p className="text-[11px] text-slate-100 capitalize">
            {status === "draft"
              ? "Borrador"
              : status === "ordered"
              ? "Ordenado"
              : status === "received"
              ? "Recibido"
              : status === "cancelled"
              ? "Cancelado"
              : status}
          </p>
          {defaultWorkOrderId && (
            <p className="text-[11px] text-slate-300 mt-1">OT general: #{defaultWorkOrderId}</p>
          )}
        </div>
      </div>

      {notes && (
        <div className="border border-slate-800 rounded-lg p-3 bg-black/40">
          <p className="text-xs text-slate-400 mb-1">Notas</p>
          <p className="text-[11px] text-slate-100 whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.(false)}>
      <DialogContent className="bg-[#020617] border border-cyan-500/30 max-w-4xl text-white theme-light:bg-white theme-light:border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            {isEditing ? "Editar Orden de Compra" : "Nueva Orden de Compra"}
          </DialogTitle>
        </DialogHeader>

        {loadingPO ? (
          <div className="py-10 text-center text-sm text-slate-300">
            Cargando orden de compra...
          </div>
        ) : (
          <>
            <StepIndicator />

            <div className="mt-2 max-h-[55vh] overflow-y-auto pr-1">
              {step === 1 && <Step1Supplier />}
              {step === 2 && <Step2Products />}
              {step === 3 && <Step3DatesStatus />}
              {step === 4 && <Step4WorkOrders />}
              {step === 5 && <Step5Summary />}
            </div>

            <DialogFooter className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ClipboardList className="w-3 h-3" />
                <span>
                  Paso {step} de 5 • Productos en orden:{" "}
                  <span className="text-emerald-400 font-semibold">{items.length}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onClose?.(false)}
                  className="border-slate-600 text-slate-200"
                >
                  Cancelar
                </Button>

                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrev}
                    className="border-cyan-600 text-cyan-300"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Atrás
                  </Button>
                )}

                {step < 5 && (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="bg-gradient-to-r from-cyan-600 to-emerald-600"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}

                {step === 5 && (
                  <Button
                    type="button"
                    onClick={handleSave}
                    className="bg-gradient-to-r from-emerald-600 to-cyan-600"
                  >
                    Guardar Orden
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
