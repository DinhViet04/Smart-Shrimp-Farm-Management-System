# Kết quả kiểm tra sequence diagrams Report 4

Ngày kiểm tra: 04/11/2026. Phạm vi: thiết kế mục tiêu được người dùng lựa chọn, đối chiếu với working tree hiện tại.

## Phạm vi và phân loại

- Đủ **57 FE**, đúng tên và đúng thứ tự 57 tiêu đề sequence diagram trong 16 nhóm chức năng của Report 4.
- Có **73 luồng chi tiết/hỗ trợ**, tổng cộng **130 file PlantUML và 130 SVG**. Các ref đều có sơ đồ tương ứng.
- Trong 57 FE: **42 Existing workflow**, **11 Existing + proposed extension**, **4 Proposed design**. Nhãn tính cả phần mở rộng trong các ref.
- FE-01…FE-57 là mã chỉ mục được gán theo thứ tự mục báo cáo; số mục gốc vẫn giữ trong README và manifest.

## Kiểm tra đã hoàn thành

- PlantUML **1.2025.4**, Java **17**: dựng SVG thành công cho **130/130** sơ đồ, không có ảnh báo lỗi cú pháp.
- **2.051 thông điệp**, **468 nhánh/khối đánh số**: main flow liên tục; số nhánh có đúng bước cha; số con liên tục và không trùng; số render khớp mã PlantUML.
- Lifeline theo thứ tự **Actor → UI → Controller → Service → Supporting Service → PrismaService → Database → External Service**; chỉ có các thành phần tham gia. PostgreSQL nằm sau PrismaService; external service nằm bên phải database. Thứ tự bố trí không thay đổi thứ tự xử lý nghiệp vụ.
- Kiểm tra khai báo participant, participant thực sự tham gia, ref, cân bằng fragment và activation.
- Kiểm tra tĩnh call/reply trên các đường đi của alt, opt và loop: reply về đúng caller; không còn call chờ ở cuối tương tác. Reply hiển nhiên có thể được lược bỏ khi execution của callee kết thúc.
- Đối chiếu các vị trí làm căn cứ trong **56 tệp nguồn**. Phần đề xuất không được trình bày như phương thức/API đã triển khai.
- Đã xem ảnh đại diện của luồng tạo vụ, tạo tài khoản Admin đề xuất, khẩu phần ăn đề xuất, dashboard có par, ghi nước, tổng quan xử lý sự cố, RAG và push đề xuất. Nhãn, số bước, fragment và activation đọc được, không thấy chồng lấn ở các ảnh đã xem.
- Sau khi bổ sung Database và cập nhật thứ tự lifeline, đã kiểm tra lại bố cục FE-15, FE-39 và RAG-ANSWER; kiểm tra tự động xác nhận thứ tự các lớp thành phần ở toàn bộ 130 sơ đồ.
- Đối chiếu SHA-256 của **373 tệp ứng dụng** với bản ghi trước khi làm: **không thay đổi**. File **Report4_Software Design Document (1).docx** gốc cũng giữ nguyên hash.

## Những điểm cần hiểu đúng

Đây là bộ sơ đồ thiết kế, không phải kết quả chạy end-to-end. Những phần chưa triển khai được đánh dấu Proposed theo yêu cầu của người dùng. Các công thức khẩu phần, cơ chế thu hồi access token tức thì và chính sách lưu/giải quyết ghi chú/cảnh báo còn cần đặc tả nghiệp vụ trước khi hiện thực.

Controller là biên request của endpoint; phần NestJS guard/pipe được tách trong ref. PrismaService gọi lifeline PostgreSQL riêng và nhận reply từ database; driver và SQL được lược bỏ. ChromaDB trong thiết kế Python là database đề xuất, không bị gắn thêm PrismaService. Không thêm self-call cho phép tính nội bộ. Helper nền trả về việc đã khởi động; sơ đồ hỗ trợ không khẳng định nó hoàn thành trước hay sau HTTP response.

Nhánh lỗi không thực hiện phần việc chỉ dành cho thành công. Sau khi có kết quả hoặc lỗi, các reply chung chỉ truyền kết quả đó về giao diện. Execution kết thúc ở reply hoặc ngay sau fragment chứa các reply có thể xảy ra.

PlantUML tự thêm ngoặc vuông khi render guard. Phần số trong guard là quy ước tài liệu, không phải biểu thức điều kiện của chương trình. Các số trong vòng lặp dùng lại theo mỗi lần lặp. Sơ đồ par của manager có căn cứ Promise.all; không tự thêm par cho mọi hàm async.

## Dựng và kiểm tra lại

```powershell
node docs/report4-sequences/tools/generate.cjs
java -jar <plantuml.jar> -charset UTF-8 -checkonly 'docs/report4-sequences/*.puml'
java -jar <plantuml.jar> -charset UTF-8 -tsvg -o svg 'docs/report4-sequences/*.puml'
node docs/report4-sequences/tools/validate.cjs --rendered
```

Lần kiểm tra bảo vệ mã nguồn còn dùng tùy chọn `--baseline` với bản hash lưu trong thư mục làm việc tạm. Không chạy ứng dụng, migration, lệnh cập nhật dependency hoặc thay đổi file Word để tạo bộ sơ đồ này.
