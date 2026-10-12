# Hướng Dẫn Build APK Android & Vận Hành Trợ Lý 5T Mobile (SSFM)

Tài liệu này hướng dẫn cách cấu hình, chạy thử nghiệm và đóng gói file **Android APK** cho ứng dụng **Smart Shrimp Farm Management (SSFM Mobile)** theo **Chiến lược 1 (EAS Cloud Build)**.

---

## 1. Kiến Trúc Tính Năng Mobile AI Chatbot (Quy Trình 5T)

Module Chatbot AI trên Mobile được thiết kế chuyên biệt cho Nông dân và Kỹ thuật viên ngoài bờ ao:
* **Màn hình chính:** `frontend-mobile/src/screens/ChatbotScreen.tsx`
* **Service:** `frontend-mobile/src/services/chatbotService.ts`
* **API Client:** `frontend-mobile/src/services/apiClient.ts` (Tự động gắn JWT Token từ `AsyncStorage`, timeout 25s, xử lý lỗi mạng).
* **Luồng dữ liệu:**
  1. Người dùng chọn ao nuôi cụ thể hoặc chọn *Tư vấn chung*.
  2. Bấm vào các câu hỏi gợi ý nhanh (*Tôm đục cơ*, *pH cao > 8.5*, *Giảm ăn khi mưa*, *Khí độc NO2*) hoặc tự nhập câu hỏi.
  3. Mobile gửi request đến NestJS Backend: `POST /api/chatbot/ask` với `{ question, pondId }`.
  4. Backend NestJS nạp ngữ cảnh ao thật và gửi sang Python AI Service (RAG) hoặc xử lý qua kho tri thức 5T (`knowledge_chunks`).
  5. Mobile hiển thị câu trả lời, khuyến nghị hành động, trích dẫn tài liệu 5T và lưu lịch sử offline trên máy bằng `AsyncStorage`.

---

## 2. Chuẩn Bị & Chạy Thử Nghiệm Nhanh Với Expo Go (Khuyến Nghị Trước Khi Build)

1. **Cài app Expo Go:** Vào Google Play Store trên điện thoại Android, tìm và cài đặt app **Expo Go**.
2. **Cấu hình IP Backend:**
   * Mở file `frontend-mobile/.env`.
   * Cập nhật `EXPO_PUBLIC_API_URL` bằng địa chỉ IP mạng nội bộ (LAN) của máy tính, ví dụ:
     ```env
     EXPO_PUBLIC_API_URL=http://192.168.1.15:3000
     ```
     *(Lưu ý: Điện thoại và máy tính phải kết nối chung một mạng Wi-Fi).*
3. **Khởi động Mobile Dev Server:**
   ```bash
   cd frontend-mobile
   npm start
   ```
4. Mở app **Expo Go** trên điện thoại và quét mã QR hiển thị trên màn hình terminal để bắt đầu trải nghiệm ứng dụng.

---

## 3. Quy Trình Xuất File APK Độc Lập (Chiến Lược 1 - EAS Build)

Chiến lược 1 sử dụng máy chủ đám mây của Expo để dịch mã và tạo file `.apk` cài trực tiếp lên mọi điện thoại Android mà **không cần cài Android Studio nặng 15GB** trên máy tính cá nhân.

### Bước 1: Kiểm tra cấu hình `app.json` và `eas.json`
Các file này đã được chuẩn hóa trong dự án:
* **`app.json`:** Định danh gói Android `com.ssfm.smartshrimpfarm` và quyền Internet.
* **`eas.json`:** Cấu hình profile `preview` chỉ định `buildType: "apk"`.

### Bước 2: Đăng ký tài khoản Expo (Miễn phí)
Nếu bạn chưa có tài khoản Expo:
* Truy cập [https://expo.dev/signup](https://expo.dev/signup) và tạo 1 tài khoản miễn phí.

### Bước 3: Đăng nhập EAS CLI trên Terminal
Mở terminal tại thư mục `frontend-mobile`:
```bash
cd frontend-mobile
npx eas-cli login
```
*(Nhập Username/Email và Password tài khoản Expo của bạn).*

### Bước 4: Khởi tạo Project ID (Chỉ thực hiện lần đầu)
```bash
npx eas-cli project:init
```
*(EAS sẽ tự động liên kết dự án với tài khoản của bạn và ghi `projectId` vào `app.json`).*

### Bước 5: Chạy Lệnh Build File APK
Chạy câu lệnh đóng gói:
```bash
npx eas-cli build -p android --profile preview
```

### Bước 6: Nhận File APK & Cài Đặt Lên Điện Thoại
1. Terminal sẽ hiển thị đường link theo dõi tiến trình build (khoảng 5-10 phút).
2. Khi hoàn tất, EAS sẽ cung cấp:
   * **Đường link tải trực tiếp file `.apk`** (ví dụ: `https://expo.dev/artifacts/eas/...apk`).
   * **Mã QR Code** trên terminal: Bạn chỉ cần dùng điện thoại Android quét mã QR này để tải file APK về máy.
3. Mở file APK đã tải trên điện thoại $\rightarrow$ Chọn **Cài đặt (Install)** $\rightarrow$ Bật quyền *Cho phép cài đặt ứng dụng từ nguồn này* (nếu Android hỏi).

---

## 4. Danh Sách File Liên Quan Trong Dự Án
* `frontend-mobile/src/screens/ChatbotScreen.tsx`: Giao diện Trợ lý AI 5T Care.
* `frontend-mobile/src/services/chatbotService.ts`: Kết nối nghiệp vụ Chatbot & Cache AsyncStorage.
* `frontend-mobile/src/services/apiClient.ts`: HTTP Client chuẩn hóa kèm Bearer Token.
* `frontend-mobile/src/config/api.ts`: Cấu hình Base URL tự động nhận diện thiết bị.
* `frontend-mobile/app.json`: Cấu hình định danh Android Application.
* `frontend-mobile/eas.json`: Cấu hình profile sinh file APK.
* `frontend-mobile/.env.example`: Mẫu biến môi trường.
