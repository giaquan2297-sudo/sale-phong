import { useState } from 'react';
import {
  X,
  Building2,
  Calendar,
  Phone,
  User,
  FileText,
  CheckCircle2,
  Loader2,
  DollarSign,
  MapPin,
  Clock,
} from 'lucide-react';
import { api } from '../api/client';
import { formatPrice } from '../utils/format';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function LeadCaptureModal({ isOpen, onClose, room }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const roomCode = room?.code || (room?.id ? `Phòng #${room.id}` : '');
  const roomAddress = [room?.street, room?.district].filter(Boolean).join(', ');
  const roomPrice = room?.price ? formatPrice(room.price) : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập họ và tên của bạn');
      return;
    }
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại hoặc Zalo để liên hệ');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.submitPublicLead({
        name: name.trim(),
        phone: phone.trim(),
        move_in_date: moveInDate.trim(),
        budget: room?.price || null,
        note: note.trim(),
        room_id: room?.id || null,
        room_code: room?.code || '',
        address: roomAddress,
        district: room?.district || '',
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Không thể gửi thông tin. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing after success
    if (success) {
      setName('');
      setPhone('');
      setMoveInDate('');
      setNote('');
      setSuccess(false);
      setError('');
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Đặt lịch xem phòng / Nhận tư vấn"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0D6E6E] to-[#148383] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Đặt lịch xem / Nhận tư vấn</h3>
              <p className="text-xs text-emerald-100">Miễn phí 100% dẫn xem và hỗ trợ thuê phòng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Info Badge */}
        {room && (
          <div className="px-6 py-3 bg-emerald-50/70 border-b border-emerald-100/80 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <div className="font-semibold text-emerald-950 flex items-center gap-1.5 truncate">
                <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>{roomCode ? `[${roomCode}]` : 'Phòng đang chọn'}</span>
                {room.room_type && (
                  <span className="text-emerald-700 font-normal">({room.room_type})</span>
                )}
              </div>
              {roomAddress && (
                <div className="text-emerald-700 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{roomAddress}</span>
                </div>
              )}
            </div>
            {roomPrice && (
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-500">Giá thuê</div>
                <div className="font-bold text-sm text-[#0D6E6E]">{roomPrice}/th</div>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-lg text-slate-900">Đã nhận thông tin thành công!</h4>
                <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Môi giới phụ trách sẽ liên hệ qua Zalo/SĐT trong <strong>5-10 phút</strong> để hỗ trợ bạn xem phòng và giải đáp thắc mắc.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-[#0D6E6E] text-white font-semibold text-sm hover:bg-[#0A5858] transition-colors shadow-xs"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Họ và tên của bạn <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ví dụ: Hoàng Minh"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Số điện thoại / Zalo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="0987 654 321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ngày dự kiến dọn vào
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ví dụ: Đầu tháng tới, hoặc 15/12..."
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nhu cầu bổ sung / Ghi chú cho môi giới
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    placeholder="Ví dụ: Muốn xem phòng vào 18h tối, có chỗ để 2 xe máy, nuôi mèo..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Gửi yêu cầu hẹn xem</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
