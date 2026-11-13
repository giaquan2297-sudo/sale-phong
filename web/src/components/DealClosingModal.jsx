import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2, Building, DollarSign, Calendar, User, Search } from 'lucide-react';
import { api } from '../api/client';
import { formatPrice, formatVND } from '../utils/format';
import { useToast } from './Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';

const RATE_PRESETS = [30, 40, 50, 60, 100];

export default function DealClosingModal({
  isOpen,
  onClose,
  customer = null,
  initialRoom = null,
  onSuccess = null,
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEscapeKey(onClose, isOpen);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.getCustomers(),
    enabled: isOpen && !customer,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.getRooms(),
    enabled: isOpen,
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState(customer?.id || '');
  const [customCustomerName, setCustomCustomerName] = useState(customer?.name || '');
  const [customCustomerPhone, setCustomCustomerPhone] = useState(customer?.zalo_phone || '');

  const [selectedRoomId, setSelectedRoomId] = useState(initialRoom?.id || '');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomCode, setRoomCode] = useState(initialRoom?.code || '');
  const [buildingName, setBuildingName] = useState(initialRoom?.landlord_name || initialRoom?.street || '');
  const [address, setAddress] = useState(
    initialRoom?.address || (initialRoom ? `${initialRoom.street || ''}, ${initialRoom.district || ''}`.trim() : '')
  );

  const [rentPrice, setRentPrice] = useState(initialRoom?.price ? String(initialRoom.price) : '4000000');
  const [commissionRate, setCommissionRate] = useState(50);
  const [commissionAmount, setCommissionAmount] = useState('2000000');
  const [closedDate, setClosedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [commissionStatus, setCommissionStatus] = useState('cho_thu');
  const [updateRoomStatus, setUpdateRoomStatus] = useState(true);
  const [roomTargetStatus, setRoomTargetStatus] = useState('da_coc');
  const [note, setNote] = useState('');

  // Sync when customer prop changes
  useEffect(() => {
    if (customer) {
      setSelectedCustomerId(customer.id);
      setCustomCustomerName(customer.name || '');
      setCustomCustomerPhone(customer.zalo_phone || '');
    }
  }, [customer]);

  // Sync initial room if passed
  useEffect(() => {
    if (initialRoom) {
      setSelectedRoomId(initialRoom.id);
      setRoomCode(initialRoom.code || '');
      setBuildingName(initialRoom.landlord_name || initialRoom.street || '');
      setAddress(initialRoom.address || `${initialRoom.street || ''}, ${initialRoom.district || ''}`.trim());
      if (initialRoom.price) {
        setRentPrice(String(initialRoom.price));
        setCommissionAmount(String(Math.round((initialRoom.price * commissionRate) / 100)));
      }
    }
  }, [initialRoom]);

  // Filtered rooms for dropdown
  const filteredRooms = useMemo(() => {
    if (!roomSearch.trim()) return rooms;
    const q = roomSearch.toLowerCase().trim();
    return rooms.filter(
      (r) =>
        (r.code && r.code.toLowerCase().includes(q)) ||
        (r.street && r.street.toLowerCase().includes(q)) ||
        (r.district && r.district.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q))
    );
  }, [rooms, roomSearch]);

  const handleRoomSelect = (roomIdStr) => {
    setSelectedRoomId(roomIdStr);
    const found = rooms.find((r) => String(r.id) === String(roomIdStr));
    if (found) {
      setRoomCode(found.code || '');
      setBuildingName(found.landlord_name || found.street || `Tòa ${found.code || ''}`);
      setAddress(found.address || `${found.street || ''}, ${found.district || ''}`.trim());
      if (found.price) {
        setRentPrice(String(found.price));
        const calc = Math.round((Number(found.price) * commissionRate) / 100);
        setCommissionAmount(String(calc));
      }
    }
  };

  const handlePriceChange = (val) => {
    setRentPrice(val);
    const numPrice = Number(val) || 0;
    const calc = Math.round((numPrice * commissionRate) / 100);
    setCommissionAmount(String(calc));
  };

  const handleRateChange = (rate) => {
    setCommissionRate(rate);
    const numPrice = Number(rentPrice) || 0;
    const calc = Math.round((numPrice * rate) / 100);
    setCommissionAmount(String(calc));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      let custId = customer?.id || (selectedCustomerId ? Number(selectedCustomerId) : null);
      let custName = customer?.name || customCustomerName.trim();
      let custPhone = customer?.zalo_phone || customCustomerPhone.trim();

      if (selectedCustomerId && !customer) {
        const foundCust = customers.find((c) => String(c.id) === String(selectedCustomerId));
        if (foundCust) {
          custName = foundCust.name;
          custPhone = foundCust.zalo_phone || '';
        }
      }

      if (!custName) {
        throw new Error('Vui lòng chọn hoặc nhập tên khách hàng');
      }

      const numPrice = Number(rentPrice) || 0;
      if (numPrice <= 0) {
        throw new Error('Vui lòng nhập giá chốt phòng hợp lệ');
      }

      const numCommission = Number(commissionAmount) || 0;

      const foundRoom = rooms.find((r) => String(r.id) === String(selectedRoomId));

      const commissionPayload = {
        customer_id: custId,
        customer_name: custName,
        customer_phone: custPhone,
        customer_zalo: custPhone,
        zalo_phone: custPhone,
        room_id: selectedRoomId ? Number(selectedRoomId) : null,
        room_code: roomCode,
        building_name: buildingName,
        address,
        district: foundRoom?.district || '',
        price: numPrice,
        rent_price: numPrice,
        commission_rate: Number(commissionRate) || 0,
        commission_amount: numCommission,
        deal_date: closedDate || new Date().toISOString().slice(0, 10),
        closed_date: closedDate || new Date().toISOString().slice(0, 10),
        commission_status: commissionStatus,
        status: commissionStatus,
        commission_received: commissionStatus === 'da_thu' ? numCommission : 0,
        received_amount: commissionStatus === 'da_thu' ? numCommission : 0,
        mark_room_rented: updateRoomStatus ? roomTargetStatus : false,
        note,
      };

      // 1. Create commission record
      let commissionResult = null;
      try {
        commissionResult = await api.createCommission(commissionPayload);
      } catch (err) {
        // If createCommission fails because customer has close-deal endpoint
        if (custId && api.closeCustomerDeal) {
          commissionResult = await api.closeCustomerDeal(custId, commissionPayload);
        } else {
          throw err;
        }
      }

      // 2. Ensure customer status is updated to da_chot
      if (custId) {
        try {
          await api.updateCustomer(custId, { status: 'da_chot' });
        } catch {
          // ignore if already updated by server
        }
      }

      // 3. Update room status if requested
      if (updateRoomStatus && selectedRoomId) {
        try {
          await api.updateRoomStatus(selectedRoomId, roomTargetStatus);
        } catch {
          // ignore
        }
      }

      return commissionResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-sends'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-stats'] });
      toast('Đã chốt phòng thành công và lưu vào Bảng hoa hồng!');
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err) => {
      toast(err.message || 'Lỗi khi lưu deal chốt', 'error');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Chốt phòng & Ghi nhận hoa hồng</h3>
              <p className="text-xs text-emerald-100">
                Lưu deal thành công và tự động tổng hợp vào bảng hoa hồng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitMutation.mutate();
          }}
          className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          {/* Customer section */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#0D6E6E]" />
              <span>Khách hàng chốt deal</span>
            </div>

            {customer ? (
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200">
                <div>
                  <div className="font-bold text-sm text-slate-900">{customer.name}</div>
                  <div className="text-xs text-slate-500 font-mono">
                    {customer.zalo_phone || 'Chưa có SĐT/Zalo'}
                  </div>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                  Đang chốt deal
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Chọn khách hàng sẵn có
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      const c = customers.find((x) => String(x.id) === e.target.value);
                      if (c) {
                        setCustomCustomerName(c.name);
                        setCustomCustomerPhone(c.zalo_phone || '');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0D6E6E]"
                  >
                    <option value="">-- Hoặc nhập tên khách mới bên dưới --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.zalo_phone ? `(${c.zalo_phone})` : ''} - {c.districts || 'HN'}
                      </option>
                    ))}
                  </select>
                </div>

                {!selectedCustomerId && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <input
                        type="text"
                        placeholder="Tên khách hàng *"
                        value={customCustomerName}
                        onChange={(e) => setCustomCustomerName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="SĐT / Zalo"
                        value={customCustomerPhone}
                        onChange={(e) => setCustomCustomerPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Room Selection */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#0D6E6E]" />
                <span>Phòng chốt thuê</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {rooms.length} phòng trong kho
              </span>
            </div>

            <div>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Gõ mã phòng, tên đường, toà nhà để lọc..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <select
                value={selectedRoomId}
                onChange={(e) => handleRoomSelect(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-medium focus:outline-none focus:border-[#0D6E6E]"
              >
                <option value="">-- Chọn phòng từ danh sách --</option>
                {filteredRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.code || `#${r.id}`}] {r.street}, {r.district} — {formatPrice(r.price)}
                    {r.status === 'trong' ? ' (Còn trống)' : ` (${r.status})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div>
                <label className="block text-slate-500 mb-0.5">Mã phòng</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="VD: 505A4"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 bg-white font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-0.5">Tòa nhà / Ngõ</label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="VD: Tòa A4"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 bg-white text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-0.5">Địa chỉ</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="VD: 12 Trần Thái Tông"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 bg-white text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Commission */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Giá chốt & Hoa hồng môi giới</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Rent Price */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Giá chốt thuê (VND) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={rentPrice}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="4000000"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums text-slate-900 bg-white focus:outline-none focus:border-[#0D6E6E]"
                  required
                />
                <div className="text-xs text-slate-500 mt-1">
                  Thành chữ: <span className="font-semibold text-emerald-700">{formatVND(rentPrice)}</span> ({formatPrice(rentPrice)})
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ngày chốt deal *</span>
                </label>
                <input
                  type="date"
                  value={closedDate}
                  onChange={(e) => setClosedDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:border-[#0D6E6E]"
                  required
                />
              </div>
            </div>

            {/* Commission Rate & Amount */}
            <div className="pt-2 border-t border-slate-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-700">Tỷ lệ hoa hồng (%)</label>
                <div className="flex items-center gap-1">
                  {RATE_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleRateChange(p)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        commissionRate === p
                          ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={commissionRate}
                      onChange={(e) => handleRateChange(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums bg-white pr-8 focus:outline-none focus:border-[#0D6E6E]"
                    />
                    <span className="absolute right-3 top-2 text-sm text-slate-400 font-medium">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                    placeholder="2000000"
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-50/50 px-3 py-2 text-sm font-bold tabular-nums text-emerald-800 focus:outline-none focus:border-emerald-600"
                    required
                  />
                  <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                    Hoa hồng: {formatVND(commissionAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Commission Status */}
            <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700">Trạng thái thu hoa hồng:</span>
              <div className="flex items-center gap-2">
                <label
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    commissionStatus === 'cho_thu'
                      ? 'bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-400/20'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="commission_status"
                    value="cho_thu"
                    checked={commissionStatus === 'cho_thu'}
                    onChange={() => setCommissionStatus('cho_thu')}
                    className="sr-only"
                  />
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Chờ thu</span>
                </label>

                <label
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    commissionStatus === 'da_thu'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="commission_status"
                    value="da_thu"
                    checked={commissionStatus === 'da_thu'}
                    onChange={() => setCommissionStatus('da_thu')}
                    className="sr-only"
                  />
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Đã nhận đủ</span>
                </label>
              </div>
            </div>
          </div>

          {/* Room status sync checkbox */}
          {selectedRoomId && (
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-3 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={updateRoomStatus}
                  onChange={(e) => setUpdateRoomStatus(e.target.checked)}
                  className="rounded text-[#0D6E6E] focus:ring-0 w-4 h-4"
                />
                <span>Cập nhật trạng thái phòng trong kho sang:</span>
              </label>

              <select
                disabled={!updateRoomStatus}
                value={roomTargetStatus}
                onChange={(e) => setRoomTargetStatus(e.target.value)}
                className="rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900"
              >
                <option value="da_coc">Đã cọc</option>
                <option value="da_thue">Đã thuê</option>
              </select>
            </div>
          )}

          {/* Deal Note */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Ghi chú deal chốt (thời hạn cọc, ngày vào ở, thỏa thuận...)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Cọc 1 tháng, hợp đồng 1 năm, nhận phòng 15/11, chủ trả hoa hồng sau 3 ngày..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {submitMutation.isPending ? (
                <span>Đang lưu deal...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận Chốt phòng & Lưu hoa hồng</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}