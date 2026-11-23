// Strategy 1: Universal Sheet Ingestion & Normalization Utilities for Cloudflare Edge

export const DISTRICTS = [
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
  'Thanh Trì',
  'Gia Lâm',
  'Hoài Đức',
];

export const DISTRICT_KEYWORDS = [
  {
    district: 'Thanh Trì',
    keywords: [
      'thanh trì', 'thanh tri', 'tân triều', 'tan trieu', 'yên xá', 'yen xa',
      'triều khúc', 'trieu khuc', 'tả thanh oai', 'ta thanh oai', 'hữu thanh oai',
      'văn điển', 'van dien', 'tứ hiệp', 'tu hiep', 'ngọc hồi', 'ngoc hoi',
      'thanh liệt', 'thanh liet', 'vĩnh quỳnh', 'vinh quynh', 'cầu bươu', 'cau buou',
      'đại thanh', 'dai thanh', 'kim giang'
    ],
  },
  {
    district: 'Cầu Giấy',
    keywords: [
      'cầu giấy', 'cau giay', 'cg', 'trần thái tông', 'tran thai tong', 'duy tân', 'duy tan',
      'trần duy hưng', 'tran duy hung', 'dịch vọng', 'dich vong', 'mai dịch', 'mai dich',
      'nghĩa tân', 'nghia tan', 'nghĩa đô', 'nghia do', 'quan hoa', 'yên hòa', 'yen hoa',
      'trung hòa', 'trung hoa', 'xuân thủy', 'xuan thuy', 'hồ tùng mậu', 'ho tung mau',
      'nguyễn phong sắc', 'nguyen phong sac', 'hoàng quốc việt', 'hoang quoc viet',
      'tô hiệu', 'to hieu', 'nguyễn khang', 'nguyen khang', 'hạ yên', 'ha yen',
      'trung kính', 'trung kinh', 'phạm văn đồng', 'pham van dong', 'nguyễn chánh',
      'vũ phạm hàm', 'vu pham ham', 'mạc thái tổ', 'mạc thái tông', 'hoa bằng', 'hoa bang',
      'trần quốc vượng', 'trần quý kiên', 'phan văn trường', 'doãn kế thiện', 'doan ke thien',
      'nguyễn khánh toàn', 'nguyen khanh toan', 'dương quảng hàm', 'chùa hà',
      'trần bình', 'tran binh', 'khúc thừa dụ', 'khuc thua du', 'thành thái', 'thanh thai'
    ],
  },
  {
    district: 'Thanh Xuân',
    keywords: [
      'thanh xuân', 'thanh xuan', 'tx', 'nguyễn trãi', 'nguyen trai', 'khương đình', 'khuong dinh',
      'khương trung', 'khuong trung', 'khương mai', 'khuong mai', 'nhân chính', 'nhan chinh',
      'phương liệt', 'phuong liet', 'thanh xuân bắc', 'thanh xuân nam', 'nguyễn tuân', 'nguyen tuan',
      'ngụy như kon tum', 'nguy nhu kon tum', 'lê văn lương', 'le van luong', 'hoàng văn thái',
      'vũ tông phan', 'vu tong phan', 'bùi xương trạch', 'bui xuong trach', 'nguyễn huy tưởng',
      'cự lộc', 'cu loc', 'chính kinh', 'chinh kinh', 'quan nhân', 'quan nhan', 'tô vĩnh diện',
      'vương thừa vũ', 'hạ đình', 'ha dinh', 'hoàng đạo thúy', 'nguyễn xiển',
      'lê trọng tấn', 'le trong tan'
    ],
  },
  {
    district: 'Đống Đa',
    keywords: [
      'đống đa', 'dong da', 'đđ', 'dd', 'chùa láng', 'chua lang', 'đường láng', 'duong lang',
      'láng hạ', 'lang ha', 'láng thượng', 'lang thuong', 'thái hà', 'thai ha', 'thái thịnh', 'thai thinh',
      'tây sơn', 'tay son', 'xã đàn', 'xa dan', 'tôn đức thắng', 'ton duc thang', 'đê la thành',
      'hào nam', 'hao nam', 'ô chợ dừa', 'o cho dua', 'cát linh', 'cat linh', 'khâm thiên',
      'kham thien', 'văn chương', 'van chuong', 'nam đồng', 'nam dong', 'trung tự', 'trung tu',
      'kim liên', 'kim lien', 'phương mai', 'phuong mai', 'nguyễn lương bằng', 'nguyen luong bang',
      'nguyên hồng', 'nguyen hong', 'huỳnh thúc kháng', 'huynh thuc khang', 'đặng văn ngữ',
      'phạm ngọc thạch', 'pham ngoc thach', 'chùa bộc', 'chua boc', 'hoàng cầu', 'hoang cau',
      'yên lãng', 'yen lang', 'trần quang diệu', 'võ văn dũng',
      'quốc tử giám', 'quoc tu giam', 'văn miếu', 'van mieu'
    ],
  },
  {
    district: 'Nam Từ Liêm',
    keywords: [
      'nam từ liêm', 'nam tu liem', 'ntl', 'mỹ đình', 'my dinh', 'mễ trì', 'me tri',
      'phú đô', 'phu do', 'trung văn', 'trung van', 'tây mỗ', 'tay mo', 'đại mỗ', 'dai mo',
      'cầu diễn', 'cau dien', 'phương canh', 'phuong canh', 'xuân phương', 'xuan phuong',
      'đình thôn', 'dinh thon', 'nguyễn cơ thạch', 'nguyen co thach', 'phạm hùng', 'pham hung',
      'lê quang đạo', 'le quang dao', 'đỗ đức dục', 'do duc duc', 'hàm nghi', 'ham nghi',
      'trần hữu dực', 'tran huu duc', 'phùng khoang', 'phung khoang', 'lê đức thọ',
      'phú mỹ', 'phu my', 'miêu nha', 'mieu nha', 'nhổn', 'quang tiến', 'quang tien'
    ],
  },
  {
    district: 'Bắc Từ Liêm',
    keywords: [
      'bắc từ liêm', 'bac tu liem', 'btl', 'nhổn', 'nhon', 'cổ nhuế', 'co nhue',
      'đông ngạc', 'dong ngac', 'đức thắng', 'duc thang', 'xuân đỉnh', 'xuan dinh',
      'xuân tảo', 'xuan tao', 'thụy phương', 'thuy phuong', 'tây tựu', 'tay tuu',
      'kiều mai', 'kieu mai', 'hoàng công chất', 'hoang cong chat', 'văn tiến dũng', 'van tien dung',
      'trần cung', 'tran cung', 'phạm văn đồng', 'pham van dong'
    ],
  },
  {
    district: 'Hà Đông',
    keywords: [
      'hà đông', 'ha dong', 'hd', 'quang trung', 'vạn phúc', 'van phuc', 'mỗ lao', 'mo lao',
      'văn quán', 'van quan', 'la khê', 'la khe', 'yên nghĩa', 'yen nghia', 'kiến hưng', 'kien hung',
      'dương nội', 'duong noi', 'hà cầu', 'ha cau', 'xala', 'xa la', 'ngô thì nhậm', 'ngo thi nham',
      'trần phú', 'tran phu', 'ba la', 'phố xốm', 'đô nghĩa', 'do nghia',
      'học viện quân y', 'hoc vien quan y', 'phùng hưng', 'phúc la'
    ],
  },
  {
    district: 'Hai Bà Trưng',
    keywords: [
      'hai bà trưng', 'hai ba trung', 'hbt', 'bách khoa', 'bach khoa', 'bạch mai', 'bach mai',
      'minh khai', 'trương định', 'truong dinh', 'thanh nhàn', 'thanh nhan', 'đồng tâm', 'dong tam',
      'vĩnh tuy', 'vinh tuy', 'phố huế', 'pho hue', 'bà triệu', 'ba trieu', 'lò đúc', 'lo duc',
      'trần khát chân', 'tran khat chan', 'lê thanh nghị', 'le thanh nghi', 'tạ quang bửu', 'ta quang buu',
      'đại la', 'dai la'
    ],
  },
  {
    district: 'Ba Đình',
    keywords: [
      'ba đình', 'ba dinh', 'bđ', 'bd', 'đội cấn', 'doi can', 'kim mã', 'kim ma',
      'giảng võ', 'giang vo', 'liễu giai', 'lieu giai', 'cống vị', 'cong vi', 'ngọc khánh', 'ngoc khanh',
      'quán thánh', 'quan thanh', 'hoàng hoa thám', 'hoang hoa tham', 'đốc ngữ',
      'đường bưởi', 'duong buoi', 'trấn vũ', 'tran vu', 'trúc bạch', 'truc bach'
    ],
  },
  {
    district: 'Tây Hồ',
    keywords: [
      'tây hồ', 'tay ho', 'th', 'lạc long quân', 'lac long quan', 'thụy khuê', 'thuy khue',
      'xuân la', 'xuan la', 'quảng an', 'quang an', 'yên phụ', 'yen phu', 'tứ liên', 'tu lien',
      'nhật tân', 'nhat tan', 'võ chí công', 'vo chi cong', 'âu cơ', 'au co', 'tô ngọc vân'
    ],
  },
  {
    district: 'Hoàng Mai',
    keywords: [
      'hoàng mai', 'hoang mai', 'hm', 'định công', 'dinh cong', 'linh đàm', 'linh dam',
      'giáp bát', 'giap bat', 'hoàng văn thụ', 'tương mai', 'tuong mai', 'vĩnh hưng', 'vinh hung',
      'tân mai', 'tan mai', 'lĩnh nam', 'linh nam', 'yên sở', 'yen so', 'thịnh liệt', 'thinh liet',
      'giải phóng', 'giai phong', 'đại từ'
    ],
  },
  {
    district: 'Hoàn Kiếm',
    keywords: ['hoàn kiếm', 'hoan kiem', 'hk', 'phố cổ', 'pho co', 'hàng bài', 'tràng tiền'],
  },
  {
    district: 'Long Biên',
    keywords: ['long biên', 'long bien', 'ngọc lâm', 'ngoc lam', 'bồ đề', 'bo de', 'sài đồng', 'sai dong', 'thạch bàn', 'việt hưng'],
  },
  {
    district: 'Gia Lâm',
    keywords: ['gia lâm', 'gia lam', 'trâu quỳ', 'trau quy', 'ocean park', 'bát tràng'],
  },
  {
    district: 'Hoài Đức',
    keywords: ['hoài đức', 'hoai duc', 'an khánh', 'an khanh', 'kim chung', 'di trạch', 'vân canh', 'trạm trôi'],
  },
];

