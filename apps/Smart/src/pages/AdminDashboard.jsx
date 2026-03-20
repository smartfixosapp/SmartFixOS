import React, { useState, useEffect } from "react";
import appClient from "@/api/appClient";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Building2, CreditCard, AlertCircle, Activity, Clock, Wifi, WifiOff, ArrowUpDown } from "lucide-react";

const COLORS = ["#00A8E8", "#10B981", "#A8D700"];

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `Hace ${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
}

function activityColor(dateStr) {
  if (!dateStr) return { dot: "bg-gray-600", badge: "bg-gray-500/20 text-gray-400", label: "Nunca" };
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (days < 1)  return { dot: "bg-emerald-400 animate-pulse", badge: "bg-emerald-400/20 text-emerald-300", label: "Hoy" };
  if (days < 3)  return { dot: "bg-lime-400",   badge: "bg-lime-400/20 text-lime-300",   label: "Reciente" };
  if (days < 7)  return { dot: "bg-amber-400",  badge: "bg-amber-400/20 text-amber-300", label: "Esta semana" };
  if (days < 30) return { dot: "bg-orange-400", badge: "bg-orange-400/20 text-orange-300",label: "Este mes" };
  return { dot: "bg-red-500", badge: "bg-red-500/20 text-red-400", label: "Inactivo" };
}

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState("month");
  const [activitySort, setActivitySort] = useState("recent"); // "recent" | "oldest" | "never"

  // 📊 Fetch Tenants
  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => appClient.entities.Tenant.list("-created_date", 100),
  });

  // 💰 Fetch Subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => appClient.entities.Subscription.filter({}, "-created_date"),
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
      .reduce((sum, s) => sum + (s.amount || 49), 0);

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

  // 📊 Activity metrics
  const activityStats = React.useMemo(() => {
    const now = Date.now();
    const active24h = tenants.filter(t => t.last_login && (now - new Date(t.last_login).getTime()) < 86400000).length;
    const active7d  = tenants.filter(t => t.last_login && (now - new Date(t.last_login).getTime()) < 7*86400000).length;
    const never     = tenants.filter(t => !t.last_login).length;
    return { active24h, active7d, never };
  }, [tenants]);

  const sortedTenantsByActivity = React.useMemo(() => {
    const copy = [...tenants];
    if (activitySort === "recent") {
      return copy.sort((a, b) => {
        if (!a.last_login && !b.last_login) return 0;
        if (!a.last_login) return 1;
        if (!b.last_login) return -1;
        return new Date(b.last_login) - new Date(a.last_login);
      });
    }
    if (activitySort === "oldest") {
      return copy.sort((a, b) => {
        if (!a.last_login && !b.last_login) return 0;
        if (!a.last_login) return 1;
        if (!b.last_login) return -1;
        return new Date(a.last_login) - new Date(b.last_login);
      });
    }
    // "never" first
    return copy.sort((a, b) => {
      if (!a.last_login && !b.last_login) return 0;
      if (!a.last_login) return -1;
      if (!b.last_login) return 1;
      return 0;
    });
  }, [tenants, activitySort]);

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
        {/* Activity KPI mini-cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-emerald-900/30 border-emerald-700/40">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-300 font-semibold uppercase tracking-wide">Últimas 24h</span>
              </div>
              <div className="text-3xl font-bold text-white">{activityStats.active24h}</div>
              <p className="text-xs text-slate-400 mt-1">tiendas conectadas hoy</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-900/30 border-amber-700/40">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Wifi className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-amber-300 font-semibold uppercase tracking-wide">Últimos 7 días</span>
              </div>
              <div className="text-3xl font-bold text-white">{activityStats.active7d}</div>
              <p className="text-xs text-slate-400 mt-1">tiendas activas esta semana</p>
            </CardContent>
          </Card>
          <Card className="bg-red-900/30 border-red-700/40">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-300 font-semibold uppercase tracking-wide">Sin actividad</span>
              </div>
              <div className="text-3xl font-bold text-white">{activityStats.never}</div>
              <p className="text-xs text-slate-400 mt-1">nunca se conectaron</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="activity" className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <TabsList className="bg-slate-900/50">
            <TabsTrigger value="activity">
              <Activity className="w-3.5 h-3.5 mr-1.5" />
              Actividad
            </TabsTrigger>
            <TabsTrigger value="subscriptions">Suscripciones Activas</TabsTrigger>
            <TabsTrigger value="trials">Tenants en Trial</TabsTrigger>
          </TabsList>

          {/* ── ACTIVIDAD TAB ── */}
          <TabsContent value="activity" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400">Última vez que cada tienda inició sesión en el sistema</p>
              <div className="flex gap-2">
                {[
                  { key: "recent", label: "Más recientes" },
                  { key: "oldest", label: "Más antiguos" },
                  { key: "never",  label: "Sin actividad" },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setActivitySort(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                      activitySort === opt.key
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-slate-700/50 text-slate-400 border border-slate-600/40 hover:border-slate-500"
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Tienda</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Estado</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Último acceso</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Actividad</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Fecha exacta</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTenantsByActivity.map(tenant => {
                    const ac = activityColor(tenant.last_login);
                    const ago = timeAgo(tenant.last_login);
                    return (
                      <tr key={tenant.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ac.dot}`} />
                            <span className="text-white font-medium">{tenant.name}</span>
                          </div>
                          <p className="text-xs text-slate-500 ml-4">{tenant.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            tenant.status === "active" ? "bg-emerald-400/15 text-emerald-300" : "bg-gray-500/15 text-gray-400"
                          }`}>
                            {tenant.status === "active" ? "Activo" : tenant.status || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white">{ago || "—"}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${ac.badge}`}>
                            {ac.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-xs">
                          {tenant.last_login
                            ? new Date(tenant.last_login).toLocaleString("es-PR", { dateStyle: "short", timeStyle: "short" })
                            : <span className="text-slate-600">Sin registro</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

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
                        <td className="py-3 px-4 text-white font-semibold">${tenant.monthly_cost || 49}</td>
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
