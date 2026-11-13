import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Phone, MessageCircle, Edit, Trash2, Building2, X } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function LandlordsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', zalo: '', note: '' });

  useEscapeKey(() => setShowModal(false), showModal);

  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ['landlords'],
    queryFn: api.getLandlords,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', phone: '', zalo: '', note: '' });
    setShowModal(true);
  };

  const openEdit = (l) => {
    setEditing(l);
    setForm({ name: l.name || '', phone: l.phone || '', zalo: l.zalo || '', note: l.note || '' });
    setShowModal(true);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editing ? api.updateLandlord(editing.id, form) : api.createLandlord(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast(editing ? 'Đã cập nhật chủ nhà' : 'Đã thêm chủ nhà mới');
      setShowModal(false);
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteLandlord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast('Đã xoá chủ nhà');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Vui lòng nhập tên chủ nhà', 'error');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Chủ nhà</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Thông tin chủ nhà được lưu cục bộ trên máy, không bao giờ gửi ra ngoài cho khách thuê
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm chủ nhà</span>
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Đang tải danh sách chủ nhà...
        </div>
      ) : landlords.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Chưa có chủ nhà nào. Bấm "Thêm chủ nhà" để bắt đầu.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {landlords.map((l) => (
            <div
              key={l.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{l.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                      {l.phone && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5 text-[#0D6E6E]" />
                          {l.phone}
                        </span>
                      )}
                      {l.zalo && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                          Zalo: {l.zalo}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/?landlord_id=${l.id}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 shrink-0 tabular-nums"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#0D6E6E]" />
                    <span>
                      {l.available_rooms || 0}/{l.total_rooms || 0} phòng trống
                    </span>
                  </button>
                </div>

                {l.note && (
                  <p className="text-xs text-slate-600 bg-amber-50/70 border border-amber-200/80 rounded-lg px-3 py-2">
                    {l.note}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openEdit(l)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Sửa</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Xoá chủ nhà "${l.name}"? Các phòng của chủ nhà này vẫn được giữ lại.`)) {
                      deleteMutation.mutate(l.id);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 hover:bg-rose-50 text-xs font-medium text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xoá</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Sửa thông tin chủ nhà' : 'Thêm chủ nhà mới'}
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                {editing ? 'Sửa thông tin chủ nhà' : 'Thêm chủ nhà mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Đóng"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tên chủ nhà *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="VD: Chú Hùng Cầu Giấy"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="0912..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Zalo</label>
                  <input
                    type="text"
                    value={form.zalo}
                    onChange={(e) => setForm((p) => ({ ...p, zalo: e.target.value }))}
                    placeholder="0912..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ghi chú (hoa hồng, cách dẫn khách, khoá cửa...)
                </label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-[#0D6E6E] text-white text-sm font-medium"
              >
                {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
