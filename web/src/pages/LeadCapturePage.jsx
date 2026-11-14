import { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Phone,
  User,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  Flame,
  ShieldCheck,
  Check,
  HelpCircle,
  ArrowRight,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api/client';
import { formatPrice } from '../utils/format';

const DISTRICT_OPTIONS = [
  'Cầu Giấy',
  'Đống Đa',
  'Thanh Xuân',
  'Ba Đình',
  'Nam Từ Liêm',
  'Bắc Từ Liêm',
  'Hai Bà Trưng',
  'Tây Hồ',
  'Hoàng Mai',
  'Hà Đông',
];

const BUDGET_PRESETS = [
  { id: 'under_3', label: '< 3 triệu', min: null, max: 3000000 },
  { id: '3_to_5', label: '3 - 5 triệu', min: 3000000, max: 5000000 },
  { id: '5_to_8', label: '5 - 8 triệu', min: 5000000, max: 8000000 },
  { id: 'above_8', label: '> 8 triệu', min: 8000000, max: null },
];

const URGENCY_OPTIONS = [
  {
    value: 'gap',
    label: 'Cần gấp trong vài ngày tới',
    icon: Flame,
    iconColor: 'text-rose-500',
    badge: '🔥 Cần gấp',
    desc: 'Ưu tiên kết nối ngay trong ngày',
    activeBorder: 'border-rose-500 bg-rose-50/50',
    dotClass: 'bg-rose-500',
  },
  {
    value: 'binh_thuong',
    label: 'Bình thường trong tháng này',
    icon: Clock,
    iconColor: 'text-emerald-600',
    badge: '🌿 Bình thường',
    desc: 'Tìm phòng phù hợp & thong thả xem',
    activeBorder: 'border-emerald-600 bg-emerald-50/50',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'hen_truoc',
    label: 'Chưa cần ngay / Hẹn ngày dọn vào',
    icon: Calendar,
    iconColor: 'text-amber-600',
    badge: '⏳ Hẹn trước',
    desc: 'Đặt phòng trước cho kỳ tới',
    activeBorder: 'border-amber-500 bg-amber-50/50',
    dotClass: 'bg-amber-500',
  },
];

export default function LeadCapturePage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDistricts, setSelectedDistricts] = useState(['Cầu Giấy']);
  const [selectedBudgetPreset, setSelectedBudgetPreset] = useState('3_to_5');
  const [budgetMin, setBudgetMin] = useState('3000000');
  const [budgetMax, setBudgetMax] = useState('5000000');
  const [urgency, setUrgency] = useState('gap');
  const [targetDate, setTargetDate] = useState(() => {
    // Default to 3 days ahead for urgency
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  const toggleDistrict = (district) => {
    setSelectedDistricts((prev) =>
      prev.includes(district) ? prev.filter((d) => d !== district) : [...prev, district]
    );
  };

  const handleSelectBudgetPreset = (preset) => {
    setSelectedBudgetPreset(preset.id);
    setBudgetMin(preset.min ? String(preset.min) : '');
    setBudgetMax(preset.max ? String(preset.max) : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Vui lòng nhập họ và tên của bạn');
      return;
    }
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại hoặc Zalo');
      return;
    }

    setError('');
    setLoading(true);

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      zalo_phone: phone.trim(),
      districts: selectedDistricts.join(', '),
      district: selectedDistricts.join(', '),
      budget_min: budgetMin ? parseInt(budgetMin, 10) : null,
      budget_max: budgetMax ? parseInt(budgetMax, 10) : null,
      budget: budgetMax ? parseInt(budgetMax, 10) : null,
      urgency,
      target_date: targetDate,
      move_in_date: targetDate,
      need_note: notes.trim(),
      note: notes.trim(),
    };

    try {
      await api.createLead(payload);
      setSubmittedData({
        ...payload,
        selectedBudgetPresetLabel:
          BUDGET_PRESETS.find((p) => p.id === selectedBudgetPreset)?.label || null,
        urgencyLabel: URGENCY_OPTIONS.find((u) => u.value === urgency)?.label || urgency,
      });
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi gửi thông tin. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName('');
    setPhone('');
    setSelectedDistricts(['Cầu Giấy']);
    setSelectedBudgetPreset('3_to_5');
    setBudgetMin('3000000');
    setBudgetMax('5000000');
    setUrgency('binh_thuong');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setTargetDate(d.toISOString().slice(0, 10));
    setNotes('');
    setSubmittedData(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/50 py-6 px-3 sm:px-4 text-slate-800">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Top Branding & Title Header */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#0D6E6E] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hệ Thống Tìm Phòng Trọ Nhanh Hà Nội</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Đăng ký Tìm Phòng Trọ Nhanh Hà Nội
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Chuyên viên sẽ lọc phòng chính xác & gửi bạn qua Zalo
            </p>
          </div>

          {/* Trust Value Props */}
          <div className="pt-2 grid grid-cols-3 gap-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
            <div className="flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Miễn phí</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#0D6E6E]" />
              <span>Phòng thật - Giá chuẩn</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Phản hồi 5-10 phút</span>
            </div>
          </div>
        </div>

        {/* Success Screen */}
        {submittedData ? (
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Đã gửi yêu cầu thành công!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Cảm ơn <strong>{submittedData.name}</strong>! Chuyên viên hỗ trợ sẽ liên hệ với bạn
                qua số Zalo <strong>{submittedData.phone}</strong> trong vòng 5–10 phút để gửi hình
                ảnh, video và bảng giá các phòng phù hợp nhất.
              </p>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2.5">
              <div className="font-bold text-slate-700 uppercase tracking-wide text-[11px] border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>Tóm tắt nhu cầu đã gửi</span>
                <span className="text-[#0D6E6E] font-medium">Mã: #{Date.now().toString().slice(-6)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400">Họ tên:</span>{' '}
                  <span className="font-semibold text-slate-800">{submittedData.name}</span>
                </div>
                <div>
                  <span className="text-slate-400">SĐT/Zalo:</span>{' '}
                  <span className="font-semibold text-slate-800">{submittedData.phone}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400">Khu vực:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {submittedData.districts || 'Chưa chọn'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400">Ngân sách:</span>{' '}
                  <span className="font-semibold text-emerald-700">
                    {submittedData.budget_min ? formatPrice(submittedData.budget_min) : '0'} –{' '}
                    {submittedData.budget_max ? formatPrice(submittedData.budget_max) : '...'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Mức độ cần:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {submittedData.urgency === 'gap'
                      ? '🔥 Cần gấp'
                      : submittedData.urgency === 'hen_truoc'
                      ? '⏳ Hẹn trước'
                      : '🌿 Bình thường'}
                  </span>
                </div>
              </div>

              {submittedData.target_date && (
                <div>
                  <span className="text-slate-400">Ngày dọn vào:</span>{' '}
                  <span className="font-semibold text-slate-800">{submittedData.target_date}</span>
                </div>
              )}

              {submittedData.need_note && (
                <div>
                  <span className="text-slate-400">Ghi chú:</span>{' '}
                  <span className="text-slate-700 italic">"{submittedData.need_note}"</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Gửi thêm yêu cầu tìm phòng khác</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-5"
          >
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2">
                <span className="font-semibold">Lỗi:</span>
                <span>{error}</span>
              </div>
            )}

            {/* 1. Personal Information */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#0D6E6E]" />
                <span>1. Thông tin liên hệ của bạn</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Hoàng Minh"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại / Zalo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="0987 654 321"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E] transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Chuyên viên sẽ gửi danh sách phòng kèm ảnh qua Zalo số này
                  </p>
                </div>
              </div>
            </div>

            {/* 2. District Multi-selection chips */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#0D6E6E]" />
                  <span>2. Khu vực muốn tìm ({selectedDistricts.length} quận)</span>
                </h2>
                <span className="text-[11px] text-slate-400">Chọn 1 hoặc nhiều quận</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {DISTRICT_OPTIONS.map((dist) => {
                  const isSelected = selectedDistricts.includes(dist);
                  return (
                    <button
                      key={dist}
                      type="button"
                      onClick={() => toggleDistrict(dist)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#0D6E6E] text-white border-[#0D6E6E] shadow-xs scale-[1.02]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                      <span>{dist}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Budget Range */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#0D6E6E]" />
                <span>3. Khoảng giá mong muốn (VND / tháng)</span>
              </h2>

              {/* Quick chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BUDGET_PRESETS.map((preset) => {
                  const isSelected = selectedBudgetPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectBudgetPreset(preset)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition-all ${
                        isSelected
                          ? 'bg-emerald-50 border-[#0D6E6E] text-[#0D6E6E] shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Min/Max manual inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Giá tối thiểu (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    placeholder="VD: 3000000"
                    value={budgetMin}
                    onChange={(e) => {
                      setBudgetMin(e.target.value);
                      setSelectedBudgetPreset(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
                  />
                  {budgetMin ? (
                    <span className="text-[11px] text-emerald-700 font-medium">
                      {formatPrice(budgetMin)}
                    </span>
                  ) : null}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Giá tối đa (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    placeholder="VD: 5000000"
                    value={budgetMax}
                    onChange={(e) => {
                      setBudgetMax(e.target.value);
                      setSelectedBudgetPreset(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
                  />
                  {budgetMax ? (
                    <span className="text-[11px] text-emerald-700 font-medium">
                      {formatPrice(budgetMax)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* 4. Urgency selection */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-500" />
                <span>4. Bạn cần tìm phòng gấp mức nào?</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {URGENCY_OPTIONS.map((opt) => {
                  const isSelected = urgency === opt.value;
                  const Icon = opt.icon;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => setUrgency(opt.value)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? opt.activeBorder
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${opt.iconColor} shrink-0`} />
                        <span className="font-bold text-xs text-slate-900 leading-tight">
                          {opt.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 pl-6">{opt.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Target Move-in Date */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#0D6E6E]" />
                <span>5. Ngày dự kiến dọn vào</span>
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full sm:w-60 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0D6E6E] bg-white"
              />
              <p className="text-[11px] text-slate-400">
                Để chuyên viên ưu tiên lọc các phòng có ngày trống phù hợp với bạn
              </p>
            </div>

            {/* 6. Detailed notes */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#0D6E6E]" />
                <span>6. Tiện ích & Ghi chú bổ sung</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Có máy giặt riêng, ban công thoáng, nuôi mèo, để 2 xe máy, chỉ ở 1 người..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6E6E]/20 focus:border-[#0D6E6E]"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#0D6E6E] to-[#128a8a] hover:from-[#0a5c5c] hover:to-[#0f7777] text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang gửi thông tin...</span>
                  </>
                ) : (
                  <>
                    <span>Gửi yêu cầu tìm phòng ngay</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-slate-400 mt-2">
                Hoàn toàn miễn phí • Không làm phiền sau khi đã tìm được phòng
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
