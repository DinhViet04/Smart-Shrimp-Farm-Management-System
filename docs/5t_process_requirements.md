# CAPSTONE PROJECT: GÓP Ý & ĐIỀU CHỈNH ĐỀ CƯƠNG
**Hệ thống Quản lý Trang trại Nuôi tôm Thông minh (SSFM)**
Người góp ý: TS. Trần Văn Thái
Ngày: 30/05/2026
Phiên bản: V1.0

## PHẦN 1: ĐÁNH GIÁ ĐỀ CƯƠNG HIỆN TẠI
### 1.1. Những điểm tốt đã có
- Bối cảnh thực tế rõ ràng: nhận diện đúng vấn đề ngành nuôi tôm đang dùng sổ tay/bảng tính thủ công
- Tích hợp AI và RAG để đưa ra khuyến nghị
- Danh sách tính năng khá đầy đủ về giám sát môi trường, quản lý ao, cảnh báo sự cố
- Công nghệ stack phù hợp (ReactJS, Node.js, PostgreSQL, Docker)
- Có kế hoạch mobile app cho nông dân

### 1.2. Những điểm cần điều chỉnh
1. **Vấn đề:** Chưa có logic nghiệp vụ cụ thể. **Hướng điều chỉnh:** Gắn với Quy trình 5T cụ thể: áp dụng công thức FCR, bảng định mức cho ăn mẫu, mục tiêu size theo ngày.
2. **Vấn đề:** Module 'theo dõi tăng trưởng' chưa có thuật toán. **Hướng điều chỉnh:** Bổ sung module 5T Care: vòng lặp 5 ngày đo-tính-hiệu chỉnh theo chuẩn 5T.
3. **Vấn đề:** Tích hợp thanh toán online không phù hợp. **Hướng điều chỉnh:** Thay bằng module báo cáo vụ nuôi & so sánh FCR thực tế vs mục tiêu 5T.
4. **Vấn đề:** RAG chưa xác định nguồn tri thức. **Hướng điều chỉnh:** Dùng tài liệu Quy trình 5T làm knowledge base cho RAG.
5. **Vấn đề:** Phạm vi quá rộng. **Hướng điều chỉnh:** Ưu tiên: (1) 5T Care – tăng trưởng/FCR, (2) môi trường & cảnh báo, (3) AI/RAG chatbot 5T.

## PHẦN 2: MỤC TIÊU DỰ ÁN (ĐÃ ĐIỀU CHỈNH)
1. Số hóa và tự động hóa vòng lặp kiểm soát tăng trưởng & FCR theo Quy trình 5T (module 5T Care)
2. Xây dựng giao diện đơn giản cho nông dân nhập liệu hàng ngày trên điện thoại
3. Triển khai AI/RAG chatbot hỏi đáp kỹ thuật nuôi tôm dựa trên tài liệu 5T
4. Giám sát môi trường ao, cảnh báo vượt ngưỡng theo tiêu chuẩn 5T
5. Báo cáo vụ nuôi: so sánh FCR thực tế vs mục tiêu 5T, phân tích nguyên nhân lệch chuẩn

## PHẦN 3: MODULE 5T CARE – MÔ TẢ CHI TIẾT
### 3.1. Vòng lặp 5 ngày (5-Day Control Loop)
- **Ngày 1–5 (NHẬP LIỆU HÀNG NGÀY):** Lượng thức ăn thực tế, Số tôm hao, Tình trạng sức khỏe, Nhiệt độ nước.
- **Ngày 5 (ĐO SIZE TÔM):** Trọng lượng mẫu (gram), số tôm đếm được → app tự tính size.
- **HỆ THỐNG TỰ TÍNH:** Tỷ lệ sống (Si), Tổng thức ăn (Foodi), Tổng sinh khối (Wi), FCR (FCRi).
- **SO SÁNH:** Đánh giá Size và FCR so với chuẩn 5T. Cảnh báo nếu vượt ngưỡng.
- **HIỆU CHỈNH:** Xuất bảng cho ăn 5 ngày tiếp theo dựa trên sinh khối, FCR và nhiệt độ.

### 3.2. Bảng mục tiêu tăng trưởng chuẩn 5T
| Mốc ngày nuôi | Size mục tiêu | FCR mục tiêu |
|---------------|---------------|--------------|
| Ngày 20       | < 1.000 con/kg| < 1,0        |
| Ngày 35       | < 250 con/kg  | < 1,0        |
| Ngày 45       | < 100 con/kg  | < 1,0        |
| Ngày 60       | < 60 con/kg   | < 1,0        |
| Ngày 70       | < 45 con/kg   | < 1,17       |
| Ngày 80       | < 35 con/kg   | < 1,25       |
| Ngày 90       | < 30 con/kg   | < 1,30       |
| Ngày 120      | < 20 con/kg   | < 1,45       |

### 3.4. Công thức cốt lõi cần implement
- `FCRi = Foodi / Wi`
- `Wi = Si × To × ti`
- `ti = 1 / Sizei (kg/con)`
- `Sizem = Nđ / Gm`
- `Foodi+1 = 80–90% × Gmax`
