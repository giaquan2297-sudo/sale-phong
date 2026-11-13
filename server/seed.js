import db from './db.js';

const force = process.argv.includes('--force');

const existingCount = db.prepare('SELECT COUNT(*) AS count FROM rooms').get().count;
if (existingCount > 0 && !force) {
  console.log(`Database đã có ${existingCount} phòng. Dùng "npm run seed -- --force" nếu muốn tạo lại dữ liệu mẫu.`);
  process.exit(0);
}

if (force) {
  db.exec(`
    DELETE FROM sends;
    DELETE FROM shared_carts;
    DELETE FROM customers;
    DELETE FROM images;
    DELETE FROM rooms;
    DELETE FROM sync_logs;
    DELETE FROM sheet_sources;
    DELETE FROM landlords;
  `);
}

const insertLandlord = db.prepare(`
  INSERT INTO landlords (name, phone, zalo, note)
  VALUES (?, ?, ?, ?)
`);

const l1 = insertLandlord.run(
  'Chú Hùng Cầu Giấy',
  '0912345678',
  '0912345678',
  'Gọi trước 30 phút khi dẫn khách qua xem, hoa hồng 50% tháng đầu'
).lastInsertRowid;

const l2 = insertLandlord.run(
  'Chị Lan Thanh Xuân',
  '0987654321',
  '0987654321',
  'Có hệ thống 4 toà CCMN khu Khương Trung - Vũ Tông Phan, giữ chìa khoá tại bảo vệ'
).lastInsertRowid;

const l3 = insertLandlord.run(
  'Anh Minh Bách Khoa',
  '0904112233',
  '0904112233',
  'Cho nuôi mèo nhỏ nếu giữ vệ sinh, không nhận xe điện sạc qua đêm trong hầm'
).lastInsertRowid;

