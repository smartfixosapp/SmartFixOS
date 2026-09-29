import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { PageSpinner } from "@/components/ui/spinner";
import RequireAuth from "@/components/auth/RequireAuth";
import Layout from "@/components/layout/Layout";

function lazyWithRetry(fn) {
  return lazy(() =>
    fn().catch((err) => {
      const retried = sessionStorage.getItem('chunk-reload');
      if (!retried) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
        return new Promise(() => {});
      }
      throw err;
    })
  );
}

const Landing          = lazyWithRetry(() => import("./Landing"));
const Registro         = lazyWithRetry(() => import("./Registro"));
const TenantActivate   = lazyWithRetry(() => import("./TenantActivate"));
const Upgrade          = lazyWithRetry(() => import("./Upgrade"));
const UpgradeSuccess   = lazyWithRetry(() => import("./UpgradeSuccess"));
const DashboardBilling = lazyWithRetry(() => import("./DashboardBilling"));
const Billing          = lazyWithRetry(() => import("./Billing"));
const LegalTerms       = lazyWithRetry(() => import("./LegalTerms"));
const LegalRefunds     = lazyWithRetry(() => import("./LegalRefunds"));
const Receipt          = lazyWithRetry(() => import("./Receipt"));
const CustomerPortal   = lazyWithRetry(() => import("./CustomerPortal"));
const CustomerApproval = lazyWithRetry(() => import("./CustomerApproval"));
const GACC             = lazyWithRetry(() => import("./gacc"));
const GACCLogin        = lazyWithRetry(() => import("./gacc/GACCLogin"));
const Login            = lazyWithRetry(() => import("./Login"));
const EmployeeLogin    = lazyWithRetry(() => import("./EmployeeLogin"));
const EmployeeHome     = lazyWithRetry(() => import("./EmployeeHome"));
const EmployeesList    = lazyWithRetry(() => import("./EmployeesList"));
const Financial        = lazyWithRetry(() => import("./Financial"));
const Dashboard        = lazyWithRetry(() => import("./Dashboard"));
const Orders           = lazyWithRetry(() => import("./Orders"));
const POS              = lazyWithRetry(() => import("./POS"));
const SettingsPage     = lazyWithRetry(() => import("./Settings"));
const Inventory        = lazyWithRetry(() => import("./Inventory"));
const Customers        = lazyWithRetry(() => import("./Customers"));

function PageLoader() {
  return <PageSpinner />;
}

function PagesContent() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/"                  element={<Landing />} />
        <Route path="/Pricing"           element={<Landing />} />
        <Route path="/registro"          element={<Registro />} />
        <Route path="/signup"            element={<Registro />} />
        <Route path="/crear-taller"      element={<Registro />} />
        <Route path="/TenantActivate"    element={<TenantActivate />} />
        <Route path="/upgrade"           element={<Upgrade />} />
        <Route path="/upgrade-success"   element={<UpgradeSuccess />} />
        <Route path="/dashboard/billing" element={<DashboardBilling />} />
        <Route path="/billing"           element={<Billing />} />
        <Route path="/legal/terms"       element={<LegalTerms />} />
        <Route path="/legal/refunds"     element={<LegalRefunds />} />
        <Route path="/Receipt"           element={<Receipt />} />
        <Route path="/CustomerPortal"    element={<CustomerPortal />} />
        <Route path="/CustomerApproval"  element={<CustomerApproval />} />
        <Route path="/SuperAdmin"        element={<GACC />} />
        <Route path="/GACC"              element={<GACC />} />
        <Route path="/GACCLogin"         element={<GACCLogin />} />
        <Route path="/Login"             element={<Login />} />
        <Route path="/EmpleadoLogin"     element={<EmployeeLogin />} />
        <Route path="/EmpleadoHome"      element={<EmployeeHome />} />
        <Route path="/Empleados"         element={<EmployeesList />} />
        <Route path="/Financial"         element={<RequireAuth roles={["admin", "super_admin", "owner"]}><Layout><Financial /></Layout></RequireAuth>} />
        <Route path="/Dashboard"         element={<RequireAuth roles={["admin", "super_admin", "owner"]}><Layout><Dashboard /></Layout></RequireAuth>} />
        <Route path="/Orders"            element={<RequireAuth roles={["admin", "super_admin", "owner"]}><Layout><Orders /></Layout></RequireAuth>} />
        <Route path="/POS"               element={<RequireAuth roles={["admin", "super_admin", "owner"]}><Layout><POS /></Layout></RequireAuth>} />
        <Route path="/Settings"          element={<RequireAuth roles={["admin", "super_admin", "owner"]}><Layout><SettingsPage /></Layout></RequireAuth>} />
        <Route path="/Inventory"         element={<RequireAuth roles={["admin", "super_admin", "owner"]}><Layout><Inventory /></Layout></RequireAuth>} />
        <Route path="/Customers"         element={<RequireAuth roles={["admin", "super_admin", "owner"]}><Layout><Customers /></Layout></RequireAuth>} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function Pages() {
  return (
    <Router>
      <PagesContent />
    </Router>
  );
}
