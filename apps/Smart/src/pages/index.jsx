
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import AuthGate, { useAuth } from '@/components/Auth';
import { PageSpinner } from "@/components/ui/spinner";

// Wrap lazy imports to auto-reload on chunk load failures (stale CDN cache)
function lazyWithRetry(fn) {
  return lazy(() =>
    fn().catch((err) => {
      const retried = sessionStorage.getItem('chunk-reload');
      if (!retried) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
        return new Promise(() => {}); // never resolves (page reloads)
      }
      throw err;
    })
  );
}

// Public & marketing pages
const Landing          = lazyWithRetry(() => import("./Landing"));
const Signup           = lazyWithRetry(() => import("./Signup"));
const LoginPage        = lazyWithRetry(() => import("./Login"));
const Dashboard        = lazyWithRetry(() => import("./Dashboard"));
const Upgrade          = lazyWithRetry(() => import("./Upgrade"));
const Billing          = lazyWithRetry(() => import("./Billing"));
const VerifyEmail      = lazyWithRetry(() => import("./VerifyEmail"));
const Activate         = lazyWithRetry(() => import("./Activate"));
const TenantActivate   = lazyWithRetry(() => import("./TenantActivate"));
const Receipt          = lazyWithRetry(() => import("./Receipt"));
const CustomerPortal   = lazyWithRetry(() => import("./CustomerPortal"));
const CustomerApproval = lazyWithRetry(() => import("./CustomerApproval"));
const GACC             = lazyWithRetry(() => import("./gacc"));

function PageLoader() {
  return <PageSpinner />;
}

function ReturnLoginInner() {
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    if (user) {
      const redirectUrl = sessionStorage.getItem("redirectAfterLogin") || "/";
      sessionStorage.removeItem("redirectAfterLogin");
      navigate(redirectUrl);
    }
  }, [user, navigate]);

  return null;
}

function ReturnLogin() {
  return (
    <AuthGate>
      <ReturnLoginInner />
    </AuthGate>
  );
}

function PagesContent() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/"                element={<Landing />} />
        <Route path="/Pricing"         element={<Landing />} />
        {/* Auth + dashboard (Sprint 134 — magic link + Google OAuth) */}
        <Route path="/signup"          element={<Signup />} />
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/dashboard"       element={<Dashboard />} />
        <Route path="/upgrade"         element={<Upgrade />} />
        <Route path="/billing"         element={<Billing />} />
        <Route path="/VerifyEmail"     element={<VerifyEmail />} />
        <Route path="/Activate"        element={<Activate />} />
        <Route path="/TenantActivate"  element={<TenantActivate />} />
        <Route path="/Receipt"         element={<Receipt />} />
        <Route path="/CustomerPortal"  element={<CustomerPortal />} />
        <Route path="/CustomerApproval" element={<CustomerApproval />} />
        <Route path="/SuperAdmin"      element={<GACC />} />
        <Route path="/GACC"            element={<GACC />} />
        <Route path="/returnlogin"     element={<ReturnLogin />} />
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
