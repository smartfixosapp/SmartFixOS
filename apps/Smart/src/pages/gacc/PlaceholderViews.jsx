/**
 * GACC — Placeholder views for sections not yet built
 * These will be replaced with full implementations
 */
import React from "react";
import {
  DollarSign, Activity, HeadphonesIcon, Lock, Wrench,
  Construction, ArrowRight
} from "lucide-react";

function PlaceholderSection({ icon: Icon, title, description, features }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto">
          <Icon className="w-8 h-8 text-gray-600" />
        </div>
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">{description}</p>

        {features && (
          <div className="mt-8 space-y-2 text-left max-w-sm mx-auto">
            <p className="text-[11px] text-gray-600 uppercase tracking-wide font-bold">Incluira:</p>
            {features.map(f => (
              <div key={f} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <ArrowRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span className="text-[12px] text-gray-400">{f}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-6">
          <Construction className="w-4 h-4 text-amber-500" />
          <p className="text-[12px] text-amber-500 font-semibold">En desarrollo</p>
        </div>
      </div>
    </div>
  );
}

export function RevenueView() {
  return (
    <PlaceholderSection
      icon={DollarSign}
      title="Revenue & Billing"
      description="Control completo de facturacion, suscripciones y cobros."
      features={[
        "MRR / ARR breakdown por plan",
        "Historial de pagos con status",
        "Pagos fallidos con acciones (retry, contactar, suspender)",
        "Dunning workflow automatizado",
        "Invoices y receipts",
        "Churn rate y LTV",
      ]}
    />
  );
}

export function OperationsView() {
  return (
    <PlaceholderSection
      icon={Activity}
      title="Operations"
      description="Monitoreo del sistema y salud de la plataforma."
      features={[
        "System Health dashboard (DB, Functions, Storage, Stripe)",
        "Activity feed global en tiempo real",
        "Error tracker (errores agrupados por funcion)",
        "Function logs viewer con filtros",
        "Alertas automaticas",
      ]}
    />
  );
}

export function SupportView() {
  return (
    <PlaceholderSection
      icon={HeadphonesIcon}
      title="Support"
      description="Centro de soporte interno para tiendas."
      features={[
        "Tickets / notas internas por tienda",
        "Communication center (email individual y masivo)",
        "Templates predefinidos (bienvenida, trial, pago fallido)",
        "Historial de comunicaciones",
        "Impersonation tool (ver como tienda X)",
      ]}
    />
  );
}

export function SecurityView() {
  return (
    <PlaceholderSection
      icon={Lock}
      title="Security & Audit"
      description="Auditoria, accesos y control de permisos."
      features={[
        "Audit Log viewer con filtros avanzados",
        "Admin users management",
        "Roles y permisos (super_admin, support, billing, ops)",
        "Session management",
        "IP whitelist",
      ]}
    />
  );
}

export function ToolsView() {
  return (
    <PlaceholderSection
      icon={Wrench}
      title="Internal Tools"
      description="Herramientas internas para diagnostico y administracion."
      features={[
        "Data Explorer (query builder visual)",
        "Storage Manager (uso por tienda, cleanup)",
        "Bulk Actions (extender trials, emails masivos)",
        "Feature Flags (toggles globales y por tienda)",
        "Diagnostics (health check, config validator)",
      ]}
    />
  );
}
