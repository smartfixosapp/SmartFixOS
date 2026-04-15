
import React, { lazy, Suspense } from 'react';
import Layout from "./Layout.jsx";
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AuthGate, { useAuth } from '@/components/Auth';
import { PageSpinner } from "@/components/ui/spinner";
// TutorialTour ahora está integrado dentro de ARIAChat como tab 🗺️

// Wrap lazy imports to auto-reload on chunk load failures (stale CDN cache)
function lazyWithRetry(fn) {
  return lazy(() =>
    fn().catch((err) => {
      // Chunk load error = old HTML referencing old hashes → reload once
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

// Lazy-loaded pages — each becomes its own chunk
const Activate              = lazyWithRetry(() => import("./Activate"));
const SuperAdmin            = lazyWithRetry(() => import("./SuperAdmin"));
const GACC                  = lazyWithRetry(() => import("./gacc"));
const AdminDashboard        = lazyWithRetry(() => import("./AdminDashboard"));
const AuditLog              = lazyWithRetry(() => import("./AuditLog"));
const CashHistory           = lazyWithRetry(() => import("./CashHistory"));
const CustomerDisplay       = lazyWithRetry(() => import("./CustomerDisplay"));
const CustomerPortal        = lazyWithRetry(() => import("./CustomerPortal"));
const Customers             = lazyWithRetry(() => import("./Customers"));
const Dashboard             = lazyWithRetry(() => import("./Dashboard"));
const Financial             = lazyWithRetry(() => import("./Financial"));
const InitialSetup          = lazyWithRetry(() => import("./InitialSetup"));
const Inventory             = lazyWithRetry(() => import("./Inventory"));
const Notifications         = lazyWithRetry(() => import("./Notifications"));
const Orders                = lazyWithRetry(() => import("./Orders"));
const POS                   = lazyWithRetry(() => import("./POS"));
const POSDesktop            = lazyWithRetry(() => import("./POSDesktop"));
const POSMobile             = lazyWithRetry(() => import("./POSMobile"));
const PinAccess             = lazyWithRetry(() => import("./PinAccess"));
const Recharges             = lazyWithRetry(() => import("./Recharges"));
const Receipt               = lazyWithRetry(() => import("./Receipt"));
const Settings              = lazyWithRetry(() => import("./Settings"));
const SettingsGeneral       = lazyWithRetry(() => import("./SettingsGeneral"));
const SettingsNav           = lazyWithRetry(() => import("./SettingsNav"));
const Setup                 = lazyWithRetry(() => import("./Setup"));
const SubscriptionManagement = lazyWithRetry(() => import("./SubscriptionManagement"));
const Technicians           = lazyWithRetry(() => import("./Technicians"));
const TenantManagement      = lazyWithRetry(() => import("./TenantManagement"));
const TenantActivate        = lazyWithRetry(() => import("./TenantActivate"));
const UsersManagement       = lazyWithRetry(() => import("./UsersManagement"));
const VerifySetup           = lazyWithRetry(() => import("./VerifySetup"));
const Welcome               = lazyWithRetry(() => import("./Welcome"));
const CustomerApproval      = lazyWithRetry(() => import("./CustomerApproval"));
const Appointments          = lazyWithRetry(() => import("./Appointments"));
const OrdersMobile          = lazyWithRetry(() => import("./OrdersMobile"));
const Menu                  = lazyWithRetry(() => import("./Menu"));

// Minimal spinner shown while a lazy chunk loads.
// Uses full-screen dark bg so any brief Suspense gap blends with the
// rest of the dark UI instead of flashing white.
// Delegates to <PageSpinner> for consistency with the rest of the app.
function PageLoader() {
  return <PageSpinner />;
}

// Pre-load the chunks for the top-level pages once the app has mounted.
// This prevents the Suspense fallback (and the visible flash) from kicking
// in when the user taps a tab in the nav bar — the chunk is already
// in memory by the time they navigate.
//
// Runs in the browser idle callback so it doesn't compete with the
// initial render and Time-to-Interactive.
function usePreloadMainRoutes() {
  React.useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const handle = idle(() => {
      // Top-level routes most likely to be navigated to first
      import("./Dashboard");
      import("./POS");
      import("./POSDesktop");
      import("./POSMobile");
      import("./Orders");
      import("./OrdersMobile");
      import("./Customers");
      import("./Settings");
      import("./Inventory");
      import("./Financial");
    });
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
    };
  }, []);
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }
    const pageNames = [
        'Activate','AdminDashboard','AuditLog','CashHistory','CustomerDisplay',
        'CustomerPortal','Customers','Dashboard','Financial','InitialSetup',
        'Inventory','Notifications','Orders','POS','POSDesktop','POSMobile',
        'PinAccess','Recharges','Settings','SettingsGeneral','SettingsNav',
        'Setup','SubscriptionManagement','Technicians','TenantManagement',
        'UsersManagement','VerifySetup','Welcome','OrdersMobile','Menu','Appointments'
    ];
    return pageNames.find(p => p.toLowerCase() === urlLastPart.toLowerCase()) || 'Dashboard';
}

