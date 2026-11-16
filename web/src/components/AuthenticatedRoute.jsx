import { useAuth } from '../context/AuthContext';
import { LogIn, ShieldAlert } from 'lucide-react';

/**
 * Route wrapper that requires user to be logged in (Admin or Sale).
 * Guests are prompted with a friendly login dialog.
 */
export default function AuthenticatedRoute({ children }) {
  const { user, isLoading, openLoginModal } = useAuth();

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-sm space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Yêu cầu đăng nhập</h2>
            <p className="text-xs text-slate-500 mt-1">
              Bảng quản lý khách hàng chỉ dành cho tài khoản Quản trị viên và Sale.
            </p>
          </div>
          <button
            type="button"
            onClick={openLoginModal}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-semibold shadow-xs transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập ngay</span>
          </button>
        </div>
      </div>
    );
  }

  return children;
}
