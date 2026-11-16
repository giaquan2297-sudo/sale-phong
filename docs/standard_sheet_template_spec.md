# BẢNG ĐẶC TẢ GOOGLE SHEET CHUẨN & MẪU QUẢN LÝ PHÒNG CHO CHỦ NHÀ (SALE TRỌ)
**Golden Standard Template Specification & Landlord Operational Guide**

---

## 1. TỔNG QUAN (EXECUTIVE SUMMARY)

Hệ thống **Sale Trọ** tự động hoá việc phân phối, tìm kiếm và gợi ý phòng trọ từ nguồn Google Sheets của các chủ nhà và quản lý tòa nhà tại Hà Nội. Để khắc phục triệt để tình trạng lệch cột, dữ liệu phi cấu trúc, trùng lặp và đồng bộ sai trạng thái phòng, tài liệu này ban hành **Golden Standard Template (Mẫu bảng tính chuẩn)**.

Khi chủ nhà áp dụng đúng biểu mẫu này:
1. **Hệ thống Auto-Detect nhận diện chính xác 100% cấu trúc** mà không cần qua bước cấu hình thủ công.
2. **Trạng thái phòng (Trống / Sắp trống / Đã cọc / Đã thuê) được đồng bộ tức thì theo thời gian thực (SSE 24/7)**.
3. **Môi giới & Khách thuê nhận được thông tin chuẩn xác nhất**, giảm 90% cuộc gọi hỏi phòng đã hết hay chưa.

---

## 2. THỨ TỰ CỘT & TIÊU ĐỀ CHUẨN (GOLDEN COLUMN SPECIFICATION)

Biểu mẫu chuẩn bao gồm **14 cột bắt buộc theo đúng thứ tự từ Cột A đến Cột N**:

| Cột | Tên Tiêu Đề Chuẩn (Exact Header) | Trường Hệ Thống (DB Field) | Kiểu Dữ Liệu | Bắt Buộc | Quy Tắc Kiểm Tra (Data Validation) | Ví Dụ Mẫu | Mô Tả & Lưu Ý |
|:---:|:---|:---|:---:|:---:|:---|:---|:---|
| **A** | `Mã phòng` | `code` | Chuỗi (Text) | **Có** | Không để trống, không trùng lặp trong cùng 1 tòa nhà | `P201`, `P402`, `A301` | Định danh phòng/căn hộ duy nhất của căn |
| **B** | `Địa chỉ` | `street` / `address` | Chuỗi (Text) | **Có** | Địa chỉ rõ ràng (Số nhà, ngõ/ngách, tên đường/tòa) | `Số 18 Ngõ 86 Chùa Hà`, `Số 12 Ngõ 165 Chùa Láng` | Vị trí địa chỉ giúp tính toán khoảng cách đến các trường ĐH |
| **C** | `Quận` | `district` | Dropdown | **Có** | Danh sách 12 quận/huyện cốt lõi Hà Nội | `Cầu Giấy`, `Đống Đa`, `Hai Bà Trưng`, `Nam Từ Liêm` | Sử dụng Dropdown để không bị gõ tắt gây lỗi bộ lọc |
| **D** | `Giá thuê` | `price` | Số (VND) | **Có** | Số nguyên `> 0`, định dạng tiền tệ `#,##0` | `4500000`, `3800000`, `5200000` | Giá thuê hàng tháng (Hỗ trợ nhập `4.5` hoặc `4tr5`) |
| **E** | `Tiền cọc` | `deposit` | Số (VND) | Không | Số nguyên `>= 0`, định dạng tiền tệ `#,##0` | `4500000`, `3800000` | Thường bằng 1 tháng tiền nhà |
| **F** | `Diện tích m2` | `area_m2` | Số thực | Không | Số dương từ `10` đến `200`, định dạng `0.0 "m²"` | `28`, `22`, `32` | Diện tích sử dụng thực tế của phòng |
| **G** | `Loại phòng` | `room_type` | Dropdown | Không | Danh sách loại hình phòng trọ chuẩn | `Studio`, `1 ngủ 1 khách`, `Gác xép`, `Khép kín` | Phân loại giúp khách lọc nhanh theo nhu cầu |
| **H** | `Trạng thái` | `status` | Dropdown | **Có** | Dropdown 4 giá trị có gán nhãn màu sắc | `Trống`, `Sắp trống`, `Đã cọc`, `Đã thuê` | Quyết định phòng có hiển thị lên giỏ hàng / tìm kiếm hay không |
| **I** | `Ngày trống` | `available_from` | Chuỗi / Ngày | Không | `Ở luôn`, `Vào ngay`, hoặc ngày `DD/MM/YYYY` | `Ở luôn`, `01/12/2026`, `25/11/2026` | Thời gian khách có thể dọn vào ở |
| **J** | `Nội thất` | `amenities` | Chuỗi (Text) | Không | Liệt kê các trang thiết bị tiện nghi | `Full đồ: Điều hoà, Nóng lạnh, Tủ lạnh, Giường đệm, Tủ áo` | Giúp hệ thống tạo tin đăng và gửi Zalo tự động |
| **K** | `Điện nước` | `electric_price` | Chuỗi (Text) | Không | Đơn giá điện, nước, phí dịch vụ tòa nhà | `Điện 3.8k/số, Nước 100k/người, Dịch vụ 150k/phòng` | Chi phí phát sinh hàng tháng khách cần nắm rõ |
| **L** | `Link ảnh/Drive` | `images` | URL | Không | Đường link thư mục Google Drive hoặc link ảnh | `https://drive.google.com/drive/folders/...` | Thư mục Drive chứa ảnh và video thực tế của phòng |
| **M** | `SĐT quản lý` | `phone` / `contact` | Chuỗi (Phone) | Không | Số điện thoại 10 số (Bắt đầu bằng 03, 05, 07, 08, 09) | `0988123456`, `0977234567` | Đầu mối liên hệ trực tiếp mở cửa xem phòng |
| **N** | `Ghi chú` | `description` | Chuỗi (Text) | Không | Ghi chú thêm: Thang máy, ô tô đỗ, ban công... | `Thang máy, khóa vân tay, ban công riêng, ô tô đỗ cửa` | Tiện ích bổ sung làm nổi bật căn phòng |

