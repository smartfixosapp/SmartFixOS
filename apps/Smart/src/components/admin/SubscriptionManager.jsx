import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, AlertCircle, Pause, Play, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SubscriptionManager() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const allTenants = await base44.entities.Tenant.list();
      setTenants(allTenants || []);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      toast.error("Error al cargar tiendas");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (tenantId) => {
    if (!window.confirm("¿Estás seguro de que deseas cancelar esta suscripción?")) {
      return;
    }

    setProcessing(tenantId);
    try {
      await base44.entities.Tenant.update(tenantId, {
        subscription_status: 'cancelled',
        metadata: {
          cancelled_at: new Date().toISOString()
        }
      });

      toast.success("Suscripción cancelada");
      fetchTenants();
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error("Error al cancelar suscripción");
    } finally {
      setProcessing(null);
    }
  };

  const handlePauseSubscription = async (tenantId, status) => {
    setProcessing(tenantId);
    try {
      await base44.entities.Tenant.update(tenantId, {
        subscription_status: status === 'paused' ? 'active' : 'paused'
      });

      toast.success(status === 'paused' ? 'Suscripción reanudada' : 'Suscripción pausada');
      fetchTenants();
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast.error("Error al actualizar suscripción");
    } finally {
      setProcessing(null);
    }
  };

  const handleManualPayment = async (tenantId) => {
    setProcessing(tenantId);
    try {
      const tenant = tenants.find(t => t.id === tenantId);
      const newNextBillingDate = new Date();
      newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);

      await base44.entities.Tenant.update(tenantId, {
        subscription_status: 'active',
        last_payment_date: new Date().toISOString(),
        last_payment_amount: tenant.monthly_cost,
        failed_payment_attempts: 0,
        next_billing_date: newNextBillingDate.toISOString().split('T')[0]
      });

      toast.success("Pago registrado manualmente");
      fetchTenants();
    } catch (error) {
      console.error("Error registering payment:", error);
      toast.error("Error al registrar pago");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'past_due':
        return 'text-red-400';
      case 'paused':
        return 'text-yellow-400';
      case 'cancelled':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'past_due':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-400" />;
      case 'cancelled':
        return <Trash2 className="w-5 h-5 text-gray-400" />;
      default:
        return <CreditCard className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400">
                {tenants.filter(t => t.subscription_status === 'active').length}
              </div>
              <p className="text-gray-400 text-sm mt-1">Suscripciones Activas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400">
                {tenants.filter(t => t.subscription_status === 'past_due').length}
              </div>
              <p className="text-gray-400 text-sm mt-1">Pagos Vencidos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">
                ${tenants
                  .filter(t => t.subscription_status === 'active')
                  .reduce((sum, t) => sum + (t.monthly_cost || 49), 0)}
              </div>
              <p className="text-gray-400 text-sm mt-1">Ingresos Mensuales</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Gestión de Suscripciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-400">Tienda</th>
                  <th className="text-left py-3 px-4 text-gray-400">Plan</th>
                  <th className="text-left py-3 px-4 text-gray-400">Estado</th>
                  <th className="text-left py-3 px-4 text-gray-400">Próximo Pago</th>
                  <th className="text-left py-3 px-4 text-gray-400">Costo Mensual</th>
                  <th className="text-left py-3 px-4 text-gray-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="py-3 px-4 text-white font-semibold">{tenant.name}</td>
                    <td className="py-3 px-4 text-gray-400 capitalize">{tenant.plan}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(tenant.subscription_status)}
                        <span className={`capitalize ${getStatusColor(tenant.subscription_status)}`}>
                          {tenant.subscription_status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {tenant.next_billing_date
                        ? format(new Date(tenant.next_billing_date), 'dd MMM yyyy')
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-cyan-400 font-semibold">${tenant.monthly_cost || 49}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {tenant.subscription_status === 'past_due' && (
                          <Button
                            onClick={() => handleManualPayment(tenant.id)}
                            disabled={processing === tenant.id}
                            size="sm"
                            className="h-7 px-2 text-xs bg-emerald-600/80 hover:bg-emerald-600"
                          >
                            {processing === tenant.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Registrar Pago'
                            )}
                          </Button>
                        )}

                        {tenant.subscription_status === 'active' && (
                          <Button
                            onClick={() => handlePauseSubscription(tenant.id, tenant.subscription_status)}
                            disabled={processing === tenant.id}
                            size="sm"
                            className="h-7 px-2 text-xs bg-yellow-600/80 hover:bg-yellow-600"
                          >
                            {processing === tenant.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Pausar'
                            )}
                          </Button>
                        )}

                        {tenant.subscription_status === 'paused' && (
                          <Button
                            onClick={() => handlePauseSubscription(tenant.id, tenant.subscription_status)}
                            disabled={processing === tenant.id}
                            size="sm"
                            className="h-7 px-2 text-xs bg-green-600/80 hover:bg-green-600"
                          >
                            {processing === tenant.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Reanudar'
                            )}
                          </Button>
                        )}

                        {tenant.subscription_status !== 'cancelled' && (
                          <Button
                            onClick={() => handleCancelSubscription(tenant.id)}
                            disabled={processing === tenant.id}
                            size="sm"
                            className="h-7 px-2 text-xs bg-red-600/80 hover:bg-red-600"
                          >
                            {processing === tenant.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Cancelar'
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