export const FIELD_SYNONYMS = {
  code: [
    'mã phòng', 'ma phong', 'số phòng', 'so phong', 'tên phòng', 'ten phong',
    'phòng', 'phong', 'phòng số', 'phong so', 'tên mặt hàng', 'ten mat hang',
    'mã căn', 'ma can', 'số p', 'so p', 'mã p', 'ma p', 'mã mặt hàng', 'ma mat hang',
    'căn', 'room'
  ],
  price: [
    'giá', 'gia', 'giá tiền', 'gia tien', 'giá thuê', 'gia thue', 'giá phòng', 'gia phong',
    'giá chốt', 'gia chot', 'giá nét', 'gia net', 'giá net', 'net',
    'tiền thuê', 'tien thue', 'tiền phòng', 'tien phong', 'giá cho thuê', 'gia cho thue',
    'giá ký hd', 'gia ky hd', 'giá ký hđ', 'giá thu', 'gia thu', 'đơn giá', 'don gia',
    'mức giá', 'muc gia', 'giá khách', 'gia khach', 'giá bán', 'gia ban', 'price',
    'giá gốc', 'gia goc'
  ],
  district: [
    'khu vực', 'khu vuc', 'quận', 'huyện', 'quận/huyện', 'quan/huyen',
    'địa bàn', 'dia ban', 'khu', 'kv'
  ],
  street: [
    'tên đường', 'ten duong', 'tòa nhà', 'toa nha', 'toà nhà',
    'tên tòa', 'ten toa', 'đường', 'phố'
  ],
  address: [
    'địa chỉ', 'dia chi', 'địa chỉ cụ thể', 'dia chi cu the', 'địa chỉ nhà', 'dia chi nha',
    'địa chỉ toà nhà', 'địa chỉ tòa nhà', 'đ/c', 'dc', 'số nhà', 'so nha'
  ],
  room_type: [
    'loại phòng', 'loai phong', 'loại', 'loai', 'kiểu phòng', 'kieu phong',
    'phân loại', 'phan loai', 'loại căn', 'loai can', 'dạng phòng', 'dang phong',
    'loại hình', 'loai hinh', 'kết cấu', 'ket cau', 'mô hình', 'mo hinh'
  ],
  status: [
    'tình trạng', 'tinh trang', 'trạng thái', 'trang thai', 'hiện trạng', 'hien trang',
    'tình trạng phòng', 'tinh trang phong', 'status', 'còn/hết', 'con/het',
    'trống/hết', 'trong/het', 'còn trống', 'con trong'
  ],
  deposit: [
    'tiền cọc', 'tien coc', 'đặt cọc', 'dat coc', 'mức cọc', 'muc coc',
    'cọc giữ', 'coc giu', 'cọc', 'coc', 'deposit'
  ],
  area: [
    'diện tích', 'dien tich', 'diện tích (m2)', 'diện tich', 'dt', 'm2', 'm²'
  ],
  amenities: [
    'thiết bị nội thất', 'thiet bi noi that', 'nội thất', 'noi that', 'tiện ích', 'tien ich',
    'đồ đạc', 'do dac', 'trang thiết bị', 'trang thiet bi', 'thiết bị', 'thiet bi',
    'full đồ', 'full do', 'tiện nghi', 'đồ'
  ],
  electric_price: [
    'giá điện', 'gia dien', 'tiền điện', 'tien dien', 'số điện', 'so dien', 'điện'
  ],
  water_price: [
    'giá nước', 'gia nuoc', 'tiền nước', 'tien nuoc', 'khối nước', 'khoi nuoc', 'nước'
  ],
  available_from: [
    'ngày trống', 'ngay trong', 'thời gian vào', 'thoi gian vao', 'ngày vào', 'ngay vao',
    'dự kiến trống', 'du kien trong', 'hợp đồng ký đến ngày', 'hop dong ky den ngay',
    'hạn hợp đồng', 'han hop dong', 'trống từ', 'ngày ra'
  ],
  description: [
    'dịch vụ', 'dich vu', 'mô tả', 'mo ta', 'chi tiết', 'chi tiet',
    'thông tin thêm', 'thông tin tòa', 'ghi chú chung', 'ghi chu chung',
    'đặc điểm', 'dac diem', 'tiện ích gần đó'
  ],
  private_note: [
    'ql nhà', 'ql nha', 'quản lý dẫn khách', 'quan ly dan khach', 'quản lý', 'quan ly',
    'sđt', 'sdt', 'liên hệ', 'lien he', 'chủ nhà', 'chu nha',
    'ghi chú riêng', 'ghi chu rieng', 'ghi chú', 'ghi chu', 'note',
    'hoa hồng', 'hoa hong', 'phí môi giới', 'phi moi gioi', 'ql'
  ],
  images: [
    'ảnh + video', 'ảnh+video', 'link ảnh phòng', 'link anh phong', 'link ảnh', 'link anh',
    'hình ảnh', 'hinh anh', 'ảnh phòng', 'anh phong', 'thư mục ảnh', 'thu muc anh',
    'link drive', 'ảnh', 'drive', 'video', 'tiktok', 'album', 'hình', 'photo', 'photos'
  ],
};

