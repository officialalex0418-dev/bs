import { Routes, Route, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, Package, Wallet, Settings, ShieldCheck,
  MapPin, Boxes, Truck, TrendingUp, FileText, CalendarCheck, CalendarOff, User,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui';
import { ROLE_HOME } from '@/lib/utils';
import DashboardLayout from '@/layouts/DashboardLayout';

// Auth
import Login from '@/pages/auth/Login';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';

// Super Admin
import SuperDashboard from '@/pages/superadmin/Dashboard';
import Companies from '@/pages/superadmin/Companies';
import Packages from '@/pages/superadmin/Packages';
import SystemEmployees from '@/pages/superadmin/SystemEmployees';
import CompanyStaff from '@/pages/superadmin/CompanyStaff';
import AuditLogs from '@/pages/superadmin/AuditLogs';
import AdminPayroll from '@/pages/superadmin/AdminPayroll';
import AdminSettings from '@/pages/superadmin/AdminSettings';

// Company
import CompanyDashboard from '@/pages/company/Dashboard';
import StaffList from '@/pages/company/StaffList';
import LiveTracking from '@/pages/company/LiveTracking';
import InventoryPage from '@/pages/company/Inventory';
import Distributors from '@/pages/company/Distributors';
import CompanyPayroll from '@/pages/company/Payroll';
import SalesTracker from '@/pages/company/SalesTracker';
import Reports from '@/pages/company/Reports';
import Leaves from '@/pages/company/Leaves';
import AttendancePage from '@/pages/company/Attendance';
import CompanySettings from '@/pages/company/Settings';
import CompanyEditProfile from '@/pages/company/EditProfile';

// Staff
import StaffDashboard from '@/pages/staff/Dashboard';
import StaffAttendance from '@/pages/staff/Attendance';
import StaffLeaves from '@/pages/staff/Leaves';
import StaffSales from '@/pages/staff/Sales';
import StaffProfile from '@/pages/staff/Profile';
import EditProfile from '@/pages/staff/EditProfile';
import ChangePassword from '@/pages/auth/ChangePassword';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.needsPasswordChange) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return children;
}

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/packages', label: 'Packages', icon: Package },
  { to: '/admin/employees', label: 'System Employees', icon: Users },
  { to: '/admin/company-staff', label: 'Company Staff', icon: Users },
  { to: '/admin/payroll', label: 'Payroll', icon: Wallet },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const companyNav = [
  { to: '/company', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/company/staff', label: 'Staff', icon: Users },
  { to: '/company/tracking', label: 'Live Tracking', icon: MapPin },
  { to: '/company/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/company/leaves', label: 'Leaves', icon: CalendarOff },
  { to: '/company/sales', label: 'Sales Tracker', icon: TrendingUp },
  { to: '/company/inventory', label: 'Inventory', icon: Boxes },
  { to: '/company/distributors', label: 'Distributors', icon: Truck },
  { to: '/company/payroll', label: 'Payroll', icon: Wallet },
  { to: '/company/reports', label: 'Reports', icon: FileText },
  { to: '/company/settings', label: 'Settings', icon: Settings },
];

const staffNav = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/staff/leaves', label: 'Leaves', icon: CalendarOff },
  { to: '/staff/sales', label: 'Sales Entry', icon: TrendingUp },
  { to: '/staff/profile', label: 'Profile', icon: User },
];

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={ROLE_HOME[user.role]} /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/change-password" element={user ? <ChangePassword /> : <Navigate to="/login" />} />

      {/* ---- Super Admin Panel ---- */}
      <Route
        path="/admin"
        element={
          <Protected roles={['SUPER_ADMIN', 'ADMIN_EMPLOYEE']}>
            <DashboardLayout title="Super Admin" nav={adminNav} />
          </Protected>
        }
      >
        <Route index element={<SuperDashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="packages" element={<Packages />} />
        <Route path="employees" element={<SystemEmployees />} />
        <Route path="company-staff" element={<CompanyStaff />} />
        <Route path="payroll" element={<AdminPayroll />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* ---- Company Panel ---- */}
      <Route
        path="/company"
        element={
          <Protected roles={['COMPANY_OWNER', 'COMPANY_MANAGER']}>
            <DashboardLayout title="Company Panel" nav={companyNav} />
          </Protected>
        }
      >
        <Route index element={<CompanyDashboard />} />
        <Route path="staff" element={<StaffList />} />
        <Route path="tracking" element={<LiveTracking />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="sales" element={<SalesTracker />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="distributors" element={<Distributors />} />
        <Route path="payroll" element={<CompanyPayroll />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<CompanySettings />} />
        <Route path="settings/edit" element={<CompanyEditProfile />} />
      </Route>

      {/* ---- Staff App ---- */}
      <Route
        path="/staff"
        element={
          <Protected roles={['STAFF']}>
            <DashboardLayout title="Staff App" nav={staffNav} />
          </Protected>
        }
      >
        <Route index element={<StaffDashboard />} />
        <Route path="attendance" element={<StaffAttendance />} />
        <Route path="leaves" element={<StaffLeaves />} />
        <Route path="sales" element={<StaffSales />} />
        <Route path="profile" element={<StaffProfile />} />
        <Route path="profile/edit" element={<EditProfile />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />} />
    </Routes>
  );
}
