import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Plus,
  Table,
} from 'lucide-react';
import { api } from '../api/client';
import { HANOI_DISTRICTS } from '../utils/constants';
import { useToast } from './Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';

const FIELD_DEFS = [
  { key: 'code', label: 'Mã phòng / Số phòng', desc: 'Định danh duy nhất' },
  { key: 'price', label: 'Giá thuê', desc: 'Giá hàng tháng' },
  { key: 'street', label: 'Đường / Tòa nhà', desc: 'Tên phố hoặc tên tòa' },
  { key: 'address', label: 'Địa chỉ cụ thể', desc: 'Số nhà, ngõ ngách' },
  { key: 'district', label: 'Quận / Huyện', desc: 'Khu vực quận' },
  { key: 'area_m2', label: 'Diện tích (m²)', desc: 'Diện tích phòng' },
  { key: 'room_type', label: 'Loại phòng', desc: 'Studio, khép kín...' },
  { key: 'status', label: 'Trạng thái', desc: 'Trống, đã cọc...' },
  { key: 'deposit', label: 'Tiền cọc', desc: 'Số tiền đặt cọc' },
  { key: 'amenities', label: 'Nội thất / Tiện ích', desc: 'Điều hoà, nóng lạnh...' },
  { key: 'electric_price', label: 'Giá điện', desc: 'đ/số hoặc gói' },
  { key: 'water_price', label: 'Giá nước', desc: 'đ/khối hoặc đầu người' },
  { key: 'available_from', label: 'Ngày trống', desc: 'Thời gian có thể vào ở' },
  { key: 'description', label: 'Mô tả / Dịch vụ', desc: 'Ghi chú chung' },
  { key: 'images', label: 'Link ảnh / Drive', desc: 'URL ảnh hoặc thư mục Drive' },
];

const GOOGLE_SHEET_URL_REGEX = /(?:spreadsheets\/d\/([a-zA-Z0-9-_]+)|^[a-zA-Z0-9-_]{25,}$)/;

