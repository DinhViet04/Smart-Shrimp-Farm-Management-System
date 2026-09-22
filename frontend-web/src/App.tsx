import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import FarmerDashboard from './pages/FarmerDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import FloatingAIChatbox from './components/FloatingAIChatbox';

function App() {
  return (
    <>
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

      {/* Floating Smart Shrimp Farming AI Assistant Sticker */}
      <FloatingAIChatbox />
    </>
  );
}

export default App;
