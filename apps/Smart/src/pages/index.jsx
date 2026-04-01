
import React, { lazy, Suspense } from 'react';
import Layout from "./Layout.jsx";
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AuthGate, { useAuth } from '@/components/Auth';

// Lazy-loaded pages — each becomes its own chunk
const Activate              = lazy(() => import("./Activate"));
const SuperAdmin            = lazy(() => import("./SuperAdmin"));
const AdminDashboard        = lazy(() => import("./AdminDashboard"));
const AuditLog              = lazy(() => import("./AuditLog"));
const CashHistory           = lazy(() => import("./CashHistory"));
const CustomerDisplay       = lazy(() => import("./CustomerDisplay"));
const CustomerPortal        = lazy(() => import("./CustomerPortal"));
const Customers             = lazy(() => import("./Customers"));
const Dashboard             = lazy(() => import("./Dashboard"));
const Financial             = lazy(() => import("./Financial"));
const InitialSetup          = lazy(() => import("./InitialSetup"));
const Inventory             = lazy(() => import("./Inventory"));
const Notifications         = lazy(() => import("./Notifications"));
const Orders                = lazy(() => import("./Orders"));
const POS                   = lazy(() => import("./POS"));
const POSDesktop            = lazy(() => import("./POSDesktop"));
const POSMobile             = lazy(() => import("./POSMobile"));
const PinAccess             = lazy(() => import("./PinAccess"));
const Recharges             = lazy(() => import("./Recharges"));
const Receipt               = lazy(() => import("./Receipt"));
const Settings              = lazy(() => import("./Settings"));
const SettingsGeneral       = lazy(() => import("./SettingsGeneral"));
const SettingsNav           = lazy(() => import("./SettingsNav"));
const Setup                 = lazy(() => import("./Setup"));
const SubscriptionManagement = lazy(() => import("./SubscriptionManagement"));
const Technicians           = lazy(() => import("./Technicians"));
const TenantManagement      = lazy(() => import("./TenantManagement"));
const TenantActivate        = lazy(() => import("./TenantActivate"));
const UsersManagement       = lazy(() => import("./UsersManagement"));
const VerifySetup           = lazy(() => import("./VerifySetup"));
const Welcome               = lazy(() => import("./Welcome"));
const Appointments          = lazy(() => import("./Appointments"));
const OrdersMobile          = lazy(() => import("./OrdersMobile"));
const Menu                  = lazy(() => import("./Menu"));

// Minimal spinner shown while a lazy chunk loads
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
    </div>
  );
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

function ProtectedRoutes() {
    return (
        <AuthGate>
            <Routes>
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
        </AuthGate>
    );
}

function LayoutWrapper({ children, currentPageName }) {
    const location = useLocation();

    if (location.pathname === '/returnlogin' || location.pathname === '/SuperAdmin' || location.pathname === '/Receipt') {
        return <>{children}</>;
    }

    return <Layout currentPageName={currentPageName}>{children}</Layout>;
}

function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    return (
        <LayoutWrapper currentPageName={currentPage}>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/SuperAdmin" element={<SuperAdmin />} />
                    <Route path="/TenantActivate" element={<TenantActivate />} />
                    <Route path="/returnlogin" element={<ReturnLogin />} />
                    <Route path="/Receipt" element={<Receipt />} />
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
