import Layout from "./Layout.jsx";

import Activate from "./Activate";
import CustomerPortal from "./CustomerPortal";
import Customers from "./Customers";
import Dashboard from "./Dashboard";
import Financial from "./Financial";
import FinancialReports from "./FinancialReports";
import Home from "./Home";
import InitialSetup from "./InitialSetup";
import Inventory from "./Inventory";
import Notifications from "./Notifications";
import Orders from "./Orders";
import OrdersMobile from "./OrdersMobile";
import POS from "./POS";
import PinAccess from "./PinAccess";
import PinLogin from "./PinLogin";
import Recharges from "./Recharges";
import Reports from "./Reports";
import Settings from "./Settings";
import SettingsGeneral from "./SettingsGeneral";
import SettingsMobile from "./SettingsMobile";
import Setup from "./Setup";
import Technicians from "./Technicians";
import TenantManagement from "./TenantManagement";
import TimeTracking from "./TimeTracking";
import UsersManagement from "./UsersManagement";
import VerifySetup from "./VerifySetup";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

import AuthGate from '@/components/Auth';

const PAGES = {
    Activate: Activate,
    CustomerPortal: CustomerPortal,
    Customers: Customers,
    Dashboard: Dashboard,
    Financial: Financial,
    FinancialReports: FinancialReports,
    Home: Home,
    InitialSetup: InitialSetup,
    Inventory: Inventory,
    Notifications: Notifications,
    Orders: Orders,
    OrdersMobile: OrdersMobile,
    POS: POS,
    PinAccess: PinAccess,
    PinLogin: PinLogin,
    Recharges: Recharges,
    Reports: Reports,
    Settings: Settings,
    SettingsGeneral: SettingsGeneral,
    SettingsMobile: SettingsMobile,
    Setup: Setup,
    Technicians: Technicians,
    TenantManagement: TenantManagement,
    TimeTracking: TimeTracking,
    UsersManagement: UsersManagement,
    VerifySetup: VerifySetup,
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

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>
    <Route path="/" element={<AuthGate><Dashboard /></AuthGate>} />

    <Route path="/Activate" element={<AuthGate><Activate /></AuthGate>} />

    <Route path="/CustomerPortal" element={<AuthGate><CustomerPortal /></AuthGate>} />

    <Route path="/Customers" element={<AuthGate><Customers /></AuthGate>} />

    <Route path="/Dashboard" element={<AuthGate><Dashboard /></AuthGate>} />

    <Route path="/Financial" element={<AuthGate><Financial /></AuthGate>} />

    <Route path="/FinancialReports" element={<AuthGate><FinancialReports /></AuthGate>} />

    <Route path="/Home" element={<AuthGate><Home /></AuthGate>} />

    <Route path="/InitialSetup" element={<AuthGate><InitialSetup /></AuthGate>} />

    <Route path="/Inventory" element={<AuthGate><Inventory /></AuthGate>} />

    <Route path="/Notifications" element={<AuthGate><Notifications /></AuthGate>} />

    <Route path="/Orders" element={<AuthGate><Orders /></AuthGate>} />

    <Route path="/OrdersMobile" element={<AuthGate><OrdersMobile /></AuthGate>} />

    <Route path="/POS" element={<AuthGate><POS /></AuthGate>} />

    <Route path="/PinAccess" element={<AuthGate><PinAccess /></AuthGate>} />

    <Route path="/PinLogin" element={<AuthGate><PinLogin /></AuthGate>} />

    <Route path="/Recharges" element={<AuthGate><Recharges /></AuthGate>} />

    <Route path="/Reports" element={<AuthGate><Reports /></AuthGate>} />

    <Route path="/Settings" element={<AuthGate><Settings /></AuthGate>} />

    <Route path="/SettingsGeneral" element={<AuthGate><SettingsGeneral /></AuthGate>} />

    <Route path="/SettingsMobile" element={<AuthGate><SettingsMobile /></AuthGate>} />

    <Route path="/Setup" element={<AuthGate><Setup /></AuthGate>} />

    <Route path="/Technicians" element={<AuthGate><Technicians /></AuthGate>} />

    <Route path="/TenantManagement" element={<AuthGate><TenantManagement /></AuthGate>} />

    <Route path="/TimeTracking" element={<AuthGate><TimeTracking /></AuthGate>} />

    <Route path="/UsersManagement" element={<AuthGate><UsersManagement /></AuthGate>} />

    <Route path="/VerifySetup" element={<AuthGate><VerifySetup /></AuthGate>} />

</Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}

