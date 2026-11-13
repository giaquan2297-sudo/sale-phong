export const HANOI_DISTRICTS = [
  'Cầu Giấy',
  'Đống Đa',
  'Thanh Xuân',
  'Hai Bà Trưng',
  'Ba Đình',
  'Tây Hồ',
  'Hoàng Mai',
  'Nam Từ Liêm',
  'Bắc Từ Liêm',
  'Hà Đông',
  'Long Biên',
  'Hoàn Kiếm',
];

export const ROOM_TYPES = [
  'Phòng trọ chung chủ',
  'Khép kín',
  'Studio',
  'Gác xép',
  'Chung cư mini',
  '1 ngủ 1 khách',
  'Nhà nguyên căn',
  'Mặt bằng',
];

export const ROOM_STATUSES = [
  {
    value: 'trong',
    label: 'Còn trống',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'sap_trong',
    label: 'Sắp trống',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  {
    value: 'da_coc',
    label: 'Đã cọc',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  {
    value: 'da_thue',
    label: 'Đã thuê',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
];

export const STATUS_MAP = Object.fromEntries(ROOM_STATUSES.map((s) => [s.value, s]));

export const SOURCE_LABELS = {
  manual: 'Nhập tay',
  sheet: 'Google Sheet',
  zalo: 'Zalo',
};

export const CUSTOMER_STATUSES = [
  {
    value: 'chua_cham',
    label: 'Chưa chăm',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  {
    value: 'da_cham',
    label: 'Đang chăm sóc',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  {
    value: 'da_chot',
    label: 'Đã chốt phòng',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
];

export const CUSTOMER_STATUS_MAP = Object.fromEntries(
  CUSTOMER_STATUSES.map((s) => [s.value, s])
);

export const COMMISSION_STATUSES = [
  {
    value: 'cho_thu',
    label: 'Chờ thu',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'da_thu',
    label: 'Đã nhận đủ',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'thu_mot_phan',
    label: 'Thu 1 phần',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
];

export const COMMISSION_STATUS_MAP = Object.fromEntries(
  COMMISSION_STATUSES.map((s) => [s.value, s])
);