export function cleanNormalizeText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Preserves Vietnamese diacritics so "điện" never collides with "diện tích",
 * "quận" never collides with "quản lý" / "quang minh", and "ảnh" never collides with "minh anh".
 */
export function normalizeViText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s/+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the actual column header title from a raw header cell:
 * - Filters out manager phone contact cells (e.g. "Minh Anh 035.432.8811")
 * - Strips parenthetical instructions (e.g. "SỐ PHÒNG \n(Màu đỏ hết tháng 12 ở được)" -> "SỐ PHÒNG")
 * - Extracts the trailing header title from multiline banner cells (e.g. "...Xe free  ĐỊA CHỈ" -> "ĐỊA CHỈ")
 */
export function extractCoreHeaderTitle(rawHeader) {
  const raw = String(rawHeader || '').trim();
  if (!raw) return '';

  // Strip parenthetical instructions first
  const withoutParens = raw.replace(/\([^)]*\)/g, ' ').trim();
  if (!withoutParens) return '';

  // If short cell with a phone number and no newline banner, check if it's just a person's contact (e.g. "Minh Anh 035.432.8811")
  if (withoutParens.length <= 45 && /0\d{2,4}[\s.-]?\d{3}[\s.-]?\d{3,4}/.test(withoutParens)) {
    const strippedPhone = withoutParens.replace(/0\d{2,4}[\s.-]?\d{3}[\s.-]?\d{3,4}/g, '').trim();
    const vi = normalizeViText(strippedPhone);
    const hasHeaderWord = ['địa chỉ', 'quản lý', 'liên hệ', 'sđt', 'chủ nhà', 'ghi chú'].some((w) => vi.includes(w));
    if (!hasHeaderWord) return '';
  }

  // If multiline or long banner cell (like Sheet 3 Anh Nhật), split by newlines or 2+ spaces
  if (withoutParens.includes('\n') || withoutParens.length > 35) {
    const segments = withoutParens
      .split(/\r?\n|\s{2,}/)
      .map((s) => s.replace(/^[-*+•💥‼️🌹👉\s]+/, '').trim())
      .filter(Boolean);

    // Search from the last segment backwards for a recognizable column title
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (seg.length > 35) continue;
      const viSeg = normalizeViText(seg);
      if (!viSeg) continue;
      for (const synonyms of Object.values(FIELD_SYNONYMS)) {
        if (synonyms.some((syn) => {
          const viSyn = normalizeViText(syn);
          return viSeg === viSyn || viSeg.startsWith(viSyn + ' ') || viSeg.endsWith(' ' + viSyn);
        })) {
          return seg;
        }
      }
    }

    const lastSeg = segments[segments.length - 1] || '';
    return lastSeg.length <= 35 ? lastSeg : '';
  }

  return withoutParens;
}

