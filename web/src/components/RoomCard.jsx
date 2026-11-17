import { memo, useState } from 'react';
import {
  Image as ImageIcon,
  CheckSquare,
  Square,
  Calendar,
  Send,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';
import { ROOM_STATUSES, STATUS_MAP } from '../utils/constants';
import { formatPrice } from '../utils/format';

/**
 * RoomCard Component
 * Displays a room preview card in grid layouts with optimized image loading
 * to prevent Cumulative Layout Shift (CLS):
 * - Fixed aspect-ratio container (aspect-[4/3] bg-slate-100)
 * - loading="lazy" and decoding="async" on image
 */
function RoomCard({
  room,
  checked = false,
  onToggleSelect,
  onClick,
  onLeadCapture,
  onSendZalo,
  statusMap = STATUS_MAP,
}) {
  const st = statusMap[room.status] || ROOM_STATUSES[0];
  const [imgError, setImgError] = useState(false);
  const coverUrl = !imgError ? (room.cover_url || room.cover_image || room.images?.[0]?.url) : null;

  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col ${
        checked ? 'border-[#0D6E6E] ring-2 ring-[#0D6E6E]/25' : 'border-slate-200'
      }`}
    >
      {/* Fixed aspect-ratio container to eliminate Cumulative Layout Shift (CLS) */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={room.code ? `Phòng ${room.code}` : [room.street, room.district].filter(Boolean).join(', ') || 'Ảnh phòng'}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}

        {/* Selection toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(room.id, e);
          }}
          aria-label={
            checked
              ? `Bỏ chọn phòng ${room.code || `#${room.id}`}`
              : `Chọn phòng ${room.code || `#${room.id}`}`
          }
          className="absolute top-2.5 left-2.5 p-1 rounded-md bg-white/90 backdrop-blur-xs shadow-xs text-slate-700 hover:bg-white transition-colors z-10 cursor-pointer"
        >
          {checked ? (
            <CheckSquare className="w-4 h-4 text-[#0D6E6E]" />
          ) : (
            <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          )}
        </button>

        {/* Status Badge */}
        <span
          className={`absolute top-2.5 right-2.5 text-[11px] font-medium px-2 py-0.5 rounded-full border shadow-xs z-10 ${st.badgeClass}`}
        >
          {st.label}
        </span>

        {/* Image count */}
        {room.images?.length > 1 && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-xs text-white text-[11px] font-medium tabular-nums z-10">
            {room.images.length} ảnh
          </span>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-bold text-[#0D6E6E] tabular-nums">
              {formatPrice(room.price)}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {room.room_type} {room.area_m2 ? `• ${room.area_m2} m²` : ''}
            </span>
          </div>

          <div className="font-semibold text-sm text-slate-900 mt-0.5 line-clamp-1">
            {room.code ? <span className="text-[#0D6E6E] mr-1">[{room.code}]</span> : null}
            {[room.street, room.district].filter(Boolean).join(', ')}
          </div>

          <p className="text-xs text-slate-500 line-clamp-2 mt-1">
            {room.amenities || room.description || 'Chưa có mô tả'}
          </p>
        </div>

        <div
          className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-1.5 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onLeadCapture?.(room)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
            >
              <Calendar className="w-3 h-3 text-emerald-600" />
              <span>Đặt lịch</span>
            </button>

            {room.sheet_url && (
              <a
                href={room.sheet_url}
                target="_blank"
                rel="noopener noreferrer"
                title="Mở dòng phòng này trên Google Sheet gốc"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-medium transition-colors"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                <span>Sheet gốc</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSendZalo?.(room)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0D6E6E]/10 text-[#0D6E6E] font-medium hover:bg-[#0D6E6E]/20 transition-colors cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Gửi Zalo</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(RoomCard);
