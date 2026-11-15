import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Plus,
  Edit,
  Trash2,
  Send,
  Clock,
  X,
  ExternalLink,
  Share2,
  CheckCircle2,
  ArrowRightCircle,
  Coins,
  Search,
  Building,
  Phone,
  MessageCircle,
  DollarSign,
  Calendar,
  Flame,
  Bell,
  Copy,
  Check,
  GraduationCap,
} from 'lucide-react';
import { api } from '../api/client';
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_MAP, STATUS_MAP } from '../utils/constants';
import {
  formatDateTime,
  formatPrice,
  formatVND,
  parseVietnameseCurrency,
  formatVietnameseBudgetPreview,
} from '../utils/format';
import { useToast } from '../components/Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';
import DealClosingModal from '../components/DealClosingModal';

const UNIVERSITY_SUGGESTIONS = [
  'ĐH Bách Khoa',
  'Kinh Tế Quốc Dân',
  'ĐHQG Hà Nội',
  'Ngoại Thương',
  'Thương Mại',
  'Xây Dựng',
  'Bưu Chính',
  'Sư Phạm',
];

const BUDGET_QUICK_BUTTONS = ['3', '3.5', '4', '4.5', '5', '6', '7'];


function getEffectiveStatus(status) {
  if (status === 'da_chot' || status === 'da_thue') return 'da_chot';
  if (status === 'da_cham') return 'da_cham';
  return 'chua_cham';
}

function getDaysUntilTarget(targetDate) {
  if (!targetDate) return null;
  const parts = String(targetDate).trim().split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function isCustomerUrgent(c) {
  return Boolean(c.is_urgent || c.urgency === 'gap');
}

function isCustomerFollowup(c) {
  if (c.needs_followup_reminder !== undefined) {
    return Boolean(c.needs_followup_reminder);
  }
  const eff = getEffectiveStatus(c.status);
  if (eff === 'da_chot') return false;
  if (!c.target_date) return false;
  const days =
    typeof c.days_until_target === 'number'
      ? c.days_until_target
      : getDaysUntilTarget(c.target_date);
  return days !== null && days >= -7 && days <= 30;
}

function renderUrgentBadge(c) {
  if (!isCustomerUrgent(c)) return null;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1 shrink-0">
      <span>🔥 CẦN GẤP</span>
    </span>
  );
}