const sampleRooms = [
  {
    landlord_id: l1,
    code: 'CG-302',
    address: 'Số 18 ngõ 68',
    street: 'Quan Hoa',
    district: 'Cầu Giấy',
    price: 3800000,
    deposit: 3800000,
    area_m2: 26,
    room_type: 'Khép kín',
    amenities: 'Điều hoà, nóng lạnh, giường tủ, máy giặt chung, ban công thoáng',
    electric_price: '3.800đ/số',
    water_price: '100k/người',
    status: 'trong',
    available_from: 'Vào ở ngay',
    description: 'Phòng tầng 3 có cửa sổ + ban công phơi đồ riêng, ngõ rộng 2 xe máy tránh nhau, gần ĐH Giao Thông Vận Tải và công viên Nghĩa Đô.',
    private_note: 'Chủ nhà dễ tính, báo trước 30p cô tạp vụ mở cửa P302',
    source: 'manual',
  },
  {
    landlord_id: l1,
    code: 'CG-501',
    address: 'Số 42 ngõ 165',
    street: 'Xuân Thuỷ',
    district: 'Cầu Giấy',
    price: 4500000,
    deposit: 4500000,
    area_m2: 30,
    room_type: 'Studio',
    amenities: 'Full đồ: điều hoà, nóng lạnh, tủ lạnh, bếp từ, máy giặt riêng, khoá vân tay',
    electric_price: '4.000đ/số',
    water_price: '30k/khối',
    status: 'trong',
    available_from: 'Vào ở ngay',
    description: 'Studio mới sơn sửa lại đẹp long lanh, cách mặt đường Xuân Thuỷ 120m, đi bộ ra ĐH Quốc Gia và ga Metro.',
    private_note: 'Cọc 1 đóng 1, khách ở tối đa 2 người 1 xe',
    source: 'manual',
  },
  {
    landlord_id: l1,
    code: 'CG-204',
    address: 'Số 9 ngách 12/3',
    street: 'Trần Thái Tông',
    district: 'Cầu Giấy',
    price: 2800000,
    deposit: 2800000,
    area_m2: 20,
    room_type: 'Phòng trọ chung chủ',
    amenities: 'Điều hoà, nóng lạnh, giường, tủ quần áo, wifi miễn phí',
    electric_price: '3.500đ/số',
    water_price: '80k/người',
    status: 'sap_trong',
    available_from: '01/12',
    description: 'Phòng gọn sạch phù hợp sinh viên hoặc 1 người đi làm, giờ giấc tự do không chung lối đi với chủ.',
    private_note: 'Khách cũ báo trả phòng cuối tháng, ưu tiên nữ thuê',
    source: 'manual',
  },
  {
    landlord_id: l2,
    code: 'TX-401',
    address: 'Số 105 ngõ 211',
    street: 'Khương Trung',
    district: 'Thanh Xuân',
    price: 3500000,
    deposit: 3500000,
    area_m2: 25,
    room_type: 'Gác xép',
    amenities: 'Điều hoà, nóng lạnh, kệ bếp, gác xép cao 1m8 đứng thẳng, thang máy',
    electric_price: '3.800đ/số',
    water_price: '100k/người',
    status: 'trong',
    available_from: 'Vào ở ngay',
    description: 'Phòng gác xép rộng thoáng khu Khương Trung, cách Ngã Tư Sở 5 phút chạy xe, nhà để xe tầng 1 có camera 24/7.',
    private_note: 'Pass cửa vân tay hoặc hỏi bác bảo vệ ca ngày',
    source: 'manual',
  },
  {
    landlord_id: l2,
    code: 'TX-603',
    address: 'Số 27B ngõ 358',
    street: 'Bùi Xương Trạch',
    district: 'Thanh Xuân',
    price: 4200000,
    deposit: 4200000,
    area_m2: 32,
    room_type: 'Chung cư mini',
    amenities: 'Full nội thất: giường, tủ, tủ lạnh, bàn ăn, sofa nhỏ, máy giặt sấy chung',
    electric_price: '4.000đ/số',
    water_price: '28k/khối',
    status: 'da_coc',
    available_from: 'Đã cọc giữ chỗ',
    description: 'CCMN tầng 6 có thang máy tốc độ cao, view thoáng không bị chắn, tiện ích xung quanh đầy đủ chợ và WinMart.',
    private_note: 'Khách cọc 1tr giữ đến ngày 15, nếu huỷ cọc báo lại sale',
    source: 'manual',
  },
  {
    landlord_id: l2,
    code: 'TX-202',
    address: 'Số 64 ngõ 72',
    street: 'Nguyễn Trãi',
    district: 'Thanh Xuân',
    price: 5500000,
    deposit: 5500000,
    area_m2: 40,
    room_type: '1 ngủ 1 khách',
    amenities: 'Full đồ cao cấp: 2 điều hoà, máy giặt riêng, tủ lạnh 180L, sofa, ban công rộng',
    electric_price: '3.900đ/số',
    water_price: '100k/người',
    status: 'trong',
    available_from: 'Vào ở ngay',
    description: 'Căn 1 ngủ 1 khách tách bếp riêng biệt ngay gần Royal City, cực kỳ phù hợp cặp đôi hoặc nhóm 2 bạn đi làm.',
    private_note: 'Chủ bao phí dịch vụ tháng đầu nếu chốt trong tuần',
    source: 'manual',
  },
  {
    landlord_id: l3,
    code: 'HBT-301',
    address: 'Số 14 ngõ 40',
    street: 'Tạ Quang Bửu',
    district: 'Hai Bà Trưng',
    price: 3200000,
    deposit: 3200000,
    area_m2: 22,
    room_type: 'Khép kín',
    amenities: 'Điều hoà, nóng lạnh, giường tủ, bàn học, sân phơi tầng thượng',
    electric_price: '3.800đ/số',
    water_price: '90k/người',
    status: 'trong',
    available_from: 'Vào ở ngay',
    description: 'Ngay cạnh ĐH Bách Khoa - Xây Dựng - Kinh Tế Quốc Dân, đi bộ đi học, khu vực an ninh tốt.',
    private_note: 'Không nhận xe phân khối lớn',
    source: 'manual',
  },
  {
    landlord_id: l3,
    code: 'HBT-502',
    address: 'Số 88 ngõ Quỳnh',
    street: 'Thanh Nhàn',
    district: 'Hai Bà Trưng',
    price: 6000000,
    deposit: 6000000,
    area_m2: 45,
    room_type: '1 ngủ 1 khách',
    amenities: 'Full đồ xịn, ban công chill, máy giặt riêng, khoá từ từng tầng, có thang máy',
    electric_price: '4.000đ/số',
    water_price: '30k/khối',
    status: 'sap_trong',
    available_from: '20/11',
    description: 'Căn hộ mini 1N1K cực thoáng sát công viên Tuổi Trẻ, bếp tách mùi, ánh sáng tự nhiên cả ngày.',
    private_note: 'Thương lượng được 5tr8 nếu ký hợp đồng 1 năm',
    source: 'manual',
  },
  {
    landlord_id: l3,
    code: 'DD-205',
    address: 'Số 31 ngõ 1194',
    street: 'Đường Láng',
    district: 'Đống Đa',
    price: 2500000,
    deposit: 2500000,
    area_m2: 18,
    room_type: 'Khép kín',
    amenities: 'Nóng lạnh, điều hoà, giường đơn, tủ vải, để xe tầng 1 miễn phí',
    electric_price: '3.500đ/số',
    water_price: '80k/người',
    status: 'trong',
    available_from: 'Vào ở ngay',
    description: 'Phòng tiết kiệm ngay Chùa Láng - Đường Láng, gần ĐH Ngoại Thương và Học viện Ngoại Giao.',
    private_note: 'Phòng nhỏ gọn 1 người ở chuẩn bài',
    source: 'manual',
  },
  {
    landlord_id: l1,
    code: 'DD-404',
    address: 'Số 52 ngõ 185',
    street: 'Chùa Láng',
    district: 'Đống Đa',
    price: 4900000,
    deposit: 4900000,
    area_m2: 34,
    room_type: 'Studio',
    amenities: 'Full đồ: điều hoà, nóng lạnh, tủ lạnh, bếp từ, máy giặt chung, ban công',
    electric_price: '3.800đ/số',
    water_price: '100k/người',
    status: 'da_thue',
    available_from: 'Đã cho thuê',
    description: 'Studio rộng khu Chùa Láng, ngõ thông sang Huỳnh Thúc Kháng, rất tiện di chuyển.',
    private_note: 'Đã chốt khách thuê 12 tháng từ tháng trước',
    source: 'manual',
  },
];

