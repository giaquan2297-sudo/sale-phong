import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Send,
  LayoutGrid,
  List,
  FolderOpen,
  Image as ImageIcon,
  RotateCcw,
  CheckSquare,
  Square,
  X,
  FileSpreadsheet,
  Calendar,
  ClipboardList,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import {
  HANOI_DISTRICTS,
  ROOM_STATUSES,
  ROOM_TYPES,
  SOURCE_LABELS,
  STATUS_MAP,
} from '../utils/constants';
import { daysAgoText, formatPrice } from '../utils/format';
import { useToast } from '../components/Toast';
import RoomCard from '../components/RoomCard';
import RoomFormModal from '../components/RoomFormModal';
import RoomDetailDrawer from '../components/RoomDetailDrawer';
import ZaloSendModal from '../components/ZaloSendModal';
import QuickAddSheetModal from '../components/QuickAddSheetModal';
import LeadCaptureModal from '../components/LeadCaptureModal';
import LeadFormShareModal from '../components/LeadFormShareModal';

const PRICE_PRESETS = [
  { label: 'Tất cả mức giá', min: '', max: '' },
  { label: 'Dưới 3 tr', min: '', max: '3000000' },
  { label: '3 – 4 tr', min: '3000000', max: '4000000' },
  { label: '4 – 5,5 tr', min: '4000000', max: '5500000' },
  { label: '5,5 – 8 tr', min: '5500000', max: '8000000' },
  { label: 'Trên 8 tr', min: '8000000', max: '' },
];

