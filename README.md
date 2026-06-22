# Smart Shrimp Farm Management System (SSFM)

Dự án Hệ thống Quản lý Trang trại Nuôi tôm Thông minh (SSFM) được thiết kế theo **Quy trình 5T** của TS. Trần Văn Thái, tập trung vào việc số hóa **Vòng lặp 5 ngày (5T Care)** nhằm kiểm soát tối ưu Tốc độ tăng trưởng và hệ số FCR.

## 🚀 Kiến Trúc Hệ Thống
Dự án bao gồm 4 khối chính độc lập:
1. `backend/`: NestJS + Prisma + PostgreSQL (Cung cấp API cho 5T Care).
2. `frontend-web/`: React + Vite + TailwindCSS (Dashboard cho Quản lý & Kỹ thuật viên).
3. `frontend-mobile/`: React Native Expo (App tối giản cho Nông dân nhập liệu hàng ngày).
4. `ai-service/`: Python + FastAPI (Chatbot RAG hỏi đáp dựa trên 10 Chương Quy trình 5T).

---

## 🛠 Hướng Dẫn Cài Đặt & Chạy Dịch Vụ (Cho Toàn Nhóm)

### Yêu cầu hệ thống:
- [Node.js (v20+)](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Python 3.10+](https://www.python.org/)

### 1. Khởi động Database (PostgreSQL & Redis)
Mở Docker Desktop. Mở terminal ở thư mục gốc và chạy:
```bash
docker-compose up -d
```

### 2. Backend (NestJS)
```bash
cd backend
npm install
cp .env.example .env
npx prisma db push
npm run start:dev
```

### 3. Frontend Web (React Vite)
```bash
cd frontend-web
npm install
npm run dev
```

### 4. Frontend Mobile (Expo)
```bash
cd frontend-mobile
npm install
npm start
```

### 5. AI Service (Python)
```bash
cd ai-service
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

---

## 📘 Logic Cốt Lõi: Vòng Lặp 5 Ngày (5T Care)
- **Ngày 1-4:** Nông dân dùng Mobile App nhập lượng thức ăn, tôm hao, nhiệt độ.
- **Ngày 5:** Nông dân bắt mẫu tôm, cân trọng lượng mẫu ($G_m$) và đếm số lượng ($N_đ$).
- **Hệ thống xử lý:** Tự động tính Size ($Size_m$), FCR thực tế, so sánh với **Bảng Mục Tiêu Chuẩn 5T** và xuất Bảng Khuyến Nghị Cho Ăn cho 5 ngày tiếp theo (có hiệu chỉnh theo nhiệt độ).