export function detectDistrict(text) {
  if (!text) return '';
  const clean = cleanNormalizeText(text);
  if (!clean) return '';

  // 1. Check exact or word boundary match with official district names
  for (const d of DISTRICTS) {
    const cleanD = cleanNormalizeText(d);
    const regex = new RegExp(`(?:^|\\s)${cleanD}(?:\\s|$)`);
    if (regex.test(clean)) {
      return d;
    }
  }

  // 2. Check keywords (streets, wards, landmarks, abbreviations)
  for (const item of DISTRICT_KEYWORDS) {
    for (const kw of item.keywords) {
      const cleanKw = cleanNormalizeText(kw);
      if (!cleanKw) continue;
      if (cleanKw.length <= 3) {
        const regex = new RegExp(`(?:^|\\s)${cleanKw}(?:\\s|$)`);
        if (regex.test(clean)) return item.district;
      } else {
        if (clean.includes(cleanKw)) {
          return item.district;
        }
      }
    }
  }

  return '';
}

export function normalizeRoomType(text, description = '', code = '') {
  const combined = `${text || ''} ${description || ''} ${code || ''}`.toLowerCase();

  if (/studio|\bst\b|ccmn/i.test(combined)) return 'Studio';
  if (/1n1k|1n\+1k|1n1b|1n\+1b|1\s*ngủ\s*1\s*khách|1pn\s*1pk|1k1n|1n\s*1k/i.test(combined)) return '1N1K';
  if (/2n1k|2n\+1k|2n1b|2n\+1b|2\s*ngủ\s*1\s*khách|2pn\s*1pk|2k1n|2n\s*1k/i.test(combined)) return '2N1K';
  if (/gác\s*xép|gac\s*xep|\bgx\b|gác\s*lửng|gac\s*lung|\bgl\b/i.test(combined)) return 'Gác xép';
  if (/duplex/i.test(combined)) return 'Duplex';
  if (/chung\s*chủ|chung\s*chu/i.test(combined)) return 'Chung chủ';
  if (/khép\s*kín|khep\s*kin|\bkk\b|phòng\s*đơn|đơn/i.test(combined)) return 'Khép kín';

  const clean = String(text || '').trim();
  // If clean is actually utility/amenity text like "thang máy, máy giặt", fallback to "Khép kín"
  if (/thang\s*máy|máy\s*giặt|điều\s*hòa|nóng\s*lạnh|tủ\s*lạnh|nội\s*thất/i.test(clean)) {
    return 'Khép kín';
  }
  if (clean && clean.length <= 25 && !/^[0-9]+$/.test(clean)) {
    return clean;
  }
  return 'Khép kín';
}

