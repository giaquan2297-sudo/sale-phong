import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

/**
 * Route wrapper that only allows Admin users.
 * Sale and Guest users are redirected to home with a notification.
 */
export default function AdminRoute({ children }) {
  const { user, isAdmin, isLoading } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      toast('Trang này chỉ dành riêng cho tài khoản Quản trị viên (Admin).');
    }
  }, [isLoading, user, isAdmin, toast]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
