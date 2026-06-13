import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { PageSpinner } from "@/components/ui/spinner";

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
