import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('accessToken');

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    
    // Check if route has restricted roles
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        // Redirect unauthorized users to their default dashboard or home
        return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'} replace />;
      }
    }
    
    return <Outlet />;
  } catch (e) {
    // If parsing fails or corrupted, clear and redirect to login
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    return <Navigate to="/login" replace />;
  }
}