function ReturnLoginInner() {
    const navigate = useNavigate();
    const { user } = useAuth();

    React.useEffect(() => {
        if (user) {
            const redirectUrl = sessionStorage.getItem("redirectAfterLogin") || "/Dashboard";
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

// Plain route outlet — NO framer-motion animation wrapper.
// The previous AnimatePresence + motion.div with opacity: 0 initial state caused
// an intermittent blank-page bug: when a lazy-loaded page chunk took longer than
// the 0.18s fade, the new page could mount stuck at opacity: 0 (DOM interactive
// but visually invisible). Removing the animation makes transitions rock solid.
function AnimatedRoutes() {
    const location = useLocation();
    return (
        <div style={{ minHeight: '100%' }}>
            <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/Activate" element={<Activate />} />
                <Route path="/AdminDashboard" element={<AdminDashboard />} />
                <Route path="/AuditLog" element={<AuditLog />} />
                <Route path="/CashHistory" element={<CashHistory />} />
                <Route path="/CustomerDisplay" element={<CustomerDisplay />} />
                <Route path="/CustomerPortal" element={<CustomerPortal />} />
                <Route path="/Customers" element={<Customers />} />
                <Route path="/Dashboard" element={<Dashboard />} />
                <Route path="/Financial" element={<Financial />} />
                <Route path="/InitialSetup" element={<InitialSetup />} />
                <Route path="/Inventory" element={<Inventory />} />
                <Route path="/Notifications" element={<Notifications />} />
                <Route path="/Orders" element={<Orders />} />
                <Route path="/POS" element={<POS />} />
                <Route path="/POSDesktop" element={<POSDesktop />} />
                <Route path="/POSMobile" element={<POSMobile />} />
                <Route path="/PinAccess" element={<PinAccess />} />
                <Route path="/Recharges" element={<Recharges />} />
                <Route path="/Reports" element={<Financial />} />
                <Route path="/Settings" element={<Settings />} />
                <Route path="/SettingsGeneral" element={<SettingsGeneral />} />
                <Route path="/SettingsNav" element={<SettingsNav />} />
                <Route path="/Setup" element={<Setup />} />
                <Route path="/SubscriptionManagement" element={<SubscriptionManagement />} />
                <Route path="/Technicians" element={<Technicians />} />
                <Route path="/TenantManagement" element={<TenantManagement />} />
                <Route path="/TimeTracking" element={<UsersManagement />} />
                <Route path="/UsersManagement" element={<UsersManagement />} />
                <Route path="/VerifySetup" element={<VerifySetup />} />
                <Route path="/Appointments" element={<Appointments />} />
                <Route path="/OrdersMobile" element={<OrdersMobile />} />
                <Route path="/Menu" element={<Menu />} />
                <Route path="/Welcome" element={<Welcome />} />
            </Routes>
        </div>
    );
}

function ProtectedRoutes() {
    return (
        <AuthGate>
            <AnimatedRoutes />
        </AuthGate>
    );
}

function LayoutWrapper({ children, currentPageName }) {
    const location = useLocation();

    if (location.pathname === '/returnlogin' || location.pathname === '/SuperAdmin' || location.pathname === '/GACC' || location.pathname === '/Receipt' || location.pathname === '/CustomerApproval') {
        return <>{children}</>;
    }

    return <Layout currentPageName={currentPageName}>{children}</Layout>;
}

function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    usePreloadMainRoutes();

    return (
        <LayoutWrapper currentPageName={currentPage}>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/SuperAdmin" element={<GACC />} />
                    <Route path="/GACC" element={<GACC />} />
                    <Route path="/TenantActivate" element={<TenantActivate />} />
                    <Route path="/returnlogin" element={<ReturnLogin />} />
                    <Route path="/Receipt" element={<Receipt />} />
                    <Route path="/CustomerApproval" element={<CustomerApproval />} />
                    <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
            </Suspense>
        </LayoutWrapper>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