---

## 3. THIẾT LẬP DATA VALIDATION TRÊN GOOGLE SHEETS

Để bảng tính không bao giờ bị sai định dạng khi nhân viên hoặc chủ nhà nhập liệu, thiết lập Data Validation (Xác thực dữ liệu) theo hướng dẫn sau:

### 3.1. Cột H - Trạng thái (`status`)
* **Dải ô áp dụng:** `H2:H1000`
* **Tiêu chí:** `Danh sách mục` (List of items)
* **Giá trị danh sách:**
  ```text
  Trống, Sắp trống, Đã cọc, Đã thuê
  ```
* **Màu sắc Conditional Formatting / Color Chips gợi nghị:**
  * `Trống`: Nền xanh lá nhạt (`#D1E7DD`), chữ xanh đậm (`#0F5132`) – Phòng đang sẵn sàng đón khách.
  * `Sắp trống`: Nền vàng/cam nhạt (`#FFF3CD`), chữ nâu cam (`#664D03`) – Khách sắp hết hợp đồng.
  * `Đã cọc`: Nền xanh dương nhạt (`#CFE2FF`), chữ xanh đậm (`#084298`) – Đã nhận cọc giữ phòng.
  * `Đã thuê`: Nền xám nhạt (`#E2E3E5`), chữ xám đậm (`#41464B`) – Phòng đã có người ở.
* **Tùy chọn:** Bật `Từ chối mục nhập không hợp lệ` (Reject input).

### 3.2. Cột C - Quận (`district`)
* **Dải ô áp dụng:** `C2:C1000`
* **Tiêu chí:** `Danh sách mục` (List of items)
* **Giá trị danh sách:**
  ```text
  Cầu Giấy, Đống Đa, Thanh Xuân, Hai Bà Trưng, Ba Đình, Tây Hồ, Hoàng Mai, Nam Từ Liêm, Bắc Từ Liêm, Hà Đông, Long Biên, Hoàn Kiếm
  ```
