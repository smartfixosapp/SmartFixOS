import React, { useState, useEffect } from "react";
import appClient from "@/api/appClient";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Building2, CreditCard, AlertCircle, Activity, Clock, Wifi, WifiOff, ArrowUpDown } from "lucide-react";

const COLORS = ["#007AFF", "#34C759", "#AF52DE"];

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
  if (!dateStr) return { dot: "bg-gray-400 dark:bg-gray-500", badge: "bg-apple-gray/15 apple-label-secondary", label: "Nunca" };
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (days < 1)  return { dot: "bg-apple-green animate-pulse", badge: "bg-apple-green/15 text-apple-green", label: "Hoy" };
  if (days < 3)  return { dot: "bg-apple-green",   badge: "bg-apple-green/12 text-apple-green",   label: "Reciente" };
  if (days < 7)  return { dot: "bg-apple-yellow",  badge: "bg-apple-yellow/15 text-apple-yellow", label: "Esta semana" };
  if (days < 30) return { dot: "bg-apple-orange", badge: "bg-apple-orange/15 text-apple-orange",label: "Este mes" };
  return { dot: "bg-apple-red", badge: "bg-apple-red/15 text-apple-red", label: "Inactivo" };
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
    <div className="min-h-screen apple-surface apple-type py-6">
      <div className="app-container">
        {/* Header */}
        <div className="mb-8">
          <h1 className="apple-text-large-title apple-label-primary mb-2">Panel Administrativo</h1>
          <p className="apple-text-subheadline apple-label-secondary">Resumen de métricas clave del sistema SaaS</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="apple-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="apple-text-subheadline apple-label-secondary flex items-center gap-2">
                <span className="w-7 h-7 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-apple-blue" />
                </span>
                Tiendas Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="apple-text-title1 apple-label-primary tabular-nums">{metrics.activeTenants}</div>
              <p className="apple-text-caption1 apple-label-tertiary mt-2">De <span className="tabular-nums">{metrics.totalUsers}</span> totales</p>
            </CardContent>
          </Card>

          <Card className="apple-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="apple-text-subheadline apple-label-secondary flex items-center gap-2">
                <span className="w-7 h-7 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-apple-orange" />
                </span>
                En Trial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="apple-text-title1 apple-label-primary tabular-nums">{metrics.trialTenants}</div>
              <p className="apple-text-caption1 apple-label-tertiary mt-2">Primeros 15 días</p>
            </CardContent>
          </Card>

          <Card className="apple-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="apple-text-subheadline apple-label-secondary flex items-center gap-2">
                <span className="w-7 h-7 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-apple-green" />
                </span>
                MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="apple-text-title1 apple-label-primary tabular-nums">${metrics.monthlyRecurring.toFixed(0)}</div>
              <p className="apple-text-caption1 apple-label-tertiary mt-2">Ingresos recurrentes mensuales</p>
            </CardContent>
          </Card>

          <Card className="apple-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="apple-text-subheadline apple-label-secondary flex items-center gap-2">
                <span className="w-7 h-7 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-apple-purple" />
                </span>
                Total Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="apple-text-title1 apple-label-primary tabular-nums">${metrics.totalRevenue.toFixed(0)}</div>
              <p className="apple-text-caption1 apple-label-tertiary mt-2">Histórico</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <Card className="apple-card border-0">
            <CardHeader>
              <CardTitle className="apple-text-headline apple-label-primary">Tendencia de Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#007AFF" strokeWidth={2} dot={{ fill: "#007AFF" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Subscription Status */}
          <Card className="apple-card border-0">
            <CardHeader>
              <CardTitle className="apple-text-headline apple-label-primary">Estado de Suscripciones</CardTitle>
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
          <Card className="bg-apple-green/12 border-0">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-apple-green animate-pulse" />
                <span className="apple-text-footnote text-apple-green">Últimas 24h</span>
              </div>
              <div className="apple-text-title1 apple-label-primary tabular-nums">{activityStats.active24h}</div>
              <p className="apple-text-caption1 apple-label-tertiary mt-1">tiendas conectadas hoy</p>
            </CardContent>
          </Card>
          <Card className="bg-apple-yellow/12 border-0">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Wifi className="w-3 h-3 text-apple-yellow" />
                <span className="apple-text-footnote text-apple-yellow">Últimos 7 días</span>
              </div>
              <div className="apple-text-title1 apple-label-primary tabular-nums">{activityStats.active7d}</div>
              <p className="apple-text-caption1 apple-label-tertiary mt-1">tiendas activas esta semana</p>
            </CardContent>
          </Card>
          <Card className="bg-apple-red/12 border-0">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <WifiOff className="w-3 h-3 text-apple-red" />
                <span className="apple-text-footnote text-apple-red">Sin actividad</span>
              </div>
              <div className="apple-text-title1 apple-label-primary tabular-nums">{activityStats.never}</div>
              <p className="apple-text-caption1 apple-label-tertiary mt-1">nunca se conectaron</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="activity" className="apple-card rounded-apple-lg p-6">
          <TabsList className="bg-gray-sys6 dark:bg-gray-sys5">
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
              <p className="apple-text-subheadline apple-label-secondary">Última vez que cada tienda inició sesión en el sistema</p>
              <div className="flex gap-2">
                {[
                  { key: "recent", label: "Más recientes" },
                  { key: "oldest", label: "Más antiguos" },
                  { key: "never",  label: "Sin actividad" },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setActivitySort(opt.key)}
                    className={`apple-press px-3 py-1.5 rounded-apple-sm apple-text-footnote transition-all flex items-center gap-1 ${
                      activitySort === opt.key
                        ? "bg-apple-blue/15 text-apple-blue"
                        : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full apple-text-subheadline">
                <thead>
                  <tr style={{ borderBottom: "0.5px solid rgba(60,60,67,0.29)" }}>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Tienda</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Estado</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Último acceso</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Actividad</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Fecha exacta</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTenantsByActivity.map(tenant => {
                    const ac = activityColor(tenant.last_login);
                    const ago = timeAgo(tenant.last_login);
                    return (
                      <tr key={tenant.id} style={{ borderBottom: "0.5px solid rgba(60,60,67,0.2)" }} className="hover:bg-gray-sys6 dark:hover:bg-gray-sys5 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ac.dot}`} />
                            <span className="apple-label-primary apple-text-subheadline">{tenant.name}</span>
                          </div>
                          <p className="apple-text-caption1 apple-label-tertiary ml-4">{tenant.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-apple-xs apple-text-caption1 ${
                            tenant.status === "active" ? "bg-apple-green/15 text-apple-green" : "bg-apple-gray/15 apple-label-secondary"
                          }`}>
                            {tenant.status === "active" ? "Activo" : tenant.status || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="apple-label-primary tabular-nums">{ago || "—"}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-apple-xs apple-text-caption1 ${ac.badge}`}>
                            {ac.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 apple-label-tertiary apple-text-caption1 tabular-nums">
                          {tenant.last_login
                            ? new Date(tenant.last_login).toLocaleString("es-PR", { dateStyle: "short", timeStyle: "short" })
                            : <span className="apple-label-tertiary">Sin registro</span>}
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
              <table className="w-full apple-text-subheadline">
                <thead>
                  <tr style={{ borderBottom: "0.5px solid rgba(60,60,67,0.29)" }}>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Tienda</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Plan</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Estado</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Próximo Pago</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Monto Mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants
                    .filter(t => t.subscription_status === "active")
                    .slice(0, 10)
                    .map(tenant => (
                      <tr key={tenant.id} style={{ borderBottom: "0.5px solid rgba(60,60,67,0.2)" }} className="hover:bg-gray-sys6 dark:hover:bg-gray-sys5">
                        <td className="py-3 px-4 apple-label-primary">{tenant.name}</td>
                        <td className="py-3 px-4 apple-label-secondary">{tenant.plan || "smartfixos"}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-apple-xs apple-text-caption1 bg-apple-green/15 text-apple-green">
                            Activa
                          </span>
                        </td>
                        <td className="py-3 px-4 apple-label-tertiary tabular-nums">{tenant.next_billing_date || "N/A"}</td>
                        <td className="py-3 px-4 apple-label-primary tabular-nums">${tenant.monthly_cost || 49}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="trials" className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full apple-text-subheadline">
                <thead>
                  <tr style={{ borderBottom: "0.5px solid rgba(60,60,67,0.29)" }}>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Tienda</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Email</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Días Restantes</th>
                    <th className="text-left py-3 px-4 apple-label-secondary apple-text-footnote">Fecha Expiración</th>
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
                        <tr key={tenant.id} style={{ borderBottom: "0.5px solid rgba(60,60,67,0.2)" }} className="hover:bg-gray-sys6 dark:hover:bg-gray-sys5">
                          <td className="py-3 px-4 apple-label-primary">{tenant.name}</td>
                          <td className="py-3 px-4 apple-label-tertiary">{tenant.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-apple-xs apple-text-caption1 tabular-nums ${
                              daysLeft <= 3 ? "bg-apple-red/15 text-apple-red" : "bg-apple-orange/15 text-apple-orange"
                            }`}>
                              {daysLeft} días
                            </span>
                          </td>
                          <td className="py-3 px-4 apple-label-tertiary tabular-nums">{tenant.trial_end_date}</td>
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
