import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check, Plus, Minus, Trash2, DollarSign, Wallet, Camera, History, Shield, X, Percent } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import OrderSecurity from "@/components/workorder/sections/OrderSecurity";
import OrderMultimedia from "@/components/workorder/sections/OrderMultimedia";
import WorkOrderTimeline from "@/components/orders/workorder/WorkOrderTimeline";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import AddItemModal from "@/components/workorder/AddItemModal";
import { base44 } from "@/api/base44Client";

export default function DeliveryStage({ order, onUpdate, user }) {
  const o = order || {};
  const [items, setItems] = useState([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taxExempt, setTaxExempt] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setItems(Array.isArray(o.order_items) ? o.order_items.map(item => ({
      ...item,
      discount_percentage: item.discount_percentage || 0,
      taxable: item.taxable !== undefined ? item.taxable : true
    })) : []);
  }, [o.order_items, o.id]);

  // Calculate item subtotal with discount
  const calculateItemSubtotal = (item) => {
    const basePrice = Number(item.price || 0);
    const itemDiscountPercent = Number(item.discount_percentage || 0);
    const priceAfterDiscount = basePrice - (basePrice * (itemDiscountPercent / 100));
    return priceAfterDiscount * Number(item.qty || 1);
  };

  const calculateTotals = () => {
    const itemsSubtotal = items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
    const taxableSubtotal = items.reduce((sum, item) => {
      if (item.taxable !== false) {
        return sum + calculateItemSubtotal(item);
      }
      return sum;
    }, 0);
    const taxAmount = taxableSubtotal * 0.115;
    const total = itemsSubtotal + taxAmount;
    return { itemsSubtotal, taxAmount, total };
  };

  const { itemsSubtotal, taxAmount, total } = calculateTotals();
  const amountPaid = Number(o.total_paid || o.amount_paid || 0);
  const balanceDue = Math.max(0, total - amountPaid);

  async function persist(itemsToSave = items) {
    setSaving(true);
    try {
      const itemsWithTotal = itemsToSave.map((it) => ({
        ...it,
        discount_percentage: Number(it.discount_percentage || 0),
        taxable: it.taxable !== undefined ? it.taxable : true,
        total: calculateItemSubtotal(it)
      }));

      const subtotal = itemsWithTotal.reduce((s, it) => s + (it.total || 0), 0);
      const taxableTotal = itemsWithTotal.reduce((s, it) => {
        if (it.taxable !== false) return s + (it.total || 0);
        return s;
      }, 0);
      const tax = taxableTotal * 0.115;
      const newTotal = subtotal + tax;

      const currentPaid = Number(o.total_paid || o.amount_paid || 0);
      const newBalance = Math.max(0, newTotal - currentPaid);

      await base44.entities.Order.update(o.id, {
        order_items: itemsWithTotal,
        total: newTotal,
        cost_estimate: newTotal,
        balance_due: newBalance,
        tax_rate: 0.115
      });

      setItems(itemsWithTotal);
      onUpdate?.();
      setIsEditing(false);
      toast.success("Orden actualizada");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function setQty(idx, qty) {
    const next = [...items];
    next[idx].qty = Math.max(1, Number(qty));
    setItems(next);
  }

  const setDiscount = (idx, discount) => {
    const next = [...items];
    next[idx].discount_percentage = Math.max(0, Math.min(100, Number(discount)));
    setItems(next);
  };

  const toggleTaxable = (idx) => {
    const next = [...items];
    next[idx].taxable = !next[idx].taxable;
    setItems(next);
  };

  function removeLine(idx) {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_30%),linear-gradient(135deg,rgba(8,24,18,0.98),rgba(10,18,28,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
                Entrega
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Cierre de orden
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Lista para cerrar</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Listo para Entregar</h2>
                <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Revisa total, balance y artículos finales. Esta etapa debe sentirse como una consola de cierre clara y rápida.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-emerald-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Total</p>
                <p className="truncate text-lg font-bold text-white">${total.toFixed(2)}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Balance</p>
                <p className={`truncate text-lg font-bold ${balanceDue <= 0.01 ? 'text-emerald-300' : 'text-amber-300'}`}>${balanceDue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-emerald-400/15 bg-black/25 p-5 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15">
                <Check className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Estado de cobro</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-white">${balanceDue <= 0.01 ? 'Orden saldada' : 'Cobro pendiente'}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Confirma artículos, descuentos e impuestos antes de pasar a POS o entregar el equipo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Unified Module: Items - Apple Style */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden shadow-lg">
        <div className="p-5 border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              Piezas y Servicios
            </h3>
            <div className="flex gap-3">
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => isEditing ? persist(items) : setIsEditing(true)}
                  disabled={saving}
                  className="h-9 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium"
                >
                  {isEditing ? <Check className="w-4 h-4 mr-1" /> : null}
                  {isEditing ? "Guardar" : "Editar"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setShowAddItemModal(true)}
                disabled={saving}
                className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20"
              >
                <Plus className="w-4 h-4 mr-1" /> Añadir
              </Button>
            </div>
          </div>
        </div>
        <div className="p-6">
          {/* Items List */}
          {items.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl bg-black/20">
              <p className="text-gray-500 text-sm font-medium">No hay items en esta orden</p>
            </div>
          ) : (
            <div className="bg-black/20 border border-white/10 rounded-2xl overflow-hidden">
              <div className="divide-y divide-white/5">
                {items.map((item, idx) => {
                  const basePrice = Number(item.price || 0);
                  const itemDiscountPercent = Number(item.discount_percentage || 0);
                  const itemSubtotal = calculateItemSubtotal(item);

                  return (
                    <div key={idx} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-bold truncate">{item.name}</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] border-white/10 text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                            ${basePrice.toFixed(2)} c/u
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-white/10 text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                            {item.type === 'service' ? 'Servicio' : 'Producto'}
                          </Badge>
                          {itemDiscountPercent > 0 && (
                            <Badge className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30 px-2 py-0.5 rounded-md">
                              -{itemDiscountPercent}% desc.
                            </Badge>
                          )}
                          {item.taxable === false && (
                            <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30 px-2 py-0.5 rounded-md">
                              Sin IVU
                            </Badge>
                          )}
                        </div>

                        {isEditing && (
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-gray-400 min-w-[80px]">Descuento %:</Label>
                                <div className="flex items-center gap-1 bg-black/40 rounded-lg border border-white/10 p-0.5">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 hover:bg-white/10 hover:text-white rounded-md" 
                                    onClick={() => setDiscount(idx, (item.discount_percentage || 0) - 5)}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <Input 
                                    type="number"
                                    value={item.discount_percentage || 0}
                                    onChange={(e) => setDiscount(idx, e.target.value)}
                                    className="w-16 h-7 text-center bg-transparent border-0 text-white text-sm"
                                    min="0"
                                    max="100"
                                  />
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 hover:bg-white/10 hover:text-white rounded-md" 
                                    onClick={() => setDiscount(idx, (item.discount_percentage || 0) + 5)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 ml-4">
                                <Switch 
                                  id={`tax-${idx}`}
                                  checked={item.taxable !== false}
                                  onCheckedChange={() => toggleTaxable(idx)}
                                  className="data-[state=checked]:bg-emerald-500"
                                />
                                <Label htmlFor={`tax-${idx}`} className="text-xs text-gray-400 cursor-pointer">
                                  Aplicar IVU
                                </Label>
                              </div>
                            </div>
                          </div>
                        )}
                        </div>
                      
                        <div className="flex items-center gap-4 pl-4">
                        {isEditing ? (
                          <>
                            <div className="flex items-center gap-1 bg-black/40 rounded-lg border border-white/10 p-0.5">
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 hover:text-white rounded-md" onClick={() => setQty(idx, item.qty - 1)}><Minus className="w-3 h-3" /></Button>
                              <span className="text-white text-sm w-8 text-center font-bold">{item.qty}</span>
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 hover:text-white rounded-md" onClick={() => setQty(idx, item.qty + 1)}><Plus className="w-3 h-3" /></Button>
                            </div>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg" onClick={() => removeLine(idx)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-400 text-xs font-medium">x{item.qty}</span>
                            <span className="text-emerald-400 font-bold text-sm min-w-[80px] text-right">
                              ${itemSubtotal.toFixed(2)}
                            </span>
                          </>
                        )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-black/40 p-5 space-y-3 border-t border-white/10">

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 font-medium">Subtotal</span>
                  <span className="text-white font-bold">${itemsSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 font-medium">IVU (11.5%)</span>
                  <span className="text-white font-bold">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-white/5">
                  <span className="text-gray-300 text-sm font-bold">Total</span>
                  <span className="text-white font-bold text-xl">${total.toFixed(2)}</span>
                </div>

                {amountPaid > 0 && (
                  <>
                    <div className="flex justify-between items-center pt-1 text-xs">
                      <span className="text-gray-400 font-medium">Pagado / Depósito</span>
                      <span className="text-emerald-400 font-bold">-${amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <span className="text-white font-bold text-base">Balance Pendiente</span>
                      <span className={`font-bold text-2xl ${balanceDue <= 0.01 ? 'text-emerald-500' : 'text-white'}`}>
                        ${balanceDue.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                
                {balanceDue > 0.01 ? (
                  <div className="pt-5 grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-12 rounded-xl text-base font-bold"
                      onClick={() => {
                        // ✅ Cerrar panel antes de navegar al POS
                        window.dispatchEvent(new Event('close-workorder-panel'));
                        navigate(`/POS?workOrderId=${o.id}&mode=deposit`);
                      }}
                    >
                      <Wallet className="w-5 h-5 mr-2" />
                      Depósito
                    </Button>
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-500 text-white h-12 rounded-xl text-base font-bold shadow-lg shadow-emerald-900/20"
                      onClick={() => {
                        // ✅ Cerrar panel antes de navegar al POS
                        window.dispatchEvent(new Event('close-workorder-panel'));
                        navigate(`/POS?workOrderId=${o.id}&mode=full`);
                      }}
                    >
                      <DollarSign className="w-5 h-5 mr-2" />
                      Cobrar Restante
                    </Button>
                  </div>
                ) : (
                   <div className="pt-5">
                      <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                          <p className="text-emerald-400 font-bold flex items-center justify-center gap-2 text-lg">
                              <Check className="w-6 h-6" /> Orden Saldada
                          </p>
                      </div>
                   </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <WorkOrderUnifiedHub order={order} onUpdate={onUpdate} accent="emerald" title="Centro de Historial" subtitle="Entrega, evidencias, seguridad y actividad unificados para cerrar la orden." />

      <AddItemModal
        open={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        order={o}
        onUpdate={onUpdate}
      />

    </div>
  );
}