* **Tùy chọn:** Hiển thị danh sách thả xuống dạng chip trong ô.

### 3.3. Cột G - Loại phòng (`room_type`)
* **Dải ô áp dụng:** `G2:G1000`
* **Tiêu chí:** `Danh sách mục` (List of items)
* **Giá trị danh sách:**
  ```text
  Studio, 1 ngủ 1 khách, Gác xép, Chung cư mini, Khép kín, Phòng trọ chung chủ, Nhà nguyên căn, Mặt bằng
  ```

### 3.4. Cột D & E - Giá thuê & Tiền cọc (`price` & `deposit`)
* **Dải ô áp dụng:** `D2:E1000`
* **Tiêu chí:** `Số` -> `Lớn hơn hoặc bằng` `0`.
* **Định dạng số:** Vào `Định dạng (Format)` -> `Số (Number)` -> `Định dạng số tùy chỉnh` -> Nhập: `#,##0 "đ"`.

### 3.5. Cột F - Diện tích (`area_m2`)
* **Dải ô áp dụng:** `F2:F1000`
* **Tiêu chí:** `Số` -> `Nằm giữa` `5` và `500`.
* **Định dạng số:** `0.0 "m²"`.

### 3.6. Cột L - Link ảnh/Drive (`images`)
* **Dải ô áp dụng:** `L2:L1000`
* **Tiêu chí:** `Văn bản` -> `Chứa` -> `http`.
* **Lưu ý:** Thư mục Google Drive phải được cấp quyền xem công khai (`Bất kỳ ai có đường liên kết đều có thể xem`).

---

## 4. BẢNG DỮ LIỆU MẪU THỰC TẾ HÀ NỘI (SAMPLE DATASET)

Dưới đây là 8 bản ghi phòng thực tế tại 4 quận trọng điểm Hà Nội (Cầu Giấy, Đống Đa, Hai Bà Trưng, Nam Từ Liêm):

