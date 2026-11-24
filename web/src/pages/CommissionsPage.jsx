import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Coins,
  Calendar,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  Edit,
  ExternalLink,
  MessageCircle,
  Building,
  X,
  RefreshCw,
  FileSpreadsheet,
  Copy,
  Check,
  Link2,
} from 'lucide-react';
import { api } from '../api/client';
import { COMMISSION_STATUSES, COMMISSION_STATUS_MAP } from '../utils/constants';
import { formatDateOnly, formatPrice, formatVND } from '../utils/format';
import { useToast } from '../components/Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';
import DealClosingModal from '../components/DealClosingModal';

const DEFAULT_SHEET_ID = '1rKFwKPXMBwN5vvt-gUiCgHTzuRmlN7LiF7VGYNf8gCI';
const HIEN_CTV_GID = '153848228';

const APPS_SCRIPT_CODE = `function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.openById(payload.spreadsheetId || '${DEFAULT_SHEET_ID}');
  var sheet = ss.getSheetByName('Hoa hồng Hiền ctv');
  var action = payload.action || 'create';
  var rowVals = payload.rowValues || [];
  var targetRow = payload.sheetRow ? Number(payload.sheetRow) : 0;

  if (!targetRow || action === 'create') {
    var colA = sheet.getRange('A1:A500').getValues();
    targetRow = 2;
    for (var i = 1; i < colA.length; i++) {
      if (String(colA[i][0] || '').trim() !== '') {
        targetRow = i + 2;
      }
    }
  }

  if (action === 'delete' && targetRow >= 2) {
    sheet.getRange(targetRow, 1, 1, 5).clearContent();
    sheet.getRange(targetRow, 8, 1, 4).clearContent();
  } else if (rowVals.length > 0 && targetRow >= 2) {
    for (var c = 0; c < rowVals.length; c++) {
      var cell = sheet.getRange(targetRow, c + 1);
      if (cell.getFormula()) continue;
      var val = rowVals[c];
      if (val === 'TRUE' || val === true) val = true;
      else if (val === 'FALSE' || val === false) val = false;
      cell.setValue(val);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true, row: targetRow }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

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

function getMonthBadge(dealDate) {
  if (!dealDate) return '—';
  const m = String(dealDate).match(/^(\d{4})-(\d{2})/);
  if (m) return `Tháng ${m[2]}/${m[1]}`;
  return dealDate;
}

export default function CommissionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [webhookInput, setWebhookInput] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    source_name: '',
    price: '',
    commission_rate: 10,
    commission_amount: '',
    deal_date: '',
    move_in_date: '',
    commission_status: 'cho_thu',
    commission_received: 0,
    payment_date: '',
    note: '',
  });

  useEscapeKey(() => setEditingDeal(null), Boolean(editingDeal));
  useEscapeKey(() => setShowSheetModal(false), showSheetModal);

  const recentMonths = useMemo(() => getRecentMonths(), []);

  // Fetch sheet config
  const { data: sheetConfig } = useQuery({
    queryKey: ['commission-sheet-config'],
    queryFn: () => api.getCommissionSheetConfig(),
  });

  useEffect(() => {
    if (sheetConfig?.webhook_url !== undefined) {
      setWebhookInput(sheetConfig.webhook_url || '');
    }
  }, [sheetConfig]);

  // Fetch commissions from Hoa hồng Hiền ctv
  const { data: allCommissions = [], isLoading } = useQuery({
    queryKey: ['commissions', selectedMonth],
    queryFn: () =>
      api.getCommissions({
        month: selectedMonth || undefined,
      }),
  });

  const commissions = useMemo(() => {
    return allCommissions.filter((d) => {
      const st = d.commission_status || d.status || 'cho_thu';
      if (selectedStatus !== 'all' && st !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hay = [
          d.customer_name,
          d.customer_phone,
          d.source_name,
          d.room_code,
          d.address,
          d.district,
          d.note,
          d.payment_date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allCommissions, selectedStatus, searchQuery]);

  // Compute live stats matching Hoa hồng Hiền ctv
  const stats = useMemo(() => {
    let totalDeals = allCommissions.length;
    let totalRent = 0;
    let totalComm = 0;
    let receivedComm = 0;

    allCommissions.forEach((d) => {
      const p = Number(d.price || d.rent_price) || 0;
      const c = Number(d.commission_amount) || 0;
      const st = d.commission_status || d.status;
      const r = st === 'da_thu' ? c : Number(d.commission_received || d.received_amount) || 0;

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
  }, [allCommissions]);

  // Sync from Google Sheet
  const syncSheetMutation = useMutation({
    mutationFn: () => api.syncCommissionSheet(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast(
        `Đã đồng bộ bảng "Hoa hồng Hiền ctv" từ Google Sheet (${res?.total || 0} giao dịch)!`
      );
    },
    onError: (err) => toast(err.message || 'Lỗi đồng bộ Google Sheet', 'error'),
  });

  // Save Webhook config
  const saveConfigMutation = useMutation({
    mutationFn: (payload) => api.saveCommissionSheetConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-sheet-config'] });
      toast('Đã lưu cấu hình tự động ghi lên Google Sheet!');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  // Quick 1-click mark as collected
  const markAsReceivedMutation = useMutation({
    mutationFn: ({ id, amount }) => {
      const now = new Date();
      const payDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      return api.updateCommissionStatus(id, {
        status: 'da_thu',
        commission_status: 'da_thu',
        commission_received: amount,
        received_amount: amount,
        payment_date: payDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast('Đã cập nhật trạng thái: Đã thanh toán hoa hồng!');
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
      customer_name: deal.customer_name || '',
      customer_phone: deal.customer_phone || deal.customer_zalo || '',
      source_name: deal.source_name || deal.address || deal.room_code || '',
      price: String(deal.price || deal.rent_price || 0),
      commission_rate: deal.commission_rate !== undefined ? Number(deal.commission_rate) : 10,
      commission_amount: String(deal.commission_amount || 0),
      deal_date: deal.deal_date || deal.closed_date || '',
      move_in_date: deal.move_in_date || '',
      commission_status: deal.commission_status || deal.status || 'cho_thu',
      commission_received: Number(deal.commission_received || deal.received_amount || 0),
      payment_date: deal.payment_date || '',
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

  const sheetId = sheetConfig?.spreadsheet_id || DEFAULT_SHEET_ID;
  const currentSheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${HIEN_CTV_GID}`;

  const copyText = async (text, key, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast(msg || 'Đã sao chép!');
      setTimeout(() => setCopiedKey(''), 2500);
    } catch {
      toast(text);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <Coins className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                  Bảng Hoa Hồng Hiền CTV
                </h2>
                <a
                  href={currentSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đã liên kết tab Hoa hồng Hiền ctv</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Đồng bộ 2 chiều với trang tính <strong>Hoa hồng Hiền ctv</strong> — khi nhập deal mới sẽ tự động thêm vào dòng tiếp theo trên Sheet
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={currentSheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-emerald-600" />
            <span>Mở Sheet gốc</span>
          </a>

          <button
            type="button"
            onClick={() => syncSheetMutation.mutate()}
            disabled={syncSheetMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncSheetMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{syncSheetMutation.isPending ? 'Đang đồng bộ...' : 'Đồng bộ từ Sheet'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSheetModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs sm:text-sm font-semibold transition-colors"
          >
            <Link2 className="w-4 h-4 text-teal-700" />
            <span>Cấu hình Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Thêm deal chốt</span>
          </button>
        </div>
      </div>

      {/* Top KPI Cards (5 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>🎯 Tổng số giao dịch</span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {stats.total_deals || 0}
            <span className="text-xs font-semibold text-slate-400 ml-1">giao dịch</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {selectedMonth ? `Tháng ${selectedMonth}` : 'Hoa hồng Hiền ctv'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>💵 Tổng doanh số</span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight truncate">
            {formatPrice(stats.total_rent_value || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {formatVND(stats.total_rent_value || 0)}
          </div>
        </div>

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

        <div className="bg-white rounded-xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
            <span>✅ Hoa hồng đã nhận</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 tracking-tight truncate">
            {formatPrice(stats.received_commission || 0)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 truncate font-medium">
            {formatVND(stats.received_commission || 0)}
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/30 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
            <span>⏳ Hoa hồng chưa nhận</span>
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
              <span>Chưa thanh toán</span>
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
              <span>Đã thanh toán</span>
            </button>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo tên khách, SĐT, thông tin phòng..."
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

      {/* Main Commission Table matching "Hoa hồng Hiền ctv" columns */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-3.5 whitespace-nowrap">Tên khách hàng</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">Số điện thoại</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap text-right">Giá phòng</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">Thời gian chốt</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap text-center">Hoa hồng</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap text-center">Đã thanh toán</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap text-right">Thành Tiền</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">Thông tin</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">Thời gian vào</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">Ghi chú / Tháng</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 text-sm">
                    Đang tải dữ liệu từ bảng Hoa hồng Hiền ctv...
                  </td>
                </tr>
              ) : commissions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Coins className="w-6 h-6" />
                    </div>
                    <div className="text-slate-600 font-medium">Chưa có deal hoa hồng nào trong bộ lọc này</div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => syncSheetMutation.mutate()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Đồng bộ từ Google Sheet</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Thêm deal mới</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                commissions.map((deal) => {
                  const dealDate = deal.deal_date || deal.closed_date || '';
                  const custName = deal.customer_name || 'Khách chốt';
                  const custPhone = deal.customer_phone || deal.customer_zalo || '';
                  const statusKey = deal.commission_status || deal.status || 'cho_thu';
                  const stMeta = COMMISSION_STATUS_MAP[statusKey] || COMMISSION_STATUSES[0];
                  const price = Number(deal.price || deal.rent_price) || 0;
                  const comm = Number(deal.commission_amount) || 0;
                  const rateVal = deal.commission_rate !== undefined ? Number(deal.commission_rate) : 10;
                  const isReceived = statusKey === 'da_thu';
                  const infoText = deal.address || deal.source_name || deal.room_code || '—';
                  const rowSheetUrl =
                    deal.sheet_url ||
                    `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${HIEN_CTV_GID}`;

                  return (
                    <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Tên khách hàng */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-sm">{custName}</div>
                        {deal.sheet_row && (
                          <div className="text-[10px] text-slate-400">Dòng #{deal.sheet_row}</div>
                        )}
                      </td>

                      {/* Số điện thoại */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {custPhone ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 font-medium">
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
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Giá phòng */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right font-semibold text-slate-800 tabular-nums">
                        {formatVND(price)}
                      </td>

                      {/* Thời gian chốt */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-600">
                        {formatDateOnly(dealDate)}
                      </td>

                      {/* Hoa hồng (%) */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold tabular-nums">
                          {rateVal}%
                        </span>
                      </td>

                      {/* Đã thanh toán */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-center">
                        <div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${stMeta.badgeClass}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isReceived ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <span>{isReceived ? 'Đã thanh toán' : 'Chưa thanh toán'}</span>
                          </span>
                        </div>
                        {deal.payment_date && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            TT: {deal.payment_date}
                          </div>
                        )}
                      </td>

                      {/* Thành Tiền */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums">
                        <div className="font-bold text-emerald-700 text-sm">{formatVND(comm)}</div>
                      </td>

                      {/* Thông tin */}
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-900 font-semibold truncate max-w-full">
                          <Building className="w-3 h-3 text-teal-600 shrink-0" />
                          <span className="truncate">{infoText}</span>
                        </span>
                      </td>

                      {/* Thời gian vào */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 font-medium">
                        {deal.move_in_date || <span className="text-slate-300">—</span>}
                      </td>

                      {/* Ghi chú / Tháng */}
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <div className="text-[11px] font-semibold text-slate-500">
                          {getMonthBadge(dealDate)}
                        </div>
                        {deal.note && (
                          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5 truncate" title={deal.note}>
                            {deal.note}
                          </div>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right space-x-1.5">
                        <a
                          href={rowSheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs shadow-2xs transition-colors"
                          title="Xem trực tiếp dòng này trên tab Hoa hồng Hiền ctv"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Xem ở Sheet</span>
                        </a>

                        {!isReceived && (
                          <button
                            type="button"
                            onClick={() =>
                              markAsReceivedMutation.mutate({ id: deal.id, amount: comm })
                            }
                            disabled={markAsReceivedMutation.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs shadow-2xs transition-colors"
                            title="1-click đánh dấu Đã thanh toán"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã thu</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openEdit(deal)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          title="Sửa deal"
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

      {/* Google Sheet Auto-Write Configuration Modal */}
      {showSheetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto">
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-base">
                    Cấu hình tự động đồng bộ tab "Hoa hồng Hiền ctv"
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Đã cài sẵn công thức tự động điền từ Dòng 12 trên tab Hoa hồng Hiền ctv
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSheetModal(false)}
                className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs sm:text-sm text-slate-700">
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="font-bold text-emerald-950">
                  ✅ Đã kích hoạt tự động thêm dòng mới vào tab "Hoa hồng Hiền ctv"
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tại <strong>Dòng 12</strong> (ô <code>A12</code> và <code>H12</code>) của bảng{' '}
                  <strong>Hoa hồng Hiền ctv</strong> trên Google Sheet của bạn đã được gắn sẵn công thức tự động kéo các deal mới nhập từ web về, đồng thời giữ nguyên ô Checkbox cột <code>F</code>, công thức <code>Thành Tiền</code> cột <code>G</code> và công thức <code>Tháng</code> cột <code>L</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900">
                  Tùy chọn nâng cao: Ghi trực tiếp giá trị tĩnh qua Apps Script Webhook
                </div>
                <div className="flex items-center justify-between bg-slate-900 text-slate-100 px-3 py-2 rounded-lg font-mono text-[11px] overflow-x-auto">
                  <span className="truncate mr-2">function doPost(e) &#123; /* Ghi vào Hoa hồng Hiền ctv */ &#125;</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(APPS_SCRIPT_CODE, 'script', 'Đã sao chép mã Google Apps Script!')
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-sans font-semibold shrink-0"
                  >
                    {copiedKey === 'script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'script' ? 'Đã chép mã' : 'Sao chép mã Apps Script'}</span>
                  </button>
                </div>

                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    placeholder="Dán link https://script.google.com/macros/s/.../exec (nếu dùng Webhook)"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => saveConfigMutation.mutate({ webhook_url: webhookInput })}
                    disabled={saveConfigMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
                  >
                    {saveConfigMutation.isPending ? 'Đang lưu...' : 'Lưu Webhook'}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSheetModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deal Modal */}
      {editingDeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const numPrice = Number(editForm.price) || 0;
              const numComm = Number(editForm.commission_amount) || 0;
              updateMutation.mutate({
                customer_name: editForm.customer_name,
                customer_phone: editForm.customer_phone,
                source_name: editForm.source_name,
                address: editForm.source_name,
                room_code: editForm.source_name,
                price: numPrice,
                rent_price: numPrice,
                commission_rate: Number(editForm.commission_rate) || 0,
                commission_amount: numComm,
                deal_date: editForm.deal_date,
                closed_date: editForm.deal_date,
                move_in_date: editForm.move_in_date,
                commission_status: editForm.commission_status,
                status: editForm.commission_status,
                commission_received:
                  editForm.commission_status === 'da_thu'
                    ? numComm
                    : Number(editForm.commission_received) || 0,
                payment_date: editForm.payment_date,
                sheet_tab: 'Hoa hồng Hiền ctv',
                note: editForm.note,
              });
            }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Sửa Deal: {editingDeal.customer_name || ''} ({editingDeal.address || editingDeal.source_name || ''})
                </h3>
                <p className="text-xs text-slate-500">
                  Cập nhật thông tin dòng #{editingDeal.sheet_row || 'mới'} trên bảng Hoa hồng Hiền ctv
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDeal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tên khách hàng *
                  </label>
                  <input
                    type="text"
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, customer_name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={editForm.customer_phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, customer_phone: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Thông tin (Địa chỉ / Khu vực)
                  </label>
                  <input
                    type="text"
                    value={editForm.source_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, source_name: e.target.value }))}
                    placeholder="VD: 128 Đình Thôn, Phú Đô..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Thời gian vào ở
                  </label>
                  <input
                    type="text"
                    value={editForm.move_in_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, move_in_date: e.target.value }))}
                    placeholder="VD: 1/11/26"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Giá phòng (VND)
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
                    Thời gian chốt
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
                    Thành Tiền (VND)
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Đã thanh toán
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Thời gian thanh toán
                  </label>
                  <input
                    type="text"
                    value={editForm.payment_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, payment_date: e.target.value }))}
                    placeholder="VD: 24/11/2026"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
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
