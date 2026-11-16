import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit,
  X,
  KeyRound,
  Upload,
  Copy,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../api/client';
import { HANOI_DISTRICTS } from '../utils/constants';
import { formatDateTime } from '../utils/format';
import { useToast } from '../components/Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';
import QuickAddSheetModal from '../components/QuickAddSheetModal';

const DEFAULT_COLUMN_MAP = {
  code: 'Mã phòng',
  street: 'Đường',
  address: 'Địa chỉ',
  district: 'Quận',
  price: 'Giá',
  deposit: 'Cọc',
  area_m2: 'Diện tích',
  room_type: 'Loại phòng',
  amenities: 'Nội thất',
  electric_price: 'Điện',
  water_price: 'Nước',
  status: 'Trạng thái',
  available_from: 'Ngày trống',
  description: 'Mô tả',
  images: 'Ảnh',
};

const FIELD_LABELS = [
  ['code', 'Mã phòng / Số phòng (định danh dòng) *'],
  ['price', 'Giá thuê *'],
  ['status', 'Trạng thái'],
  ['district', 'Quận'],
  ['street', 'Đường / Phố'],
  ['address', 'Số nhà cụ thể'],
  ['area_m2', 'Diện tích'],
  ['room_type', 'Loại phòng'],
  ['deposit', 'Tiền cọc'],
  ['amenities', 'Nội thất / Tiện ích'],
  ['electric_price', 'Giá điện'],
  ['water_price', 'Giá nước'],
  ['available_from', 'Thời gian vào'],
  ['description', 'Mô tả'],
  ['images', 'Link ảnh'],
];