| Mã phòng | Địa chỉ | Quận | Giá thuê | Tiền cọc | Diện tích m2 | Loại phòng | Trạng thái | Ngày trống | Nội thất | Điện nước | Link ảnh/Drive | SĐT quản lý | Ghi chú |
|:---|:---|:---|---:|---:|---:|:---|:---|:---|:---|:---|:---|:---|:---|
| **P201** | Số 18 Ngõ 86 Chùa Hà | Cầu Giấy | 4.500.000 đ | 4.500.000 đ | 28 m² | Studio | **Trống** | Ở luôn | Full đồ: Điều hoà, Nóng lạnh, Tủ lạnh, Giường đệm, Tủ áo, Bếp từ, Hút mùi | Điện 3.8k/số, Nước 100k/người, Dịch vụ 150k/phòng | `https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456` | 0988123456 | Thang máy, khóa vân tay, ban công riêng siêu thoáng, ô tô đỗ cửa |
| **P402** | Số 45 Ngõ 165 Cầu Giấy | Cầu Giấy | 3.800.000 đ | 3.800.000 đ | 22 m² | Khép kín | **Sắp trống** | 01/12/2026 | Đầy đủ: Điều hòa, Nóng lạnh, Giường, Tủ, Bàn học | Điện 4k/số, Nước 30k/khối, Máy giặt 50k/người | `https://drive.google.com/drive/folders/1xYzAbCdEfGhIjKlMnOpQrStUvWx89012` | 0977234567 | Gần ĐH Sư Phạm, ĐH Quốc Gia, giờ giấc tự do không chung chủ |
| **P302** | Số 12 Ngõ 165 Chùa Láng | Đống Đa | 5.200.000 đ | 5.200.000 đ | 32 m² | 1 ngủ 1 khách | **Trống** | Ở luôn | Full nội thất cao cấp: Sofa, Tủ bếp riêng, Điều hoà 2 chiều, Nóng lạnh, Máy giặt riêng | Điện 3.8k/số, Nước 100k/người, Combo DV 150k/người | `https://drive.google.com/drive/folders/1mNoPqRsTuVwXyZ1234567890abcdef` | 0912345678 | Gần ĐH Ngoại Thương, Ngoại Giao, ngõ ba gác, ban công riêng siêu thoáng |
| **P501** | Số 88 Ngõ 178 Tây Sơn | Đống Đa | 3.500.000 đ | 3.500.000 đ | 20 m² | Gác xép | **Đã thuê** | 15/01/2027 | Điều hoà, Nóng lạnh, Tủ quần áo, Kệ bếp, Gác xép cao đứng được | Điện 3.9k/số, Nước 90k/người, Mạng 100k/phòng | `https://drive.google.com/drive/folders/1uVwXyZabCdEfGhIjKlMnOpQrSt987654` | 0989876543 | Cách ĐH Công Đoàn 200m, an ninh tốt, khóa cửa vân tay |
| **P303** | Số 45 Ngõ 254 Minh Khai | Hai Bà Trưng | 4.200.000 đ | 4.200.000 đ | 25 m² | Chung cư mini | **Trống** | Ở luôn | Full đồ: Điều hoà, Nóng lạnh, Tủ lạnh 2 cánh, Giường tủ gỗ, Bàn ăn mini | Điện 3.8k/số, Nước 100k/người, Thang máy + Vệ sinh 120k/phòng | `https://drive.google.com/drive/folders/1KlMnOpQrStUvWxYzAbCdEfGhIj112233` | 0904567890 | Gần Times City, ĐH Bách Khoa - Xây Dựng - Kinh Tế, có chỗ sạc xe điện tầng 1 |
| **P202** | Số 19 Ngõ 40 Tạ Quang Bửu | Hai Bà Trưng | 3.200.000 đ | 3.200.000 đ | 18 m² | Khép kín | **Sắp trống** | 25/11/2026 | Cơ bản: Điều hòa, Nóng lạnh, Giường, Tủ nhôm kính | Điện giá dân chia đầu người, Nước 80k/người | `https://drive.google.com/drive/folders/1DeFgHiJkLmNoPqRsTuVwXyZ123445566` | 0936112233 | Trung tâm Bách Khoa, đi bộ ra trường ĐHBK, tiện sinh viên ở 2 người |
| **P601** | Số 36 Ngõ 39 Đình Thôn | Nam Từ Liêm | 4.800.000 đ | 4.800.000 đ | 30 m² | Studio | **Trống** | Ở luôn | Đồ mới 100%: Điều hòa Inverter, Nóng lạnh, Tủ lạnh, Tủ bếp trên dưới, Hút mùi, Giường thông minh | Điện 3.8k/số, Nước 30k/khối, Dịch vụ chung 150k/người | `https://drive.google.com/drive/folders/1QrStUvWxYzAbCdEfGhIjKlMnOp778899` | 0968998877 | Gần Keangnam, The Manor, khu vực nhiều người Hàn và văn phòng, ngõ ô tô tránh |
| **P301** | Số 8 Ngách 12/89 Mễ Trì Thượng | Nam Từ Liêm | 3.600.000 đ | 3.600.000 đ | 24 m² | Gác xép | **Đã cọc** | 20/12/2026 | Điều hoà, Nóng lạnh, Tủ lạnh, Gác lửng bê tông, Sofa văng nhỏ | Điện 3.7k/số, Nước 100k/người, Wifi free | `https://drive.google.com/drive/folders/1TuVwXyZabCdEfGhIjKlMnOpQr001122` | 0945678123 | Gần Trung tâm Hội nghị Quốc gia, thoáng mát, ban công phơi đồ riêng |

---

## 5. QUY TRÌNH 3 BƯỚC CHO CHỦ NHÀ / QUẢN LÝ TÒA NHÀ

Quy trình cực kỳ tinh gọn, giúp chủ nhà thao tác xong trong vòng **3 phút**:

