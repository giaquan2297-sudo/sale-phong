import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Home,
  Copy,
  Check,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Calendar,
} from 'lucide-react';
import { api } from '../api/client';
import { STATUS_MAP } from '../utils/constants';
import { formatPrice } from '../utils/format';
import { useEscapeKey } from '../hooks/useEscapeKey';
import LeadCaptureModal from '../components/LeadCaptureModal';

export default function PublicCartPage() {
  const { slug } = useParams();
  const [copiedCode, setCopiedCode] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { room, index }
  const [leadRoom, setLeadRoom] = useState(null);

  useEscapeKey(() => setLightbox(null), Boolean(lightbox));

  useEffect(() => {
    if (!lightbox) return undefined;
    const total = lightbox.room.images?.length || 0;
    if (total <= 1) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setLightbox((prev) =>
          prev ? { ...prev, index: (prev.index - 1 + total) % total } : null
        );
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setLightbox((prev) => (prev ? { ...prev, index: (prev.index + 1) % total } : null));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-cart', slug],
    queryFn: () => api.getPublicCart(slug),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center text-sm text-slate-500">
        Đang tải danh sách phòng...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md text-center space-y-2">
          <h1 className="font-bold text-lg text-slate-900">Không tìm thấy giỏ phòng</h1>
          <p className="text-sm text-slate-500">
            {error?.message || 'Link giỏ phòng không tồn tại hoặc đã hết hạn.'}
          </p>
        </div>
      </div>
    );
  }

  const copyRoomCode = async (room) => {
    const label = room.code || `${room.street}, ${room.district} (${formatPrice(room.price)})`;
    try {
      await navigator.clipboard.writeText(`Mình quan tâm phòng ${label}`);
      setCopiedCode(room.id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const openPhoto = (room, index) => {
    if (!room.images?.length) return;
    setLightbox({ room, index });
  };

  const lightboxImages = lightbox?.room?.images || [];
  const lightboxImg = lightboxImages[lightbox?.index] || null;

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#0F172A]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3.5 sm:py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0D6E6E] text-white flex items-center justify-center shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg text-slate-900 truncate">
                {data.title}
              </h1>
              <p className="text-xs text-slate-500">
                <span className="tabular-nums font-medium text-slate-700">
                  {data.rooms.length}
                </span>{' '}
                phòng chọn lọc • Nhắn lại mã phòng qua Zalo để hẹn lịch xem trực tiếp
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5">
        {data.note && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed">
            {data.note}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {data.rooms.map((room) => {
            const st = STATUS_MAP[room.status];
            const images = room.images || [];
            const areaText = room.area_m2 ? `${room.area_m2} m²` : '';

            return (
              <article
                key={room.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-xs"
              >
                {images.length > 0 ? (
                  <div className="relative grid grid-cols-2 gap-0.5 bg-slate-100 h-48 sm:h-56 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => openPhoto(room, 0)}
                      aria-label={`Xem ảnh lớn 1 của phòng ${room.code || room.room_type}`}
                      className={`relative group overflow-hidden h-full w-full text-left cursor-zoom-in ${
                        images.length === 1 ? 'col-span-2' : ''
                      }`}
                    >
                      <img
                        src={images[0].url}
                        alt={`Ảnh 1 phòng ${room.code || room.room_type}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                      />
                      <span className="absolute bottom-2 left-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="w-3.5 h-3.5" />
                      </span>
                    </button>

                    {images.length > 1 && (
                      <div className="grid grid-rows-2 gap-0.5 h-48 sm:h-56">
                        <button
                          type="button"
                          onClick={() => openPhoto(room, 1)}
                          aria-label={`Xem ảnh lớn 2 của phòng ${room.code || room.room_type}`}
                          className="relative group overflow-hidden w-full h-full cursor-zoom-in"
                        >
                          <img
                            src={images[1].url}
                            alt={`Ảnh 2 phòng ${room.code || room.room_type}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                          />
                        </button>

                        {images[2] ? (
                          <button
                            type="button"
                            onClick={() => openPhoto(room, 2)}
                            aria-label={`Xem toàn bộ ${images.length} ảnh phòng ${room.code || room.room_type}`}
                            className="relative group overflow-hidden w-full h-full cursor-zoom-in"
                          >
                            <img
                              src={images[2].url}
                              alt={`Ảnh 3 phòng ${room.code || room.room_type}`}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                            />
                            {images.length > 3 && (
                              <div className="absolute inset-0 bg-black/55 group-hover:bg-black/65 transition-colors text-white font-semibold text-sm flex items-center justify-center tabular-nums">
                                +{images.length - 3} ảnh
                              </div>
                            )}
                          </button>
                        ) : (
                          <div className="bg-slate-200" />
                        )}
                      </div>
                    )}

                    <span className="pointer-events-none absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-medium tabular-nums">
                      {images.length} ảnh
                    </span>
                  </div>
                ) : (
                  <div className="h-44 bg-slate-100 flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xl font-bold text-[#0D6E6E] tabular-nums">
                          {formatPrice(room.price)}
                          <span className="text-xs font-normal text-slate-500">/tháng</span>
                        </div>
                        <h2 className="font-semibold text-base text-slate-900 tabular-nums">
                          {room.code ? `[${room.code}] ` : ''}
                          {room.room_type} {areaText ? `• ${areaText}` : ''}
                        </h2>
                      </div>
                      {st && (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-medium shrink-0 ${st.badgeClass}`}
                        >
                          {st.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{[room.street, room.district].filter(Boolean).join(', ')}</span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                      {(room.deposit || room.available_from) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                          {room.deposit > 0 && (
                            <span>
                              <strong>Tiền cọc:</strong>{' '}
                              {room.deposit === room.price ? 'Cọc 1 tháng' : formatPrice(room.deposit)}
                            </span>
                          )}
                          {room.available_from && (
                            <span>
                              <strong>Vào ở:</strong> {room.available_from}
                            </span>
                          )}
                        </div>
                      )}
                      {(room.electric_price || room.water_price) && (
                        <div>
                          <strong>Dịch vụ:</strong>{' '}
                          {[
                            room.electric_price ? `Điện ${room.electric_price}` : '',
                            room.water_price ? `Nước ${room.water_price}` : '',
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                      )}
                      {room.amenities && (
                        <div>
                          <strong>Tiện ích:</strong> {room.amenities}
                        </div>
                      )}
                      {room.description && (
                        <p className="text-slate-600 leading-relaxed pt-1 whitespace-pre-line">
                          {room.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLeadRoom(room)}
                      className="w-full py-2.5 px-3 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Tôi quan tâm phòng này (Đặt lịch xem)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copyRoomCode(room)}
                      className={`w-full py-2 px-3 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                        copiedCode === room.id
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {copiedCode === room.id ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Đã copy mã phòng — gửi qua Zalo</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 shrink-0" />
                          <span>Sao chép mã phòng</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {/* Fullscreen Photo Lightbox */}
      {lightbox && lightboxImg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phòng kích thước đầy đủ"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightbox(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/90 flex flex-col justify-between p-3 sm:p-6"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 text-white">
            <div className="min-w-0">
              <div className="font-semibold text-sm sm:text-base truncate">
                {lightbox.room.code ? `[${lightbox.room.code}] ` : ''}
                {lightbox.room.room_type} —{' '}
                {[lightbox.room.street, lightbox.room.district].filter(Boolean).join(', ')}
              </div>
              <div className="text-xs text-slate-300 tabular-nums">
                {formatPrice(lightbox.room.price)}/tháng • Ảnh {lightbox.index + 1} /{' '}
                {lightboxImages.length}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Đóng xem ảnh"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Image */}
          <div
            className="relative flex-1 flex items-center justify-center my-3 min-h-0"
            onClick={(e) => {
              if (e.target === e.currentTarget) setLightbox(null);
            }}
          >
            {lightboxImages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightbox((prev) =>
                    prev
                      ? {
                          ...prev,
                          index:
                            (prev.index - 1 + lightboxImages.length) % lightboxImages.length,
                        }
                      : null
                  )
                }
                aria-label="Ảnh trước"
                className="absolute left-1 sm:left-3 z-10 p-2.5 sm:p-3 rounded-full bg-black/55 hover:bg-black/80 text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            <img
              src={lightboxImg.url}
              alt={`Ảnh ${lightbox.index + 1} phòng ${lightbox.room.code || lightbox.room.room_type}`}
              className="max-h-full max-w-full object-contain rounded-lg select-none"
            />

            {lightboxImages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightbox((prev) =>
                    prev
                      ? { ...prev, index: (prev.index + 1) % lightboxImages.length }
                      : null
                  )
                }
                aria-label="Ảnh tiếp theo"
                className="absolute right-1 sm:right-3 z-10 p-2.5 sm:p-3 rounded-full bg-black/55 hover:bg-black/80 text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>

          {/* Thumbnail strip */}
          {lightboxImages.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
              {lightboxImages.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightbox((prev) => (prev ? { ...prev, index: idx } : null))}
                  aria-label={`Chuyển sang ảnh ${idx + 1}`}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-opacity ${
                    idx === lightbox.index
                      ? 'border-emerald-400 opacity-100'
                      : 'border-transparent opacity-55 hover:opacity-90'
                  }`}
                >
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {leadRoom && (
        <LeadCaptureModal
          isOpen={Boolean(leadRoom)}
          onClose={() => setLeadRoom(null)}
          room={leadRoom}
        />
      )}
    </div>
  );
}
