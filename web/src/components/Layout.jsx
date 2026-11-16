import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Building2,
  Users,
  UserCheck,
  CircleDollarSign,
  FileSpreadsheet,
  HardDrive,
  Settings,
  Smartphone,
  Wifi,
  WifiOff,
  LogIn,
  LogOut,
  ShieldCheck,
  Briefcase,
  User,
  ClipboardList,
} from 'lucide-react';
import { useSSE } from '../hooks/useSSE';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';
import LeadFormShareModal from './LeadFormShareModal';

export default function Layout() {
  const toast = useToast();
  const sseConnected = useSSE(toast);
  const { user, logout, isAdmin, isUser, isGuest, isLoginModalOpen, openLoginModal, closeLoginModal } =
    useAuth();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Determine navigation items based on role
  let navItems = [];
  if (isAdmin) {
    navItems = [
      { to: '/', label: 'Bảng hàng', icon: Building2, end: true },
      { to: '/customers', label: 'Bảng khách hàng', icon: UserCheck },
      { to: '/nhu-cau', label: 'Biểu mẫu gửi khách', icon: ClipboardList },
      { to: '/landlords', label: 'Chủ nhà', icon: Users },
      { to: '/commissions', label: 'Bảng hoa hồng', icon: CircleDollarSign },
      { to: '/sheets', label: 'Google Sheet', icon: FileSpreadsheet },
      { to: '/storage', label: 'Dung lượng', icon: HardDrive },
      { to: '/settings', label: 'Cài đặt', icon: Settings },
    ];
  } else if (isUser) {
    // Tài khoản Sale / Môi giới: CHỈ nhìn thấy Bảng hàng, Bảng khách hàng, Biểu mẫu gửi khách
    navItems = [
      { to: '/', label: 'Bảng hàng', icon: Building2, end: true },
      { to: '/customers', label: 'Bảng khách hàng', icon: UserCheck },
      { to: '/nhu-cau', label: 'Biểu mẫu gửi khách', icon: ClipboardList },
    ];
  } else {
    // Guest
    navItems = [
      { to: '/', label: 'Bảng hàng phòng trống', icon: Building2, end: true },
      { to: '/nhu-cau', label: 'Đăng ký tìm phòng', icon: ClipboardList },
    ];
  }

  const handleLogout = () => {
    logout();
    toast('Đã đăng xuất tài khoản');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F6F7F9] text-[#0F172A]">
      {/* Sidebar on desktop, top bar on mobile */}
      <aside className="md:w-60 md:shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col">
        {/* Top brand header */}
        <div className="px-4 py-3.5 md:py-4 border-b border-slate-100 flex items-center justify-between md:block">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0D6E6E] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
              ST
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-slate-900">Sale Trọ</h1>
              <p className="text-xs text-slate-500">Bảng hàng Hà Nội</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:hidden">
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50 text-[#0D6E6E] hover:bg-teal-100 text-xs font-semibold transition-colors shadow-2xs"
              title="Lấy link gửi khách"
            >
              <span>📋 Lấy link gửi khách</span>
            </button>
            {isGuest ? (
              <button
                type="button"
                onClick={openLoginModal}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0D6E6E] text-white text-xs font-medium"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                    isAdmin
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {isAdmin ? 'Admin' : 'Môi giới'}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="p-1 rounded text-slate-500 hover:text-slate-800"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User Status Bar in Sidebar (Desktop) */}
        <div className="hidden md:block p-3 border-b border-slate-100 bg-slate-50/60">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                    isAdmin ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-slate-900 truncate">
                    {user.name || user.username}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>Quản trị viên</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        <Briefcase className="w-2.5 h-2.5" />
                        <span>Môi giới</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Chế độ xem khách thuê
                </span>
              </div>
              <button
                type="button"
                onClick={openLoginModal}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#0D6E6E] text-white text-xs font-medium hover:bg-[#0A5858] transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập Môi giới</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Lead Form Link Button (Desktop Sidebar) */}
        <div className="hidden md:block p-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-teal-200 bg-teal-50/70 hover:bg-teal-100/80 text-[#0D6E6E] text-xs font-bold transition-colors shadow-2xs"
          >
            <span>📋 Lấy link gửi khách</span>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-visible flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#0D6E6E]/10 text-[#0D6E6E]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom actions & SSE indicator */}
        <div className="hidden md:flex flex-col gap-2 p-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200/70">
            {sseConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span>{sseConnected ? 'Cập nhật trực tiếp (SSE)' : 'Đang kết nối lại...'}</span>
          </div>
          {isAdmin && (
            <NavLink
              to="/settings"
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors font-medium"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>Mở trên điện thoại (Cài đặt)</span>
            </NavLink>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Subtle Guest Banner */}
        {isGuest && (
          <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>
                <strong>Chế độ khách xem phòng:</strong> Đang xem với tư cách Khách tìm phòng. Đăng nhập để sử dụng tính năng môi giới.
              </span>
            </div>
            <button
              type="button"
              onClick={openLoginModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0D6E6E] text-white text-xs font-semibold hover:bg-[#0A5858] transition-colors shadow-xs"
            >
              <LogIn className="w-3 h-3" />
              <span>Đăng nhập ngay</span>
            </button>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </main>

      {/* Lead Form Share Modal */}
      <LeadFormShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Global Login / Register Modal */}
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
    </div>
  );
}