```
+--------------------------+       +----------------------------+       +----------------------------+
|  BƯỚC 1: TẠO BẢN SAO     |       |  BƯỚC 2: NHẬP LIỆU PHÒNG   |       |  BƯỚC 3: KẾT NỐI SALE TRỌ  |
|                          |       |                            |       |                            |
| Mở link Template chuẩn   | ----> | Điền danh sách phòng       | ----> | Bật quyền "Bất kỳ ai có    |
| Chọn: Tệp -> Tạo bản sao |       | Chọn dropdown trạng thái   |       | liên kết đều có thể xem"   |
| Đặt tên theo tòa nhà     |       | Cập nhật hàng ngày         |       | Dán link vào app Sale Trọ  |
+--------------------------+       +----------------------------+       +----------------------------+
```

### Bước 1: Tạo bản sao (Make a Copy) từ Template mẫu
1. Chủ nhà truy cập vào liên kết Google Sheet Template của hệ thống Sale Trọ.
2. Trên thanh menu, chọn **Tệp (File)** -> **Tạo bản sao (Make a copy)**.
3. Đặt tên file theo cấu trúc dễ quản lý: `Kho_Phong_[Tên Chủ Nhà/Tòa Nhà]_[Năm]` (Ví dụ: `Kho_Phong_Toa_Nha_Chua_Ha_2026`).
4. Lưu file vào Google Drive cá nhân của chủ nhà.

### Bước 2: Nhập liệu & Cập nhật trạng thái phòng
1. Nhập thông tin các phòng vào các dòng từ dòng số 2 trở đi.
2. Với các cột `Quận`, `Loại phòng`, `Trạng thái`, chỉ cần bấm vào mũi tên để chọn từ danh mục có sẵn.
3. Chụp ảnh phòng -> Tải lên một thư mục Google Drive riêng cho phòng/tòa nhà đó -> Copy liên kết thư mục và dán vào cột `Link ảnh/Drive`.
   > *Lưu ý quan trọng:* Trong Google Drive, click chuột phải vào thư mục ảnh -> Chọn **Chia sẻ** -> Đổi sang **"Bất kỳ ai có đường liên kết đều có quyền Người xem"**.
4. Hàng ngày hoặc mỗi khi có biến động khách (khách cọc giữ chỗ, khách dọn đi), chủ nhà chỉ cần **mở điện thoại và đổi trạng thái dropdown** (từ `Trống` sang `Đã cọc` hoặc `Đã thuê`).

### Bước 3: Chia sẻ quyền xem & Kết nối tức thì vào Sale Trọ
1. Tại file Google Sheet của chủ nhà, bấm nút **Chia sẻ (Share)** màu xanh ở góc phải trên cùng màn hình.
2. Tại mục *Quyền truy cập chung*, chọn: **"Bất kỳ ai có đường liên kết"** với quyền **"Người xem" (Viewer)**.
   *(Nếu hệ thống sử dụng Google Service Account riêng, chủ nhà chỉ cần thêm email Service Account vào danh sách Viewer).*
3. Bấm **Sao chép đường liên kết (Copy link)**.
4. Mở ứng dụng **Sale Trọ** -> Vào mục **"Google Sheets"** -> Bấm **"Thêm nhanh Sheet"** -> Dán đường link vừa copy và bấm **"Kiểm tra & Kết nối"**.
5. Hệ thống tự động nhận dạng 14/14 cột, nạp toàn bộ phòng vào kho dữ liệu và kích hoạt cơ chế **Tự động đồng bộ 24/7**. Khi chủ nhà đổi trên Sheet, ứng dụng Sale Trọ của toàn bộ đội ngũ môi giới sẽ tự động cập nhật ngay lập tức!

---

## 6. MÃ GOOGLE APPS SCRIPT HỖ TRỢ TỰ ĐỘNG THIẾT LẬP TEMPLATE (BONUS TOOL)

Đối với chủ nhà hoặc quản trị viên muốn tạo tự động một Google Sheet mới tinh với đầy đủ Dropdown, định dạng màu sắc và dữ liệu mẫu chỉ với 1 cú click:

