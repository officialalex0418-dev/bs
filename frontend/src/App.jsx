import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, Package, Wallet, Settings, ShieldCheck,
  MapPin, Boxes, Truck, TrendingUp, FileText, CalendarCheck, CalendarOff, User,
  MessageSquare, LayoutGrid
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAppPermissions } from '@/hooks/useAppPermissions';
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
import Configuration from '@/pages/superadmin/Configuration';
import Designations from '@/pages/superadmin/Designations';
import AuditLogs from '@/pages/superadmin/AuditLogs';
import AdminSettings from '@/pages/superadmin/AdminSettings';

// Company
import CompanyDashboard from '@/pages/company/Dashboard';
import StaffList from '@/pages/company/StaffList';
import LiveTracking from '@/pages/company/LiveTracking';
import InventoryPage from '@/pages/company/Inventory';
import Distributors from '@/pages/company/Distributors';
import DistributorDetails from '@/pages/company/DistributorDetails';
import CompanyPayroll from '@/pages/company/Payroll';
import SalesTracker from '@/pages/company/SalesTracker';
import Reports from '@/pages/company/Reports';
import Leaves from '@/pages/company/Leaves';
import AttendancePage from '@/pages/company/Attendance';
import CompanySettings from '@/pages/company/Settings';
import CompanyEditProfile from '@/pages/company/EditProfile';
import CompanyConfiguration from '@/pages/company/Configuration';
import CompanyDesignations from '@/pages/company/Designations';
import CompanyBranches from '@/pages/company/Branches';
import CompanyShifts from '@/pages/company/Shifts';
import CompanyDepartments from '@/pages/company/Departments';
import CompanyLeavesConfig from '@/pages/company/LeavesConfig';
import HolidayCalendar from '@/pages/company/HolidayCalendar';
import Complaints from '@/pages/shared/Complaints';

// Staff
import StaffDashboard from '@/pages/staff/Dashboard';
import StaffAttendance from '@/pages/staff/Attendance';
import StaffLeaves from '@/pages/staff/Leaves';
import StaffCustomers from '@/pages/staff/Customers';
import StaffSales from '@/pages/staff/Sales';
import StaffPayroll from '@/pages/staff/Payroll';
import StaffProfile from '@/pages/staff/Profile';
import EditProfile from '@/pages/staff/EditProfile';
import ChangePassword from '@/pages/auth/ChangePassword';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.needsPasswordChange) return <Navigate to="/change-password" replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return children;
}

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/packages', label: 'Packages', icon: Package },
  { to: '/admin/employees', label: 'System Employees', icon: Users },
  { to: '/admin/company-staff', label: 'Company Staff', icon: Users },
  { to: '/admin/configuration', label: 'Configuration', icon: Settings },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const companyNav = [
  { to: '/company', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/company/staff', label: 'Employee', icon: Users },
  { to: '/company/tracking', label: 'Live Tracking', icon: MapPin },
  { to: '/company/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/company/leaves', label: 'Leave Management', icon: CalendarOff },
  { to: '/company/sales', label: 'Sales Tracker', icon: TrendingUp },
  { to: '/company/inventory', label: 'Inventory', icon: Boxes },
  { to: '/company/distributors', label: 'Distributors', icon: Truck },
  { to: '/company/payroll', label: 'Payroll Management', icon: Wallet },
  { to: '/company/complaints', label: 'Complaints', icon: MessageSquare },
  { to: '/company/reports', label: 'Reports', icon: FileText },
  { to: '/company/configuration', label: 'Configuration', icon: Settings },
  { to: '/company/settings', label: 'Settings', icon: Settings },
];

const staffNavBase = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/staff/leaves', label: 'Leaves', icon: CalendarOff },
  { to: '/staff/customers', label: 'Customers', icon: Users },
  { to: '/staff/sales', label: 'Sales Entry', icon: TrendingUp },
  { to: '/staff/payroll', label: 'My Payroll', icon: Wallet },
  { to: '/staff/complaints', label: 'Complaints', icon: MessageSquare },
  { to: '/staff/profile', label: 'Profile', icon: User },
];

