import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Star, Trash2, Lock, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { HANOI_DISTRICTS, ROOM_STATUSES, ROOM_TYPES } from '../utils/constants';
import { formatBytes, formatPrice } from '../utils/format';
import { compressRoomImage } from '../utils/compressImage';
import { useToast } from './Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';

const EMPTY_FORM = {
  landlord_id: '',
  code: '',
  address: '',
  street: '',
  district: 'Cầu Giấy',
  price: '',
  deposit: '',
  area_m2: '',
  room_type: 'Khép kín',
  amenities: '',
  electric_price: '3.800đ/số',
  water_price: '100k/người',
  status: 'trong',
  available_from: 'Vào ở ngay',
  description: '',
  private_note: '',
};

export default function RoomFormModal({ room, onClose }) {
  const isEdit = Boolean(room?.id);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [compressing, setCompressing] = useState(false);
  const pendingFilesRef = useRef([]);
  pendingFilesRef.current = pendingFiles;

  useEscapeKey(onClose);

  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((pf) => {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      });
    };
  }, []);

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords'],
    queryFn: api.getLandlords,
  });

  useEffect(() => {
    if (room) {
      setForm({
        landlord_id: room.landlord_id ? String(room.landlord_id) : '',
        code: room.code || '',
        address: room.address || '',
        street: room.street || '',
        district: room.district || 'Cầu Giấy',
        price: room.price ? String(room.price) : '',
        deposit: room.deposit ? String(room.deposit) : '',
        area_m2: room.area_m2 ? String(room.area_m2) : '',
        room_type: room.room_type || 'Khép kín',
        amenities: room.amenities || '',
        electric_price: room.electric_price || '',
        water_price: room.water_price || '',
        status: room.status || 'trong',
        available_from: room.available_from || '',
        description: room.description || '',
        private_note: room.private_note || '',
      });
      setImages(room.images || []);
    } else {
      setForm(EMPTY_FORM);
      setImages([]);
    }
    setPendingFiles([]);
  }, [room]);

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        landlord_id: form.landlord_id ? parseInt(form.landlord_id, 10) : null,
        price: parseInt(form.price, 10) || 0,
        deposit: form.deposit ? parseInt(form.deposit, 10) : parseInt(form.price, 10) || 0,
        area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
      };

      const savedRoom = isEdit
        ? await api.updateRoom(room.id, payload)
        : await api.createRoom(payload);

      if (pendingFiles.length > 0) {
        await api.uploadRoomImages(savedRoom.id, pendingFiles);
      }
      return savedRoom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      toast(isEdit ? 'Đã cập nhật thông tin phòng' : 'Đã thêm phòng mới vào bảng hàng');
      onClose();
    },
    onError: (err) => {
      toast(err.message, 'error');
    },
  });

  const handleSelectImages = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    setCompressing(true);
    try {
      const compressedList = [];
      let totalBefore = 0;
      let totalAfter = 0;

      for (const f of fileList) {
        totalBefore += f.size;
        const result = await compressRoomImage(f);
        totalAfter += result.file.size;
        compressedList.push({
          ...result,
          previewUrl: URL.createObjectURL(result.file),
        });
      }

      if (isEdit) {
        const uploaded = await api.uploadRoomImages(room.id, compressedList);
        setImages((prev) => [...prev, ...uploaded]);
        compressedList.forEach((c) => URL.revokeObjectURL(c.previewUrl));
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        queryClient.invalidateQueries({ queryKey: ['storage'] });
        toast(
          `Đã nén & tải lên ${uploaded.length} ảnh (${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)})`
        );
      } else {
        setPendingFiles((prev) => [...prev, ...compressedList]);
        toast(
          `Đã nén ${compressedList.length} ảnh (${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)})`
        );
      }
    } catch (err) {
      toast(`Lỗi nén ảnh: ${err.message}`, 'error');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const handleSetCover = async (imgId) => {
    try {
      await api.setCoverImage(imgId);
      setImages((prev) => prev.map((img) => ({ ...img, is_cover: img.id === imgId ? 1 : 0 })));
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast('Đã đặt làm ảnh đại diện');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteImage = async (imgId) => {
    try {
      await api.deleteImage(imgId);
      setImages((prev) => prev.filter((img) => img.id !== imgId));
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      toast('Đã xoá ảnh');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleRemovePending = (idx) => {
    setPendingFiles((prev) => {
      const target = prev[idx];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.district.trim()) {
      toast('Vui lòng chọn quận', 'error');
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      toast('Vui lòng nhập giá thuê hợp lệ (VND)', 'error');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Sửa phòng ${room.code || `#${room.id}`}` : 'Thêm phòng mới'}
        className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? `Sửa phòng ${room.code || `#${room.id}`}` : 'Thêm phòng mới'}
            </h2>
            <p className="text-xs text-slate-500">
              Ảnh tải lên sẽ tự động nén tối đa 1600px (JPEG 80%) ngay trên trình duyệt
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* Private / Confidential Section */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Thông tin nội bộ (không bao giờ đưa vào tin nhắn Zalo hay giỏ phòng khách xem)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Chủ nhà</label>
                <select
                  value={form.landlord_id}
                  onChange={(e) => setField('landlord_id', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                >
                  <option value="">-- Chưa chọn chủ nhà --</option>
                  {landlords.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.phone ? `(${l.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Số nhà / Ngõ ngách cụ thể
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="VD: Số 18 ngõ 68"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ghi chú riêng cho sale (không bị Google Sheet ghi đè)
              </label>
              <input
                type="text"
                value={form.private_note}
                onChange={(e) => setField('private_note', e.target.value)}
                placeholder="VD: Hoa hồng 50%, gọi trước 30p cô tạp vụ mở cửa"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
          </div>

          {/* Public Room Information */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mã phòng</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setField('code', e.target.value)}
                placeholder="VD: CG-302"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quận *</label>
              <select
                value={form.district}
                onChange={(e) => setField('district', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0D6E6E]"
              >
                {HANOI_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Đường / Phố</label>
              <input
                type="text"
                value={form.street}
                onChange={(e) => setField('street', e.target.value)}
                placeholder="VD: Quan Hoa"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Giá thuê (VND) *{' '}
                {form.price ? (
                  <span className="text-[#0D6E6E] font-semibold">({formatPrice(form.price)})</span>
                ) : null}
              </label>
              <input
                type="number"
                step="100000"
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                placeholder="3500000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tiền cọc (VND){' '}
                {form.deposit ? (
                  <span className="text-slate-500">({formatPrice(form.deposit)})</span>
                ) : null}
              </label>
              <input
                type="number"
                step="100000"
                value={form.deposit}
                onChange={(e) => setField('deposit', e.target.value)}
                placeholder="Mặc định bằng 1 tháng"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Diện tích (m²)</label>
              <input
                type="number"
                step="0.5"
                value={form.area_m2}
                onChange={(e) => setField('area_m2', e.target.value)}
                placeholder="26"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Trạng thái</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0D6E6E]"
              >
                {ROOM_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Loại phòng</label>
              <select
                value={form.room_type}
                onChange={(e) => setField('room_type', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0D6E6E]"
              >
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Giá điện</label>
              <input
                type="text"
                value={form.electric_price}
                onChange={(e) => setField('electric_price', e.target.value)}
                placeholder="3.800đ/số"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Giá nước</label>
              <input
                type="text"
                value={form.water_price}
                onChange={(e) => setField('water_price', e.target.value)}
                placeholder="100k/người"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Thời gian vào ở</label>
              <input
                type="text"
                value={form.available_from}
                onChange={(e) => setField('available_from', e.target.value)}
                placeholder="Vào ở ngay / 01/12"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nội thất & Tiện ích
              </label>
              <input
                type="text"
                value={form.amenities}
                onChange={(e) => setField('amenities', e.target.value)}
                placeholder="Điều hoà, nóng lạnh, giường tủ, thang máy, khoá vân tay..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mô tả gửi khách
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Mô tả vị trí gần trường/chợ, ánh sáng, giờ giấc..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
            />
          </div>

          {/* Images Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Ảnh phòng ({images.length + pendingFiles.length})
              </label>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium cursor-pointer transition-colors">
                {compressing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{compressing ? 'Đang nén ảnh...' : 'Chọn & nén ảnh'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={compressing}
                  onChange={handleSelectImages}
                  className="hidden"
                />
              </label>
            </div>

            {(images.length > 0 || pendingFiles.length > 0) && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`relative group rounded-lg overflow-hidden border aspect-square bg-slate-100 ${
                      img.is_cover ? 'border-[#0D6E6E] ring-2 ring-[#0D6E6E]/30' : 'border-slate-200'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleSetCover(img.id)}
                        title="Đặt làm ảnh đại diện"
                        className={`p-1 rounded ${
                          img.is_cover ? 'text-amber-400' : 'text-white/80 hover:text-amber-300'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        title="Xoá ảnh"
                        className="p-1 rounded text-white/80 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {pendingFiles.map((pf, idx) => (
                  <div
                    key={pf.previewUrl}
                    className="relative rounded-lg overflow-hidden border border-dashed border-[#0D6E6E] aspect-square bg-slate-100"
                  >
                    <img src={pf.previewUrl} alt="" className="w-full h-full object-cover" />
                    <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                      {formatBytes(pf.file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePending(idx)}
                      aria-label="Xoá ảnh chờ tải"
                      className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white hover:text-rose-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saveMutation.isPending || compressing}
            className="px-4 py-2 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Lưu phòng mới'}
          </button>
        </div>
      </div>
    </div>
  );
}
