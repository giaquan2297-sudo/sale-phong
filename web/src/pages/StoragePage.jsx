import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Trash2, CheckCircle2, Database, Image as ImageIcon } from 'lucide-react';
import { api } from '../api/client';
import { formatBytes, formatDateTime } from '../utils/format';
import { useToast } from '../components/Toast';

export default function StoragePage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['storage'],
    queryFn: api.getStorage,
  });

  const cleanupMutation = useMutation({
    mutationFn: () => api.runCleanup(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (res.deletedFiles === 0) {
        toast('Không có ảnh cũ nào cần dọn lúc này', 'info');
      } else {
        toast(
          `Đã dọn ${res.deletedFiles} ảnh của ${res.cleanedRooms} phòng, giải phóng ${formatBytes(
            res.freedBytes
          )}`
        );
      }
    },
    onError: (err) => toast(err.message, 'error'),
  });

  if (isLoading || !stats) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-sm text-slate-500">
        Đang kiểm tra dung lượng...
      </div>
    );
  }

  const candidates = stats.cleanup_candidates || [];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Quản lý dung lượng</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Phòng trạng thái "Đã thuê" quá {stats.cleanup_days} ngày sẽ tự động xoá ảnh phụ, luôn giữ lại 1 ảnh đại diện
          </p>
        </div>
        <button
          type="button"
          onClick={() => cleanupMutation.mutate()}
          disabled={cleanupMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          <span>{cleanupMutation.isPending ? 'Đang dọn...' : 'Dọn ảnh cũ ngay'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <HardDrive className="w-4 h-4 text-[#0D6E6E]" />
            <span>Tổng thư mục data/</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatBytes(stats.total_bytes)}
          </div>
          <div className="text-xs text-slate-400">Mục tiêu giữ dưới 1 GB</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <span>Dung lượng ảnh trên máy</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatBytes(stats.images_bytes)}
          </div>
          <div className="text-xs text-slate-400">
            {stats.local_images} ảnh lưu local • {stats.remote_images} link Sheet
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>File SQLite (sale-tro.db)</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatBytes(stats.db_bytes)}
          </div>
          <div className="text-xs text-slate-400">
            {stats.total_rooms} phòng ({stats.available_rooms} đang trống)
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Trash2 className="w-4 h-4 text-amber-600" />
            <span>Có thể giải phóng ngay</span>
          </div>
          <div className="text-2xl font-bold text-amber-700 tabular-nums">
            {formatBytes(stats.reclaimable_bytes)}
          </div>
          <div className="text-xs text-slate-400">
            Từ {candidates.length} phòng đã thuê quá {stats.cleanup_days} ngày
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-xs text-slate-600 uppercase">
          Phòng "Đã thuê" quá {stats.cleanup_days} ngày chờ dọn ảnh phụ
        </div>
        {candidates.length === 0 ? (
          <div className="p-8 text-center space-y-1.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
            <p className="text-sm font-medium text-slate-700">Bộ nhớ đang gọn gàng</p>
            <p className="text-xs text-slate-500">
              Không có phòng "Đã thuê" nào quá {stats.cleanup_days} ngày còn dư ảnh phụ.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <th className="py-2.5 px-4">Phòng</th>
                  <th className="py-2.5 px-4">Ngày đổi sang Đã thuê</th>
                  <th className="py-2.5 px-4">Số ảnh hiện có</th>
                  <th className="py-2.5 px-4 text-right">Dung lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {c.code ? `[${c.code}] ` : ''}
                      {[c.street, c.district].filter(Boolean).join(', ')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTime(c.status_changed_at)}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums">
                      {c.total_images} ảnh (sẽ giữ lại 1 ảnh đại diện)
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatBytes(c.total_bytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
