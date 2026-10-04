import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const FarmerDashboard = lazy(() => import('./pages/FarmerDashboard'));
const TechnicianDashboard = lazy(() => import('./pages/TechnicianDashboard'));
const FloatingAIChatbox = lazy(() => import('./components/FloatingAIChatbox'));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
    </div>
  );
}

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected Routes for Admin */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>

        {/* Protected Routes for Standard Users (Manager) */}
        <Route element={<ProtectedRoute allowedRoles={['FARM_MANAGER']} />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Protected Routes for Technician */}
        <Route element={<ProtectedRoute allowedRoles={['TECHNICIAN']} />}>
          <Route path="/technician/dashboard" element={<TechnicianDashboard />} />
        </Route>

        {/* Protected Routes for Farmer */}
        <Route element={<ProtectedRoute allowedRoles={['FARMER']} />}>
          <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
        </Route>
        </Routes>
      </Suspense>

      {/* Floating Smart Shrimp Farming AI Assistant Sticker */}
      <Suspense fallback={null}>
        <FloatingAIChatbox />
      </Suspense>
    </>
  );
}

export default App;
