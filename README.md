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

## 🗄️ Kiến Trúc Tầng Dữ Liệu (Data Layer Architecture)

Hệ thống hỗ trợ 2 trình điều khiển lưu trữ dữ liệu (storage drivers) thông qua biến môi trường `DATA_STORE`:

1. **`json` (JsonDataStore):**
   - Lưu trữ dữ liệu cục bộ dưới dạng tệp JSON trong thư mục `.data/` (hoặc in-memory khi không có quyền ghi đĩa).
   - Phù hợp cho môi trường phát triển cục bộ (Local Development) và chạy thử nghiệm nhanh.
2. **`firestore` (FirestoreDataStore):**
   - Lưu trữ dữ liệu lâu bền trên Google Cloud Firestore với khả năng tìm kiếm vector trực tiếp (`findNearest`) theo từng tổ chức (`orgId`).
   - Yêu cầu cấu hình cho môi trường Production trên Cloud Run.

> **Lưu ý quan trọng về thiết kế:** Trình điều khiển cơ sở dữ liệu được chọn cố định một lần duy nhất khi khởi động ứng dụng (startup) dựa trên giá trị của `DATA_STORE`. Hệ thống **không tự động chuyển đổi runtime (no runtime fallback)** để tránh chia cắt dữ liệu trên nhiều backend. Nếu Firestore không khả dụng khi khởi động hoặc trong quá trình chạy, lỗi sẽ được hiển thị rõ ràng (HTTP 503) thay vì âm thầm ghi vào bộ nhớ tạm.

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend:** Express.js, TypeScript (`tsx`), `@google/genai` SDK, `@google-cloud/firestore`.
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
DATA_STORE=json
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

---

## ☁️ Hướng Dẫn Triển Khai (Deployment to Cloud Run)

### 1. Danh sách Biến Môi Trường (Environment Variables)

| Biến | Bắt buộc trên Production | Mô tả |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Có** | API Key cho các mô hình Gemini AI (suy luận schema, phán định thực thể, tạo embedding, NL query). |
| `DATA_STORE` | **Có** | Driver cơ sở dữ liệu: đặt `firestore` trên Production. |
| `ALLOW_ANON_DEMO` | **Có** | Đặt `false` trên Production để ngăn chặn truy cập ẩn danh trái phép. |
| `APP_URL` | Không | URL triển khai của dịch vụ (Cloud Run tự động tiêm hoặc tự cấu hình). |
| `GEMINI_MODEL` | Không | Ghi đè mô hình chính (mặc định: `gemini-3.7-flash`). |
| `PORT` | Không | Port dịch vụ (Cloud Run tự động tiêm biến `PORT`, mặc định 8080). |
| `FIREBASE_PROJECT_ID`| Không | Ghi đè Project ID đọc từ `firebase-applet-config.json`. |
| `FIRESTORE_DATABASE_ID`| Không | ID cơ sở dữ liệu Firestore (nếu dùng named database, mặc định `(default)`). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Không | Đường dẫn service account key cho dev cục bộ với Firestore. Trên Cloud Run, dịch vụ tự động xác thực qua Metadata Server. |

> **Về tệp `firebase-applet-config.json`:** Tệp cấu hình này được commit trực tiếp vào mã nguồn một cách có chủ đích. Firebase Web API Key đóng vai trò là định danh ứng dụng công khai (public client identifier), không phải secret. Cơ chế kiểm soát truy cập và bảo mật dựa vào `firestore.rules` và danh sách **Authorized Domains** trong Firebase Auth. Không đưa tệp này vào `.gitignore` hoặc chuyển thành secret.

### 2. Kích hoạt Google Cloud APIs
Bật các API cần thiết trên Google Cloud Project:
```bash
gcloud services enable \
  drive.googleapis.com \
  sheets.googleapis.com \
  generativelanguage.googleapis.com \
  firestore.googleapis.com \
  iam.googleapis.com
```

### 3. Cấu hình Quyền & Phạm vi OAuth (OAuth Scopes)
Ứng dụng sử dụng các scope OAuth sau khi người dùng kết nối Google Drive / Sheets:
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`

### 4. Cấu hình Firebase Auth Authorized Domains
Sau khi triển khai Cloud Run, sao chép URL dịch vụ (ví dụ: `https://event-data-hub-xyz.run.app`) và thêm vào:
- **Firebase Console** -> **Authentication** -> **Settings** -> **Authorized domains** -> **Add domain**.
- *Nếu bỏ qua bước này, việc đăng nhập Google trên Production sẽ thất bại với mã lỗi `auth/unauthorized-domain`.*

### 5. Cấp quyền IAM cho Cloud Run Service Account
Dịch vụ Cloud Run chạy dưới danh tính của Service Account mặc định (hoặc tùy chỉnh). Service Account này **bắt buộc** phải có quyền truy cập Firestore để đọc/ghi thực thể:
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```
*(Nếu thiếu quyền này, hệ thống sẽ dừng ngay lập tức tại bước kiểm tra khởi động `Startup reachability check` với mã lỗi PERMISSION_DENIED / code 7).*

### 6. Vector index (required for Stage 1)
Tạo chỉ mục composite vector trên Firestore để phục vụ tìm kiếm Top-N ứng viên tương đồng trong Giai đoạn 1:

```bash
gcloud firestore indexes composite create \
  --project=light-broker-x8gvj \
  --database=ai-studio-eventdatahub-50743d01-7c2c-4c9b-8521-419982eee455 \
  --collection-group=canonicalEntities \
  --query-scope=COLLECTION \
  --field-config=field-path=orgId,order=ASCENDING \
  --field-config=field-path=embedding,vector-config='{"dimension":"768","flat":"{}"}'
```

*Lưu ý: Kích thước vector `768` phải khớp chính xác với `EMBEDDING_DIM` trong `server/services/geminiService.ts`.*

### 7. Lệnh Triển Khai Cloud Run (Deployment Command)
Triển khai ứng dụng lên Cloud Run bằng lệnh sau:
```bash
gcloud run deploy event-data-hub \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars DATA_STORE=firestore,ALLOW_ANON_DEMO=false
```
