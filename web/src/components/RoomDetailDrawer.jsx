import { useEffect, useState } from 'react';
import {
  X,
  Lock,
  Phone,
  FolderOpen,
  Edit,
  Trash2,
  Send,
  Copy,
  Check,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { ROOM_STATUSES, SOURCE_LABELS, STATUS_MAP } from '../utils/constants';
import { formatDateTime, formatPrice } from '../utils/format';
import { copyImageToClipboard } from '../utils/zaloMessage';
import { api } from '../api/client';
import { useToast } from './Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function RoomDetailDrawer({
  room,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onSendZalo,
  onBookTour,
}) {
  const toast = useToast();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedImgId, setCopiedImgId] = useState(null);

  useEscapeKey(onClose, Boolean(room));

  useEffect(() => {
    setActiveImageIndex(0);
  }, [room?.id]);

  if (!room) return null;

  const images = room.images || [];
  const safeIndex = activeImageIndex < images.length ? activeImageIndex : 0;
  const activeImage = images[safeIndex] || null;
  const statusInfo = STATUS_MAP[room.status] || ROOM_STATUSES[0];

  const handleOpenFolder = async () => {
    try {
      await api.openRoomFolder(room.id);
      toast('Đã mở thư mục ảnh trên máy');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleCopyImg = async (img) => {
    try {
      await copyImageToClipboard(img);
      setCopiedImgId(img.id);
      toast('Đã copy ảnh vào clipboard');
      setTimeout(() => setCopiedImgId(null), 1500);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết phòng ${room.code || `#${room.id}`}`}
        className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-slate-900">
                {room.code || `Phòng #${room.id}`}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusInfo.badgeClass}`}
              >
                {statusInfo.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {SOURCE_LABELS[room.source] || room.source}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật lần cuối: {formatDateTime(room.updated_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết phòng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Image Gallery */}
          {images.length > 0 ? (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 aspect-[16/10]">
                <img
                  src={activeImage.url}
                  alt={`Ảnh phòng ${room.code || `#${room.id}`}`}
                  className="w-full h-full object-contain bg-slate-900/5"
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((safeIndex - 1 + images.length) % images.length)
                      }
                      aria-label="Ảnh trước"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/65 hover:bg-slate-900 text-white transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((safeIndex + 1) % images.length)}
                      aria-label="Ảnh tiếp theo"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/65 hover:bg-slate-900 text-white transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-900/70 text-white text-[11px] font-medium tabular-nums">
                      {safeIndex + 1} / {images.length}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleCopyImg(activeImage)}
                  className={`absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors ${
                    copiedImgId === activeImage.id
                      ? 'bg-emerald-600'
                      : 'bg-slate-900/80 hover:bg-slate-900'
                  }`}
                >
                  {copiedImgId === activeImage.id ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedImgId === activeImage.id ? 'Đã copy ảnh' : 'Copy ảnh này'}</span>
                </button>
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      aria-label={`Xem ảnh ${idx + 1}`}
                      className={`w-16 h-16 rounded-lg overflow-hidden border shrink-0 ${
                        idx === safeIndex
                          ? 'border-[#0D6E6E] ring-2 ring-[#0D6E6E]/30'
                          : 'border-slate-200 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              Chưa có ảnh phòng. Bấm "Sửa" để tải ảnh lên.
            </div>
          )}

          {/* Quick Status Switch */}
          <div>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">
              Đổi nhanh trạng thái
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ROOM_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onStatusChange(room.id, s.value)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                    room.status === s.value
                      ? 'border-[#0D6E6E] bg-[#0D6E6E] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Public Info */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold text-[#0D6E6E] tabular-nums">
                {formatPrice(room.price)}
                <span className="text-xs font-normal text-slate-500">/tháng</span>
              </div>
              <div className="text-sm font-medium text-slate-700 tabular-nums">
                {room.room_type} {room.area_m2 ? `• ${room.area_m2} m²` : ''}
              </div>
            </div>

            {onBookTour && (
              <button
                type="button"
                onClick={() => onBookTour(room)}
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Calendar className="w-4 h-4" />
                <span>Đặt lịch xem / Nhận tư vấn phòng này</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 text-sm text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{[room.street, room.district].filter(Boolean).join(', ')}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
              <div>
                <span className="text-slate-400">Tiền cọc:</span>{' '}
                <span className="font-medium text-slate-800 tabular-nums">
                  {formatPrice(room.deposit)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Vào ở:</span>{' '}
                <span className="font-medium text-slate-800">{room.available_from || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Điện:</span>{' '}
                <span className="font-medium text-slate-800">{room.electric_price || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Nước:</span>{' '}
                <span className="font-medium text-slate-800">{room.water_price || '—'}</span>
              </div>
            </div>

            {room.amenities && (
              <div className="text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-400 block mb-0.5">Nội thất & tiện ích:</span>
                <p className="text-slate-800 leading-relaxed">{room.amenities}</p>
              </div>
            )}

            {room.description && (
              <div className="text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-400 block mb-0.5">Mô tả gửi khách:</span>
                <p className="text-slate-800 leading-relaxed whitespace-pre-line">
                  {room.description}
                </p>
              </div>
            )}
          </div>

          {/* Private Info Box */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
              <Lock className="w-3.5 h-3.5" />
              <span>Thông tin mật (chỉ mình bạn thấy)</span>
            </div>
            <div>
              <span className="text-slate-500">Số nhà cụ thể:</span>{' '}
              <span className="font-medium text-slate-900">{room.address || 'Chưa ghi'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Chủ nhà:</span>
              <span className="font-medium text-slate-900">
                {room.landlord_name || 'Chưa gắn chủ nhà'}
              </span>
              {room.landlord_phone && (
                <span className="inline-flex items-center gap-1 font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                  <Phone className="w-3 h-3 text-amber-700" />
                  {room.landlord_phone}
                </span>
              )}
            </div>
            {room.private_note && (
              <div>
                <span className="text-slate-500">Ghi chú riêng:</span>{' '}
                <span className="text-slate-900">{room.private_note}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(room)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Sửa</span>
            </button>
            <button
              type="button"
              onClick={handleOpenFolder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Thư mục ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(room)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-xs font-medium text-rose-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xoá</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onBookTour && (
              <button
                type="button"
                onClick={() => onBookTour(room)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đặt lịch xem</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onSendZalo([room])}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-xs font-medium"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi khách qua Zalo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
