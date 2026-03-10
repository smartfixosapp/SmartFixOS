import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Building2, CreditCard, AlertCircle } from "lucide-react";

const COLORS = ["#00A8E8", "#10B981", "#A8D700"];

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState("month");

  // 📊 Fetch Tenants
  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => base44.entities.Tenant.list("-created_date", 100),
  });

  // 💰 Fetch Subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => base44.entities.Subscription.filter({}, "-created_date"),
  });

  // 📈 Calculate Metrics
  const metrics = React.useMemo(() => {
    const activeTenants = tenants.filter(t => t.status === "active").length;
    const trialTenants = tenants.filter(t => t.subscription_status === "active" && t.status === "active").filter(t => {
      if (!t.trial_end_date) return false;
      return new Date(t.trial_end_date) > new Date();
    }).length;
    const activeSubscriptions = subscriptions.filter(s => s.status === "active").length;
    
    const totalRevenue = subscriptions
      .filter(s => s.last_payment_status === "succeeded")
      .reduce((sum, s) => sum + (s.last_payment_amount || 0), 0);

    const monthlyRecurring = subscriptions
      .filter(s => s.status === "active")
      .reduce((sum, s) => sum + (s.amount || 65), 0);

    const churnTenants = tenants.filter(t => t.status === "cancelled").length;
    const totalUsers = tenants.length;

    return {
      activeTenants,
      trialTenants,
      activeSubscriptions,
      totalRevenue,
      monthlyRecurring,
      churnTenants,
      totalUsers,
    };
  }, [tenants, subscriptions]);

  // 📊 Subscription Status Distribution
  const subscriptionData = [
    { name: "Activas", value: metrics.activeSubscriptions },
    { name: "Trial", value: metrics.trialTenants },
    { name: "Pendiente Pago", value: tenants.filter(t => t.subscription_status === "past_due").length },
    { name: "Canceladas", value: tenants.filter(t => t.status === "cancelled").length },
  ];

  // 📈 Revenue Trend (mock data for demo)
  const revenueTrend = [
    { month: "Ene", revenue: 1300 },
    { month: "Feb", revenue: 2200 },
    { month: "Mar", revenue: 1800 },
    { month: "Abr", revenue: 3200 },
    { month: "May", revenue: 2900 },
    { month: "Jun", revenue: 3500 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Panel Administrativo</h1>
          <p className="text-slate-400">Resumen de métricas clave del sistema SaaS</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Tiendas Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{metrics.activeTenants}</div>
              <p className="text-xs text-slate-400 mt-2">De {metrics.totalUsers} totales</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                En Trial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{metrics.trialTenants}</div>
              <p className="text-xs text-slate-400 mt-2">Primeros 15 días</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">${metrics.monthlyRecurring.toFixed(0)}</div>
              <p className="text-xs text-slate-400 mt-2">Ingresos recurrentes mensuales</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-lime-400" />
                Total Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">${metrics.totalRevenue.toFixed(0)}</div>
              <p className="text-xs text-slate-400 mt-2">Histórico</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Tendencia de Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#00A8E8" strokeWidth={2} dot={{ fill: "#00A8E8" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Subscription Status */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Estado de Suscripciones</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={subscriptionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {subscriptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tables */}
        <Tabs defaultValue="subscriptions" className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <TabsList className="bg-slate-900/50">
            <TabsTrigger value="subscriptions">Suscripciones Activas</TabsTrigger>
            <TabsTrigger value="trials">Tenants en Trial</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Tienda</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Plan</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Estado</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Próximo Pago</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Monto Mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants
                    .filter(t => t.subscription_status === "active")
                    .slice(0, 10)
                    .map(tenant => (
                      <tr key={tenant.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                        <td className="py-3 px-4 text-white">{tenant.name}</td>
                        <td className="py-3 px-4 text-slate-300">{tenant.plan || "smartfixos"}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded text-xs bg-emerald-400/20 text-emerald-300">
                            Activa
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{tenant.next_billing_date || "N/A"}</td>
                        <td className="py-3 px-4 text-white font-semibold">${tenant.monthly_cost || 65}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="trials" className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Tienda</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Email</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Días Restantes</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Fecha Expiración</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants
                    .filter(t => {
                      if (!t.trial_end_date) return false;
                      return new Date(t.trial_end_date) > new Date();
                    })
                    .map(tenant => {
                      const daysLeft = Math.ceil(
                        (new Date(tenant.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <tr key={tenant.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                          <td className="py-3 px-4 text-white">{tenant.name}</td>
                          <td className="py-3 px-4 text-slate-400">{tenant.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              daysLeft <= 3 ? "bg-red-400/20 text-red-300" : "bg-amber-400/20 text-amber-300"
                            }`}>
                              {daysLeft} días
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">{tenant.trial_end_date}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