export function parsePrice(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) return 0;
    if (raw < 100) return Math.round(raw * 1000000);
    if (raw < 100000) return Math.round(raw * 1000);
    return Math.round(raw);
  }
  let str = String(raw).trim().toLowerCase();
  if (!str || /^-/.test(str)) return 0;

  // Ignore Vietnamese phone numbers (e.g. "0865599604", "0982379505")
  if (/^0\d{8,10}$/.test(str.replace(/[\s.-]/g, ''))) return 0;

  // Ignore room types ("1N1K", "2N1K", "1N1B"), area ("25m2", "27m3"), dates ("1/12"), or room codes ("P201")
  if (/\b[1-4]n\s*\+?\s*[1-2][kbh]/i.test(str)) return 0;
  if (/^\d+(?:[.,]\d+)?\s*(?:m2|m²|m3)\b/i.test(str)) return 0;
  if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+|$)/i.test(str)) return 0;
  if (/^(?:p|phòng|trục)\s*\d+/i.test(str)) return 0;

  // Handle alternatives like "45,000,000 hoặc 2000$"
  if (/\s+(?:hoặc|hoac|or)\s+/i.test(str)) {
    const firstChoice = str.split(/\s+(?:hoặc|hoac|or)\s+/i)[0]?.trim();
    if (firstChoice) {
      const p = parsePrice(firstChoice);
      if (p > 0) return p;
    }
  }

  // Handle ranges like "3.5 - 4tr" -> pick lower bound
  if (/[-~–—]/.test(str)) {
    const parts = str.split(/[-~–—]/);
    if (parts[0] && parts[0].trim()) {
      const minPart = parts[0].trim();
      const unitMatch = parts[1]?.match(/(?:tr|triệu|trieu|k|m(?!2|²|3))/i);
      const toParse = unitMatch && !/(?:tr|triệu|trieu|k|m)/i.test(minPart)
        ? `${minPart}${unitMatch[0]}`
        : minPart;
      const parsedMin = parsePrice(toParse);
      if (parsedMin > 0) return parsedMin;
    }
  }

  // Strip currency words/symbols
  str = str.replace(/đồng|vnd|vnđ|đ|\/tháng|\/th|tháng/g, '').trim();
  if (!str || /^-/.test(str)) return 0;

  // Pattern like "3 triệu rưỡi"
  const ruoiMatch = str.match(/(\d+)\s*(?:tr|triệu|trieu)\s*(?:rưỡi|ruoi)/i);
  if (ruoiMatch) {
    return Math.round((parseInt(ruoiMatch[1], 10) + 0.5) * 1000000);
  }

  // Handle "X triệu Y" / "XtrY" / "3m5"
  const trSplitMatch = str.match(/^(\d+)\s*(?:tr|triệu|trieu|m(?!2|²|3))\s*(\d+)(?:k|tr)?$/i);
  if (trSplitMatch) {
    const millions = parseInt(trSplitMatch[1], 10);
    const fracStr = trSplitMatch[2];
    const decimal = parseInt(fracStr, 10) / Math.pow(10, fracStr.length);
    return Math.round((millions + decimal) * 1000000);
  }

  // Pattern like "3.5tr", "3,5 triệu", "4tr" (must NOT match "68 triều khúc" or "15 trần cung")
  const trMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr|m)(?=$|[\s.,;/)\]]|\d)/i);
  if (trMatch) {
    const num = parseFloat(trMatch[1].replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 1000000) : 0;
  }

  // Pattern like "3500k" or "3.500k"
  const kMatch = str.match(/(\d+(?:[.,]\d+)?)\s*k(?=$|[\s.,;/)\]])/i);
  if (kMatch) {
    const cleaned = kMatch[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? Math.round(num * 1000) : 0;
  }

  // Formatted numbers like "3.500.000", "3,500,000", or thousands like "4.000", "3.700"
  if (/^\d{1,3}([.,]\d{3})+$/.test(str)) {
    const parsed = parseInt(str.replace(/[.,]/g, ''), 10) || 0;
    if (parsed > 0 && parsed < 100000) {
      return parsed * 1000;
    }
    return parsed;
  }

  // Plain number or decimal like "3.5" / "3,5" / "3500" / "3500000"
  if (/^\d+(?:[.,]\d+)?$/.test(str)) {
    const plain = parseFloat(str.replace(',', '.'));
    if (!Number.isFinite(plain) || plain <= 0) return 0;
    if (plain < 100) return Math.round(plain * 1000000);
    if (plain < 100000) return Math.round(plain * 1000);
    return Math.round(plain);
  }

  return 0;
}

export function parseDeposit(raw, roomPrice = 0) {
  if (!raw) return roomPrice > 0 ? roomPrice : 0;
  if (typeof raw === 'number') {
    if (raw <= 0) return roomPrice;
    if (raw <= 10 && roomPrice > 0) return Math.round(raw * roomPrice);
    if (raw < 100) return Math.round(raw * 1000000);
    return Math.round(raw);
  }
  const str = String(raw).trim().toLowerCase();
  if (!str) return roomPrice;

  const percentMatch = str.match(/(\d+)\s*%/);
  if (percentMatch && roomPrice > 0) {
    return Math.round((parseFloat(percentMatch[1]) / 100) * roomPrice);
  }

  const monthMatch = str.match(/(?:cọc|coc)?\s*(\d+(?:[.,]\d+)?)\s*(?:tháng|thang|th|t)\b/i);
  if (monthMatch && roomPrice > 0) {
    const months = parseFloat(monthMatch[1].replace(',', '.'));
    if (!isNaN(months) && months > 0) {
      return Math.round(months * roomPrice);
    }
  }

  const parsed = parsePrice(raw);
  return parsed > 0 ? parsed : roomPrice;
}

