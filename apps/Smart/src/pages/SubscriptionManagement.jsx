import React, { useState } from "react";
import appClient from "@/api/appClient";
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
    queryFn: () => appClient.entities.Tenant.list("-created_date", 100),
  });

  // 💳 Fetch Subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions-details"],
    queryFn: () => appClient.entities.Subscription.filter({}, "-created_date"),
  });

  // Cancel Subscription Mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ tenantId, reason }) => {
      const tenant = await appClient.entities.Tenant.get(tenantId);
      await appClient.entities.Tenant.update(tenantId, {
        subscription_status: "cancelled",
        status: "suspended",
      });

      // Create cancellation log
      await appClient.entities.Subscription.create({
        tenant_id: tenantId,
        tenant_name: tenant.name,
        plan: tenant.plan,
        status: "cancelled",
        amount: tenant.monthly_cost || 49,
        cancellation_date: new Date().toISOString(),
        cancellation_reason: reason,
      });

      // Send cancellation email
      await appClient.integrations.Core.SendEmail({
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
    <div className="min-h-screen apple-surface apple-type p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="apple-text-large-title apple-label-primary mb-8">Gestión de Suscripciones</h1>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-gray-sys6 dark:bg-gray-sys5">
            <TabsTrigger value="active">Suscripciones Activas</TabsTrigger>
            <TabsTrigger value="payment-history">Historial de Pagos</TabsTrigger>
            <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
          </TabsList>

          {/* Suscripciones Activas */}
          <TabsContent value="active" className="space-y-4">
            <div className="grid gap-4">
              {activeTenants.map(tenant => (
                <Card key={tenant.id} className="apple-card border-0">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="apple-text-headline apple-label-primary">{tenant.name}</CardTitle>
                      <p className="apple-text-subheadline apple-label-tertiary mt-1">{tenant.email}</p>
                    </div>
                    <span className="px-3 py-1 rounded-apple-xs bg-apple-green/15 text-apple-green apple-text-footnote">
                      Activa
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div>
                        <p className="apple-text-caption1 apple-label-tertiary">Plan</p>
                        <p className="apple-text-headline apple-label-primary">{tenant.plan || "SmartFixOS"}</p>
                      </div>
                      <div>
                        <p className="apple-text-caption1 apple-label-tertiary">Costo Mensual</p>
                        <p className="apple-text-headline apple-label-primary tabular-nums">${tenant.monthly_cost || 49}</p>
                      </div>
                      <div>
                        <p className="apple-text-caption1 apple-label-tertiary">Próximo Pago</p>
                        <p className="apple-text-headline apple-label-primary tabular-nums">{tenant.next_billing_date || "N/A"}</p>
                      </div>
                      <div>
                        <p className="apple-text-caption1 apple-label-tertiary">Intentos Fallidos</p>
                        <p className="apple-text-headline apple-label-primary tabular-nums">{tenant.failed_payment_attempts || 0}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="apple-btn apple-btn-destructive"
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
                        className="apple-btn apple-btn-tinted"
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
            <Card className="apple-card border-0">
              <CardHeader>
                <CardTitle className="apple-text-headline apple-label-primary">Últimos Pagos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full apple-text-subheadline">
                    <thead>
                      <tr style={{ borderBottom: "0.5px solid rgba(60,60,67,0.29)" }}>
                        <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Tienda</th>
                        <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Monto</th>
                        <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Fecha</th>
                        <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions
                        .filter(s => s.last_payment_date)
                        .slice(0, 20)
                        .map(sub => (
                          <tr key={sub.id} style={{ borderBottom: "0.5px solid rgba(60,60,67,0.2)" }} className="hover:bg-gray-sys6 dark:hover:bg-gray-sys5">
                            <td className="py-3 px-4 apple-label-primary">{sub.tenant_name}</td>
                            <td className="py-3 px-4 apple-label-primary tabular-nums">${sub.last_payment_amount || 0}</td>
                            <td className="py-3 px-4 apple-label-tertiary tabular-nums">{sub.last_payment_date}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-apple-xs apple-text-caption1 ${
                                sub.last_payment_status === 'succeeded'
                                  ? 'bg-apple-green/15 text-apple-green'
                                  : 'bg-apple-red/15 text-apple-red'
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
                <Card key={tenant.id} className="apple-card border-0 opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="apple-text-headline apple-label-primary">{tenant.name}</CardTitle>
                        <p className="apple-text-subheadline apple-label-tertiary mt-1">{tenant.email}</p>
                      </div>
                      <span className="px-3 py-1 rounded-apple-xs bg-apple-red/15 text-apple-red apple-text-footnote">
                        Suspendida
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="apple-text-subheadline apple-label-secondary">Plan: {tenant.plan}</p>
                    <p className="apple-text-subheadline apple-label-secondary mt-2 tabular-nums">Suspendida desde: {tenant.updated_date}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="apple-surface-elevated border-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="apple-text-headline apple-label-primary">¿Cancelar suscripción?</AlertDialogTitle>
            <AlertDialogDescription className="apple-text-subheadline apple-label-secondary">
              Esta acción suspenderá el acceso de {selectedTenant?.name}. Los datos se conservarán durante 30 días.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <label className="apple-text-subheadline apple-label-secondary mb-2 block">Razón de cancelación:</label>
            <input
              type="text"
              placeholder="Ej: Solicitud del cliente, falta de pago..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="apple-input w-full"
            />
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel className="apple-btn apple-btn-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="apple-btn apple-btn-destructive"
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