const insertRoom = db.prepare(`
  INSERT INTO rooms (
    landlord_id, code, address, street, district, price, deposit, area_m2,
    room_type, amenities, electric_price, water_price, status, available_from,
    description, private_note, source, created_at, updated_at, status_changed_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'), datetime('now', 'localtime')
  )
`);

const insertedIds = [];
for (const r of sampleRooms) {
  const res = insertRoom.run(
    r.landlord_id,
    r.code,
    r.address,
    r.street,
    r.district,
    r.price,
    r.deposit,
    r.area_m2,
    r.room_type,
    r.amenities,
    r.electric_price,
    r.water_price,
    r.status,
    r.available_from,
    r.description,
    r.private_note,
    r.source
  );
  insertedIds.push(res.lastInsertRowid);
}

// Seed 2 sample customers and 1 send log for immediate demonstration
const insertCustomer = db.prepare(`
  INSERT INTO customers (name, zalo_phone, budget_min, budget_max, districts, need_note, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const c1 = insertCustomer.run(
  'Bạn Minh Anh',
  '0965111222',
  3000000,
  4500000,
  'Cầu Giấy, Đống Đa',
  'Tìm phòng ở 1 mình, cần ban công và để 1 xe máy',
  'dang_tim'
).lastInsertRowid;

insertCustomer.run(
  'Anh Tuấn & Bạn gái',
  '0938444555',
  4500000,
  6000000,
  'Thanh Xuân, Hai Bà Trưng',
  'Cần 1 ngủ 1 khách hoặc studio rộng, ở đầu tháng sau',
  'dang_tim'
);

db.prepare(
  `INSERT INTO sends (customer_id, room_ids, sent_at, message)
   VALUES (?, ?, datetime('now', 'localtime', '-1 day'), ?)`
).run(
  c1,
  JSON.stringify([insertedIds[0], insertedIds[1]]),
  'Chào bạn Minh Anh, em gửi mình 2 phòng ở Cầu Giấy tầm 3,8 - 4,5 tr có ban công thoáng ạ.'
);

console.log(`Đã tạo thành công 3 chủ nhà, ${insertedIds.length} phòng mẫu và 2 khách hàng mẫu.`);
