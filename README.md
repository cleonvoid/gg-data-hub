# Event Data Hub - Hệ thống Chuẩn hoá Dữ liệu & Phân giải Thực thể Sự kiện

**Event Data Hub** là hệ thống chuẩn hoá dữ liệu và phân giải thực thể (Entity Resolution) chuyên biệt cho các tổ chức, viện nghiên cứu, sở ban ngành và trung tâm đổi mới sáng tạo tổ chức hàng trăm hội thảo, khóa tập huấn và sự kiện mỗi năm.

---

## 🌟 Tính Năng Cốt Lõi

1. **Kiến Trúc Dữ Liệu 3 Lớp Chuẩn Enterprise:**
   - **Lớp 1 - Bản ghi Thô Bất biến (Raw Source Records):** Lưu trữ nguyên vẹn dữ liệu từ từng tệp Excel/Google Sheets, giữ nguyên cấu trúc cột gốc và dấu thời gian.
   - **Lớp 2 - Thực thể Chuẩn hoá (Canonical Entities):** Hồ sơ định danh duy nhất (họ tên chuẩn, đơn vị chính thức, chức danh, email chuẩn, danh sách biến thể / aliases).
   - **Lớp 3 - Bảng Liên kết Thực thể (Entity Link Graph):** Lưu vết quan hệ giữa bản ghi thô và thực thể chuẩn cùng điểm số tương đồng Vector, mức độ tin cậy LLM và lý do phân giải.

2. **Cơ Chế Phân Giải Thực Thể 2 Giai Đoạn (Two-Stage Entity Resolution):**
   - **Giai đoạn 1 (Candidate Retrieval):** Tạo vector embedding (sử dụng mô hình `gemini-embedding-2-preview`) cho chuỗi định danh đã chuẩn hóa tiếng Việt, tìm kiếm Top-N ứng viên có độ tương đồng Cosine cao trong không gian vector.
   - **Giai đoạn 2 (LLM Adjudication):** Sử dụng **Gemini 3.7 Flash** với ngữ cảnh ngôn ngữ tiếng Việt để phân giải các trường hợp phức tạp:
     - Lược bỏ hoặc chuẩn hóa tiền tố học hàm, học vị (`TS.`, `PGS.TS.`, `ThS.`, `Ông`, `Bà`).
     - So khớp tên không dấu (`Nguyen Van An`) và có dấu (`Nguyễn Văn An`).
     - Nhận diện tên viết tắt cơ quan (`Viện CNTT - VAST` vs `Viện Công nghệ Thông tin - Viện Hàn lâm KH&CN`).
     - Phân định email công vụ và email cá nhân của cùng một đại biểu.

3. **Suy Luận Cấu Trúc Bảng Tính Bằng AI (AI Schema Inference):**
   - Tự động nhận diện dòng tiêu đề (header row) bất kể tệp có dòng mở đầu rườm rà.
   - Gợi ý ánh xạ cột vào lược đồ chuẩn hoá (`fullName`, `organization`, `role`, `email`, `phone`) kèm độ tin cậy.

4. **Tìm Kiếm Bằng Ngôn Ngữ Tự Nhiên (Natural Language Query):**
   - Chuyển đổi trực tiếp các câu hỏi tiếng Việt tự nhiên (ví dụ: *"Chuyên gia AI tham gia từ 2 sự kiện"*, *"Cán bộ Sở Khoa học và Công nghệ"*) thành các bộ lọc tham số an toàn.

5. **Tích Hợp Google Drive & Google Sheets API:**
   - Đọc trực tiếp danh sách bảng tính từ Google Drive của đơn vị.
   - Hỗ trợ tải tệp Excel `.xlsx` / `.csv` từ máy tính cá nhân.

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend:** Express.js, TypeScript (`tsx`), `@google/genai` SDK.
- **AI Models:**
  - `gemini-3.7-flash`: Suy luận lược đồ cột, phán định trùng lặp thực thể (LLM Adjudication), biên dịch truy vấn ngôn ngữ tự nhiên.
  - `gemini-embedding-2-preview`: Tạo vector embedding 768 chiều cho trích xuất ứng viên tương đồng (Stage 1).
- **Authentication & APIs:** Google Identity Services / Firebase Auth, Google Drive API v3, Google Sheets API v4.
- **Excel Parser:** `xlsx` (SheetJS).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ

### 1. Cấu hình biến môi trường
Tạo tệp `.env` dựa trên `.env.example`:
```bash
GEMINI_API_KEY="AIzaSy..."
```

### 2. Chạy ứng dụng trong môi trường phát triển (Dev)
```bash
npm run dev
```
Ứng dụng sẽ chạy tại: `http://localhost:3000`

### 3. Đóng gói cho Production
```bash
npm run build
npm start
```
Lệnh này sẽ tạo bản build tĩnh cho Vite và đóng gói máy chủ backend TypeScript thành file duy nhất `dist/server.cjs` qua `esbuild`.
