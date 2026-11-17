# Hướng dẫn Public Website Sale Trọ Hoàn Toàn Miễn Phí (100% Free)

Tài liệu này cung cấp 2 giải pháp tốt nhất để đưa trang web **Sale Trọ** của bạn ra internet công khai mà không tốn 1 đồng chi phí nào.

---

## CÁCH 1: Dùng Cloudflare Tunnel (ĐANG CHẠY TRỰC TIẾP NGAY BÂY GIỜ) ⚡

Hệ thống đã tích hợp sẵn công cụ **Cloudflare Tunnel** chính thức của Cloudflare vào dự án:
* **Chi phí**: 0đ trọn đời.
* **Bảo mật**: Có sẵn chứng chỉ HTTPS (ổ khóa xanh), bảo vệ chống tấn công qua hạ tầng Cloudflare toàn cầu.
* **Không cần cấu hình Router**: Không cần mở port mạng (NAT/Port Forwarding), máy ở mạng nào cũng kết nối được.

### 🌐 Link public đang chạy ngay lúc này:
👉 **[https://roses-developed-moderator-shed.trycloudflare.com](https://roses-developed-moderator-shed.trycloudflare.com)**

*(Bạn có thể mở 4G trên điện thoại hoặc gửi cho bất kỳ ai truy cập thử ngay!)*

### Cách tự bật lại bất kỳ lúc nào:
Mở Terminal trong thư mục dự án và chạy 1 lệnh duy nhất:
```bash
npm run public
```
*(Hoặc: `npm run tunnel:cloudflare`)*. Hệ thống sẽ kết nối với Cloudflare và in ra đường link HTTPS công khai để bạn dùng.

> **Lưu ý**: Cách 1 yêu cầu máy Mac của bạn phải đang mở và có kết nối mạng. Nếu bạn tắt máy tính hoặc đi ngủ, link ngoài sẽ tạm thời ngắt kết nối.

---

## CÁCH 2: Deploy lên Đám mây (Cloud) Chạy 24/7 Miễn phí (Render.com) ☁️

Nếu bạn muốn **ngay cả khi tắt hẳn máy tính Mac**, khách hàng vẫn xem được giỏ hàng và bạn vẫn mở điện thoại bằng 4G ngoài đường 24/7 mọi lúc mọi nơi, hãy đưa website lên **Render.com** (dịch vụ đám mây uy tín có gói miễn phí 100%):

### Các bước thực hiện (chỉ mất 3-5 phút):

#### Bước 1: Đưa mã nguồn lên GitHub cá nhân (Miễn phí)
1. Đăng ký tài khoản miễn phí tại [github.com](https://github.com) (nếu chưa có).
2. Tạo 1 repository mới (chọn chế độ **Private** để bảo mật thông tin nội bộ).
3. Đẩy toàn bộ thư mục `sale-tro` lên GitHub:
   ```bash
   cd /Users/giaquan/.gemini/antigravity/scratch/sale-tro
   git init
   git add .
   git commit -m "Khoi tao he thong Sale Tro"
   git branch -M main
   git remote add origin https://github.com/TÊN_GITHUB_CỦA_BẠN/sale-tro.git
   git push -u origin main
   ```

#### Bước 2: Triển khai 100% Cloudflare Pages & Cloudflare D1 (Khuyên dùng)
Hệ thống hiện tại hoạt động 100% trên nền tảng Cloudflare Edge Serverless & Cloudflare D1 SQLite:
* Không sử dụng máy chủ Render (tránh tình trạng ngủ đông và lỗi 502).
* Tốc độ phản hồi cực nhanh (~300ms), 0ms cold-start.
* Cơ sở dữ liệu SQLite Cloudflare D1 lưu trữ an toàn, sao lưu tự động.

👉 **Đường link chính thức 24/7:**
**`https://sale-tro-hanoi.pages.dev`**

* Có sẵn HTTPS an toàn và CDN toàn cầu của Cloudflare.
* Hoạt động 24/7 hoàn toàn độc lập, không phụ thuộc vào máy tính cá nhân.
* Hỗ trợ đầy đủ phân quyền Admin / Môi giới Sale, đồng bộ Google Sheets thông minh và CRM khách hàng.