export default function QuickAddSheetModal({ onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEscapeKey(onClose);

  const [url, setUrl] = useState('');
  const [lastInspectedUrl, setLastInspectedUrl] = useState('');
  const [inspectedData, setInspectedData] = useState(null);
  const [selectedTab, setSelectedTab] = useState('');
  const [sheetCustomName, setSheetCustomName] = useState('');
  const [defaultDistrict, setDefaultDistrict] = useState('Cầu Giấy');
  const [landlordMode, setLandlordMode] = useState('new'); // 'new' | 'existing'
  const [selectedLandlordId, setSelectedLandlordId] = useState('');
  const [newLandlordName, setNewLandlordName] = useState('');
  const [columnMap, setColumnMap] = useState({});
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);

  const debounceTimerRef = useRef(null);

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords'],
    queryFn: api.getLandlords,
  });

  const inspectMutation = useMutation({
    mutationFn: (payload) => api.inspectSheet(payload),
    onSuccess: (data) => {
      setInspectedData(data);
      setLastInspectedUrl(url.trim());
      if (data.title && !sheetCustomName) {
        setSheetCustomName(data.title);
      }
      if (data.selectedTab) {
        setSelectedTab(data.selectedTab);
      } else if (data.tabs && data.tabs.length > 0) {
        setSelectedTab(data.tabs[0]);
      }
      if (data.columnMap) {
        setColumnMap(data.columnMap);
      }
      if (data.suggestedDistrict && HANOI_DISTRICTS.includes(data.suggestedDistrict)) {
        setDefaultDistrict(data.suggestedDistrict);
      } else if (!defaultDistrict) {
        setDefaultDistrict('Cầu Giấy');
      }
    },
    onError: (err) => {
      toast(err.message || 'Không thể đọc Google Sheet. Hãy kiểm tra lại link hoặc quyền chia sẻ.', 'error');
    },
  });

  const handleInspect = (targetUrl, tabName) => {
    const clean = (targetUrl || url).trim();
    if (!clean) return;
    inspectMutation.mutate({
      url: clean,
      ...(tabName ? { sheet_name: tabName } : {}),
    });
  };

  const handleUrlChange = (newVal) => {
    setUrl(newVal);
    const trimmed = newVal.trim();
    if (trimmed && trimmed !== lastInspectedUrl && GOOGLE_SHEET_URL_REGEX.test(trimmed)) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        handleInspect(trimmed);
      }, 400);
    }
  };

  const handleTabChange = (newTab) => {
    setSelectedTab(newTab);
    handleInspect(url, newTab);
  };

  const quickAddMutation = useMutation({
    mutationFn: (payload) => api.quickAddSheet(payload),
    onSuccess: (res) => {
      const added = res?.syncResult?.added ?? res?.source?.room_count ?? 0;
      const updated = res?.syncResult?.updated ?? 0;
      let msg = `Đã thêm bảng hàng và đồng bộ thành công ${added} phòng!`;
      if (updated > 0) {
        msg += ` (${updated} phòng đã cập nhật)`;
      }
      toast(msg, 'success');
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      onClose();
    },
    onError: (err) => {
      toast(err.message || 'Lỗi khi thêm bảng hàng và đồng bộ', 'error');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      toast('Vui lòng dán link Google Sheet', 'error');
      return;
    }

    const payload = {
      url: url.trim(),
      sheet_name: selectedTab || undefined,
      name: sheetCustomName.trim() || inspectedData?.title || 'Bảng hàng Google Sheet',
      header_row: inspectedData?.headerRow || undefined,
      default_district: defaultDistrict,
      column_map: columnMap,
    };

    if (landlordMode === 'existing' && selectedLandlordId) {
      payload.landlord_id = parseInt(selectedLandlordId, 10);
    } else if (newLandlordName.trim()) {
      payload.landlord_name = newLandlordName.trim();
    }

    quickAddMutation.mutate(payload);
  };

  const detectedEntries = Object.entries(columnMap).filter(([, colName]) => Boolean(colName));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thêm nhanh bảng hàng Google Sheet"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0D6E6E] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                <span>Thêm bảng hàng Google Sheet</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Tự động nhận diện
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉ cần dán link Sheet — hệ thống tự động quét cột, khớp dữ liệu và đồng bộ phòng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Link Google Sheet Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Link Google Sheet của chủ nhà <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  autoFocus
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInspect();
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted) {
                      setUrl(pasted);
                      setTimeout(() => handleInspect(pasted), 100);
                    }
                  }}
                  placeholder="Dán link Google Sheet vào đây (VD: https://docs.google.com/spreadsheets/d/...)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#0D6E6E] focus:ring-2 focus:ring-[#0D6E6E]/15 pr-8 shadow-xs"
                />
                {url && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrl('');
                      setInspectedData(null);
                    }}
                    aria-label="Xoá link"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleInspect()}
                disabled={!url.trim() || inspectMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold disabled:opacity-40 transition-colors shrink-0 flex items-center gap-1.5"
              >
                {inspectMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D6E6E]" />
                    <span>Đang đọc...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#0D6E6E]" />
                    <span>Nhận diện</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Mẹo: Đảm bảo bảng tính đã bật quyền <em>"Bất kỳ ai có đường liên kết đều xem được"</em> hoặc đã chia sẻ email Service Account.
            </p>
          </div>

          {/* Inspection Loading State */}
          {inspectMutation.isPending && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-6 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
              <Loader2 className="w-7 h-7 text-[#0D6E6E] animate-spin" />
              <div>
                <p className="text-sm font-semibold text-[#0D6E6E]">
                  Đang tự động đọc &amp; nhận diện bảng hàng...
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quét cấu trúc bảng, nhận dạng dòng tiêu đề và suy luận cột phòng, giá, địa chỉ
                </p>
              </div>
            </div>
          )}

          {/* Inspection Result Card */}
          {inspectedData && !inspectMutation.isPending && (
            <div className="space-y-4">
              {/* Sheet Title & Tabs */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-xs text-slate-700">Tên bảng tính:</span>
                    <span className="font-bold text-sm text-slate-900">
                      {inspectedData.title || 'Google Sheet'}
                    </span>
                  </div>
                  {inspectedData.spreadsheetId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${inspectedData.spreadsheetId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#0D6E6E] hover:underline"
                    >
                      <span>Mở Sheet gốc</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Tabs selector */}
                {inspectedData.tabs && inspectedData.tabs.length > 1 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                    <span className="text-xs font-medium text-slate-600 shrink-0">Chọn Tab (trang tính):</span>
                    <select
                      value={selectedTab}
                      onChange={(e) => handleTabChange(e.target.value)}
                      aria-label="Chọn tab trang tính"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0D6E6E]"
                    >
                      {inspectedData.tabs.map((tab) => (
                        <option key={tab} value={tab}>
                          {tab}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Auto-detected Column Mapping Pills */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cột đã tự động nhận diện ({detectedEntries.length} trường):</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedMapping((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D6E6E] hover:underline"
                  >
                    <span>{showAdvancedMapping ? 'Thu gọn' : 'Chỉnh sửa ánh xạ cột'}</span>
                    {showAdvancedMapping ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {detectedEntries.length === 0 ? (
                    <span className="text-xs text-amber-700 italic">
                      Chưa tự nhận diện được cột. Vui lòng bấm "Chỉnh sửa ánh xạ cột" để chọn thủ công.
                    </span>
                  ) : (
                    detectedEntries.map(([key, colName]) => {
                      const def = FIELD_DEFS.find((f) => f.key === key);
                      const fieldLabel = def ? def.label.split('/')[0].trim() : key;
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-xs text-slate-800 shadow-2xs font-medium"
                        >
                          <span className="text-emerald-800 font-semibold">{fieldLabel}:</span>
                          <span className="text-slate-600 font-normal">Cột "{colName}"</span>
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Expandable custom mapping editor */}
                {showAdvancedMapping && (
                  <div className="pt-3 border-t border-emerald-200/70 space-y-2">
                    <p className="text-[11px] text-slate-600">
                      Nhập tên cột trong Google Sheet (tiêu đề hàng {inspectedData.headerRow || 1} hoặc chữ cái A, B, C...):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {FIELD_DEFS.map((field) => (
                        <div key={field.key} className="flex items-center gap-2">
                          <label className="text-xs text-slate-700 w-36 shrink-0 truncate" title={field.label}>
                            {field.label}:
                          </label>
                          <input
                            type="text"
                            value={columnMap[field.key] || ''}
                            onChange={(e) =>
                              setColumnMap((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            placeholder="Tên cột trong Sheet..."
                            className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:border-[#0D6E6E]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sample Rows Preview (if available) */}
              {Array.isArray(inspectedData.sampleRows) && inspectedData.sampleRows.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Table className="w-3.5 h-3.5 text-[#0D6E6E]" />
                    <span>Xem trước dữ liệu mẫu ({Math.min(inspectedData.sampleRows.length, 3)} dòng đầu):</span>
                  </div>
                  <div className="overflow-x-auto text-xs text-slate-600">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {inspectedData.sampleRows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="py-1 px-1.5 font-mono text-[11px] text-slate-400 w-6">
                              #{i + 1}
                            </td>
                            <td className="py-1 px-1.5 font-medium text-slate-800">
                              {typeof row === 'object'
                                ? Object.entries(row)
                                    .slice(0, 5)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(' | ')
                                : String(row)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Landlord selection & Default district */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Landlord selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-800">
                      Gắn với chủ nhà
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setLandlordMode('new')}
                        className={`font-medium ${
                          landlordMode === 'new' ? 'text-[#0D6E6E] underline' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        + Tạo mới
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setLandlordMode('existing')}
                        className={`font-medium ${
                          landlordMode === 'existing' ? 'text-[#0D6E6E] underline' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Chọn có sẵn
                      </button>
                    </div>
                  </div>

                  {landlordMode === 'new' ? (
                    <input
                      type="text"
                      value={newLandlordName}
                      onChange={(e) => setNewLandlordName(e.target.value)}
                      placeholder="VD: Chủ nhà Đạt Bee, Chú Hùng..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0D6E6E]"
                    />
                  ) : (
                    <select
                      value={selectedLandlordId}
                      onChange={(e) => setSelectedLandlordId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#0D6E6E]"
                    >
                      <option value="">-- Chọn chủ nhà --</option>
                      {landlords.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} {l.phone ? `(${l.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Default District */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Quận mặc định <span className="text-slate-400 font-normal">(khi dòng thiếu quận)</span>
                  </label>
                  <select
                    value={defaultDistrict}
                    onChange={(e) => setDefaultDistrict(e.target.value)}
                    aria-label="Chọn quận mặc định"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#0D6E6E]"
                  >
                    {HANOI_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sheet Custom Name */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">
                  Tên gợi nhớ cho bảng hàng này:
                </label>
                <input
                  type="text"
                  value={sheetCustomName}
                  onChange={(e) => setSheetCustomName(e.target.value)}
                  placeholder={inspectedData.title || 'VD: Bảng hàng Hoàng Mai'}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-[#0D6E6E]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={quickAddMutation.isPending}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!url.trim() || quickAddMutation.isPending || inspectMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:shadow-none cursor-pointer"
          >
            {quickAddMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang thêm &amp; đồng bộ...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Thêm bảng hàng &amp; Đồng bộ ngay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}