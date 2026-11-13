import { useState } from 'react';
import { X, Lock, User, Phone, ShieldCheck, Briefcase, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function LoginModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const handleQuickLogin = async (username, password, roleLabel) => {
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      toast(`Đăng nhập thành công với vai trò ${roleLabel}!`);
      onClose();
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const u = await login(loginUsername.trim(), loginPassword);
      toast(`Xin chào ${u.name || u.username}!`);
      onClose();
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }
    if (regPassword.length < 4) {
      setError('Mật khẩu tối thiểu 4 ký tự');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const u = await register({
        username: regUsername.trim(),
        password: regPassword,
        name: regName.trim() || regUsername.trim(),
        phone: regPhone.trim(),
      });
      toast(`Đăng ký tài khoản thành công! Xin chào ${u.name || u.username}.`);
      onClose();
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Tên đăng nhập có thể đã tồn tại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Đăng nhập hoặc Đăng ký"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-slate-900 via-slate-800 to-[#0D6E6E] text-white relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-bold text-sm border border-white/20">
              ST
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Sale Trọ Hà Nội</h2>
              <p className="text-xs text-slate-300">Hệ thống phân phối phòng trọ & quản lý hoa hồng</p>
            </div>
          </div>
        </div>

        {/* Quick test buttons */}
        <div className="px-6 pt-4 pb-3 bg-slate-50 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
            <span>⚡ Tài khoản thử nghiệm (1 chạm):</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin('admin', 'admin123', 'Quản trị viên')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-xs active:scale-[0.98]"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">Admin</div>
                <div className="text-[10px] text-emerald-600">admin / admin123</div>
              </div>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin('sale', 'sale123', 'Môi giới')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs active:scale-[0.98]"
            >
              <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">Môi giới</div>
                <div className="text-[10px] text-blue-600">sale / sale123</div>
              </div>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError('');
            }}
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${
              tab === 'login'
                ? 'border-[#0D6E6E] text-[#0D6E6E] bg-slate-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
            }}
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${
              tab === 'register'
                ? 'border-[#0D6E6E] text-[#0D6E6E] bg-slate-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Đăng ký tài khoản
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="admin hoặc sale..."
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Đăng nhập</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên đăng nhập <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="nguyenvana..."
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại / Zalo
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="0912..."
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 4 ký tự..."
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Tạo tài khoản & Đăng nhập</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