export function parseAreaM2(rawArea) {
  if (!rawArea) return null;
  const str = String(rawArea).trim().toLowerCase().replace(/m2|m²|m3|mét|met/gi, '');
  if (str.includes('+')) {
    const parts = str.split('+');
    let total = 0;
    for (const p of parts) {
      const num = parseFloat(p.replace(',', '.').replace(/[^\d.]/g, ''));
      if (Number.isFinite(num)) total += num;
    }
    return total > 0 ? Math.round(total * 10) / 10 : null;
  }
  const clean = str.replace(',', '.').replace(/[^\d.]/g, '');
  const num = parseFloat(clean);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function extractElectricAndWater(text) {
  const s = String(text || '');
  if (!s) return { electric: '', water: '' };

  let electric = '';
  let water = '';

  const elecMatch = s.match(/(?:^|[^\p{L}\p{N}])(?:giá\s*điện|tiền\s*điện|điện)\s*[:=-]?\s*(giá\s*dân|nhà\s*nước|\d+(?:[.,]\d+)?\s*(?:k|đ|đồng|nghìn)(?:\s*\/\s*(?:số|kwh|kw))?)/iu);
  if (elecMatch) {
    electric = elecMatch[1].trim().replace(/\s+/g, ' ');
  }

  const waterMatch = s.match(/(?:^|[^\p{L}\p{N}])(?:giá\s*nước|tiền\s*nước|nước)\s*[:=-]?\s*(giá\s*dân|nhà\s*nước|\d+(?:[.,]\d+)?\s*(?:k|đ|đồng|nghìn)?(?:\s*\/\s*(?:khối|m3|m³|người|ng|tháng))?)/iu);
  if (waterMatch) {
    water = waterMatch[1].trim().replace(/\s+/g, ' ');
  }

  return { electric, water };
}

const UTILITY_SYNONYMS = [
  { match: /(?:^|[^\p{L}\p{N}])(?:dh|đh|dieu hoa|điều hoà|điều hòa|ac)(?:$|[^\p{L}\p{N}])/iu, label: 'Điều hoà' },
  { match: /(?:^|[^\p{L}\p{N}])(?:nl|nong lanh|nóng lạnh|bình nóng lạnh)(?:$|[^\p{L}\p{N}])/iu, label: 'Nóng lạnh' },
  { match: /(?:^|[^\p{L}\p{N}])(?:tl|tu lanh|tủ lạnh)(?:$|[^\p{L}\p{N}])/iu, label: 'Tủ lạnh' },
  { match: /(?:^|[^\p{L}\p{N}])(?:mg|may giat|máy giặt)(?:$|[^\p{L}\p{N}])/iu, label: 'Máy giặt' },
  { match: /(?:^|[^\p{L}\p{N}])(?:g|giuong|giường)(?:$|[^\p{L}\p{N}])/iu, label: 'Giường' },
  { match: /(?:^|[^\p{L}\p{N}])(?:t|tu|tủ|tu quan ao|tủ quần áo)(?:$|[^\p{L}\p{N}])/iu, label: 'Tủ quần áo' },
  { match: /(?:^|[^\p{L}\p{N}])(?:bc|ban cong|ban công)(?:$|[^\p{L}\p{N}])/iu, label: 'Ban công' },
  { match: /(?:^|[^\p{L}\p{N}])(?:cs|cua so|cửa sổ)(?:$|[^\p{L}\p{N}])/iu, label: 'Cửa sổ' },
  { match: /(?:^|[^\p{L}\p{N}])(?:bep|bếp|ke bep|kệ bếp|tu bep|tủ bếp)(?:$|[^\p{L}\p{N}])/iu, label: 'Kệ bếp' },
  { match: /(?:^|[^\p{L}\p{N}])(?:tm|thang may|thang máy)(?:$|[^\p{L}\p{N}])/iu, label: 'Thang máy' },
  { match: /(?:^|[^\p{L}\p{N}])(?:gx|gac xep|gác xép|gac lung|gác lửng)(?:$|[^\p{L}\p{N}])/iu, label: 'Gác xép' },
  { match: /(?:^|[^\p{L}\p{N}])(?:full|full do|full đồ|full noi that|full nội thất)(?:$|[^\p{L}\p{N}])/iu, label: 'Full nội thất' },
];

export function extractUtilitiesAndAmenities(text, existingAmenities = '') {
  const detected = new Set();
  if (existingAmenities) {
    existingAmenities.split(/[,;\n+]+/).forEach((item) => {
      const trimmed = item.trim();
      if (trimmed) detected.add(trimmed);
    });
  }
  const clean = String(text || '').trim();
  if (!clean) return Array.from(detected).join(', ');

  for (const { match, label } of UTILITY_SYNONYMS) {
    if (match.test(clean)) {
      detected.add(label);
    }
  }

  if (detected.size === 0) {
    clean.split(/[,;\n+]+/).forEach((part) => {
      const p = part.trim();
      if (p.length >= 2 && p.length <= 40) detected.add(p);
    });
  }

  return Array.from(detected).join(', ');
}

export function normalizeStatus(rawValue, statusRules = {}) {
  const text = String(rawValue || '').trim().toLowerCase();
  if (!text) return 'trong';

  for (const [pattern, targetStatus] of Object.entries(statusRules)) {
    if (pattern && text.includes(pattern.toLowerCase())) {
      return targetStatus;
    }
  }

  if (/(?:\d{1,2}\/\d{1,2}|trống từ|ra ngày|hết hạn|cuối tháng|đầu tháng|chuẩn bị ra|sắp ra|ở đến)/i.test(text)) {
    return 'sap_trong';
  }
  if (text.includes('đã thuê') || text.includes('da thue') || text.includes('đang ở') || text.includes('dang o') || text.includes('hết') || text.includes('full') || text.includes('kín') || text.includes('đã cho thuê')) {
    return 'da_thue';
  }
  if (text.includes('cọc') || text.includes('coc')) {
    return 'da_coc';
  }
  if (text.includes('ct') || text.includes('chuẩn bị') || text.includes('chuan bi') || text.includes('sắp') || text.includes('sap') || text.includes('chờ') || text.includes('cho')) {
    return 'sap_trong';
  }
  return 'trong';
}

export function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const text = String(csvText || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Discovers all visible worksheet tabs [{ name, gid }] of a public Google Spreadsheet
 * by inspecting /htmlview. Hidden tabs are automatically excluded by Google Sheets.
 */
export async function fetchSpreadsheetTabs(spreadsheetId) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/htmlview`;
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) return [];
    const html = await resp.text();
    const tabs = [];
    const regex = /items\.push\(\{name:\s*"([^"]+)",\s*pageUrl:\s*"[^"]*gid=(-?\d+)[^"]*"/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      tabs.push({ name: m[1].trim(), gid: m[2].trim() });
    }
    return tabs;
  } catch {
    return [];
  }
}

function isHtmlErrorResponse(resp, body) {
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  const trimmed = String(body || '').trimStart();
  return (
    !resp.ok ||
    contentType.includes('text/html') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html')
  );
}

export async function fetchPublicSheetRows(spreadsheetId, sheetName = 'Sheet1', explicitGid = '') {
  const id = encodeURIComponent(spreadsheetId);
  let targetGid = explicitGid ? String(explicitGid).trim() : '';

  // If no explicit gid is provided and sheetName is generic 'Sheet1', resolve the first visible tab's gid
  if (!targetGid) {
    const tabs = await fetchSpreadsheetTabs(spreadsheetId);
    if (tabs.length > 0) {
      const matched =
        sheetName && sheetName !== 'Sheet1'
          ? tabs.find((t) => t.name.toLowerCase() === String(sheetName).trim().toLowerCase())
          : null;
      targetGid = (matched || tabs[0]).gid;
    }
  }

  // 1. Prefer /export?format=csv&gid=... for 100% lossless cell values and exact 1-to-1 row numbers
  if (targetGid) {
    try {
      const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(targetGid)}`;
      const expResp = await fetch(exportUrl, { redirect: 'follow' });
      const expBody = await expResp.text();
      if (!isHtmlErrorResponse(expResp, expBody) && expBody.trim().length > 0) {
        return parseCsvRows(expBody);
      }
    } catch {}

    // 2. Fallback to /gviz/tq?tqx=out:csv&gid=... (when owner disables download/export)
    const gvizGidUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(targetGid)}`;
    const gvizResp = await fetch(gvizGidUrl, { redirect: 'follow' });
    const gvizBody = await gvizResp.text();
    if (!isHtmlErrorResponse(gvizResp, gvizBody)) {
      return parseCsvRows(gvizBody);
    }
  }

  // 3. Final fallback by sheet name
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName || 'Sheet1')}`;
  const resp = await fetch(url, { redirect: 'follow' });
  const body = await resp.text();

  if (isHtmlErrorResponse(resp, body)) {
    throw new Error('Google Sheet đang ở chế độ riêng tư. Vui lòng bật chia sẻ "Bất kỳ ai có đường liên kết đều xem được".');
  }

  return parseCsvRows(body);
}