export default function App() {
  const { user, loading } = useAuth();
  const { requestLocation, requestCamera, requestFiles, requestNotifications } = useAppPermissions();

  const hasFeature = (feature) => {
    if (['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(user?.role)) return true;
    const features = user?.company?.package?.features || {};
    return !!features[feature];
  };

  const filteredAdminNav = adminNav.filter(item => {
    if (user?.role === 'SUPER_ADMIN') return true;
    if (user?.role === 'ADMIN_EMPLOYEE') {
      const perms = user.designation?.permissions || {};
      if (item.to === '/admin/companies') return perms.companies;
      if (item.to === '/admin/packages') return perms.packages;
      if (item.to === '/admin/employees') return perms.systemEmployees;
      if (item.to === '/admin/company-staff') return perms.companyStaff;
      if (item.to === '/admin/configuration') return perms.configuration;
    }
    return true;
  });

  const filteredCompanyNav = companyNav.filter(item => {
    if (user?.role === 'COMPANY_OWNER') return true;

    if (item.to === '/company/complaints' && !hasFeature('complaintChat')) return false;
    if (item.to === '/company/sales' && !hasFeature('salesTracking')) return false;
    if (item.to === '/company/inventory' && !hasFeature('inventoryManagement')) return false;
    if (item.to === '/company/distributors' && !hasFeature('vendorManagement')) return false;
    if (item.to === '/company/payroll' && !hasFeature('payrollManagement')) return false;

    if (user?.designation?.permissions) {
      const perms = user.designation.permissions;
      if (item.to === '/company/staff') return perms.staff;
      if (item.to === '/company/tracking') return perms.liveTracking;
      if (item.to === '/company/attendance') return perms.attendance;
      if (item.to === '/company/leaves') return perms.leaves;
      if (item.to === '/company/sales') return perms.salesTracker;
      if (item.to === '/company/inventory') return perms.inventory;
      if (item.to === '/company/distributors') return perms.distributors;
      if (item.to === '/company/payroll') return perms.payroll;
      if (item.to === '/company/complaints') return perms.complaints;
      if (item.to === '/company/reports') return perms.reports;
      if (item.to === '/company/configuration') return perms.configuration;
    }

    return user?.role === 'COMPANY_MANAGER';
  });

  const finalStaffNav = staffNavBase.filter(item => {
    if (item.to === '/staff/complaints' && !hasFeature('complaintChat')) return false;
    if (item.to === '/staff/customers' && !hasFeature('salesTracking')) return false;
    if (item.to === '/staff/sales') {
      if (!hasFeature('salesTracking')) return false;
      // Point 2: Sales Entry available to Sales/Marketing departments if allowed by package
      const dept = (user?.designation?.department?.name || '').toLowerCase();
      if (!dept.includes('sales') && !dept.includes('marketing')) return false;
    }

    // Dashboard, Attendance, Leaves, My Payroll, and Profile are mandatory
    return true;
  });

  // Point 1: Administrative tools appear for ANY staff/manager with explicit permissions
  if (user?.role === 'STAFF' || user?.role === 'COMPANY_MANAGER' || user?.role === 'COMPANY_OWNER') {
    const perms = user?.designation?.permissions;
    if (perms) {
      if (perms.staff) finalStaffNav.push({ to: '/staff/management/staff', label: 'Employee Mgmt', icon: Users });
      if (perms.liveTracking) finalStaffNav.push({ to: '/staff/management/tracking', label: 'Tracking Mgmt', icon: MapPin });
      if (perms.attendance) finalStaffNav.push({ to: '/staff/management/attendance', label: 'Attendance Mgmt', icon: CalendarCheck });
      if (perms.leaves) finalStaffNav.push({ to: '/staff/management/leaves', label: 'Leave Mgmt', icon: CalendarOff });
      if (perms.salesTracker && hasFeature('salesTracking')) finalStaffNav.push({ to: '/staff/management/sales', label: 'Sales Mgmt', icon: TrendingUp });
      if (perms.inventory && hasFeature('inventoryManagement')) finalStaffNav.push({ to: '/staff/management/inventory', label: 'Inventory', icon: Boxes });
      if (perms.distributors && hasFeature('vendorManagement')) finalStaffNav.push({ to: '/staff/management/distributors', label: 'Distributors', icon: Truck });
      if (perms.payroll && hasFeature('payrollManagement')) finalStaffNav.push({ to: '/staff/management/payroll', label: 'Payroll', icon: Wallet });
      if (perms.reports) finalStaffNav.push({ to: '/staff/management/reports', label: 'Reports', icon: FileText });
      if (perms.configuration) finalStaffNav.push({ to: '/staff/management/configuration', label: 'Config', icon: Settings });
    }
  }

  useEffect(() => {
    const initPermissions = async () => {
      await requestLocation();
      await requestCamera();
      await requestFiles();
      await requestNotifications();
    };
    initPermissions();
  }, [requestLocation, requestCamera, requestFiles, requestNotifications]);

  if (loading) return <Spinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={ROLE_HOME[user.role]} /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/change-password" element={user ? <ChangePassword /> : <Navigate to="/login" />} />

      <Route
        path="/admin"
        element={
          <Protected roles={['SUPER_ADMIN', 'ADMIN_EMPLOYEE']}>
            <DashboardLayout title="Super Admin" nav={filteredAdminNav} />
          </Protected>
        }
      >
        <Route index element={<SuperDashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="packages" element={<Packages />} />
        <Route path="employees" element={<SystemEmployees />} />
        <Route path="company-staff" element={<CompanyStaff />} />
        <Route path="configuration" element={<Configuration />} />
        <Route path="configuration/designations" element={<Designations />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route
        path="/company"
        element={
          <Protected roles={['COMPANY_OWNER']}>
            <DashboardLayout title="Company Panel" nav={filteredCompanyNav} />
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
        <Route path="distributors/:id" element={<DistributorDetails />} />
        <Route path="payroll" element={<CompanyPayroll />} />
        <Route path="complaints" element={hasFeature('complaintChat') ? <Complaints /> : <Navigate to="/company" />} />
        <Route path="reports" element={<Reports />} />
        <Route path="configuration" element={<CompanyConfiguration />} />
        <Route path="configuration/designations" element={<CompanyDesignations />} />
        <Route path="configuration/branches" element={<CompanyBranches />} />
        <Route path="configuration/shifts" element={<CompanyShifts />} />
        <Route path="configuration/departments" element={<CompanyDepartments />} />
        <Route path="configuration/leaves" element={<CompanyLeavesConfig />} />
        <Route path="configuration/holidays" element={<HolidayCalendar />} />
        <Route path="settings" element={<CompanySettings />} />
        <Route path="settings/edit" element={<CompanyEditProfile />} />
      </Route>

      <Route
        path="/staff"
        element={
          <Protected roles={['STAFF', 'COMPANY_MANAGER']}>
            <DashboardLayout title="Staff App" nav={finalStaffNav} />
          </Protected>
        }
      >
        <Route index element={<StaffDashboard />} />
        <Route path="attendance" element={<StaffAttendance />} />
        <Route path="leaves" element={<StaffLeaves />} />
        <Route path="customers" element={<StaffCustomers />} />
        <Route path="sales" element={<StaffSales />} />
        <Route path="payroll" element={<StaffPayroll />} />
        <Route path="complaints" element={hasFeature('complaintChat') ? <Complaints /> : <Navigate to="/staff" />} />
        <Route path="profile" element={<StaffProfile />} />
        <Route path="profile/edit" element={<EditProfile />} />

        <Route path="management/staff" element={<StaffList />} />
        <Route path="management/tracking" element={<LiveTracking />} />
        <Route path="management/attendance" element={<AttendancePage />} />
        <Route path="management/leaves" element={<Leaves />} />
        <Route path="management/sales" element={<SalesTracker />} />
        <Route path="management/inventory" element={<InventoryPage />} />
        <Route path="management/distributors" element={<Distributors />} />
        <Route path="management/distributors/:id" element={<DistributorDetails />} />
        <Route path="management/payroll" element={<CompanyPayroll />} />
        <Route path="management/reports" element={<Reports />} />
        <Route path="management/configuration" element={<CompanyConfiguration />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />} />
    </Routes>
  );
}
