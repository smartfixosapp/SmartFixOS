import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CreditCard, X, Check, Clock } from "lucide-react";
import { toast } from "sonner";

export default function SubscriptionManagement() {
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const queryClient = useQueryClient();

  // 📊 Fetch Tenants
  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants-subscriptions"],
    queryFn: () => base44.entities.Tenant.list("-created_date", 100),
  });

  // 💳 Fetch Subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions-details"],
    queryFn: () => base44.entities.Subscription.filter({}, "-created_date"),
  });

  // Cancel Subscription Mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ tenantId, reason }) => {
      const tenant = await base44.entities.Tenant.get(tenantId);
      await base44.entities.Tenant.update(tenantId, {
        subscription_status: "cancelled",
        status: "suspended",
      });

      // Create cancellation log
      await base44.entities.Subscription.create({
        tenant_id: tenantId,
        tenant_name: tenant.name,
        plan: tenant.plan,
        status: "cancelled",
        amount: tenant.monthly_cost || 65,
        cancellation_date: new Date().toISOString(),
        cancellation_reason: reason,
      });

      // Send cancellation email
      await base44.integrations.Core.SendEmail({
        to: tenant.email,
        subject: "Suscripción cancelada en SmartFixOS",
        body: `
          <div style="font-family: Arial;">
            <h2>Tu suscripción ha sido cancelada</h2>
            <p>Tu acceso a SmartFixOS ha sido suspendido.</p>
            <p><strong>Razón:</strong> ${reason}</p>
            <p>Tus datos se conservarán durante 30 días.</p>
            <p>Para reactivar tu cuenta, contáctanos: support@smartfixos.com</p>
          </div>
        `,
        from_name: "SmartFixOS",
      });
    },
    onSuccess: () => {
      toast.success("Suscripción cancelada");
      queryClient.invalidateQueries({ queryKey: ["tenants-subscriptions"] });
      setCancelDialogOpen(false);
      setSelectedTenant(null);
    },
    onError: (error) => {
      toast.error("Error al cancelar suscripción: " + error.message);
    },
  });

  const activeTenants = tenants.filter(t => t.subscription_status === "active" && t.status === "active");
  const suspendedTenants = tenants.filter(t => t.status === "suspended");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Gestión de Suscripciones</h1>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="active">Suscripciones Activas</TabsTrigger>
            <TabsTrigger value="payment-history">Historial de Pagos</TabsTrigger>
            <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
          </TabsList>

          {/* Suscripciones Activas */}
          <TabsContent value="active" className="space-y-4">
            <div className="grid gap-4">
              {activeTenants.map(tenant => (
                <Card key={tenant.id} className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-white">{tenant.name}</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">{tenant.email}</p>
                    </div>
                    <span className="px-3 py-1 rounded bg-emerald-400/20 text-emerald-300 text-sm font-semibold">
                      Activa
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div>
                        <p className="text-xs text-slate-400">Plan</p>
                        <p className="text-lg font-semibold text-white">{tenant.plan || "SmartFixOS"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Costo Mensual</p>
                        <p className="text-lg font-semibold text-white">${tenant.monthly_cost || 65}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Próximo Pago</p>
                        <p className="text-lg font-semibold text-white">{tenant.next_billing_date || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Intentos Fallidos</p>
                        <p className="text-lg font-semibold text-white">{tenant.failed_payment_attempts || 0}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setCancelDialogOpen(true);
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar Suscripción
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-cyan-600/30 text-cyan-300 hover:bg-cyan-900/20"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Cambiar Método de Pago
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Historial de Pagos */}
          <TabsContent value="payment-history">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Últimos Pagos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Tienda</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Monto</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Fecha</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions
                        .filter(s => s.last_payment_date)
                        .slice(0, 20)
                        .map(sub => (
                          <tr key={sub.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                            <td className="py-3 px-4 text-white">{sub.tenant_name}</td>
                            <td className="py-3 px-4 text-white font-semibold">${sub.last_payment_amount || 0}</td>
                            <td className="py-3 px-4 text-slate-400">{sub.last_payment_date}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                sub.last_payment_status === 'succeeded'
                                  ? 'bg-emerald-400/20 text-emerald-300'
                                  : 'bg-red-400/20 text-red-300'
                              }`}>
                                {sub.last_payment_status === 'succeeded' ? (
                                  <><Check className="w-3 h-3 inline mr-1" /> Exitoso</>
                                ) : (
                                  'Fallido'
                                )}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Canceladas */}
          <TabsContent value="cancelled">
            <div className="grid gap-4">
              {suspendedTenants.map(tenant => (
                <Card key={tenant.id} className="bg-slate-800/50 border-slate-700 opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-white">{tenant.name}</CardTitle>
                        <p className="text-sm text-slate-400 mt-1">{tenant.email}</p>
                      </div>
                      <span className="px-3 py-1 rounded bg-red-400/20 text-red-300 text-sm font-semibold">
                        Suspendida
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400">Plan: {tenant.plan}</p>
                    <p className="text-slate-400 mt-2">Suspendida desde: {tenant.updated_date}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Cancelar suscripción?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta acción suspenderá el acceso de {selectedTenant?.name}. Los datos se conservarán durante 30 días.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <label className="text-sm text-slate-300 mb-2 block">Razón de cancelación:</label>
            <input
              type="text"
              placeholder="Ej: Solicitud del cliente, falta de pago..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500"
            />
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (selectedTenant && cancelReason) {
                  cancelMutation.mutate({
                    tenantId: selectedTenant.id,
                    reason: cancelReason,
                  });
                } else {
                  toast.error("Por favor ingresa una razón");
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelando..." : "Confirmar Cancelación"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
