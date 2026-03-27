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
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../../../lib/supabase-client.js";
import { createPageUrl } from "@/components/utils/helpers";

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

export default function DeliveryStage({ order, onUpdate, user, onPaymentClick }) {
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
  // ✅ Priorizar balance_due de DB (actualizado por POS), luego calcular
  const balanceDue = o.balance_due != null
    ? Math.max(0, Number(o.balance_due))
    : Math.max(0, total - amountPaid);

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

      const remoteUpdatePayload = {
        order_items: itemsWithTotal,
        cost_estimate: newTotal,
        balance_due: newBalance,
        tax_rate: 0.115,
        updated_date: new Date().toISOString(),
      };

      const localUpdatePayload = {
        ...remoteUpdatePayload,
        total: newTotal,
      };

      let savedRemotely = false;
      let lastError = null;

      try {
        await dataClient.entities.Order.update(o.id, remoteUpdatePayload);
        savedRemotely = true;
      } catch (primaryError) {
        console.warn("[DeliveryStage] dataClient update failed, trying base44 fallback:", primaryError);
        lastError = primaryError;
        try {
          await base44.entities.Order.update(o.id, remoteUpdatePayload);
          savedRemotely = true;
        } catch (secondaryError) {
          console.warn("[DeliveryStage] base44 update failed, trying direct supabase fallback:", secondaryError);
          lastError = secondaryError;
          let query = supabase
            .from("order")
            .update(remoteUpdatePayload)
            .eq("id", o.id);

          const tenantId = getTenantId();
          if (tenantId) {
            query = query.eq("tenant_id", tenantId);
          }

          const { error: directError } = await query.select("id").maybeSingle();
          if (directError) {
            lastError = directError;
          } else {
            savedRemotely = true;
          }
        }
      }

      if (!savedRemotely && lastError) {
        throw lastError;
      }

      setItems(itemsWithTotal);
      await onUpdate?.({ id: o.id, ...localUpdatePayload });
      setIsEditing(false);
      toast.success("Orden actualizada");
    } catch (e) {
      console.error("[DeliveryStage] persist error:", e);
      toast.error(e?.message ? `Error al guardar: ${e.message}` : "Error al guardar");
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

      <div className="relative overflow-hidden rounded-[30px] border border-emerald-400/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.10),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
                <ShoppingCart className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Cobro y cierre</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Revisa la cotización final, confirma impuestos y cobra el balance restante sin salir de la orden.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => isEditing ? persist(items) : setIsEditing(true)}
                  disabled={saving}
                  className="h-10 rounded-2xl border-white/10 bg-white/5 px-4 text-white hover:bg-white/10"
                >
                  {isEditing ? <Check className="w-4 h-4 mr-1" /> : null}
                  {isEditing ? "Guardar" : "Editar"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setShowAddItemModal(true)}
                disabled={saving}
                className="h-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 font-bold text-white shadow-[0_12px_30px_rgba(16,185,129,0.25)] hover:from-emerald-400 hover:to-teal-400"
              >
                <Plus className="w-4 h-4 mr-1" /> Añadir
              </Button>
            </div>
          </div>
        </div>
        <div className="relative z-10 p-6">
          {/* Items List */}
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ShoppingCart className="h-6 w-6 text-white/35" />
              </div>
              <p className="text-sm font-semibold text-white/70">No hay items en esta orden</p>
              <p className="mt-2 text-xs text-white/40">Añade piezas o servicios para preparar el cobro final.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="divide-y divide-white/5">
                {items.map((item, idx) => {
                  const basePrice = Number(item.price || 0);
                  const itemDiscountPercent = Number(item.discount_percentage || 0);
                  const itemSubtotal = calculateItemSubtotal(item);

                  return (
                    <div key={idx} className="p-5 transition-colors hover:bg-white/[0.04]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-white">{item.name}</p>
                            <p className="mt-1 text-xs text-white/35">
                              {item.type === 'service' ? 'Servicio agregado a la entrega' : 'Producto agregado a la entrega'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-300">
                            ${basePrice.toFixed(2)} c/u
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-300">
                            {item.type === 'service' ? 'Servicio' : 'Producto'}
                          </Badge>
                          {itemDiscountPercent > 0 && (
                            <Badge className="rounded-full border-orange-500/30 bg-orange-500/20 px-2.5 py-1 text-[10px] text-orange-300">
                              -{itemDiscountPercent}% desc.
                            </Badge>
                          )}
                          {item.taxable === false && (
                            <Badge className="rounded-full border-purple-500/30 bg-purple-500/20 px-2.5 py-1 text-[10px] text-purple-300">
                              Sin IVU
                            </Badge>
                          )}
                        </div>

                        {isEditing && (
                          <div className="mt-4 space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-gray-400 min-w-[80px]">Descuento %:</Label>
                                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-0.5">
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
                            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-0.5">
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 hover:text-white rounded-md" onClick={() => setQty(idx, item.qty - 1)}><Minus className="w-3 h-3" /></Button>
                              <span className="text-white text-sm w-8 text-center font-bold">{item.qty}</span>
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 hover:text-white rounded-md" onClick={() => setQty(idx, item.qty + 1)}><Plus className="w-3 h-3" /></Button>
                            </div>
                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => removeLine(idx)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                              x{item.qty}
                            </div>
                            <span className="min-w-[92px] text-right text-base font-black text-emerald-300">
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
              
              <div className="grid gap-5 border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-5 lg:grid-cols-[1fr_320px]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm">
                    <span className="font-medium text-gray-400">Subtotal</span>
                    <span className="font-bold text-white">${itemsSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm">
                    <span className="font-medium text-gray-400">IVU (11.5%)</span>
                    <span className="font-bold text-white">${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                    <span className="text-sm font-bold text-emerald-100">Total</span>
                    <span className="text-2xl font-black text-white">${total.toFixed(2)}</span>
                  </div>

                  {(amountPaid > 0 || (o.balance_due != null && Number(o.balance_due) === 0 && total > 0)) && (
                    <>
                      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm">
                        <span className="font-medium text-gray-400">Pagado / Depósito</span>
                        <span className="font-bold text-emerald-400">
                          -{amountPaid > 0 ? amountPaid.toFixed(2) : total.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-4 py-4">
                        <span className="text-base font-bold text-white">Balance Pendiente</span>
                        <span className={`text-2xl font-black ${balanceDue <= 0.01 ? 'text-emerald-400' : 'text-white'}`}>
                          ${balanceDue.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {balanceDue > 0.01 ? (
                  <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-black/25 p-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Acciones de cobro</p>
                      <h4 className="mt-2 text-xl font-black tracking-tight text-white">Cierra el balance de la orden</h4>
                      <p className="mt-2 text-sm leading-relaxed text-white/50">
                        Registra un depósito adicional o cobra el restante completo desde POS.
                      </p>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-3">
                    <Button 
                      variant="outline"
                      className="h-12 rounded-2xl border-emerald-500/30 bg-white text-base font-bold text-emerald-500 hover:bg-emerald-50"
                      onClick={() => onPaymentClick?.("deposit")}
                    >
                      <Wallet className="w-5 h-5 mr-2" />
                      Depósito
                    </Button>
                    <Button
                      className="h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-bold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] hover:from-emerald-400 hover:to-teal-400"
                      onClick={() => onPaymentClick?.("full")}
                    >
                      <DollarSign className="w-5 h-5 mr-2" />
                      Cobrar Restante
                    </Button>
                  </div>
                  </div>
                ) : (
                   <div className="flex flex-col justify-center rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
                          <p className="flex items-center justify-center gap-2 text-lg font-bold text-emerald-400">
                              <Check className="w-6 h-6" /> Orden Saldada
                          </p>
                          <p className="mt-2 text-sm text-emerald-200/70">
                            No queda balance pendiente. La orden está lista para entrega o cierre.
                          </p>
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
        onPaymentClick={onPaymentClick}
      />

    </div>
  );
}
