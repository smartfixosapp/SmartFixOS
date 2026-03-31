
import React from 'react';
import Layout from "./Layout.jsx";
import Activate from "./Activate";
import SuperAdmin from "./SuperAdmin";
import AdminDashboard from "./AdminDashboard";
import AuditLog from "./AuditLog";
import CashHistory from "./CashHistory";
import CustomerDisplay from "./CustomerDisplay";
import CustomerPortal from "./CustomerPortal";
import Customers from "./Customers";
import Dashboard from "./Dashboard";
import Financial from "./Financial";
import InitialSetup from "./InitialSetup";
import Inventory from "./Inventory";
import Notifications from "./Notifications";
import Orders from "./Orders";
import POS from "./POS";
import POSDesktop from "./POSDesktop";
import POSMobile from "./POSMobile";
import PinAccess from "./PinAccess";
import Recharges from "./Recharges";
import Settings from "./Settings";
import SettingsGeneral from "./SettingsGeneral";
import SettingsNav from "./SettingsNav";
import Setup from "./Setup";
import SubscriptionManagement from "./SubscriptionManagement";
import Technicians from "./Technicians";
import TenantManagement from "./TenantManagement";
import UsersManagement from "./UsersManagement";
import TenantActivate from "./TenantActivate";
import VerifySetup from "./VerifySetup";
import Welcome from "./Welcome";

import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import AuthGate, { useAuth } from '@/components/Auth';

const PAGES = {
    Activate: Activate,
    AdminDashboard: AdminDashboard,
    AuditLog: AuditLog,
    CashHistory: CashHistory,
    CustomerDisplay: CustomerDisplay,
    CustomerPortal: CustomerPortal,
    Customers: Customers,
    Dashboard: Dashboard,
    Financial: Financial,
    InitialSetup: InitialSetup,
    Inventory: Inventory,
    Notifications: Notifications,
    Orders: Orders,
    POS: POS,
    POSDesktop: POSDesktop,
    POSMobile: POSMobile,
    PinAccess: PinAccess,
    Recharges: Recharges,
    Settings: Settings,
    SettingsGeneral: SettingsGeneral,
    SettingsNav: SettingsNav,
    Setup: Setup,
    SubscriptionManagement: SubscriptionManagement,
    Technicians: Technicians,
    TenantManagement: TenantManagement,
    UsersManagement: UsersManagement,
    VerifySetup: VerifySetup,
    Welcome: Welcome,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }
    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Minimal redirect component for returnlogin - just shows AuthGate which handles auth UI
function ReturnLoginInner() {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    React.useEffect(() => {
        if (user) {
            // User is logged in, redirect to stored URL or default
            const redirectUrl = sessionStorage.getItem("redirectAfterLogin") || "/Dashboard";
            sessionStorage.removeItem("redirectAfterLogin");
            navigate(redirectUrl);
        }
    }, [user, navigate]);
    
    return null;
}

function ReturnLogin() {
    // AuthGate will show auth UI if not logged in, or render children if logged in
    return (
        <AuthGate>
            <ReturnLoginInner />
        </AuthGate>
    );
}

// Protected routes wrapper - single AuthGate instance for all protected routes
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
                    <Route path="/Welcome" element={<Welcome />} />
            </Routes>
        </AuthGate>
    );
}

// Wrapper component that conditionally applies Layout
function LayoutWrapper({ children, currentPageName }) {
const location = useLocation();

// /returnlogin y /SuperAdmin son standalone (sin Layout)
if (location.pathname === '/returnlogin' || location.pathname === '/SuperAdmin') {
    return <>{children}</>;
}

return <Layout currentPageName={currentPageName}>{children}</Layout>;
}

// Create a wrapper component that uses useLocation inside the Router context
// CRITICAL: Public routes (no AuthGate), protected routes share single AuthGate
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    return (
        <LayoutWrapper currentPageName={currentPage}>
        <Routes>
    {/* Ruta pública standalone — no necesita AuthGate */}
    <Route path="/SuperAdmin" element={<SuperAdmin />} />
    <Route path="/TenantActivate" element={<TenantActivate />} />
    <Route path="/returnlogin" element={<ReturnLogin />} />

    <Route path="/*" element={<ProtectedRoutes />} />
</Routes>
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