export default function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [viewMode, setViewMode] = useState('table');
  const [filters, setFilters] = useState({
    search: '',
    district: '',
    status: 'trong,sap_trong',
    room_type: '',
    landlord_id: searchParams.get('landlord_id') || '',
    min_price: '',
    max_price: '',
    sort: 'updated_desc',
  });

  const [selectedIds, setSelectedIds] = useState([]);
  const [editingRoom, setEditingRoom] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [detailRoomId, setDetailRoomId] = useState(null);
  const [zaloRooms, setZaloRooms] = useState(null);
  const [leadCaptureRoom, setLeadCaptureRoom] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const lid = searchParams.get('landlord_id') || '';
    if (lid !== filters.landlord_id) {
      setFilters((prev) => ({ ...prev, landlord_id: lid }));
    }
  }, [searchParams]);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms', filters],
    queryFn: () => api.getRooms(filters),
  });

  const { data: allRoomsSummary = [] } = useQuery({
    queryKey: ['rooms', 'summary'],
    queryFn: () => api.getRooms({}),
  });

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords'],
    queryFn: api.getLandlords,
  });

  const detailRoom = useMemo(
    () => rooms.find((r) => r.id === detailRoomId) || allRoomsSummary.find((r) => r.id === detailRoomId) || null,
    [rooms, allRoomsSummary, detailRoomId]
  );

  const stats = useMemo(() => {
    const counts = { total: allRoomsSummary.length, trong: 0, sap_trong: 0, da_coc: 0, da_thue: 0 };
    for (const r of allRoomsSummary) {
      if (counts[r.status] !== undefined) counts[r.status] += 1;
    }
    return counts;
  }, [allRoomsSummary]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.updateRoomStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      toast('Đã cập nhật trạng thái phòng');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }) => api.bulkUpdateRoomStatus(ids, status),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      setSelectedIds([]);
      const count = res?.updated ?? variables.ids.length;
      const label = STATUS_MAP[variables.status]?.label || variables.status;
      toast(`Đã chuyển ${count} phòng sang "${label}"`);
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteRoom(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      setSelectedIds((prev) => prev.filter((id) => id !== deletedId));
      setDetailRoomId(null);
      toast('Đã xoá phòng');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const selectedRooms = useMemo(
    () => rooms.filter((r) => selectedIds.includes(r.id)),
    [rooms, selectedIds]
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (rooms.length === 0) return;
    const allSelected = rooms.every((r) => selectedIds.includes(r.id));
    setSelectedIds(allSelected ? [] : rooms.map((r) => r.id));
  };

  const handleOpenFolder = async (e, roomId) => {
    e.stopPropagation();
    try {
      const res = await api.openRoomFolder(roomId);
      if (res.downloaded > 0) queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast('Đã mở thư mục ảnh trên máy');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteRoom = (room) => {
    if (window.confirm(`Xoá phòng ${room.code || `#${room.id}`} và toàn bộ ảnh của phòng này?`)) {
      deleteMutation.mutate(room.id);
    }
  };

  const setFilter = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    if (key === 'landlord_id') {
      if (val) setSearchParams({ landlord_id: val });
      else setSearchParams({});
    }
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      district: '',
      status: 'trong,sap_trong',
      room_type: '',
      landlord_id: '',
      min_price: '',
      max_price: '',
      sort: 'updated_desc',
    });
    setSearchParams({});
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Bảng hàng tổng</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
            <span>
              Tổng: <strong className="text-slate-800 tabular-nums">{stats.total}</strong>
            </span>
            <span className="text-emerald-700">
              Còn trống: <strong className="tabular-nums">{stats.trong}</strong>
            </span>
            <span className="text-amber-700">
              Sắp trống: <strong className="tabular-nums">{stats.sap_trong}</strong>
            </span>
            <span className="text-blue-700">
              Đã cọc: <strong className="tabular-nums">{stats.da_coc}</strong>
            </span>
            <span>
              Đã thuê: <strong className="tabular-nums">{stats.da_thue}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              aria-label="Xem dạng bảng"
              className={`p-1.5 rounded-md ${
                viewMode === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Xem dạng bảng"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="Xem dạng thẻ ảnh"
              className={`p-1.5 rounded-md ${
                viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Xem dạng thẻ ảnh"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

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
            onClick={() => setShowShareModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#0D6E6E] text-sm font-semibold shadow-xs transition-colors"
            title="Lấy link biểu mẫu nhu cầu gửi khách"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Biểu mẫu gửi khách</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingRoom(null);
              setShowFormModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm phòng</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="Tìm mã phòng, đường, tiện ích, chủ nhà..."
              aria-label="Tìm kiếm phòng"
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#0D6E6E]"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilter('search', '')}
                aria-label="Xoá từ khoá tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={filters.district}
            onChange={(e) => setFilter('district', e.target.value)}
            aria-label="Lọc theo quận"
            className="lg:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
          >
            <option value="">Tất cả quận</option>
            {HANOI_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={filters.room_type}
            onChange={(e) => setFilter('room_type', e.target.value)}
            aria-label="Lọc theo loại phòng"
            className="lg:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
          >
            <option value="">Tất cả loại phòng</option>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={filters.landlord_id}
            onChange={(e) => setFilter('landlord_id', e.target.value)}
            aria-label="Lọc theo chủ nhà"
            className="lg:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
          >
            <option value="">Tất cả chủ nhà</option>
            {landlords.map((l) => (
              <option key={l.id} value={l.id}>
                Chủ nhà: {l.name}
              </option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value)}
            aria-label="Sắp xếp danh sách phòng"
            className="lg:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
          >
            <option value="updated_desc">Mới cập nhật</option>
            <option value="price_asc">Giá thấp đến cao</option>
            <option value="price_desc">Giá cao đến thấp</option>
            <option value="newest">Mới thêm nhất</option>
          </select>
        </div>

        {/* Price presets + custom min/max inputs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-500">Mức giá:</span>
          {(() => {
            const matchedPreset = PRICE_PRESETS.find(
              (p) => p.min === filters.min_price && p.max === filters.max_price
            );
            const presetVal = matchedPreset
              ? `${matchedPreset.min}|${matchedPreset.max}`
              : 'custom';
            return (
              <select
                value={presetVal}
                onChange={(e) => {
                  if (e.target.value === 'custom') return;
                  const [min, max] = e.target.value.split('|');
                  setFilters((prev) => ({ ...prev, min_price: min, max_price: max }));
                }}
                aria-label="Chọn khoảng giá nhanh"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#0D6E6E]"
              >
                {PRICE_PRESETS.map((p) => (
                  <option key={p.label} value={`${p.min}|${p.max}`}>
                    {p.label}
                  </option>
                ))}
                {presetVal === 'custom' && <option value="custom">Tuỳ chỉnh</option>}
              </select>
            );
          })()}

          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              type="number"
              min="0"
              step="100000"
              value={filters.min_price}
              onChange={(e) => setFilter('min_price', e.target.value)}
              placeholder="Từ (VND)"
              aria-label="Giá thuê tối thiểu (VND)"
              className="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs tabular-nums focus:outline-none focus:border-[#0D6E6E]"
            />
            <span className="text-slate-400 text-xs">–</span>
            <input
              type="number"
              min="0"
              step="100000"
              value={filters.max_price}
              onChange={(e) => setFilter('max_price', e.target.value)}
              placeholder="Đến (VND)"
              aria-label="Giá thuê tối đa (VND)"
              className="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs tabular-nums focus:outline-none focus:border-[#0D6E6E]"
            />
            {(filters.min_price || filters.max_price) && (
              <>
                <span className="text-[11px] font-medium text-[#0D6E6E] bg-[#0D6E6E]/10 px-2 py-0.5 rounded-full tabular-nums">
                  {filters.min_price ? formatPrice(filters.min_price) : '0'} –{' '}
                  {filters.max_price ? formatPrice(filters.max_price) : 'trở lên'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, min_price: '', max_price: '' }))
                  }
                  aria-label="Xoá lọc giá"
                  className="p-1 rounded text-slate-400 hover:text-slate-700"
                  title="Xoá lọc giá"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {filters.min_price &&
              filters.max_price &&
              Number(filters.min_price) > Number(filters.max_price) && (
                <span className="text-[11px] text-amber-700 font-medium">
                  Giá tối thiểu đang lớn hơn giá tối đa
                </span>
              )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { value: 'trong,sap_trong', label: 'Còn & Sắp trống' },
              { value: '', label: 'Tất cả trạng thái' },
              ...ROOM_STATUSES.map((s) => ({ value: s.value, label: s.label })),
            ].map((tab) => (
              <button
                key={tab.value || 'all'}
                type="button"
                onClick={() => setFilter('status', tab.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filters.status === tab.value
                    ? 'bg-[#0D6E6E] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại lọc</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Đang tải bảng hàng...
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700">Không có phòng nào khớp bộ lọc</p>
          <p className="text-xs text-slate-500">
            Thử đổi trạng thái sang "Tất cả trạng thái" hoặc bấm "Thêm phòng" để nhập phòng mới.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 pl-3 pr-2 w-9">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      aria-label="Chọn hoặc bỏ chọn tất cả phòng"
                      className="text-slate-400 hover:text-[#0D6E6E]"
                      title="Chọn / bỏ chọn tất cả"
                    >
                      {rooms.length > 0 && rooms.every((r) => selectedIds.includes(r.id)) ? (
                        <CheckSquare className="w-4 h-4 text-[#0D6E6E]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-2 w-14">Ảnh</th>
                  <th className="py-2.5 px-3">Phòng & Khu vực</th>
                  <th className="py-2.5 px-3">Giá thuê</th>
                  <th className="py-2.5 px-3">Loại / DT</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3">Chủ nhà / Cập nhật</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rooms.map((room) => {
                  const checked = selectedIds.includes(room.id);
                  const st = STATUS_MAP[room.status] || ROOM_STATUSES[0];
                  return (
                    <tr
                      key={room.id}
                      onClick={() => setDetailRoomId(room.id)}
                      className={`cursor-pointer transition-colors ${
                        checked ? 'bg-[#0D6E6E]/5' : 'hover:bg-slate-50/90'
                      }`}
                    >
                      <td
                        className="py-2.5 pl-3 pr-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(room.id);
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(room.id);
                          }}
                          aria-label={
                            checked
                              ? `Bỏ chọn phòng ${room.code || `#${room.id}`}`
                              : `Chọn phòng ${room.code || `#${room.id}`}`
                          }
                          className="flex items-center justify-center rounded"
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-[#0D6E6E]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-2">
                        {room.cover_url || room.cover_image || room.images?.[0]?.url ? (
                          <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                            <img
                              src={room.cover_url || room.cover_image || room.images?.[0]?.url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                              className="w-full h-full object-cover"
                            />
                            {room.images?.length > 1 && (
                              <span className="absolute bottom-0 right-0 px-1 text-[10px] font-medium bg-black/65 text-white rounded-tl">
                                {room.images.length}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 flex items-center flex-wrap gap-1">
                          {room.code ? <span className="text-[#0D6E6E] mr-1">[{room.code}]</span> : null}
                          <span>{[room.street, room.district].filter(Boolean).join(', ')}</span>
                          {room.sheet_url && (
                            <a
                              href={room.sheet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Xem trực tiếp trên Google Sheet"
                              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-colors"
                            >
                              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                              <span>Sheet</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-1">
                          {room.amenities || room.description || 'Chưa có mô tả tiện ích'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-[#0D6E6E] tabular-nums">
                          {formatPrice(room.price)}
                        </div>
                        {room.available_from && (
                          <div className="text-[11px] text-slate-400">{room.available_from}</div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-800">{room.room_type}</div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {room.area_m2 ? `${room.area_m2} m²` : '—'}
                        </div>
                      </td>

                      <td
                        className="py-2.5 px-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={room.status}
                          onChange={(e) =>
                            statusMutation.mutate({ id: room.id, status: e.target.value })
                          }
                          aria-label={`Trạng thái phòng ${room.code || `#${room.id}`}`}
                          className={`text-xs font-medium px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${st.badgeClass}`}
                        >
                          {ROOM_STATUSES.map((s) => (
                            <option key={s.value} value={s.value} className="bg-white text-slate-800">
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-700">
                          {room.landlord_name || '—'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {SOURCE_LABELS[room.source] || room.source} • {daysAgoText(room.updated_at)}
                        </div>
                      </td>

                      <td
                        className="py-2.5 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setLeadCaptureRoom(room)}
                            title="Đặt lịch xem / Nhận tư vấn"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-medium"
                          >
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đặt lịch</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenFolder(e, room.id)}
                            title="Mở thư mục ảnh"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setZaloRooms([room])}
                            title="Gửi phòng này qua Zalo"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0D6E6E]/10 hover:bg-[#0D6E6E]/20 text-[#0D6E6E] text-xs font-medium"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Gửi</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              checked={selectedIds.includes(room.id)}
              onToggleSelect={toggleSelect}
              onClick={() => setDetailRoomId(room.id)}
              onLeadCapture={setLeadCaptureRoom}
              onSendZalo={(r) => setZaloRooms([r])}
            />
          ))}
        </div>
      )}

      {/* Floating Multi-Select Action Dock */}
      {selectedRooms.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-1.5rem)] bg-slate-900 text-white px-3.5 sm:px-4 py-2.5 rounded-xl shadow-xl flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 border border-slate-700">
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
            Đã chọn{' '}
            <strong className="text-emerald-400 tabular-nums">{selectedRooms.length}</strong> phòng
          </span>

          <select
            value=""
            disabled={bulkStatusMutation.isPending}
            onChange={(e) => {
              const nextStatus = e.target.value;
              if (!nextStatus) return;
              bulkStatusMutation.mutate({
                ids: selectedRooms.map((r) => r.id),
                status: nextStatus,
              });
            }}
            aria-label="Đổi trạng thái hàng loạt"
            className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1.5 text-xs font-medium cursor-pointer focus:outline-none disabled:opacity-50"
          >
            <option value="">
              {bulkStatusMutation.isPending ? 'Đang cập nhật...' : 'Đổi trạng thái...'}
            </option>
            {ROOM_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setZaloRooms(selectedRooms)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0D6E6E] hover:bg-[#0f8080] text-white text-xs font-semibold whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi khách qua Zalo</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            aria-label="Bỏ chọn tất cả"
            className="p-1 rounded-md text-slate-400 hover:text-white"
            title="Bỏ chọn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals & Drawer */}
      {showFormModal && (
        <RoomFormModal
          room={editingRoom}
          onClose={() => {
            setShowFormModal(false);
            setEditingRoom(null);
          }}
        />
      )}

      {detailRoom && (
        <RoomDetailDrawer
          room={detailRoom}
          onClose={() => setDetailRoomId(null)}
          onEdit={(r) => {
            setDetailRoomId(null);
            setEditingRoom(r);
            setShowFormModal(true);
          }}
          onDelete={handleDeleteRoom}
          onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
          onSendZalo={(roomList) => setZaloRooms(roomList)}
          onBookTour={(r) => setLeadCaptureRoom(r)}
        />
      )}

      {zaloRooms && (
        <ZaloSendModal rooms={zaloRooms} onClose={() => setZaloRooms(null)} />
      )}

      {showQuickAddModal && (
        <QuickAddSheetModal onClose={() => setShowQuickAddModal(false)} />
      )}

      {leadCaptureRoom && (
        <LeadCaptureModal
          isOpen={Boolean(leadCaptureRoom)}
          onClose={() => setLeadCaptureRoom(null)}
          room={leadCaptureRoom}
        />
      )}

      {showShareModal && (
        <LeadFormShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
