// === PurchaseOrderDetailDialog.jsx — Ver y editar orden de compra existente ===

import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  FileText,
  PackageSearch,
  Truck,
  UserCircle2,
  X,
  Save,
  Edit2 } from
"lucide-react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function PurchaseOrderDetailDialog({
  open,
  onClose,
  purchaseOrder,
  suppliers = [],
  products = [],
  workOrders = []
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [poData, setPoData] = useState(null);
  const [form, setForm] = useState({
    po_number: "",
    supplier_id: "",
    supplier_name: "",
    status: "draft",
    order_date: "",
    expected_date: "",
    notes: "",
    shipping_cost: 0,
    items: []
  });

  useEffect(() => {
    if (!open || !purchaseOrder?.id) return;

    const loadPO = async () => {
      setLoading(true);
      try {
        const po = await base44.entities.PurchaseOrder.get(purchaseOrder.id);
        console.log("📦 PO cargada:", po);
        setPoData(po);

        const rawItems = po.items || po.line_items || [];
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

        setForm({
          po_number: po.po_number || "",
          supplier_id: po.supplier_id || "",
          supplier_name: po.supplier_name || "",
          status: po.status || "draft",
          order_date: po.order_date || "",
          expected_date: po.expected_date || "",
          notes: po.notes || "",
          shipping_cost: Number(po.shipping_cost || 0),
          items: mappedItems
        });
      } catch (err) {
        console.error("Error cargando PO:", err);
        toast.error("No se pudo cargar la orden");
      } finally {
        setLoading(false);
      }
    };

    loadPO();
  }, [open, purchaseOrder?.id, products]);

  const handleSave = async () => {
    try {
      const payload = {
        po_number: form.po_number,
        supplier_id: form.supplier_id || null,
        supplier_name: form.supplier_name || "",
        status: form.status,
        order_date: form.order_date || null,
        expected_date: form.expected_date || null,
        notes: form.notes || "",
        shipping_cost: Number(form.shipping_cost || 0),
        items: form.items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: Number(it.quantity || 1),
          unit_cost: Number(it.unit_cost || 0),
          work_order_id: it.work_order_id || null
        }))
      };

      // Calcular total
      const subtotal = form.items.reduce(
        (sum, it) => sum + Number(it.unit_cost || 0) * Number(it.quantity || 0),
        0
      );
      payload.total_amount = subtotal + Number(form.shipping_cost || 0);

      await base44.entities.PurchaseOrder.update(purchaseOrder.id, payload);
      toast.success("Orden actualizada");
      setEditing(false);
      onClose?.(true);
    } catch (err) {
      console.error("Error actualizando:", err);
      toast.error("No se pudo actualizar");
    }
  };

  const handleChangeItemQty = (idx, qty) => {
    const n = Math.max(1, Number(qty || 1));
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, quantity: n } : it)
    }));
  };

  const handleChangeItemCost = (idx, cost) => {
    const n = Math.max(0, Number(cost || 0));
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, unit_cost: n } : it)
    }));
  };

  const handleRemoveItem = (idx) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx)
    }));
  };

  const subtotal = form.items.reduce(
    (sum, it) => sum + Number(it.unit_cost || 0) * Number(it.quantity || 0),
    0
  );
  const total = subtotal + Number(form.shipping_cost || 0);

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.(false)}>
      <DialogContent className="bg-[#020617] border border-cyan-500/30 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col text-white theme-light:bg-white theme-light:border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Orden de Compra: {form.po_number}
            </div>
            {!editing &&
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              className="bg-gradient-to-r from-cyan-600 to-emerald-600">

                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </Button>
            }
          </DialogTitle>
        </DialogHeader>

        {loading ?
        <div className="py-12 text-center text-slate-300">Cargando...</div> :

        <div className="overflow-y-auto flex-1 space-y-4 pr-2">
            {/* Información del proveedor */}
            <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <UserCircle2 className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white theme-light:text-gray-900">Proveedor</h3>
              </div>
              {editing ?
            <div className="space-y-2">
                  <select
                value={form.supplier_id}
                onChange={(e) => {
                  const sup = suppliers.find((s) => s.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    supplier_id: e.target.value,
                    supplier_name: sup?.name || ""
                  }));
                }}
                className="w-full h-10 px-3 rounded-md bg-black/20 border border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300">

                    <option value="">Seleccionar proveedor</option>
                    {suppliers.map((s) =>
                <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                )}
                  </select>
                  <Input
                value={form.supplier_name}
                onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                placeholder="O escribe un nombre manual"
                className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />

                </div> :

            <p className="text-slate-100 theme-light:text-gray-800">
                  {selectedSupplier?.name || form.supplier_name || "No especificado"}
                </p>
            }
            </div>

            {/* Estado y fechas */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-white theme-light:text-gray-900">Fechas</h3>
                </div>
                {editing ?
              <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-400 theme-light:text-gray-600">Fecha orden</label>
                      <Input
                    type="date"
                    value={form.order_date}
                    onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
                    className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />

                    </div>
                    <div>
                      <label className="text-xs text-slate-400 theme-light:text-gray-600">Fecha estimada</label>
                      <Input
                    type="date"
                    value={form.expected_date}
                    onChange={(e) => setForm((f) => ({ ...f, expected_date: e.target.value }))}
                    className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />

                    </div>
                  </div> :

              <div className="space-y-1 text-sm">
                    <p className="text-slate-300 theme-light:text-gray-700">
                      Orden: {form.order_date || "—"}
                    </p>
                    <p className="text-slate-300 theme-light:text-gray-700">
                      Estimada: {form.expected_date || "—"}
                    </p>
                  </div>
              }
              </div>

              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white theme-light:text-gray-900">Estado</h3>
                </div>
                {editing ?
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full h-10 px-3 rounded-md bg-black/20 border border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300">

                    <option value="draft">Borrador</option>
                    <option value="ordered">Ordenado</option>
                    <option value="received">Recibido</option>
                    <option value="cancelled">Cancelado</option>
                  </select> :

              <Badge
                className={`${
                form.status === "received" ?
                "bg-green-600/20 text-green-300 border-green-600/30" :
                form.status === "ordered" ?
                "bg-blue-600/20 text-blue-300 border-blue-600/30" :
                "bg-gray-600/20 text-gray-300 border-gray-600/30"}`
                }>

                    {form.status === "draft" ?
                "Borrador" :
                form.status === "ordered" ?
                "Ordenado" :
                form.status === "received" ?
                "Recibido" :
                "Cancelado"}
                  </Badge>
              }
              </div>
            </div>

            {/* Productos */}
            <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <PackageSearch className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white theme-light:text-gray-900">
                  Productos ({form.items.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 theme-light:border-gray-300">
                      <th className="text-left py-2 text-slate-400 theme-light:text-gray-600">Producto</th>
                      <th className="text-right py-2 text-slate-400 theme-light:text-gray-600">Cant.</th>
                      <th className="text-right py-2 text-slate-400 theme-light:text-gray-600">Costo</th>
                      <th className="text-right py-2 text-slate-400 theme-light:text-gray-600">Total</th>
                      {editing && <th className="text-right py-2 text-slate-400 theme-light:text-gray-600"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, idx) =>
                  <tr key={idx} className="border-b border-slate-800 theme-light:border-gray-200">
                        <td className="py-2 text-slate-100 theme-light:text-gray-800">{it.product_name}</td>
                        <td className="py-2 text-right">
                          {editing ?
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => handleChangeItemQty(idx, e.target.value)}
                        className="h-8 w-16 text-right bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" /> :


                      <span className="text-slate-100 theme-light:text-gray-800">{it.quantity}</span>
                      }
                        </td>
                        <td className="py-2 text-right">
                          {editing ?
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={it.unit_cost}
                        onChange={(e) => handleChangeItemCost(idx, e.target.value)}
                        className="h-8 w-20 text-right bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" /> :


                      <span className="text-slate-100 theme-light:text-gray-800">{money(it.unit_cost)}</span>
                      }
                        </td>
                        <td className="py-2 text-right text-slate-100 theme-light:text-gray-800">
                          {money((it.unit_cost || 0) * (it.quantity || 0))}
                        </td>
                        {editing &&
                    <td className="py-2 text-right">
                            <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400"
                        onClick={() => handleRemoveItem(idx)}>

                              <X className="w-4 h-4" />
                            </Button>
                          </td>
                    }
                      </tr>
                  )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="pt-3 text-right text-slate-400 theme-light:text-gray-600">
                        Subtotal:
                      </td>
                      <td className="pt-3 text-right font-semibold text-slate-100 theme-light:text-gray-900">
                        {money(subtotal)}
                      </td>
                      {editing && <td />}
                    </tr>
                    <tr>
                      <td colSpan={3} className="pt-2 text-right text-slate-400 theme-light:text-gray-600">
                        Envío:
                      </td>
                      <td className="pt-2 text-right">
                        {editing ?
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.shipping_cost}
                        onChange={(e) =>
                        setForm((f) => ({ ...f, shipping_cost: Number(e.target.value) || 0 }))
                        }
                        className="h-8 w-24 ml-auto text-right bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" /> :


                      <span className="text-slate-100 theme-light:text-gray-900">{money(form.shipping_cost)}</span>
                      }
                      </td>
                      {editing && <td />}
                    </tr>
                    <tr>
                      <td colSpan={3} className="pt-2 text-right font-bold text-slate-300 theme-light:text-gray-700">
                        Total:
                      </td>
                      <td className="pt-2 text-right font-bold text-emerald-400 theme-light:text-emerald-600">
                        {money(total)}
                      </td>
                      {editing && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notas */}
            <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
              <h3 className="font-bold text-white mb-2 theme-light:text-gray-900">Notas</h3>
              {editing ?
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" /> :


            <p className="text-slate-300 text-sm theme-light:text-gray-700">
                  {form.notes || "Sin notas"}
                </p>
            }
            </div>
          </div>
        }

        <DialogFooter className="border-t border-cyan-500/20 pt-4 theme-light:border-gray-200">
          {editing ?
          <div className="flex gap-2 w-full">
              <Button
              variant="outline"
              onClick={() => setEditing(false)} className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-9 flex-1 border-slate-600 theme-light:border-gray-300">


                Cancelar
              </Button>
              <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600">

                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </Button>
            </div> :

          <Button
            onClick={() => onClose?.(false)}
            className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600">

              Cerrar
            </Button>
          }
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}