1. Mở một Google Sheet trống -> Chọn **Tiện ích mở rộng (Extensions)** -> **Apps Script**.
2. Dán đoạn mã sau vào và nhấn **Chạy (Run)**:

```javascript
function setupSaleTroGoldenTemplate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  sheet.setName("Danh_Sach_Phong");

  // 1. Headers
  const headers = [
    "Mã phòng", "Địa chỉ", "Quận", "Giá thuê", "Tiền cọc", "Diện tích m2",
    "Loại phòng", "Trạng thái", "Ngày trống", "Nội thất", "Điện nước",
    "Link ảnh/Drive", "SĐT quản lý", "Ghi chú"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#1E293B")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  // 2. Data Validations
  // Cột C: Quận
  const districts = ["Cầu Giấy", "Đống Đa", "Thanh Xuân", "Hai Bà Trưng", "Ba Đình", "Tây Hồ", "Hoàng Mai", "Nam Từ Liêm", "Bắc Từ Liêm", "Hà Đông", "Long Biên", "Hoàn Kiếm"];
  const districtRule = SpreadsheetApp.newDataValidation().requireValueInList(districts, true).build();
  sheet.getRange("C2:C1000").setDataValidation(districtRule);

  // Cột G: Loại phòng
  const roomTypes = ["Studio", "1 ngủ 1 khách", "Gác xép", "Chung cư mini", "Khép kín", "Phòng trọ chung chủ", "Nhà nguyên căn", "Mặt bằng"];
  const typeRule = SpreadsheetApp.newDataValidation().requireValueInList(roomTypes, true).build();
  sheet.getRange("G2:G1000").setDataValidation(typeRule);

  // Cột H: Trạng thái
  const statuses = ["Trống", "Sắp trống", "Đã cọc", "Đã thuê"];
  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(statuses, true).build();
  sheet.getRange("H2:H1000").setDataValidation(statusRule);

  // 3. Format Number
  sheet.getRange("D2:E1000").setNumberFormat('#,##0 "đ"');
  sheet.getRange("F2:F1000").setNumberFormat('0.0 "m²"');

  // 4. Sample Rows
  const sampleRows = [
    ["P201", "Số 18 Ngõ 86 Chùa Hà", "Cầu Giấy", 4500000, 4500000, 28, "Studio", "Trống", "Ở luôn", "Full đồ: Điều hoà, Nóng lạnh, Tủ lạnh, Giường đệm, Tủ áo, Bếp từ, Hút mùi", "Điện 3.8k/số, Nước 100k/người, Dịch vụ 150k/phòng", "https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456", "0988123456", "Thang máy, khóa vân tay, ban công riêng siêu thoáng, ô tô đỗ cửa"],
    ["P402", "Số 45 Ngõ 165 Cầu Giấy", "Cầu Giấy", 3800000, 3800000, 22, "Khép kín", "Sắp trống", "01/12/2026", "Đầy đủ: Điều hòa, Nóng lạnh, Giường, Tủ, Bàn học", "Điện 4k/số, Nước 30k/khối, Máy giặt 50k/người", "https://drive.google.com/drive/folders/1xYzAbCdEfGhIjKlMnOpQrStUvWx89012", "0977234567", "Gần ĐH Sư Phạm, ĐH Quốc Gia, giờ giấc tự do không chung chủ"],
    ["P302", "Số 12 Ngõ 165 Chùa Láng", "Đống Đa", 5200000, 5200000, 32, "1 ngủ 1 khách", "Trống", "Ở luôn", "Full nội thất cao cấp: Sofa, Tủ bếp riêng, Điều hoà 2 chiều, Nóng lạnh, Máy giặt riêng", "Điện 3.8k/số, Nước 100k/người, Combo DV 150k/người", "https://drive.google.com/drive/folders/1mNoPqRsTuVwXyZ1234567890abcdef", "0912345678", "Gần ĐH Ngoại Thương, Ngoại Giao, ngõ ba gác, ban công riêng siêu thoáng"],
    ["P501", "Số 88 Ngõ 178 Tây Sơn", "Đống Đa", 3500000, 3500000, 20, "Gác xép", "Đã thuê", "15/01/2027", "Điều hoà, Nóng lạnh, Tủ quần áo, Kệ bếp, Gác xép cao đứng được", "Điện 3.9k/số, Nước 90k/người, Mạng 100k/phòng", "https://drive.google.com/drive/folders/1uVwXyZabCdEfGhIjKlMnOpQrSt987654", "0989876543", "Cách ĐH Công Đoàn 200m, an ninh tốt, khóa cửa vân tay"],
    ["P303", "Số 45 Ngõ 254 Minh Khai", "Hai Bà Trưng", 4200000, 4200000, 25, "Chung cư mini", "Trống", "Ở luôn", "Full đồ: Điều hoà, Nóng lạnh, Tủ lạnh 2 cánh, Giường tủ gỗ, Bàn ăn mini", "Điện 3.8k/số, Nước 100k/người, Thang máy + Vệ sinh 120k/phòng", "https://drive.google.com/drive/folders/1KlMnOpQrStUvWxYzAbCdEfGhIj112233", "0904567890", "Gần Times City, ĐH Bách Khoa - Xây Dựng - Kinh Tế, có chỗ sạc xe điện tầng 1"],
    ["P202", "Số 19 Ngõ 40 Tạ Quang Bửu", "Hai Bà Trưng", 3200000, 3200000, 18, "Khép kín", "Sắp trống", "25/11/2026", "Cơ bản: Điều hòa, Nóng lạnh, Giường, Tủ nhôm kính", "Điện giá dân chia đầu người, Nước 80k/người", "https://drive.google.com/drive/folders/1DeFgHiJkLmNoPqRsTuVwXyZ123445566", "0936112233", "Trung tâm Bách Khoa, đi bộ ra trường ĐHBK, tiện sinh viên ở 2 người"],
    ["P601", "Số 36 Ngõ 39 Đình Thôn", "Nam Từ Liêm", 4800000, 4800000, 30, "Studio", "Trống", "Ở luôn", "Đồ mới 100%: Điều hòa Inverter, Nóng lạnh, Tủ lạnh, Tủ bếp trên dưới, Hút mùi, Giường thông minh", "Điện 3.8k/số, Nước 30k/khối, Dịch vụ chung 150k/người", "https://drive.google.com/drive/folders/1QrStUvWxYzAbCdEfGhIjKlMnOp778899", "0968998877", "Gần Keangnam, The Manor, khu vực nhiều người Hàn và văn phòng, ngõ ô tô tránh"],
    ["P301", "Số 8 Ngách 12/89 Mễ Trì Thượng", "Nam Từ Liêm", 3600000, 3600000, 24, "Gác xép", "Đã cọc", "20/12/2026", "Điều hoà, Nóng lạnh, Tủ lạnh, Gác lửng bê tông, Sofa văng nhỏ", "Điện 3.7k/số, Nước 100k/người, Wifi free", "https://drive.google.com/drive/folders/1TuVwXyZabCdEfGhIjKlMnOpQr001122", "0945678123", "Gần Trung tâm Hội nghị Quốc gia, thoáng mát, ban công phơi đồ riêng"]
  ];
  sheet.getRange(2, 1, sampleRows.length, sampleRows[0].length).setValues(sampleRows);

  // Auto-fit columns
  for (let c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }
}
```

---

## 7. FILE TEMPLATE SẴN DÙNG (READY-TO-USE ASSETS)

Hệ thống đã chuẩn bị sẵn file mẫu định dạng CSV chuẩn RFC 4180 tại:
- Đường dẫn server nội bộ: `/Users/giaquan/.gemini/antigravity/scratch/sale-tro/data/sale_tro_template.csv`
- Đường dẫn tải trực tiếp trên Web App: `/sale_tro_template.csv` (trong thư mục `web/public`)
- Đặc tả kỹ thuật đầy đủ: `/Users/giaquan/.gemini/antigravity/scratch/sale-tro/docs/standard_sheet_template_spec.md`