const EXCLUDED_HEADER_PATTERNS = /^(?:stt|số thứ tự|sl|số lượng|số lượng trống|giảm giá|khuyến mãi|giới hạn xe|finish)$/i;

function isFieldBlockedByHeaderContext(field, viHeader) {
  if (field === 'code' && /(?:loại|giá|ảnh|video|tình trạng|trạng thái|lượng|diện tích|nội thất)/.test(viHeader)) {
    return true;
  }
  if (field === 'price' && /(?:điện|nước|dịch vụ|giảm|cọc|hoa hồng)/.test(viHeader)) {
    return true;
  }
  if ((field === 'address' || field === 'street') && /(?:map|bản đồ|link)/.test(viHeader)) {
    return true;
  }
  if (field === 'electric_price' && /diện tích/.test(viHeader)) {
    return true;
  }
  if (field === 'district' && /(?:quản lý|dẫn khách|liên hệ|sđt)/.test(viHeader)) {
    return true;
  }
  if (field === 'available_from' && /(?:số lượng|sl|giá)/.test(viHeader)) {
    return true;
  }
  if (field === 'amenities' && /gần đó/.test(viHeader)) {
    return true;
  }
  return false;
}

export function detectHeaderRow(rows) {
  if (!rows || rows.length === 0) return 1;
  const maxScan = Math.min(rows.length, 15);
  let bestRowIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    let score = 0;
    const matchedFields = new Set();

    for (const cell of row) {
      const core = extractCoreHeaderTitle(cell);
      if (!core || core.length > 40) continue;
      if (EXCLUDED_HEADER_PATTERNS.test(core.trim())) continue;

      const vi = normalizeViText(core);
      const clean = cleanNormalizeText(core);
      if (!vi) continue;

      for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
        if (matchedFields.has(field)) continue;
        if (isFieldBlockedByHeaderContext(field, vi)) continue;

        for (const syn of synonyms) {
          const viSyn = normalizeViText(syn);
          const cleanSyn = cleanNormalizeText(syn);
          const allowAscii = viSyn === cleanSyn && cleanSyn.includes(' ');

          if (vi === viSyn || (allowAscii && clean === cleanSyn)) {
            score += 15;
            matchedFields.add(field);
            break;
          } else if (
            vi.startsWith(viSyn + ' ') ||
            vi.endsWith(' ' + viSyn) ||
            vi.includes(' ' + viSyn + ' ') ||
            (allowAscii && (clean.startsWith(cleanSyn + ' ') || clean.endsWith(' ' + cleanSyn)))
          ) {
            score += 8;
            matchedFields.add(field);
            break;
          }
        }
      }
    }

    score += matchedFields.size * 10;

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = i;
    }
  }

  return bestScore >= 15 ? bestRowIndex + 1 : 1;
}

