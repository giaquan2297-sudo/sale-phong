import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Coins,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  ExternalLink,
  MessageCircle,
  Building,
  TrendingUp,
  AlertCircle,
  X,
  User,
} from 'lucide-react';
import { api } from '../api/client';
import { COMMISSION_STATUSES, COMMISSION_STATUS_MAP } from '../utils/constants';
import { formatDateOnly, formatPrice, formatVND } from '../utils/format';
import { useToast } from '../components/Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';
import DealClosingModal from '../components/DealClosingModal';

// Generate list of 12 recent months (e.g. "2026-11", "2026-10", ...)
function getRecentMonths() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `Tháng ${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    months.push({ value: val, label });
  }
  return months;
}

export default function CommissionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedMonth, setSelectedMonth] = useState(''); // '' means all months
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'cho_thu' | 'da_thu' | 'thu_mot_phan'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [editForm, setEditForm] = useState({
    price: '',
    commission_rate: 50,
    commission_amount: '',
    deal_date: '',
    commission_status: 'cho_thu',
    commission_received: 0,
    note: '',
  });

  useEscapeKey(() => setEditingDeal(null), Boolean(editingDeal));

  const recentMonths = useMemo(() => getRecentMonths(), []);

  // Fetch commissions
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions', selectedMonth, selectedStatus, searchQuery],
    queryFn: () =>
      api.getCommissions({
        month: selectedMonth || undefined,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        q: searchQuery.trim() || undefined,
      }),
  });

  // Fetch commission stats
  const { data: serverStats } = useQuery({
    queryKey: ['commission-stats', selectedMonth],
    queryFn: () => api.getCommissionStats({ month: selectedMonth || undefined }),
  });

  // Compute live client stats fallback to ensure 100% reactive & accurate KPI cards
  const stats = useMemo(() => {
    if (serverStats && serverStats.total_deals !== undefined) {
      return serverStats;
    }
    let totalDeals = commissions.length;
    let totalRent = 0;
    let totalComm = 0;
    let receivedComm = 0;

    commissions.forEach((d) => {
      const p = Number(d.price || d.rent_price) || 0;
      const c = Number(d.commission_amount) || 0;
      const st = d.commission_status || d.status;
      const r = Number(d.commission_received || d.received_amount) || (st === 'da_thu' ? c : 0);

      totalRent += p;
      totalComm += c;
      receivedComm += r;
    });

    return {
      total_deals: totalDeals,
      total_rent_value: totalRent,
      total_commission: totalComm,
      received_commission: receivedComm,
      pending_commission: Math.max(0, totalComm - receivedComm),
    };
  }, [serverStats, commissions]);

  // Quick 1-click mark as collected
  const markAsReceivedMutation = useMutation({
    mutationFn: ({ id, amount }) =>
      api.updateCommissionStatus(id, {
        status: 'da_thu',
        commission_status: 'da_thu',
        commission_received: amount,
        received_amount: amount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast('Đã cập nhật trạng thái: Đã nhận đủ hoa hồng!');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  // Delete commission
  const deleteMutation = useMutation({
    mutationFn: api.deleteCommission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast('Đã xoá deal hoa hồng');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  // Update commission form
  const updateMutation = useMutation({
    mutationFn: (payload) => api.updateCommission(editingDeal.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingDeal(null);
      toast('Đã cập nhật thông tin deal hoa hồng');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const openEdit = (deal) => {
    setEditingDeal(deal);
    setEditForm({
      price: String(deal.price || deal.rent_price || 0),
      commission_rate: Number(deal.commission_rate) || 50,
      commission_amount: String(deal.commission_amount || 0),
      deal_date: deal.deal_date || deal.closed_date || '',
      commission_status: deal.commission_status || deal.status || 'cho_thu',
      commission_received: Number(deal.commission_received || deal.received_amount || 0),
      note: deal.note || '',
    });
  };

  const handleEditPriceChange = (val) => {
    const p = Number(val) || 0;
    const calc = Math.round((p * editForm.commission_rate) / 100);
    setEditForm((prev) => ({
      ...prev,
      price: val,
      commission_amount: String(calc),
    }));
  };

  const handleEditRateChange = (r) => {
    const p = Number(editForm.price) || 0;
    const calc = Math.round((p * r) / 100);
    setEditForm((prev) => ({
      ...prev,
      commission_rate: r,
      commission_amount: String(calc),
    }));
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <Coins className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                Bảng Tổng Hợp Hoa Hồng
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Theo dõi các deal thuê đã chốt, doanh số và tiến độ thu hoa hồng môi giới
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Thêm deal chốt</span>
        </button>
      </div>

      {/* Top KPI Cards (5 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Tổng deal đã chốt */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>🎯 Tổng deal đã chốt</span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {stats.total_deals || 0}
            <span className="text-xs font-semibold text-slate-400 ml-1">deal</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {selectedMonth ? `Trong ${selectedMonth}` : 'Toàn thời gian'}
          </div>
        </div>

        {/* 2. Tổng giá trị thuê */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>💵 Tổng giá trị thuê</span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight truncate">
            {formatPrice(stats.total_rent_value || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {formatVND(stats.total_rent_value || 0)}
          </div>
        </div>

        {/* 3. Tổng hoa hồng dự kiến */}
        <div className="bg-white rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/30 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-blue-700 text-xs font-medium">
            <span>💰 Tổng hoa hồng</span>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-900 tracking-tight truncate">
            {formatPrice(stats.total_commission || 0)}
          </div>
          <div className="text-[11px] text-blue-600/80 mt-1 truncate font-medium">
            {formatVND(stats.total_commission || 0)}
          </div>
        </div>

        {/* 4. Đã thực nhận */}
        <div className="bg-white rounded-xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
            <span>✅ Đã thực nhận</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 tracking-tight truncate">
            {formatPrice(stats.received_commission || 0)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 truncate font-medium">
            {formatVND(stats.received_commission || 0)}
          </div>
        </div>

        {/* 5. Còn phải thu */}
        <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/30 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
            <span>⏳ Còn phải thu</span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700 tracking-tight truncate">
            {formatPrice(stats.pending_commission || 0)}
          </div>
          <div className="text-[11px] text-amber-600 mt-1 truncate font-medium">
            {formatVND(stats.pending_commission || 0)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Month selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="">Tất cả các tháng</option>
              {recentMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status selector tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setSelectedStatus('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({commissions.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('cho_thu')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors inline-flex items-center gap-1 ${
                selectedStatus === 'cho_thu'
                  ? 'bg-amber-500 text-white shadow-xs font-semibold'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Chờ thu</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('da_thu')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors inline-flex items-center gap-1 ${
                selectedStatus === 'da_thu'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Đã nhận đủ</span>
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo khách, SĐT, mã phòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#0D6E6E]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Commission Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 whitespace-nowrap">Ngày chốt</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Khách hàng</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Phòng chốt</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Địa chỉ & Tòa nhà</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-right">Giá thuê</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-right">Hoa hồng</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-center">Trạng thái thu</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    Đang tải dữ liệu hoa hồng...
                  </td>
                </tr>
              ) : commissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Coins className="w-6 h-6" />
                    </div>
                    <div className="text-slate-600 font-medium">Chưa có deal hoa hồng nào</div>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto">
                      Khi chốt phòng cho khách hàng hoặc thêm deal mới, các thông tin hoa hồng sẽ tự động tổng hợp tại đây.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Thêm deal chốt đầu tiên</span>
                    </button>
                  </td>
                </tr>
              ) : (
                commissions.map((deal) => {
                  const dealDate = deal.deal_date || deal.closed_date || '';
                  const custName = deal.customer_name || 'Khách vãng lai';
                  const custPhone = deal.customer_zalo || deal.customer_phone || '';
                  const statusKey = deal.commission_status || deal.status || 'cho_thu';
                  const stMeta = COMMISSION_STATUS_MAP[statusKey] || COMMISSION_STATUSES[0];
                  const price = Number(deal.price || deal.rent_price) || 0;
                  const comm = Number(deal.commission_amount) || 0;
                  const rate = deal.commission_rate ? `${deal.commission_rate}%` : '50%';
                  const isReceived = statusKey === 'da_thu';

                  return (
                    <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Ngày chốt */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600">
                        {formatDateOnly(dealDate)}
                      </td>

                      {/* Khách hàng */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-sm">{custName}</div>
                        {custPhone && (
                          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px] mt-0.5">
                            <span>{custPhone}</span>
                            <a
                              href={`https://zalo.me/${custPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              title="Chat Zalo"
                            >
                              <MessageCircle className="w-3.5 h-3.5 inline" />
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Phòng chốt */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-bold">
                          <Building className="w-3 h-3 text-teal-600" />
                          <span>{deal.room_code || 'Phòng'}</span>
                        </span>
                      </td>

                      {/* Địa chỉ & Tòa nhà */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-slate-800 truncate">
                          {deal.building_name || deal.district || 'Hà Nội'}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate">
                          {deal.address || deal.district || '—'}
                        </div>
                      </td>

                      {/* Giá thuê */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-semibold text-slate-800 tabular-nums">
                        {formatVND(price)}
                      </td>

                      {/* Hoa hồng */}
                      <td className="py-3 px-4 whitespace-nowrap text-right tabular-nums">
                        <div className="font-bold text-emerald-700 text-sm">
                          {formatVND(comm)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Tỷ lệ: {rate}
                        </div>
                      </td>

                      {/* Trạng thái thu */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${stMeta.badgeClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isReceived ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span>{stMeta.label}</span>
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-4 whitespace-nowrap text-right space-x-1.5">
                        {/* 1-click Mark Received */}
                        {!isReceived && (
                          <button
                            type="button"
                            onClick={() =>
                              markAsReceivedMutation.mutate({ id: deal.id, amount: comm })
                            }
                            disabled={markAsReceivedMutation.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs shadow-xs transition-colors"
                            title="1-click đánh dấu đã nhận đủ hoa hồng"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã nhận đủ</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openEdit(deal)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          title="Sửa deal"
                          aria-label={`Sửa deal ${deal.room_code || ''}`}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Xoá bản ghi hoa hồng này?')) {
                              deleteMutation.mutate(deal.id);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                          title="Xoá deal"
                          aria-label={`Xoá deal ${deal.room_code || ''}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Deal Modal */}
      <DealClosingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['commissions'] });
          queryClient.invalidateQueries({ queryKey: ['commission-stats'] });
        }}
      />

      {/* Edit Deal Modal */}
      {editingDeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const numPrice = Number(editForm.price) || 0;
              const numComm = Number(editForm.commission_amount) || 0;
              updateMutation.mutate({
                price: numPrice,
                rent_price: numPrice,
                commission_rate: Number(editForm.commission_rate) || 0,
                commission_amount: numComm,
                deal_date: editForm.deal_date,
                closed_date: editForm.deal_date,
                commission_status: editForm.commission_status,
                status: editForm.commission_status,
                commission_received:
                  editForm.commission_status === 'da_thu'
                    ? numComm
                    : Number(editForm.commission_received) || 0,
                note: editForm.note,
              });
            }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden my-auto"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Sửa Deal: {editingDeal.room_code || 'Phòng'} - {editingDeal.customer_name || ''}
                </h3>
                <p className="text-xs text-slate-500">Cập nhật giá thuê, hoa hồng và trạng thái</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDeal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Giá chốt thuê (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={editForm.price}
                    onChange={(e) => handleEditPriceChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums"
                    required
                  />
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    {formatVND(editForm.price)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ngày chốt
                  </label>
                  <input
                    type="date"
                    value={editForm.deal_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, deal_date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    % Hoa hồng
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={editForm.commission_rate}
                    onChange={(e) => handleEditRateChange(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tiền hoa hồng (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={editForm.commission_amount}
                    onChange={(e) => setEditForm((p) => ({ ...p, commission_amount: e.target.value }))}
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-50/40 px-3 py-2 text-sm font-bold tabular-nums text-emerald-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Trạng thái hoa hồng
                </label>
                <select
                  value={editForm.commission_status}
                  onChange={(e) => setEditForm((p) => ({ ...p, commission_status: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-medium"
                >
                  {COMMISSION_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={editForm.note}
                  onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingDeal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs"
              >
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}