export default function SheetsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showModal, setShowModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [keyJsonText, setKeyJsonText] = useState('');
  const [editing, setEditing] = useState(null);

  useEscapeKey(() => setShowKeyModal(false), showKeyModal);
  useEscapeKey(() => setShowModal(false), showModal && !showKeyModal);
  const [form, setForm] = useState({
    name: '',
    landlord_id: '',
    spreadsheet_id: '',
    sheet_name: 'Sheet1',
    header_row: 1,
    default_district: 'Cầu Giấy',
    enabled: true,
    column_map: { ...DEFAULT_COLUMN_MAP },
    status_rules: '{}',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sheets'],
    queryFn: api.getSheets,
  });

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords'],
    queryFn: api.getLandlords,
  });

  const auth = data?.auth || {};
  const sources = data?.sources || [];
  const logs = data?.logs || [];

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      landlord_id: '',
      spreadsheet_id: '',
      sheet_name: 'Sheet1',
      header_row: 1,
      default_district: 'Cầu Giấy',
      enabled: true,
      column_map: { ...DEFAULT_COLUMN_MAP },
      status_rules: '{"Hết": "da_thue", "Trống": "trong"}',
    });
    setShowModal(true);
  };

  const openEdit = (s) => {
    let parsedMap = { ...DEFAULT_COLUMN_MAP };
    try {
      parsedMap = { ...DEFAULT_COLUMN_MAP, ...JSON.parse(s.column_map || '{}') };
    } catch {
      // Keep default
    }
    setEditing(s);
    setForm({
      name: s.name || '',
      landlord_id: s.landlord_id ? String(s.landlord_id) : '',
      spreadsheet_id: s.spreadsheet_id || '',
      sheet_name: s.sheet_name || 'Sheet1',
      header_row: s.header_row || 1,
      default_district: s.default_district || '',
      enabled: Boolean(s.enabled),
      column_map: parsedMap,
      status_rules: s.status_rules || '{}',
    });
    setShowModal(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        landlord_id: form.landlord_id ? parseInt(form.landlord_id, 10) : null,
      };
      return editing ? api.updateSheet(editing.id, payload) : api.createSheet(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      setShowModal(false);
      toast(editing ? 'Đã cập nhật nguồn Sheet' : 'Đã thêm nguồn Google Sheet');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const syncOneMutation = useMutation({
    mutationFn: api.syncSheet,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast(`Đồng bộ xong: +${res.added} mới, ${res.updated} cập nhật, ${res.removed} đã hết`);
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      toast(err.message, 'error');
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: api.syncAllSheets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast('Đã hoàn tất đồng bộ tất cả Google Sheet đang bật');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSheet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      toast('Đã xoá cấu hình Sheet');
    },
  });

  const uploadKeyMutation = useMutation({
    mutationFn: api.uploadGoogleKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      setShowKeyModal(false);
      setKeyJsonText('');
      toast('Đã lưu khoá Google Service Account vào data/google-key.json');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: api.deleteGoogleKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      toast('Đã gỡ khoá Service Account');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Đồng bộ Google Sheet</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động đọc bảng hàng của chủ nhà theo chu kỳ, không ghi đè ghi chú riêng của bạn
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/sale_tro_template.csv"
            download="sale_tro_mau_chuan.csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#0D6E6E] text-sm font-semibold shadow-2xs transition-colors"
            title="Tải tệp mẫu bảng hàng Google Sheet chuẩn của Sale Trọ"
          >
            <span>📥 Mẫu Sheet chuẩn</span>
          </a>
          <button
            type="button"
            onClick={() => syncAllMutation.mutate()}
            disabled={sources.length === 0 || syncAllMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Đồng bộ tất cả</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQuickAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Thêm bảng hàng</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm thủ công</span>
          </button>
        </div>
      </div>

      {/* Google Connection Status Banner */}
      <div
        className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
          auth.configured
            ? 'bg-emerald-50/70 border-emerald-200'
            : 'bg-sky-50/80 border-sky-200'
        }`}
      >
        <div className="flex items-start gap-3">
          {auth.configured ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <KeyRound className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs space-y-1">
            {auth.configured ? (
              <>
                <div className="font-semibold text-emerald-900 text-sm">
                  Đã kết nối Google Service Account
                </div>
                <p className="text-emerald-800 flex flex-wrap items-center gap-1.5">
                  <span>Chia sẻ (quyền Xem) Google Sheet của chủ nhà cho email:</span>
                  <code className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 font-mono">
                    {auth.serviceAccountEmail}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(auth.serviceAccountEmail || '');
                      toast('Đã copy email Service Account');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-medium"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </p>
              </>
            ) : (
              <>
                <div className="font-semibold text-sky-950 text-sm">
                  Kết nối Google Sheet: hỗ trợ 2 cách
                </div>
                <p className="text-sky-900 leading-relaxed">
                  <strong>Cách 1 (nhanh nhất, không cần key):</strong> Bật chia sẻ Sheet ở chế độ{' '}
                  <em>"Bất kỳ ai có đường liên kết đều xem được"</em> rồi thêm link Sheet bên dưới.
                  <br />
                  <strong>Cách 2 (Sheet riêng tư):</strong> Tải lên hoặc dán nội dung file{' '}
                  <code className="px-1 py-0.5 rounded bg-white border border-sky-200 font-mono">
                    google-key.json
                  </code>{' '}
                  của Service Account.
                </p>
                {auth.error && <p className="text-rose-700 font-medium">{auth.error}</p>}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800"
          >
            <Upload className="w-3.5 h-3.5 text-[#0D6E6E]" />
            <span>{auth.configured ? 'Đổi google-key.json' : 'Nhập google-key.json'}</span>
          </button>
          {auth.configured && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Gỡ bỏ khoá Google Service Account hiện tại?')) {
                  deleteKeyMutation.mutate();
                }
              }}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-xs font-medium text-rose-600"
            >
              Gỡ khoá
            </button>
          )}
        </div>
      </div>

      {/* Configured Sources */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-xs text-slate-600 uppercase">
          Danh sách Google Sheet ({sources.length})
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Đang tải...</div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 space-y-3">
            <p>Chưa cấu hình Google Sheet nào. Bấm nút bên dưới để kết nối nhanh bảng hàng chủ nhà.</p>
            <button
              type="button"
              onClick={() => setShowQuickAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Thêm bảng hàng ngay</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sources.map((s) => (
              <div
                key={s.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {s.name || `Sheet #${s.id}`}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        s.enabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {s.enabled ? 'Đang bật' : 'Tạm tắt'}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">{s.room_count} phòng</span>
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Tab: {s.sheet_name}</span>
                    {s.landlord_name && <span>Chủ nhà: {s.landlord_name}</span>}
                    {s.default_district && <span>Quận mặc định: {s.default_district}</span>}
                    <span>
                      Đồng bộ cuối:{' '}
                      {s.last_synced_at ? formatDateTime(s.last_synced_at) : 'Chưa chạy'}
                    </span>
                  </div>
                  {s.last_error && (
                    <div className="text-xs text-rose-600 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{s.last_error}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => syncOneMutation.mutate(s.id)}
                    disabled={syncOneMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0D6E6E]/10 hover:bg-[#0D6E6E]/20 text-[#0D6E6E] text-xs font-medium disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Đồng bộ ngay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    aria-label={`Sửa cấu hình Sheet ${s.name || s.spreadsheet_id}`}
                    title="Sửa cấu hình"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Xoá cấu hình Sheet "${s.name || s.spreadsheet_id}"?`)) {
                        deleteMutation.mutate(s.id);
                      }
                    }}
                    aria-label={`Xoá cấu hình Sheet ${s.name || s.spreadsheet_id}`}
                    title="Xoá cấu hình"
                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync Logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-xs text-slate-600 uppercase">
            Lịch sử đồng bộ gần đây
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3">Nguồn</th>
                  <th className="py-2 px-3">Thời gian</th>
                  <th className="py-2 px-3">Thêm mới</th>
                  <th className="py-2 px-3">Cập nhật</th>
                  <th className="py-2 px-3">Báo hết</th>
                  <th className="py-2 px-3">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {log.source_name || log.sheet_name}
                    </td>
                    <td className="py-2 px-3 text-slate-500 tabular-nums">
                      {formatDateTime(log.started_at)}
                    </td>
                    <td className="py-2 px-3 text-emerald-700 font-medium tabular-nums">
                      +{log.added}
                    </td>
                    <td className="py-2 px-3 text-blue-700 font-medium tabular-nums">
                      {log.updated}
                    </td>
                    <td className="py-2 px-3 text-amber-700 font-medium tabular-nums">
                      {log.removed}
                    </td>
                    <td className="py-2 px-3">
                      {log.error ? (
                        <span className="text-rose-600">{log.error}</span>
                      ) : (
                        <span className="text-emerald-600">Thành công</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Sửa cấu hình Google Sheet' : 'Thêm Google Sheet chủ nhà'}
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editing ? 'Sửa cấu hình Google Sheet' : 'Thêm Google Sheet chủ nhà'}
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

            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tên gợi nhớ
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="VD: Bảng hàng Chú Hùng"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Gắn với chủ nhà
                  </label>
                  <select
                    value={form.landlord_id}
                    onChange={(e) => setForm((p) => ({ ...p, landlord_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">-- Không chọn --</option>
                    {landlords.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Link hoặc ID Google Sheet *
                </label>
                <input
                  type="text"
                  required
                  value={form.spreadsheet_id}
                  onChange={(e) => setForm((p) => ({ ...p, spreadsheet_id: e.target.value }))}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tên Tab</label>
                  <input
                    type="text"
                    value={form.sheet_name}
                    onChange={(e) => setForm((p) => ({ ...p, sheet_name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dòng tiêu đề
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.header_row}
                    onChange={(e) => setForm((p) => ({ ...p, header_row: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Quận mặc định
                  </label>
                  <select
                    value={form.default_district}
                    onChange={(e) => setForm((p) => ({ ...p, default_district: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">-- Theo cột Quận --</option>
                    {HANOI_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-700">
                  Ánh xạ tên cột (nhập đúng tên tiêu đề cột trong Sheet hoặc chữ cái cột A, B, C...)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {FIELD_LABELS.map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[11px] text-slate-500 mb-0.5">{label}</label>
                      <input
                        type="text"
                        value={form.column_map[key] || ''}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            column_map: { ...p.column_map, [key]: e.target.value },
                          }))
                        }
                        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Quy tắc trạng thái (JSON)
                </label>
                <input
                  type="text"
                  value={form.status_rules}
                  onChange={(e) => setForm((p) => ({ ...p, status_rules: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                  className="accent-[#0D6E6E]"
                />
                <span>Bật tự động đồng bộ định kỳ cho Sheet này</span>
              </label>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-[#0D6E6E] text-white text-sm font-medium"
              >
                Lưu cấu hình
              </button>
            </div>
          </form>
        </div>
      )}

      {showKeyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nhập khoá Google Service Account"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                Nhập khoá Google Service Account
              </h3>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed">
                <li>
                  Mở{' '}
                  <a
                    href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0D6E6E] underline font-medium"
                  >
                    Google Cloud Console (Sheets API)
                  </a>{' '}
                  và bật API.
                </li>
                <li>Vào IAM &amp; Admin → Service Accounts → tạo tài khoản → Keys → Add Key (JSON).</li>
                <li>Chọn file JSON vừa tải về hoặc dán toàn bộ nội dung vào ô bên dưới:</li>
              </ol>

              <div>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn file .json từ máy</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadKeyMutation.mutate(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Hoặc dán nội dung JSON tại đây:
                </label>
                <textarea
                  rows={6}
                  value={keyJsonText}
                  onChange={(e) => setKeyJsonText(e.target.value)}
                  placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                  className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-[11px] focus:outline-none focus:border-[#0D6E6E]"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={!keyJsonText.trim() || uploadKeyMutation.isPending}
                onClick={() => uploadKeyMutation.mutate(keyJsonText)}
                className="px-4 py-1.5 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium disabled:opacity-50"
              >
                {uploadKeyMutation.isPending ? 'Đang lưu...' : 'Lưu khoá JSON'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickAddModal && (
        <QuickAddSheetModal onClose={() => setShowQuickAddModal(false)} />
      )}
    </div>
  );
}