export function detectColumnMap(headers, sampleRows = []) {
  const columnMap = {};
  if (!Array.isArray(headers) || headers.length === 0) return columnMap;

  const candidates = [];

  headers.forEach((header, colIndex) => {
    const headerStr = String(header || '').trim();
    if (!headerStr) return;

    const coreTitle = extractCoreHeaderTitle(headerStr);
    if (!coreTitle) return;
    if (EXCLUDED_HEADER_PATTERNS.test(coreTitle.trim())) return;

    const viHeader = normalizeViText(coreTitle);
    const cleanHeader = cleanNormalizeText(coreTitle);
    if (!viHeader) return;

    for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      if (isFieldBlockedByHeaderContext(field, viHeader)) continue;

      synonyms.forEach((syn, synIndex) => {
        const viSyn = normalizeViText(syn);
        const cleanSyn = cleanNormalizeText(syn);
        const allowAscii = viSyn === cleanSyn && (cleanSyn.includes(' ') || cleanSyn.length >= 4);
        let score = 0;

        if (viHeader === viSyn || (allowAscii && cleanHeader === cleanSyn)) {
          score = 1000 - synIndex * 5;
        } else if (
          viHeader.startsWith(viSyn + ' ') ||
          viHeader.endsWith(' ' + viSyn) ||
          viHeader.includes(' ' + viSyn + ' ') ||
          (allowAscii && (
            cleanHeader.startsWith(cleanSyn + ' ') ||
            cleanHeader.endsWith(' ' + cleanSyn) ||
            cleanHeader.includes(' ' + cleanSyn + ' ')
          ))
        ) {
          score = 800 - synIndex * 5 - Math.min(50, viHeader.length - viSyn.length);
        } else if (viSyn.length >= 5 && viHeader.includes(viSyn)) {
          score = 550 - synIndex * 5 - Math.min(80, viHeader.length - viSyn.length);
        }

        if (score > 0) {
          candidates.push({ field, header: headerStr, colIndex, score, synIndex });
        }
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  const mappedFields = new Set();
  const claimedCols = new Set();

  for (const cand of candidates) {
    if (!mappedFields.has(cand.field) && !claimedCols.has(cand.colIndex)) {
      columnMap[cand.field] = cand.header;
      mappedFields.add(cand.field);
      claimedCols.add(cand.colIndex);
    }
  }

  return columnMap;
}

/**
 * Extracts Google Drive Folder ID from various URL patterns
 */
export function extractDriveFolderId(input) {
  if (!input) return null;
  const str = String(input).trim();
  const folderMatch = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && !str.includes('/file/d/')) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(str) && !str.includes('http')) return str;
  return null;
}

/**
 * Extracts Google Drive File ID from various URL patterns
 */
export function extractDriveFileId(input) {
  if (!input) return null;
  const str = String(input).trim();
  const fileMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const openMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch && (str.includes('/open') || str.includes('/uc'))) return openMatch[1];
  return null;
}

/**
 * Parses flip-entry items from https://drive.google.com/embeddedfolderview?id=<id>#list
 */
export function parseEmbeddedFolderView(html) {
  const entries = [];
  if (!html) return entries;
  const entryRegex =
    /<div class="flip-entry" id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
  let m;
  while ((m = entryRegex.exec(html)) !== null) {
    const id = m[1];
    const href = m[2];
    const title = m[3].trim();
    const isFolder = href.includes('/folders/') || m[0].includes('aria-label="Folder"');
    const isVideo =
      m[0].includes('type/video') ||
      m[0].includes('alt="Video"') ||
      /\.(mp4|mov|avi|wmv|mkv|webm)$/i.test(title);
    entries.push({ id, href, title, isFolder, isVideo });
  }
  return entries;
}

/**
 * Resolves image items from a Google Drive folder or file ID into direct CDN URLs
 */
export async function resolveDriveFolderImages(urlOrId) {
  const folderId = extractDriveFolderId(urlOrId);
  if (!folderId) {
    const fileId = extractDriveFileId(urlOrId);
    if (fileId) {
      return [{ id: fileId, url: `https://lh3.googleusercontent.com/d/${fileId}=w1000` }];
    }
    return [];
  }

  try {
    const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
    const resp = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const entries = parseEmbeddedFolderView(html);
    const subfolders = entries.filter((e) => e.isFolder);
    const rootImages = entries.filter((e) => !e.isFolder && !e.isVideo);

    const newFolder = subfolders.find((f) => /mới|moi|new/i.test(f.title));
    if (newFolder) {
      try {
        const newResp = await fetch(
          `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(newFolder.id)}#list`,
          { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
        );
        if (newResp.ok) {
          const newHtml = await newResp.text();
          const newEntries = parseEmbeddedFolderView(newHtml);
          const newImages = newEntries.filter((e) => !e.isFolder && !e.isVideo);
          if (newImages.length > 0) {
            return newImages.slice(0, 10).map((img) => ({
              id: img.id,
              url: `https://lh3.googleusercontent.com/d/${img.id}=w1000`,
            }));
          }
        }
      } catch {}
    }

    if (rootImages.length > 0) {
      return rootImages.slice(0, 10).map((img) => ({
        id: img.id,
        url: `https://lh3.googleusercontent.com/d/${img.id}=w1000`,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Extracts all plain HTTP/HTTPS image URLs from a block of text
 */
export function extractAllImageUrls(text) {
  if (!text) return [];
  const urls = [];
  const matches = String(text).match(/https?:\/\/[^\s,;"'<>()]+/gi) || [];
  for (const u of matches) {
    if (/\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(u) || u.includes('googleusercontent.com')) {
      urls.push(u);
    }
  }
  return urls;
}