function renderTargetDateBadge(c) {
  if (!c.target_date) return null;
  const days =
    typeof c.days_until_target === 'number'
      ? c.days_until_target
      : getDaysUntilTarget(c.target_date);
  if (days === null) return null;

  let label = '';
  if (days > 0) {
    label = `⏰ Sắp cần phòng (còn ${days} ngày - ${c.target_date})`;
  } else if (days === 0) {
    label = `⏰ Cần phòng hôm nay (${c.target_date})`;
  } else {
    label = `⏰ Quá hạn cần phòng (${Math.abs(days)} ngày trước - ${c.target_date})`;
  }

  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shrink-0">
      <span>{label}</span>
    </span>
  );
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'chua_cham' | 'da_cham' | 'da_chot'
  const [searchQuery, setSearchQuery] = useState('');

  // Deal modal state
  const [dealModalCustomer, setDealModalCustomer] = useState(null);
  const [showDealModal, setShowDealModal] = useState(false);

  // Customer create/edit modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    zalo_phone: '',
    university: '',
    budget_min: '',
    budget_max: '',
    districts: '',
    need_note: '',
    status: 'chua_cham',
    urgency: 'binh_thuong',
    target_date: '',
    deal_room_id: '',
    deal_room_code: '',
    deal_building_name: '',
    deal_address: '',
    deal_price: '4000000',
    deal_commission_rate: 50,
    deal_commission_amount: '2000000',
    deal_closed_date: new Date().toISOString().slice(0, 10),
    deal_commission_status: 'cho_thu',
    deal_update_room_status: true,
    deal_room_target_status: 'da_coc',
  });

  useEscapeKey(() => setShowModal(false), showModal);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.getCustomers(),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.getRooms(),
  });

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts = { all: customers.length, chua_cham: 0, da_cham: 0, da_chot: 0 };
    customers.forEach((c) => {
      const eff = getEffectiveStatus(c.status);
      if (counts[eff] !== undefined) {
        counts[eff] += 1;
      }
    });
    return counts;
  }, [customers]);

  const urgentCustomers = useMemo(() => customers.filter(isCustomerUrgent), [customers]);
  const followupCustomers = useMemo(() => customers.filter(isCustomerFollowup), [customers]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const eff = getEffectiveStatus(c.status);
      if (activeTab === 'urgent') {
        if (!isCustomerUrgent(c)) return false;
      } else if (activeTab === 'followup') {
        if (!isCustomerFollowup(c)) return false;
      } else if (activeTab !== 'all' && eff !== activeTab) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.name && c.name.toLowerCase().includes(q);
        const matchesPhone = c.zalo_phone && c.zalo_phone.toLowerCase().includes(q);
        const matchesDistrict = c.districts && c.districts.toLowerCase().includes(q);
        const matchesNote = c.need_note && c.need_note.toLowerCase().includes(q);
        const matchesUniversity = c.university && c.university.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesDistrict && !matchesNote && !matchesUniversity) return false;
      }
      return true;
    });
  }, [customers, activeTab, searchQuery]);

  const activeCustomerId = selectedId || filteredCustomers[0]?.id || customers[0]?.id || null;

  const { data: historyData } = useQuery({
    queryKey: ['customer-sends', activeCustomerId],
    queryFn: () => api.getCustomerSends(activeCustomerId),
    enabled: Boolean(activeCustomerId),
  });

  const { data: carts = [] } = useQuery({
    queryKey: ['carts'],
    queryFn: api.getCarts,
  });

  const copyLeadLink = async () => {
    const url = `${window.location.origin}/nhu-cau`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Đã sao chép link đăng ký tìm phòng: ' + url);
    } catch {
      toast('Link tìm phòng: ' + url);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      zalo_phone: '',
      university: '',
      budget_min: '',
      budget_max: '',
      districts: '',
      need_note: '',
      status: 'chua_cham',
      urgency: 'binh_thuong',
      target_date: '',
      deal_room_id: '',
      deal_room_code: '',
      deal_building_name: '',
      deal_address: '',
      deal_price: '4000000',
      deal_commission_rate: 50,
      deal_commission_amount: '2000000',
      deal_closed_date: new Date().toISOString().slice(0, 10),
      deal_commission_status: 'cho_thu',
      deal_update_room_status: true,
      deal_room_target_status: 'da_coc',
    });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    const eff = getEffectiveStatus(c.status);
    setForm({
      name: c.name || '',
      zalo_phone: c.zalo_phone || '',
      university: c.university || '',
      budget_min: c.budget_min ? String(c.budget_min) : '',
      budget_max: c.budget_max ? String(c.budget_max) : '',
      districts: c.districts || '',
      need_note: c.need_note || '',
      status: eff,
      urgency: c.urgency || 'binh_thuong',
      target_date: c.target_date || '',
      deal_room_id: '',
      deal_room_code: '',
      deal_building_name: '',
      deal_address: '',
      deal_price: '4000000',
      deal_commission_rate: 50,
      deal_commission_amount: '2000000',
      deal_closed_date: new Date().toISOString().slice(0, 10),
      deal_commission_status: 'cho_thu',
      deal_update_room_status: true,
      deal_room_target_status: 'da_coc',
    });
    setShowModal(true);
  };

  const openDealForCustomer = (cust) => {
    setDealModalCustomer(cust);
    setShowDealModal(true);
  };

  const quickStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.updateCustomer(id, { status }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast(
        vars.status === 'da_cham'
          ? 'Đã chuyển sang trạng thái "Đang chăm sóc"'
          : 'Đã cập nhật trạng thái khách hàng'
      );
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        zalo_phone: form.zalo_phone.trim(),
        university: form.university ? form.university.trim() : '',
        budget_min: form.budget_min ? parseVietnameseCurrency(form.budget_min) : null,
        budget_max: form.budget_max ? parseVietnameseCurrency(form.budget_max) : null,
        districts: form.districts.trim(),
        need_note: form.need_note.trim(),
        status: form.status,
        urgency: form.urgency || 'binh_thuong',
        target_date: form.target_date || '',
      };

      const saved = editing
        ? await api.updateCustomer(editing.id, payload)
        : await api.createCustomer(payload);

      // If status is da_chot and deal information was filled, record commission
      if (form.status === 'da_chot' && (form.deal_price || form.deal_room_id)) {
        try {
          const numPrice = Number(form.deal_price) || 0;
          const numComm = Number(form.deal_commission_amount) || Math.round((numPrice * form.deal_commission_rate) / 100);
          await api.createCommission({
            customer_id: saved.id,
            customer_name: saved.name,
            customer_phone: saved.zalo_phone || '',
            room_id: form.deal_room_id ? Number(form.deal_room_id) : null,
            room_code: form.deal_room_code || '',
            building_name: form.deal_building_name || '',
            address: form.deal_address || '',
            rent_price: numPrice,
            commission_rate: Number(form.deal_commission_rate) || 0,
            commission_amount: numComm,
            closed_date: form.deal_closed_date || new Date().toISOString().slice(0, 10),
            status: form.deal_commission_status || 'cho_thu',
            received_amount: form.deal_commission_status === 'da_thu' ? numComm : 0,
          });

          if (form.deal_update_room_status && form.deal_room_id) {
            await api.updateRoomStatus(form.deal_room_id, form.deal_room_target_status || 'da_coc');
          }
        } catch {
          // don't block saving customer
        }
      }

      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-stats'] });
      setSelectedId(saved.id);
      setShowModal(false);
      toast(editing ? 'Đã cập nhật khách hàng' : 'Đã thêm khách hàng mới');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedId(null);
      toast('Đã xoá khách hàng');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteCartMutation = useMutation({
    mutationFn: api.deleteCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carts'] });
      toast('Đã xoá link giỏ phòng');
    },
  });

  const activeCustomer =
    customers.find((c) => c.id === activeCustomerId) || historyData?.customer || null;
  const sends = historyData?.sends || [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Quản lý Khách hàng & Pipeline</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Lưu trữ danh sách khách, chăm sóc theo trạng thái và chốt phòng tính hoa hồng
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyLeadLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors shadow-xs"
            title="Sao chép link form tìm phòng gửi khách hàng"
          >
            <span>📋 Sao chép link gửi khách</span>
          </button>
          <Link
            to="/commissions"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-medium transition-colors"
          >
            <Coins className="w-4 h-4 text-emerald-600" />
            <span>Bảng hoa hồng</span>
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm khách hàng</span>
          </button>
        </div>
      </div>

      {/* Reminder Banner */}
      {(followupCustomers.length > 0 || urgentCustomers.length > 0) && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm text-slate-800 font-medium">
              <span className="font-bold text-amber-900">🔔 Nhắc nhở chăm sóc: </span>
              {followupCustomers.length > 0 && (
                <span>
                  Có <strong>{followupCustomers.length}</strong> khách sắp cần phòng trong 30 ngày tới
                </span>
              )}
              {followupCustomers.length > 0 && urgentCustomers.length > 0 && <span> & </span>}
              {urgentCustomers.length > 0 && (
                <span className="text-rose-700 font-bold">
                  {urgentCustomers.length} khách cần gấp!
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {urgentCustomers.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('urgent')}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                🔥 Xem {urgentCustomers.length} khách gấp
              </button>
            )}
            {followupCustomers.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('followup')}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                ⏰ Xem {followupCustomers.length} khách sắp đến hạn
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Tất cả</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {statusCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('urgent')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'urgent'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
          }`}
        >
          <span>🔥 Cần gấp</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'urgent' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {urgentCustomers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('followup')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'followup'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <span>⏰ Sắp đến hạn (&le;30 ngày)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'followup' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {followupCustomers.length}
          </span>
        </button>

        {CUSTOMER_STATUSES.map((st) => {
          const isActive = activeTab === st.value;
          const count = statusCounts[st.value] || 0;
          return (
            <button
              key={st.value}
              type="button"
              onClick={() => setActiveTab(st.value)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[#0D6E6E] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : st.dotClass}`} />
              <span>{st.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Customer list column */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Search bar inside list */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Tìm tên khách, số điện thoại, khu vực..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D6E6E]"
              />
            </div>
          </div>

          <div className="px-4 py-2 border-b border-slate-100 font-semibold text-xs text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>Danh sách khách ({filteredCustomers.length})</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-sm text-slate-500">Đang tải...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 space-y-2">
              <p>Chưa có khách hàng nào trong mục này</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs text-[#0D6E6E] font-medium hover:underline"
              >
                + Thêm khách ngay
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[620px]">
              {filteredCustomers.map((c) => {
                const effStatus = getEffectiveStatus(c.status);
                const st = CUSTOMER_STATUS_MAP[effStatus] || CUSTOMER_STATUSES[0];
                const isSelected = c.id === activeCustomerId;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#0D6E6E]/8 border-l-4 border-l-[#0D6E6E]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {c.name}
                          </span>
                          {c.university && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium inline-flex items-center gap-1">
                              <span>🎓 {c.university}</span>
                            </span>
                          )}
                          {c.source === 'web_form' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                              🌐 Web
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                          <span>{c.zalo_phone || 'Chưa có SĐT'}</span>
                          {c.zalo_phone && (
                            <a
                              href={`https://zalo.me/${c.zalo_phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800"
                              title="Mở Zalo"
                            >
                              <MessageCircle className="w-3 h-3 inline" />
                            </a>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 inline-flex items-center gap-1 ${st.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dotClass}`} />
                        <span>{st.label}</span>
                      </span>
                    </div>

                    {/* Prominent Badges */}
                    {(isCustomerUrgent(c) || (c.target_date && isCustomerFollowup(c))) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {renderUrgentBadge(c)}
                        {renderTargetDateBadge(c)}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                      <span className="tabular-nums truncate max-w-[200px]">
                        {c.districts ? `Khu vực: ${c.districts}` : 'Chưa chọn khu vực'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700 tabular-nums shrink-0">
                        <Send className="w-3 h-3 text-[#0D6E6E]" />
                        {c.send_count || 0} lần gửi
                      </span>
                    </div>

                    {/* Quick Action Transition Buttons */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between gap-1.5">
                      <div className="text-[11px] text-slate-400">
                        {c.budget_max ? `≤ ${formatPrice(c.budget_max)}` : ''}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {effStatus === 'chua_cham' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              quickStatusMutation.mutate({ id: c.id, status: 'da_cham' });
                            }}
                            className="text-[11px] px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-medium inline-flex items-center gap-1 transition-colors"
                            title="1-click chuyển sang Đang chăm sóc"
                          >
                            <ArrowRightCircle className="w-3 h-3 text-amber-600" />
                            <span>Đang chăm sóc</span>
                          </button>
                        )}

                        {effStatus !== 'da_chot' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDealForCustomer(c);
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1 shadow-xs transition-colors"
                            title="Chốt deal phòng cho khách này"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Chốt phòng</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã chốt</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Customer Details & Send History */}
        <div className="lg:col-span-7 space-y-4">
          {activeCustomer ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              {/* Customer Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg text-slate-900">{activeCustomer.name}</h3>
                    {activeCustomer.university && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium inline-flex items-center gap-1">
                        <span>🎓 {activeCustomer.university}</span>
                      </span>
                    )}
                    {activeCustomer.source === 'web_form' && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                        🌐 Web Form
                      </span>
                    )}
                    {(() => {
                      const eff = getEffectiveStatus(activeCustomer.status);
                      const st = CUSTOMER_STATUS_MAP[eff] || CUSTOMER_STATUSES[0];
                      return (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${st.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dotClass}`} />
                          <span>{st.label}</span>
                        </span>
                      );
                    })()}
                    {renderUrgentBadge(activeCustomer)}
                    {renderTargetDateBadge(activeCustomer)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{activeCustomer.zalo_phone || 'Chưa có SĐT'}</span>
                    </span>
                    {activeCustomer.university && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-blue-700 font-medium">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                          <span>{activeCustomer.university}</span>
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>Khu vực: {activeCustomer.districts || 'Chưa chọn'}</span>
                    <span>•</span>
                    <span className="tabular-nums">
                      Ngân sách: {activeCustomer.budget_min ? formatPrice(activeCustomer.budget_min) : '0'} –{' '}
                      {activeCustomer.budget_max ? formatPrice(activeCustomer.budget_max) : '...'}
                    </span>
                    {activeCustomer.target_date && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-700 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Ngày cần: {activeCustomer.target_date}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {getEffectiveStatus(activeCustomer.status) !== 'da_chot' && (
                    <button
                      type="button"
                      onClick={() => openDealForCustomer(activeCustomer)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Chốt phòng</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(activeCustomer)}
                    aria-label={`Sửa khách hàng ${activeCustomer.name}`}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Sửa khách"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Xoá khách hàng "${activeCustomer.name}"?`)) {
                        deleteMutation.mutate(activeCustomer.id);
                      }
                    }}
                    aria-label={`Xoá khách hàng ${activeCustomer.name}`}
                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                    title="Xoá khách"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Status Bar */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="font-semibold text-slate-600">Trạng thái:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CUSTOMER_STATUSES.map((st) => {
                    const isCurrent = getEffectiveStatus(activeCustomer.status) === st.value;
                    return (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() => {
                          if (st.value === 'da_chot') {
                            openDealForCustomer(activeCustomer);
                          } else {
                            quickStatusMutation.mutate({ id: activeCustomer.id, status: st.value });
                          }
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors inline-flex items-center gap-1 ${
                          isCurrent
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white' : st.dotClass}`} />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeCustomer.need_note && (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700">
                  <strong className="text-slate-900">Nhu cầu:</strong> {activeCustomer.need_note}
                </div>
              )}

              {/* Send History */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lịch sử phòng đã gửi ({sends.length})
                </h4>

                {sends.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                    Chưa lưu lần gửi phòng nào cho khách này
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sends.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/50"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDateTime(s.sent_at)}</span>
                        </div>

                        {s.rooms?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {s.rooms.map((r) => {
                              const st = STATUS_MAP[r.status];
                              return (
                                <span
                                  key={r.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 text-xs"
                                >
                                  <span className="font-semibold text-[#0D6E6E]">
                                    {r.code || `#${r.id}`}
                                  </span>
                                  <span className="text-slate-700">
                                    {r.street}, {r.district}
                                  </span>
                                  <span className="font-medium tabular-nums">
                                    ({formatPrice(r.price)})
                                  </span>
                                  {st && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded-full border ${st.badgeClass}`}
                                    >
                                      {st.label}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {s.message && (
                          <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans bg-white border border-slate-200/80 rounded p-2.5 max-h-36 overflow-y-auto">
                            {s.message}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
              Chọn một khách hàng bên trái để xem chi tiết và lịch sử gửi phòng
            </div>
          )}

          {/* Shared Carts Section */}
          {carts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#0D6E6E]" />
                <span>Trang giỏ phòng đã tạo ({carts.length})</span>
              </h4>
              <div className="divide-y divide-slate-100">
                {carts.map((cart) => (
                  <div key={cart.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-medium text-slate-900">{cart.title}</div>
                      <div className="text-slate-400 tabular-nums">
                        {cart.room_ids.length} phòng • {formatDateTime(cart.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/share/${cart.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 text-[#0D6E6E] font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Mở trang</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Xoá link giỏ phòng "${cart.title}"?`)) {
                            deleteCartMutation.mutate(cart.id);
                          }
                        }}
                        aria-label={`Xoá link giỏ phòng ${cart.title}`}
                        title="Xoá link giỏ phòng"
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) return toast('Nhập tên khách hàng', 'error');
              saveMutation.mutate();
            }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900">
                {editing ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'}
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

            <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tên khách *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">SĐT / Zalo</label>
                  <input
                    type="text"
                    value={form.zalo_phone}
                    onChange={(e) => setForm((p) => ({ ...p, zalo_phone: e.target.value }))}
                    placeholder="0987654321"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                  <span>Trường học / Nơi làm việc</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.university}
                    onChange={(e) => setForm((p) => ({ ...p, university: e.target.value }))}
                    placeholder="VD: ĐH Bách Khoa, Kinh Tế Quốc Dân..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {UNIVERSITY_SUGGESTIONS.map((uni) => (
                    <button
                      key={uni}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, university: uni }))}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                        form.university === uni
                          ? 'bg-blue-100 text-blue-800 border-blue-300 font-semibold shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {uni}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Ngân sách từ (VND)
                    </label>
                    <input
                      type="text"
                      value={form.budget_min}
                      onChange={(e) => setForm((p) => ({ ...p, budget_min: e.target.value }))}
                      placeholder="VD: 3 hoặc 3.5..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
                    />
                    {form.budget_min && formatVietnameseBudgetPreview(form.budget_min) ? (
                      <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                        {formatVietnameseBudgetPreview(form.budget_min)}
                      </div>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {BUDGET_QUICK_BUTTONS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, budget_min: b }))}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            form.budget_min === b
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Đến tối đa (VND)
                    </label>
                    <input
                      type="text"
                      value={form.budget_max}
                      onChange={(e) => setForm((p) => ({ ...p, budget_max: e.target.value }))}
                      placeholder="VD: 4 hoặc 4.5..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
                    />
                    {form.budget_max && formatVietnameseBudgetPreview(form.budget_max) ? (
                      <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                        {formatVietnameseBudgetPreview(form.budget_max)}
                      </div>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {BUDGET_QUICK_BUTTONS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, budget_max: b }))}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            form.budget_max === b
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Khu vực / Quận tìm</label>
                  <input
                    type="text"
                    value={form.districts}
                    onChange={(e) => setForm((p) => ({ ...p, districts: e.target.value }))}
                    placeholder="Cầu Giấy, Đống Đa"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Trạng thái chăm sóc</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-medium"
                  >
                    {CUSTOMER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mức độ cần phòng (Urgency)
                  </label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-medium"
                  >
                    <option value="gap">🔥 Cần gấp trong vài ngày tới</option>
                    <option value="binh_thuong">🌿 Bình thường trong tháng này</option>
                    <option value="hen_truoc">⏳ Chưa cần ngay / Hẹn ngày</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Thời gian vào ở
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().slice(0, 10);
                          setForm((p) => ({ ...p, target_date: today }));
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                      >
                        Vào ngay
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                          setForm((p) => ({ ...p, target_date: nextMonth.toISOString().slice(0, 10) }));
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                      >
                        Đầu tháng tới
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={form.target_date}
                    onChange={(e) => setForm((p) => ({ ...p, target_date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ghi chú nhu cầu</label>
                <textarea
                  rows={2}
                  value={form.need_note}
                  onChange={(e) => setForm((p) => ({ ...p, need_note: e.target.value }))}
                  placeholder="Yêu cầu riêng: có ban công, nuôi thú cưng, ở 2 người..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Embedded Section: Thông tin chốt phòng & Hoa hồng when status === 'da_chot' */}
              {form.status === 'da_chot' && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3 pt-3">
                  <div className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Thông tin chốt phòng & Hoa hồng</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Chọn phòng chốt từ kho
                    </label>
                    <select
                      value={form.deal_room_id}
                      onChange={(e) => {
                        const roomId = e.target.value;
                        const found = rooms.find((r) => String(r.id) === String(roomId));
                        if (found) {
                          setForm((p) => ({
                            ...p,
                            deal_room_id: roomId,
                            deal_room_code: found.code || '',
                            deal_building_name: found.landlord_name || found.street || '',
                            deal_address: found.address || `${found.street || ''}, ${found.district || ''}`.trim(),
                            deal_price: found.price ? String(found.price) : p.deal_price,
                            deal_commission_amount: found.price
                              ? String(Math.round((Number(found.price) * p.deal_commission_rate) / 100))
                              : p.deal_commission_amount,
                          }));
                        } else {
                          setForm((p) => ({ ...p, deal_room_id: roomId }));
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white font-medium"
                    >
                      <option value="">-- Chọn phòng --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          [{r.code || `#${r.id}`}] {r.street}, {r.district} — {formatPrice(r.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-slate-600 mb-0.5">Mã phòng chốt</label>
                      <input
                        type="text"
                        value={form.deal_room_code}
                        onChange={(e) => setForm((p) => ({ ...p, deal_room_code: e.target.value }))}
                        placeholder="VD: 505A4"
                        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-0.5">Địa chỉ / Tòa nhà</label>
                      <input
                        type="text"
                        value={form.deal_address}
                        onChange={(e) => setForm((p) => ({ ...p, deal_address: e.target.value }))}
                        placeholder="VD: 12 Trần Thái Tông"
                        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-0.5">
                        Giá chốt thuê (VND)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={form.deal_price}
                        onChange={(e) => {
                          const pVal = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            deal_price: pVal,
                            deal_commission_amount: String(
                              Math.round((Number(pVal) * prev.deal_commission_rate) / 100)
                            ),
                          }));
                        }}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold tabular-nums bg-white"
                      />
                      <div className="text-[11px] text-emerald-800 mt-0.5 font-medium">
                        {formatVND(form.deal_price)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-0.5">
                        Ngày chốt
                      </label>
                      <input
                        type="date"
                        value={form.deal_closed_date}
                        onChange={(e) => setForm((p) => ({ ...p, deal_closed_date: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-0.5">
                        % Hoa hồng
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={form.deal_commission_rate}
                        onChange={(e) => {
                          const rVal = Number(e.target.value) || 0;
                          setForm((prev) => ({
                            ...prev,
                            deal_commission_rate: rVal,
                            deal_commission_amount: String(
                              Math.round((Number(prev.deal_price) * rVal) / 100)
                            ),
                          }));
                        }}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs tabular-nums bg-white font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-0.5">
                        Tiền hoa hồng (VND)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={form.deal_commission_amount}
                        onChange={(e) => setForm((p) => ({ ...p, deal_commission_amount: e.target.value }))}
                        className="w-full rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-bold tabular-nums text-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-700 font-medium">Trạng thái hoa hồng:</span>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="deal_comm_st"
                          value="cho_thu"
                          checked={form.deal_commission_status === 'cho_thu'}
                          onChange={() => setForm((p) => ({ ...p, deal_commission_status: 'cho_thu' }))}
                        />
                        <span>Chờ thu</span>
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="deal_comm_st"
                          value="da_thu"
                          checked={form.deal_commission_status === 'da_thu'}
                          onChange={() => setForm((p) => ({ ...p, deal_commission_status: 'da_thu' }))}
                        />
                        <span className="text-emerald-700 font-medium">Đã nhận đủ</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
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
                className="px-4 py-1.5 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium shadow-xs"
              >
                {saveMutation.isPending ? 'Đang lưu...' : 'Lưu khách hàng'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Standalone Deal Closing Modal */}
      <DealClosingModal
        isOpen={showDealModal}
        onClose={() => {
          setShowDealModal(false);
          setDealModalCustomer(null);
        }}
        customer={dealModalCustomer}
      />
    </div>
  );
}