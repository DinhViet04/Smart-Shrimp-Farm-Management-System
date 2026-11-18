# Sequence diagrams cho Report 4

Bộ tài liệu gồm **57 FE** thuộc 16 nhóm chức năng trong mục 3 của **Report4_Software Design Document (1).docx**, cùng **73 sơ đồ chi tiết/hỗ trợ**. Sơ đồ thể hiện thiết kế mục tiêu của Report 4 theo lựa chọn của người dùng. Phần đã có trong code được dùng làm căn cứ; phần chưa có được đánh dấu **Proposed**. Không chỉnh sửa mã nguồn ứng dụng hoặc file Word gốc.

Report 4 dùng số mục như **3.1.2.1**, không đặt mã FE trực tiếp. Mã **FE-01…FE-57** được gán theo đúng thứ tự 57 tiêu đề sequence diagram trong tài liệu, với số mục gốc giữ lại trong bảng bên dưới. Không sử dụng các comment FE cũ trong schema làm chỉ mục.

## Mở và sử dụng

- Mở [danh mục trực quan](index.html) để tìm theo FE hoặc tên chức năng, xem SVG và mở mã PlantUML.
- Mỗi FE có file độc lập **FE-xx.puml**; ảnh vector tương ứng là **svg/FE-xx.svg**.
- FE có nhiều thao tác dùng sơ đồ tổng quan ngắn và **ref** đến các luồng chi tiết. Toàn bộ nội dung của các ref đều được cung cấp.
- Nhãn thông điệp bằng tiếng Anh đơn giản. **SSFM Interface** đại diện giao diện người dùng chung, không tách Web/Mobile.

## Cách phân biệt thiết kế và hiện trạng

| Nhãn | Ý nghĩa | Số FE |
|---|---|---|
| Existing workflow | Luồng nghiệp vụ có căn cứ mã nguồn hiện tại | 42 |
| Existing + proposed extension | Có luồng hiện tại nhưng sơ đồ hoặc ref chứa phần mở rộng mục tiêu | 11 |
| Proposed design | Chưa có đầy đủ luồng hiện tại; đây là thiết kế đề xuất | 4 |

Caption và ghi chú ngắn chỉ rõ phần đề xuất. Nhãn trạng thái của sơ đồ tổng quan cũng tính đến các ref mà nó sử dụng. Tên lớp mới như DailyNotesService, FeedingRecommendationService, Report Exporter và các kênh Expo/FCM/APNs được ghi là proposed khi chưa có mã tương ứng. Existing workflow không có nghĩa là đã kiểm thử end-to-end hoặc đã triển khai trên server.

## Các quyết định về phạm vi

Đây là sequence ở mức thiết kế nghiệp vụ, tập trung vào người dùng và hệ thống. Controller được mô hình hóa như **biên xử lý request của endpoint**, bao gồm kết quả guard/validation do NestJS thực hiện trước handler; không khẳng định controller gọi guard trực tiếp. Chi tiết này nằm trong REQUEST-CHECKS và PUBLIC-CHECKS.

Các lifeline được sắp từ trái sang phải: **Actor → UI → Controller → Service → Supporting Service → PrismaService → Database → External Service**. Chỉ giữ thành phần thực sự tham gia; không thêm lifeline trống để đủ mẫu. Database PostgreSQL có lifeline riêng sau PrismaService, với call và reply nối đúng caller. Với kho tri thức Python, ChromaDB được thể hiện là database dự kiến; không thêm PrismaService vào luồng Python không dùng Prisma. External Service nằm bên phải database khi cùng xuất hiện. Đây là thứ tự bố trí lifeline, không thay đổi thứ tự gọi nghiệp vụ.

Không vẽ driver hoặc SQL. Các phép tính nội bộ được thể hiện qua điều kiện, kết quả hoặc ghi chú ngắn; không tạo self-call cho mỗi phép gán. Một số nhóm đọc/lưu liên quan được gộp, vẫn giữ điểm kiểm tra điều kiện và trách nhiệm của thành phần.

Report mô tả ChromaDB và Expo/FCM/APNs là kiến trúc dự kiến. Code hiện tại dùng kho vector JSON phía Python và không có push hệ điều hành. Các bước chuyển sang ChromaDB, đồng bộ kho tri thức, live client thống nhất và push được đánh dấu đề xuất. Không đưa Caddy, Cloudflare, CI/CD hoặc Docker vào từng luồng nghiệp vụ chỉ vì chúng có trong sơ đồ kiến trúc.

Thuật toán khẩu phần thích ứng, cơ chế thu hồi access token tức thì, trường dữ liệu ghi chú độc lập và chính sách giải quyết cảnh báo chưa được Report 4 đặc tả đầy đủ. Sơ đồ chỉ đề xuất trách nhiệm và thứ tự tương tác, không bịa công thức, ngưỡng an toàn, bảng database hoặc API đã triển khai. Danh mục sản phẩm dùng liên kết Inventory–Supplier; báo cáo hiệu quả lấy vụ nuôi được chọn; thống kê quản trị dùng số liệu nghiệp vụ hiện có.

## Quy ước UML và đánh số

- Call đồng bộ: đường liền, đầu tam giác kín. Reply: đường đứt, đầu mở. Sự kiện không chờ kết quả: đường liền, đầu mở.
- Activation bắt đầu khi thành phần xử lý lời gọi và kết thúc ở reply hoặc ngay sau fragment chứa các reply thay thế. Caller có thể giữ activation trong khi chờ. Lifeline vẫn tiếp tục khi activation kết thúc.
- Các nhánh từ chối chỉ trả lỗi cho caller thực tế. Phần việc chỉ dành cho thành công nằm trong toán hạng else. Sau khi chọn kết quả, các reply chung chỉ truyền kết quả/lỗi về giao diện; chúng không chạy lại bước thành công.
- Hàm JavaScript async không tự động là thông điệp UML async. Helper nền được gọi đồng bộ và trả về việc đã khởi động; phần tiếp tục nằm trong sơ đồ hỗ trợ, không áp đặt thứ tự hoàn thành so với HTTP response.
- Main flow dùng 1, 2, 3… (kể cả ref). Nhánh tại bước 4 là 4.1 hoặc 4.2; thông điệp trong nhánh là 4.1.1, 4.1.2…; nhánh không tăng số main flow. opt/loop và nhánh lồng nhau mở rộng cùng quy ước. Số trong loop là số bước tài liệu, dùng lại mỗi vòng.
- Điều kiện được PlantUML tự đặt trong ngoặc vuông khi render. Không gõ thêm cặp ngoặc bên ngoài chuỗi có dấu cách để tránh bị hiểu là hyperlink Creole. Phần số ở đầu guard là chú giải tài liệu; guard và fragment vẫn quyết định luồng.
- par chỉ dùng cho cặp overview/incidents của dashboard manager, có Promise.all trong source. Các panel khác có thể tải độc lập; sơ đồ chọn một thứ tự hợp lệ cho việc trình bày, không khẳng định thời gian thực thi.

Tham khảo ký hiệu: [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1), [PlantUML sequence syntax](https://plantuml.com/sequence-diagram).

## Chỉ mục 57 FE

| FE | Mục Report 4 | Chức năng | Trạng thái | Tệp |
|---|---|---|---|---|
| FE-01 | 3.1.2.1 | User Registration | Existing workflow | [PlantUML](FE-01.puml) · [SVG](svg/FE-01.svg) |
| FE-02 | 3.1.2.2 | Sign In with Email/Password and Google OAuth | Existing workflow | [PlantUML](FE-02.puml) · [SVG](svg/FE-02.svg) |
| FE-03 | 3.1.2.3 | Sign Out and Session Token Invalidation | Existing + proposed extension | [PlantUML](FE-03.puml) · [SVG](svg/FE-03.svg) |
| FE-04 | 3.1.2.4 | Password Management and Reset via Email OTP | Existing workflow | [PlantUML](FE-04.puml) · [SVG](svg/FE-04.svg) |
| FE-05 | 3.1.2.5 | Role-Based Access Control for Admin, Farm Manager, Technician, and Farmer | Existing workflow | [PlantUML](FE-05.puml) · [SVG](svg/FE-05.svg) |
| FE-06 | 3.2.2.1 | View User List | Existing workflow | [PlantUML](FE-06.puml) · [SVG](svg/FE-06.svg) |
| FE-07 | 3.2.2.2 | View and Update User Profile Details | Existing + proposed extension | [PlantUML](FE-07.puml) · [SVG](svg/FE-07.svg) |
| FE-08 | 3.2.2.3 | Create User Account | Proposed design | [PlantUML](FE-08.puml) · [SVG](svg/FE-08.svg) |
| FE-09 | 3.2.2.4 | Lock and Unlock User Account | Existing workflow | [PlantUML](FE-09.puml) · [SVG](svg/FE-09.svg) |
| FE-10 | 3.3.2.1 | View Farm List | Existing workflow | [PlantUML](FE-10.puml) · [SVG](svg/FE-10.svg) |
| FE-11 | 3.3.2.2 | Manage Farm Profile and Farming Model Configuration | Existing workflow | [PlantUML](FE-11.puml) · [SVG](svg/FE-11.svg) |
| FE-12 | 3.3.2.3 | Assign and Manage Farm Staff | Existing workflow | [PlantUML](FE-12.puml) · [SVG](svg/FE-12.svg) |
| FE-13 | 3.4.2.1 | View Pond List | Existing workflow | [PlantUML](FE-13.puml) · [SVG](svg/FE-13.svg) |
| FE-14 | 3.4.2.2 | Manage Pond Specifications and Farm Association | Existing workflow | [PlantUML](FE-14.puml) · [SVG](svg/FE-14.svg) |
| FE-15 | 3.4.2.3 | Assign Crop and Monitor Active Pond Status | Existing workflow | [PlantUML](FE-15.puml) · [SVG](svg/FE-15.svg) |
| FE-16 | 3.5.2.1 | Manage Shrimp Crop | Existing workflow | [PlantUML](FE-16.puml) · [SVG](svg/FE-16.svg) |
| FE-17 | 3.5.2.2 | Record Shrimp Stocking Information | Existing workflow | [PlantUML](FE-17.puml) · [SVG](svg/FE-17.svg) |
| FE-18 | 3.5.2.3 | Split and Transfer Nursery Crop to Commercial Ponds | Existing workflow | [PlantUML](FE-18.puml) · [SVG](svg/FE-18.svg) |
| FE-19 | 3.5.2.4 | Harvest Crop and Generate Financial Summary | Existing workflow | [PlantUML](FE-19.puml) · [SVG](svg/FE-19.svg) |
| FE-20 | 3.5.2.5 | View Crop Lifecycle History and Milestones | Existing workflow | [PlantUML](FE-20.puml) · [SVG](svg/FE-20.svg) |
| FE-21 | 3.6.2.1 | Record Daily Feed Consumption | Existing workflow | [PlantUML](FE-21.puml) · [SVG](svg/FE-21.svg) |
| FE-22 | 3.6.2.2 | Record Daily Shrimp Mortality | Existing workflow | [PlantUML](FE-22.puml) · [SVG](svg/FE-22.svg) |
| FE-23 | 3.6.2.3 | Record Shrimp Health and Clinical Symptoms | Existing workflow | [PlantUML](FE-23.puml) · [SVG](svg/FE-23.svg) |
| FE-24 | 3.6.2.4 | Record Daily Farming Notes and Operational Observations | Proposed design | [PlantUML](FE-24.puml) · [SVG](svg/FE-24.svg) |
| FE-25 | 3.7.2.1 | Record Water Quality Parameters | Existing workflow | [PlantUML](FE-25.puml) · [SVG](svg/FE-25.svg) |
| FE-26 | 3.7.2.2 | View Water Quality Historical Logs | Existing workflow | [PlantUML](FE-26.puml) · [SVG](svg/FE-26.svg) |
| FE-27 | 3.7.2.3 | Monitor Water Quality Trends and Fluctuation Analytics | Existing workflow | [PlantUML](FE-27.puml) · [SVG](svg/FE-27.svg) |
| FE-28 | 3.8.2.1 | View Inventory Item List and Current Stock Level | Existing workflow | [PlantUML](FE-28.puml) · [SVG](svg/FE-28.svg) |
| FE-29 | 3.8.2.2 | Manage Inventory Items and Low-Stock Threshold Alerts | Existing + proposed extension | [PlantUML](FE-29.puml) · [SVG](svg/FE-29.svg) |
| FE-30 | 3.8.2.3 | Track Inventory Usage and Material Depletion Logs | Existing workflow | [PlantUML](FE-30.puml) · [SVG](svg/FE-30.svg) |
| FE-31 | 3.8.2.4 | Manage Suppliers and Supplied Product Catalog | Existing + proposed extension | [PlantUML](FE-31.puml) · [SVG](svg/FE-31.svg) |
| FE-32 | 3.9.2.1 | Record Sampling Data and Track Shrimp Size | Existing workflow | [PlantUML](FE-32.puml) · [SVG](svg/FE-32.svg) |
| FE-33 | 3.9.2.2 | Estimate Pond Biomass Using the Cast-Net Method | Existing workflow | [PlantUML](FE-33.puml) · [SVG](svg/FE-33.svg) |
| FE-34 | 3.9.2.3 | Monitor Survival Rate and Remaining Shrimp Population | Existing workflow | [PlantUML](FE-34.puml) · [SVG](svg/FE-34.svg) |
| FE-35 | 3.9.2.4 | Calculate and Analyze Real-Time Feed Conversion Ratio | Existing workflow | [PlantUML](FE-35.puml) · [SVG](svg/FE-35.svg) |
| FE-36 | 3.9.2.5 | Compare Actual Growth Curve | Existing workflow | [PlantUML](FE-36.puml) · [SVG](svg/FE-36.svg) |
| FE-37 | 3.9.2.6 | Generate Adaptive Daily Feeding Recommendations | Proposed design | [PlantUML](FE-37.puml) · [SVG](svg/FE-37.svg) |
| FE-38 | 3.10.2.1 | Trigger Rule-Based Water Quality Alerts | Existing workflow | [PlantUML](FE-38.puml) · [SVG](svg/FE-38.svg) |
| FE-39 | 3.10.2.2 | Retrieve Real-Time Weather and Forecast Data | Existing workflow | [PlantUML](FE-39.puml) · [SVG](svg/FE-39.svg) |
| FE-40 | 3.10.2.3 | Generate Weather-Induced Risk Warnings | Existing workflow | [PlantUML](FE-40.puml) · [SVG](svg/FE-40.svg) |
| FE-41 | 3.10.2.4 | View Environmental Warning History and Resolution Logs | Proposed design | [PlantUML](FE-41.puml) · [SVG](svg/FE-41.svg) |
| FE-42 | 3.11.2.1 | Create Incident Record and Assign Technician | Existing workflow | [PlantUML](FE-42.puml) · [SVG](svg/FE-42.svg) |
| FE-43 | 3.11.2.2 | Track Treatment Timeline and Update Clinical Progress | Existing workflow | [PlantUML](FE-43.puml) · [SVG](svg/FE-43.svg) |
| FE-44 | 3.12.2.1 | Evaluate Water Quality Status and Diagnose Risk | Existing + proposed extension | [PlantUML](FE-44.puml) · [SVG](svg/FE-44.svg) |
| FE-45 | 3.12.2.2 | Request AI Farming Advice and Inquire About Shrimp Disease Symptoms | Existing + proposed extension | [PlantUML](FE-45.puml) · [SVG](svg/FE-45.svg) |
| FE-46 | 3.12.2.3 | Generate Crop Harvest Review and Next-Crop Recommendations | Existing workflow | [PlantUML](FE-46.puml) · [SVG](svg/FE-46.svg) |
| FE-47 | 3.13.2.1 | Ask Aquaculture Technical Questions | Existing + proposed extension | [PlantUML](FE-47.puml) · [SVG](svg/FE-47.svg) |
| FE-48 | 3.13.2.2 | Manage and Ingest Knowledge Documents | Existing + proposed extension | [PlantUML](FE-48.puml) · [SVG](svg/FE-48.svg) |
| FE-49 | 3.13.2.3 | Generate Context-Aware Consultation Using Pond Metrics and Weather Data | Existing + proposed extension | [PlantUML](FE-49.puml) · [SVG](svg/FE-49.svg) |
| FE-50 | 3.14.2.1 | Dispatch Real-Time Alerts and In-App Push Notifications | Existing + proposed extension | [PlantUML](FE-50.puml) · [SVG](svg/FE-50.svg) |
| FE-51 | 3.14.2.2 | Manage Notifications, Mark as Read, and Filter by Severity | Existing workflow | [PlantUML](FE-51.puml) · [SVG](svg/FE-51.svg) |
| FE-52 | 3.15.2.1 | View Farm Manager Executive Performance Dashboard | Existing workflow | [PlantUML](FE-52.puml) · [SVG](svg/FE-52.svg) |
| FE-53 | 3.15.2.2 | View Technician Environmental and Pond Health Dashboard | Existing workflow | [PlantUML](FE-53.puml) · [SVG](svg/FE-53.svg) |
| FE-54 | 3.15.2.3 | View Farmer Daily Task Dashboard on the Web | Existing workflow | [PlantUML](FE-54.puml) · [SVG](svg/FE-54.svg) |
| FE-55 | 3.15.2.4 | View System Administration and System Metrics Dashboard | Existing workflow | [PlantUML](FE-55.puml) · [SVG](svg/FE-55.svg) |
| FE-56 | 3.16.2.1 | Generate Comprehensive Farming Performance Report | Existing workflow | [PlantUML](FE-56.puml) · [SVG](svg/FE-56.svg) |
| FE-57 | 3.16.2.2 | Export Analytical Reports and Historical Logs as PDF, Excel, or CSV | Existing + proposed extension | [PlantUML](FE-57.puml) · [SVG](svg/FE-57.svg) |

## Giải thích và căn cứ từng FE

### FE-01 — User Registration

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit registration details → Validate request → Validate invitation → Check whether email is registered → Create account → Join the invited farm → Create sign-in session → Send welcome notification.

**Actor:** User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [PUBLIC-CHECKS](PUBLIC-CHECKS.puml), [CHECK-INVITATION](CHECK-INVITATION.puml), [JOIN-FARM](JOIN-FARM.puml).

**Thành phần và trách nhiệm:**

- **User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **AuthController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **AuthService**: Thực hiện tương tác đã ghi trên lifeline.
- **UsersService**: Performs the supporting action shown in its messages.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **JwtService**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Registration validates before creating the user and catches later join failures. Email sign-in rethrows invitation validation errors but catches other join errors. Google sign-in catches invitation errors. The enclosing caller determines the error outcome.

**Căn cứ mã nguồn:**

- [backend/src/modules/auth/auth.controller.ts:28](../../backend/src/modules/auth/auth.controller.ts#L28) — `AuthController`
- [backend/src/modules/auth/auth.service.ts:35](../../backend/src/modules/auth/auth.service.ts#L35) — `register`
- [backend/src/modules/users/users.service.ts:107](../../backend/src/modules/users/users.service.ts#L107) — `findByEmail`
- [backend/src/modules/users/users.service.ts:142](../../backend/src/modules/users/users.service.ts#L142) — `create`
- [backend/src/modules/auth/auth.service.ts:820](../../backend/src/modules/auth/auth.service.ts#L820) — `generateTokens`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/notifications/notifications.service.ts:13](../../backend/src/modules/notifications/notifications.service.ts#L13) — `createWelcomeNotification`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/auth/auth.service.ts:173](../../backend/src/modules/auth/auth.service.ts#L173) — `login`
- [backend/src/modules/auth/auth.service.ts:298](../../backend/src/modules/auth/auth.service.ts#L298) — `loginWithGoogle`
- [backend/src/modules/notifications/notifications.service.ts:31](../../backend/src/modules/notifications/notifications.service.ts#L31) — `createFarmJoinNotification`
- [backend/src/modules/notifications/notifications.service.ts:129](../../backend/src/modules/notifications/notifications.service.ts#L129) — `createStaffJoinedNotification`

### FE-02 — Sign In with Email/Password and Google OAuth

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-02-EMAIL](FE-02-EMAIL.puml), [FE-02-GOOGLE](FE-02-GOOGLE.puml).

**Thành phần và trách nhiệm:**

- **User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **AuthController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **AuthService**: Applies the feature rules and coordinates storage or supporting services.
- **UsersService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **JwtService**: Performs the supporting action shown in its messages.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **Google Identity**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Registration validates before creating the user and catches later join failures. Email sign-in rethrows invitation validation errors but catches other join errors. Google sign-in catches invitation errors. The enclosing caller determines the error outcome.

**Căn cứ mã nguồn:**

- [backend/src/modules/auth/auth.controller.ts:28](../../backend/src/modules/auth/auth.controller.ts#L28) — `AuthController`
- [backend/src/modules/auth/auth.service.ts:173](../../backend/src/modules/auth/auth.service.ts#L173) — `login`
- [backend/src/modules/users/users.service.ts:107](../../backend/src/modules/users/users.service.ts#L107) — `findByEmail`
- [backend/src/modules/auth/auth.service.ts:820](../../backend/src/modules/auth/auth.service.ts#L820) — `generateTokens`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/auth/auth.service.ts:35](../../backend/src/modules/auth/auth.service.ts#L35) — `register`
- [backend/src/modules/auth/auth.service.ts:298](../../backend/src/modules/auth/auth.service.ts#L298) — `loginWithGoogle`
- [backend/src/modules/notifications/notifications.service.ts:31](../../backend/src/modules/notifications/notifications.service.ts#L31) — `createFarmJoinNotification`
- [backend/src/modules/notifications/notifications.service.ts:129](../../backend/src/modules/notifications/notifications.service.ts#L129) — `createStaffJoinedNotification`
- [backend/src/modules/notifications/notifications.service.ts:13](../../backend/src/modules/notifications/notifications.service.ts#L13) — `createWelcomeNotification`

### FE-03 — Sign Out and Session Token Invalidation

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Sign out → Validate request → Revoke refresh session → Invalidate remaining access to the ended session.

**Actor:** Signed-in User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [SIGNOUT-CHECKS](SIGNOUT-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Signed-in User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **AuthController**: Thực hiện tương tác đã ghi trên lifeline.
- **AuthService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Immediate access-token invalidation is a proposed extension; current logout revokes refresh sessions only. The revocation mechanism is not prescribed by Report 4.

**Căn cứ mã nguồn:**

- [backend/src/modules/auth/auth.controller.ts:28](../../backend/src/modules/auth/auth.controller.ts#L28) — `AuthController`
- [backend/src/modules/auth/auth.service.ts:645](../../backend/src/modules/auth/auth.service.ts#L645) — `logout`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/auth.controller.ts:203](../../backend/src/modules/auth/auth.controller.ts#L203) — `assertCsrfHeader`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-04 — Password Management and Reset via Email OTP

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-04-REQUEST-CODE](FE-04-REQUEST-CODE.puml), [FE-04-RESET](FE-04-RESET.puml), [FE-04-CHANGE](FE-04-CHANGE.puml).

**Thành phần và trách nhiệm:**

- **User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **AuthController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **AuthService**: Applies the feature rules and coordinates storage or supporting services.
- **UsersService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **SMTP Server**: Performs the supporting action shown in its messages.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **Signed-in User**: Initiates the selected workflow.
- **UsersController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/auth/auth.controller.ts:28](../../backend/src/modules/auth/auth.controller.ts#L28) — `AuthController`
- [backend/src/modules/auth/auth.service.ts:452](../../backend/src/modules/auth/auth.service.ts#L452) — `forgotPassword`
- [backend/src/modules/users/users.service.ts:107](../../backend/src/modules/users/users.service.ts#L107) — `findByEmail`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/auth/auth.service.ts:520](../../backend/src/modules/auth/auth.service.ts#L520) — `resetPassword`
- [backend/src/modules/users/users.controller.ts:22](../../backend/src/modules/users/users.controller.ts#L22) — `UsersController`
- [backend/src/modules/users/users.service.ts:233](../../backend/src/modules/users/users.service.ts#L233) — `changePassword`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`

### FE-05 — Role-Based Access Control for Admin, Farm Manager, Technician, and Farmer

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Open a role-restricted feature → Verify user, role and input → Find accessible farms → Load records in accessible farms.

**Actor:** User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **PondsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **PondsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/ponds/ponds.controller.ts:21](../../backend/src/modules/ponds/ponds.controller.ts#L21) — `PondsController`
- [backend/src/modules/ponds/ponds.service.ts:68](../../backend/src/modules/ponds/ponds.service.ts#L68) — `findAll`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-06 — View User List

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View user list → Verify user, role and input → Load users without password data.

**Actor:** Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **UsersController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **UsersService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/users/users.controller.ts:22](../../backend/src/modules/users/users.controller.ts#L22) — `UsersController`
- [backend/src/modules/users/users.service.ts:20](../../backend/src/modules/users/users.service.ts#L20) — `findAll`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-07 — View and Update User Profile Details

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** User / Admin. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [FE-07-OWN-PROFILE](FE-07-OWN-PROFILE.puml), [FE-07-ADMIN-PROFILE](FE-07-ADMIN-PROFILE.puml).

**Thành phần và trách nhiệm:**

- **User / Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **Signed-in User**: Initiates the selected workflow.
- **UsersController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **UsersService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **Admin**: Initiates the selected workflow.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.
- An administrator may edit another user profile. Current profile endpoints only edit the signed-in account; role/status actions already exist separately.

**Căn cứ mã nguồn:**

- [backend/src/modules/users/users.controller.ts:22](../../backend/src/modules/users/users.controller.ts#L22) — `UsersController`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/users/users.service.ts:198](../../backend/src/modules/users/users.service.ts#L198) — `updateProfile`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/users/users.service.ts:14](../../backend/src/modules/users/users.service.ts#L14) — `UsersService`

### FE-08 — Create User Account

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit new user details → Verify user, role and input → Check email availability → Save new account with permitted role.

**Actor:** Admin. **Trạng thái:** Proposed design.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **UsersController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **UsersService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- The administrator supplies initial account details. Account delivery or invitation policy is unspecified, so no email step is invented.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/users/users.controller.ts:22](../../backend/src/modules/users/users.controller.ts#L22) — `UsersController`
- [backend/src/modules/users/users.service.ts:14](../../backend/src/modules/users/users.service.ts#L14) — `UsersService`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-09 — Lock and Unlock User Account

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Lock or unlock selected account → Verify user, role and input → Save account access status.

**Actor:** Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **UsersController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **UsersService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/users/users.controller.ts:22](../../backend/src/modules/users/users.controller.ts#L22) — `UsersController`
- [backend/src/modules/users/users.service.ts:184](../../backend/src/modules/users/users.service.ts#L184) — `updateStatus`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-10 — View Farm List

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View farm list → Verify user, role and input → Load farms and ponds allowed by the user role.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **FarmsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **FarmsService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/farms/farms.controller.ts:24](../../backend/src/modules/farms/farms.controller.ts#L24) — `FarmsController`
- [backend/src/modules/farms/farms.service.ts:74](../../backend/src/modules/farms/farms.service.ts#L74) — `findAll`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-11 — Manage Farm Profile and Farming Model Configuration

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm Manager. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-11-CREATE](FE-11-CREATE.puml), [FE-11-UPDATE](FE-11-UPDATE.puml), [FE-11-DELETE](FE-11-DELETE.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **FarmsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **FarmsService**: Applies the feature rules and coordinates storage or supporting services.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **FarmAccessService**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/farms/farms.controller.ts:24](../../backend/src/modules/farms/farms.controller.ts#L24) — `FarmsController`
- [backend/src/modules/farms/farms.service.ts:28](../../backend/src/modules/farms/farms.service.ts#L28) — `create`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/notifications/notifications.service.ts:167](../../backend/src/modules/notifications/notifications.service.ts#L167) — `createFarmCreatedNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/farms/farms.service.ts:154](../../backend/src/modules/farms/farms.service.ts#L154) — `update`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/farm-access/farm-access.service.ts:54](../../backend/src/modules/farm-access/farm-access.service.ts#L54) — `assertCanManageFarm`
- [backend/src/modules/farms/farms.service.ts:210](../../backend/src/modules/farms/farms.service.ts#L210) — `remove`

### FE-12 — Assign and Manage Farm Staff

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm Manager / Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-12-STAFF](FE-12-STAFF.puml), [FE-12-INVITE](FE-12-INVITE.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager / Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **FarmsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **FarmsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **Farm Manager**: Initiates the selected workflow.
- **EmailService**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/farms/farms.controller.ts:24](../../backend/src/modules/farms/farms.controller.ts#L24) — `FarmsController`
- [backend/src/modules/farms/farms.service.ts:223](../../backend/src/modules/farms/farms.service.ts#L223) — `getStaff`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/farm-access/farm-access.service.ts:54](../../backend/src/modules/farm-access/farm-access.service.ts#L54) — `assertCanManageFarm`
- [backend/src/modules/farms/farms.service.ts:246](../../backend/src/modules/farms/farms.service.ts#L246) — `assignStaff`
- [backend/src/modules/notifications/notifications.service.ts:31](../../backend/src/modules/notifications/notifications.service.ts#L31) — `createFarmJoinNotification`
- [backend/src/modules/farms/farms.service.ts:317](../../backend/src/modules/farms/farms.service.ts#L317) — `unassignStaff`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/farms/farms.service.ts:357](../../backend/src/modules/farms/farms.service.ts#L357) — `inviteStaffByEmail`
- [backend/src/modules/email/email.service.ts:31](../../backend/src/modules/email/email.service.ts#L31) — `sendFarmInvitationExistingUser`
- [backend/src/modules/email/email.service.ts:136](../../backend/src/modules/email/email.service.ts#L136) — `sendFarmInvitationNewUser`
- [backend/src/modules/notifications/notifications.service.ts:129](../../backend/src/modules/notifications/notifications.service.ts#L129) — `createStaffJoinedNotification`

### FE-13 — View Pond List

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View pond list → Verify user, role and input → Find accessible farms → Load ponds in accessible farms.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **PondsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **PondsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/ponds/ponds.controller.ts:21](../../backend/src/modules/ponds/ponds.controller.ts#L21) — `PondsController`
- [backend/src/modules/ponds/ponds.service.ts:68](../../backend/src/modules/ponds/ponds.service.ts#L68) — `findAll`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-14 — Manage Pond Specifications and Farm Association

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm Manager / Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-14-CREATE](FE-14-CREATE.puml), [FE-14-UPDATE](FE-14-UPDATE.puml), [FE-14-DELETE](FE-14-DELETE.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager / Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **PondsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **PondsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/ponds/ponds.controller.ts:21](../../backend/src/modules/ponds/ponds.controller.ts#L21) — `PondsController`
- [backend/src/modules/ponds/ponds.service.ts:22](../../backend/src/modules/ponds/ponds.service.ts#L22) — `create`
- [backend/src/modules/farm-access/farm-access.service.ts:54](../../backend/src/modules/farm-access/farm-access.service.ts#L54) — `assertCanManageFarm`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/notifications/notifications.service.ts:187](../../backend/src/modules/notifications/notifications.service.ts#L187) — `createPondCreatedNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/ponds/ponds.service.ts:231](../../backend/src/modules/ponds/ponds.service.ts#L231) — `update`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/ponds/ponds.service.ts:255](../../backend/src/modules/ponds/ponds.service.ts#L255) — `remove`

### FE-15 — Assign Crop and Monitor Active Pond Status

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Assign a new crop to the pond → Verify user, role and input → Load selected pond and farm → Check farm access → Find another active crop in the pond → Save crop details → Notify crop creation.

**Actor:** Farm Manager / Farmer. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager / Farmer**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- An active pond is inferred from its active crop. No separate pond active-status update is invented.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:387](../../backend/src/modules/crops/crops.service.ts#L387) — `create`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/notifications/notifications.service.ts:210](../../backend/src/modules/notifications/notifications.service.ts#L210) — `createCropCreatedNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-16 — Manage Shrimp Crop

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-16-LIST](FE-16-LIST.puml), [FE-16-CREATE](FE-16-CREATE.puml), [FE-16-UPDATE](FE-16-UPDATE.puml), [FE-16-DELETE](FE-16-DELETE.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **Farm Manager / Farmer**: Initiates the selected workflow.
- **NotificationsService**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:40](../../backend/src/modules/crops/crops.service.ts#L40) — `findAll`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/crops/crops.service.ts:387](../../backend/src/modules/crops/crops.service.ts#L387) — `create`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/notifications/notifications.service.ts:210](../../backend/src/modules/notifications/notifications.service.ts#L210) — `createCropCreatedNotification`
- [backend/src/modules/crops/crops.service.ts:533](../../backend/src/modules/crops/crops.service.ts#L533) — `update`
- [backend/src/modules/crops/crops.service.ts:721](../../backend/src/modules/crops/crops.service.ts#L721) — `remove`

### FE-17 — Record Shrimp Stocking Information

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Record shrimp stocking → Verify user, role and input → Load selected pond and farm → Check farm access → Find another active crop in the pond → Save crop details → Notify crop creation.

**Actor:** Farm Manager / Farmer. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager / Farmer**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Stocking details are crop fields; no separate multi-batch stocking ledger is assumed.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:387](../../backend/src/modules/crops/crops.service.ts#L387) — `create`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/notifications/notifications.service.ts:210](../../backend/src/modules/notifications/notifications.service.ts#L210) — `createCropCreatedNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-18 — Split and Transfer Nursery Crop to Commercial Ponds

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit nursery transfer plan → Verify user, role and input → Load crop and pond → Check farm access → Load destination ponds and active crops → Close nursery crop and create linked commercial crops atomically.

**Actor:** Farm Manager / Farmer. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager / Farmer**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:1527](../../backend/src/modules/crops/crops.service.ts#L1527) — `splitCrop`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-19 — Harvest Crop and Generate Financial Summary

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm Manager / Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-19-COSTS](FE-19-COSTS.puml), [FE-19-CONFIRM](FE-19-CONFIRM.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager / Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **Farm Manager / Admin / Farmer**: Initiates the selected workflow.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **crop-review.generator.ts**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:740](../../backend/src/modules/crops/crops.service.ts#L740) — `getHarvestSummary`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/crops/crops.service.ts:1387](../../backend/src/modules/crops/crops.service.ts#L1387) — `harvest`
- [backend/src/modules/crops/crop-review.generator.ts:36](../../backend/src/modules/crops/crop-review.generator.ts#L36) — `generateHarvestReview`

### FE-20 — View Crop Lifecycle History and Milestones

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View crop lifecycle → Verify user, role and input → Load crop and pond → Check farm access.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:357](../../backend/src/modules/crops/crops.service.ts#L357) — `findOne`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-21 — Record Daily Feed Consumption

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit daily feeding sessions → Verify user, role and input → Check farm access → Load pond and selected crop → Load existing feeding sessions → Load selected feed and stock → Save feeding sessions and adjust stock together.

**Actor:** Farmer / Farm Manager / Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farmer / Farm Manager / Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **FeedingLogsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **FeedingLogsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/feeding-logs/feeding-logs.controller.ts:21](../../backend/src/modules/feeding-logs/feeding-logs.controller.ts#L21) — `FeedingLogsController`
- [backend/src/modules/feeding-logs/feeding-logs.service.ts:25](../../backend/src/modules/feeding-logs/feeding-logs.service.ts#L25) — `createOrUpdateDailyLog`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-22 — Record Daily Shrimp Mortality

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Record shrimp mortality → Verify user, role and input → Load crop and pond → Check farm access → Save mortality record.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **SurvivalRateController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **SurvivalRateService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Recording mortality does not change stocking count. Current survival estimates do not subtract mortality totals automatically.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/survival-rate/survival-rate.controller.ts:22](../../backend/src/modules/survival-rate/survival-rate.controller.ts#L22) — `SurvivalRateController`
- [backend/src/modules/survival-rate/survival-rate.service.ts:206](../../backend/src/modules/survival-rate/survival-rate.service.ts#L206) — `createMortalityLog`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-23 — Record Shrimp Health and Clinical Symptoms

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit shrimp health observations → Verify user, role and input → Load farm, pond, crop and recorder → Check farm access → Save shrimp health observations → Start health notification task.

**Actor:** Farmer / Technician. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [HEALTH-NOTIFICATION](HEALTH-NOTIFICATION.puml).

**Thành phần và trách nhiệm:**

- **Farmer / Technician**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **ShrimpHealthController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ShrimpHealthService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **NotificationsService**: Thực hiện tương tác đã ghi trên lifeline.
- **User**: Initiates the selected workflow.
- **NotificationsGateway**: Thực hiện tương tác đã ghi trên lifeline.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/shrimp-health/shrimp-health.controller.ts:22](../../backend/src/modules/shrimp-health/shrimp-health.controller.ts#L22) — `ShrimpHealthController`
- [backend/src/modules/shrimp-health/shrimp-health.service.ts:25](../../backend/src/modules/shrimp-health/shrimp-health.service.ts#L25) — `create`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/shrimp-health/shrimp-health.service.ts:113](../../backend/src/modules/shrimp-health/shrimp-health.service.ts#L113) — `dispatchShrimpHealthNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/notifications/notifications.service.ts:318](../../backend/src/modules/notifications/notifications.service.ts#L318) — `notifyShrimpHealthUpdate`
- [backend/src/modules/notifications/notifications.service.ts:234](../../backend/src/modules/notifications/notifications.service.ts#L234) — `notifyWaterQualityUpdate`
- [backend/src/modules/notifications/notifications.service.ts:403](../../backend/src/modules/notifications/notifications.service.ts#L403) — `notifyGrowthUpdate`
- [backend/src/modules/notifications/notifications.gateway.ts:85](../../backend/src/modules/notifications/notifications.gateway.ts#L85) — `sendNotificationToUser`

### FE-24 — Record Daily Farming Notes and Operational Observations

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit daily farming note → Verify user, role and input → Check farm access → Check selected farm, pond and crop → Save daily note and observations.

**Actor:** Farmer / Farm Manager. **Trạng thái:** Proposed design.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farmer / Farm Manager**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **DailyNotesController (proposed)**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **DailyNotesService (proposed)**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- A standalone daily note is proposed. Current code stores notes only inside feeding, water, mortality and health records. Detailed note fields and retention are unspecified.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/feeding-logs/feeding-logs.service.ts:25](../../backend/src/modules/feeding-logs/feeding-logs.service.ts#L25) — `createOrUpdateDailyLog`
- [backend/prisma/schema.prisma:509](../../backend/prisma/schema.prisma#L509) — `model FeedingLog`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-25 — Record Water Quality Parameters

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit water measurements → Verify user, role and input → Load pond, farm and recorder → Check farm access → Save water measurements → Start water notification task.

**Actor:** Technician / Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [WATER-NOTIFICATION](WATER-NOTIFICATION.puml).

**Thành phần và trách nhiệm:**

- **Technician / Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **WaterQualityController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WaterQualityService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **NotificationsService**: Thực hiện tương tác đã ghi trên lifeline.
- **User**: Initiates the selected workflow.
- **NotificationsGateway**: Thực hiện tương tác đã ghi trên lifeline.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/water-quality/water-quality.controller.ts:23](../../backend/src/modules/water-quality/water-quality.controller.ts#L23) — `WaterQualityController`
- [backend/src/modules/water-quality/water-quality.service.ts:21](../../backend/src/modules/water-quality/water-quality.service.ts#L21) — `create`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/water-quality/water-quality.service.ts:96](../../backend/src/modules/water-quality/water-quality.service.ts#L96) — `dispatchWaterQualityNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/notifications/notifications.service.ts:234](../../backend/src/modules/notifications/notifications.service.ts#L234) — `notifyWaterQualityUpdate`
- [backend/src/modules/notifications/notifications.service.ts:318](../../backend/src/modules/notifications/notifications.service.ts#L318) — `notifyShrimpHealthUpdate`
- [backend/src/modules/notifications/notifications.service.ts:403](../../backend/src/modules/notifications/notifications.service.ts#L403) — `notifyGrowthUpdate`
- [backend/src/modules/notifications/notifications.gateway.ts:85](../../backend/src/modules/notifications/notifications.gateway.ts#L85) — `sendNotificationToUser`

### FE-26 — View Water Quality Historical Logs

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View water quality history → Verify user, role and input → Find accessible farms → Apply selected farm, pond and period filters → Load water history and total.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [WATER-HISTORY-FILTERS](WATER-HISTORY-FILTERS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **WaterQualityController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WaterQualityService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/water-quality/water-quality.controller.ts:23](../../backend/src/modules/water-quality/water-quality.controller.ts#L23) — `WaterQualityController`
- [backend/src/modules/water-quality/water-quality.service.ts:206](../../backend/src/modules/water-quality/water-quality.service.ts#L206) — `findHistory`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-27 — Monitor Water Quality Trends and Fluctuation Analytics

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View water quality trends → Verify user, role and input → Apply pond, crop or farm scope → Load measurements in time order.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [WATER-TREND-FILTERS](WATER-TREND-FILTERS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **WaterQualityController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WaterQualityService**: Thực hiện tương tác đã ghi trên lifeline.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **FarmAccessService**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.
- A missing selected pond is rejected. Current trend code tolerates a missing crop rather than always returning not found.

**Căn cứ mã nguồn:**

- [backend/src/modules/water-quality/water-quality.controller.ts:23](../../backend/src/modules/water-quality/water-quality.controller.ts#L23) — `WaterQualityController`
- [backend/src/modules/water-quality/water-quality.service.ts:406](../../backend/src/modules/water-quality/water-quality.service.ts#L406) — `findTrends`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-28 — View Inventory Item List and Current Stock Level

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View inventory and current stock → Verify user, role and input → Find accessible farms → Check selected farm access → Load matching inventory and total.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [FARM-SCOPE-CHECK](FARM-SCOPE-CHECK.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **InventoryController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **InventoryService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Thực hiện tương tác đã ghi trên lifeline.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/inventory/inventory.controller.ts:25](../../backend/src/modules/inventory/inventory.controller.ts#L25) — `InventoryController`
- [backend/src/modules/inventory/inventory.service.ts:70](../../backend/src/modules/inventory/inventory.service.ts#L70) — `findAll`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`

### FE-29 — Manage Inventory Items and Low-Stock Threshold Alerts

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm Manager. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [FE-29-CREATE](FE-29-CREATE.puml), [FE-29-UPDATE](FE-29-UPDATE.puml), [FE-29-DELETE](FE-29-DELETE.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **InventoryController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **InventoryService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/inventory/inventory.controller.ts:25](../../backend/src/modules/inventory/inventory.controller.ts#L25) — `InventoryController`
- [backend/src/modules/inventory/inventory.service.ts:24](../../backend/src/modules/inventory/inventory.service.ts#L24) — `create`
- [backend/src/modules/farm-access/farm-access.service.ts:54](../../backend/src/modules/farm-access/farm-access.service.ts#L54) — `assertCanManageFarm`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/inventory/inventory.service.ts:542](../../backend/src/modules/inventory/inventory.service.ts#L542) — `update`
- [backend/src/modules/inventory/inventory.service.ts:602](../../backend/src/modules/inventory/inventory.service.ts#L602) — `remove`

### FE-30 — Track Inventory Usage and Material Depletion Logs

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-30-USE](FE-30-USE.puml), [FE-30-HISTORY](FE-30-HISTORY.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **InventoryController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **InventoryService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Thực hiện tương tác đã ghi trên lifeline.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/inventory/inventory.controller.ts:25](../../backend/src/modules/inventory/inventory.controller.ts#L25) — `InventoryController`
- [backend/src/modules/inventory/inventory.service.ts:125](../../backend/src/modules/inventory/inventory.service.ts#L125) — `recordUsage`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/inventory/inventory.service.ts:274](../../backend/src/modules/inventory/inventory.service.ts#L274) — `findUsageLogs`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`

### FE-31 — Manage Suppliers and Supplied Product Catalog

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [FE-31-LIST](FE-31-LIST.puml), [FE-31-SAVE](FE-31-SAVE.puml), [FE-31-DELETE](FE-31-DELETE.puml), [FE-29](FE-29.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **SuppliersController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **SuppliersService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **Farm Manager**: Initiates the selected workflow.
- **InventoryController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **InventoryService**: Applies the feature rules and coordinates storage or supporting services.
- **NotificationsService**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- The supplied product catalog is represented by supplier-linked Inventory items. No separate supplier-product master is invented.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/suppliers/suppliers.controller.ts:22](../../backend/src/modules/suppliers/suppliers.controller.ts#L22) — `SuppliersController`
- [backend/src/modules/suppliers/suppliers.service.ts:31](../../backend/src/modules/suppliers/suppliers.service.ts#L31) — `findAll`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/suppliers/suppliers.service.ts:21](../../backend/src/modules/suppliers/suppliers.service.ts#L21) — `create`
- [backend/src/modules/farm-access/farm-access.service.ts:54](../../backend/src/modules/farm-access/farm-access.service.ts#L54) — `assertCanManageFarm`
- [backend/src/modules/suppliers/suppliers.service.ts:68](../../backend/src/modules/suppliers/suppliers.service.ts#L68) — `update`
- [backend/src/modules/suppliers/suppliers.service.ts:93](../../backend/src/modules/suppliers/suppliers.service.ts#L93) — `remove`
- [backend/src/modules/inventory/inventory.controller.ts:25](../../backend/src/modules/inventory/inventory.controller.ts#L25) — `InventoryController`
- [backend/src/modules/inventory/inventory.service.ts:24](../../backend/src/modules/inventory/inventory.service.ts#L24) — `create`
- [backend/src/modules/inventory/inventory.service.ts:542](../../backend/src/modules/inventory/inventory.service.ts#L542) — `update`
- [backend/src/modules/inventory/inventory.service.ts:602](../../backend/src/modules/inventory/inventory.service.ts#L602) — `remove`

### FE-32 — Record Sampling Data and Track Shrimp Size

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit five shrimp sample casts → Verify user, role and input → Load selected pond → Check farm access → Load active crop and pond area → Load previous sample in the crop → Save sample with size, growth and biomass estimates → Start growth notification task.

**Actor:** Technician. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [GROWTH-NOTIFICATION](GROWTH-NOTIFICATION.puml).

**Thành phần và trách nhiệm:**

- **Technician**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **ShrimpSizeController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ShrimpSizeService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **NotificationsService**: Thực hiện tương tác đã ghi trên lifeline.
- **User**: Initiates the selected workflow.
- **NotificationsGateway**: Thực hiện tương tác đã ghi trên lifeline.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/shrimp-size/shrimp-size.controller.ts:19](../../backend/src/modules/shrimp-size/shrimp-size.controller.ts#L19) — `ShrimpSizeController`
- [backend/src/modules/shrimp-size/shrimp-size.service.ts:24](../../backend/src/modules/shrimp-size/shrimp-size.service.ts#L24) — `createSample`
- [backend/src/modules/shrimp-size/shrimp-size.service.ts:610](../../backend/src/modules/shrimp-size/shrimp-size.service.ts#L610) — `assertCanAccessPond`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/shrimp-size/shrimp-size.service.ts:165](../../backend/src/modules/shrimp-size/shrimp-size.service.ts#L165) — `dispatchGrowthNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/notifications/notifications.service.ts:403](../../backend/src/modules/notifications/notifications.service.ts#L403) — `notifyGrowthUpdate`
- [backend/src/modules/notifications/notifications.service.ts:234](../../backend/src/modules/notifications/notifications.service.ts#L234) — `notifyWaterQualityUpdate`
- [backend/src/modules/notifications/notifications.service.ts:318](../../backend/src/modules/notifications/notifications.service.ts#L318) — `notifyShrimpHealthUpdate`
- [backend/src/modules/notifications/notifications.gateway.ts:85](../../backend/src/modules/notifications/notifications.gateway.ts#L85) — `sendNotificationToUser`

### FE-33 — Estimate Pond Biomass Using the Cast-Net Method

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit casts for biomass estimation → Verify user, role and input → Load selected pond → Check farm access → Load active crop and pond area → Load previous sample in the crop → Save sample with size, growth and biomass estimates → Start growth notification task.

**Actor:** Technician. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [GROWTH-NOTIFICATION](GROWTH-NOTIFICATION.puml).

**Thành phần và trách nhiệm:**

- **Technician**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **ShrimpSizeController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ShrimpSizeService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **NotificationsService**: Thực hiện tương tác đã ghi trên lifeline.
- **User**: Initiates the selected workflow.
- **NotificationsGateway**: Thực hiện tương tác đã ghi trên lifeline.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/shrimp-size/shrimp-size.controller.ts:19](../../backend/src/modules/shrimp-size/shrimp-size.controller.ts#L19) — `ShrimpSizeController`
- [backend/src/modules/shrimp-size/shrimp-size.service.ts:24](../../backend/src/modules/shrimp-size/shrimp-size.service.ts#L24) — `createSample`
- [backend/src/modules/shrimp-size/shrimp-size.service.ts:610](../../backend/src/modules/shrimp-size/shrimp-size.service.ts#L610) — `assertCanAccessPond`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/shrimp-size/shrimp-size.service.ts:165](../../backend/src/modules/shrimp-size/shrimp-size.service.ts#L165) — `dispatchGrowthNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/notifications/notifications.service.ts:403](../../backend/src/modules/notifications/notifications.service.ts#L403) — `notifyGrowthUpdate`
- [backend/src/modules/notifications/notifications.service.ts:234](../../backend/src/modules/notifications/notifications.service.ts#L234) — `notifyWaterQualityUpdate`
- [backend/src/modules/notifications/notifications.service.ts:318](../../backend/src/modules/notifications/notifications.service.ts#L318) — `notifyShrimpHealthUpdate`
- [backend/src/modules/notifications/notifications.gateway.ts:85](../../backend/src/modules/notifications/notifications.gateway.ts#L85) — `sendNotificationToUser`

### FE-34 — Monitor Survival Rate and Remaining Shrimp Population

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View crop survival and population → Verify user, role and input → Load crop and pond → Check farm access → Load latest population estimate.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **SurvivalRateController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **SurvivalRateService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **ShrimpSizeService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/survival-rate/survival-rate.controller.ts:22](../../backend/src/modules/survival-rate/survival-rate.controller.ts#L22) — `SurvivalRateController`
- [backend/src/modules/survival-rate/survival-rate.service.ts:31](../../backend/src/modules/survival-rate/survival-rate.service.ts#L31) — `calculateSurvivalRate`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/shrimp-size/shrimp-size.service.ts:358](../../backend/src/modules/shrimp-size/shrimp-size.service.ts#L358) — `getCurrentShrimpCount`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-35 — Calculate and Analyze Real-Time Feed Conversion Ratio

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View feed conversion analysis → Verify user, role and input → Load selected pond → Check farm access → Load active crop → Load biomass samples → Load non-skipped feeding records.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **ShrimpSizeController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ShrimpSizeService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/shrimp-size/shrimp-size.controller.ts:19](../../backend/src/modules/shrimp-size/shrimp-size.controller.ts#L19) — `ShrimpSizeController`
- [backend/src/modules/shrimp-size/shrimp-size.service.ts:451](../../backend/src/modules/shrimp-size/shrimp-size.service.ts#L451) — `analyzeFCR`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-36 — Compare Actual Growth Curve

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Compare actual shrimp growth → Verify user, role and input → Find accessible farms → Resolve selected farm, pond and crop → Load actual shrimp samples.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [GROWTH-SCOPE](GROWTH-SCOPE.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- The standard/reference curve is the existing frontend reference, not an invented server-calculated 5T interpolation.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:1730](../../backend/src/modules/crops/crops.service.ts#L1730) — `getGrowthTrajectory90d`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [frontend-web/src/features/growth/TechnicianOverviewDashboard.tsx:286](../../frontend-web/src/features/growth/TechnicianOverviewDashboard.tsx#L286) — `fetchGrowthData`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-37 — Generate Adaptive Daily Feeding Recommendations

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Request daily feeding recommendation → Verify user, role and input → Check farm access → Load active crop, growth and feeding history → Load relevant weather → Load approved feeding rules and targets.

**Actor:** Farm Manager / Farmer. **Trạng thái:** Proposed design.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager / Farmer**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **FeedingRecommendationController (proposed)**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **FeedingRecommendationService (proposed)**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **WeatherService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Controller, service and ration calculation are proposed. Current UI only suggests feed reductions from fixed water rules; no adaptive daily-ration algorithm exists. The design leaves formula details open.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [frontend-web/src/features/environment/EnvironmentAIAssessment.tsx:223](../../frontend-web/src/features/environment/EnvironmentAIAssessment.tsx#L223) — `const aiEvaluation`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-38 — Trigger Rule-Based Water Quality Alerts

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Record water quality for alert checks → Verify user, role and input → Load pond, farm and recorder → Check farm access → Save water measurements → Start water notification task → Evaluate water status and notify recipients.

**Actor:** Technician / Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [WATER-NOTIFICATION](WATER-NOTIFICATION.puml).

**Thành phần và trách nhiệm:**

- **Technician / Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **WaterQualityController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WaterQualityService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **NotificationsService**: Thực hiện tương tác đã ghi trên lifeline.
- **User**: Initiates the selected workflow.
- **NotificationsGateway**: Thực hiện tương tác đã ghi trên lifeline.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/water-quality/water-quality.controller.ts:23](../../backend/src/modules/water-quality/water-quality.controller.ts#L23) — `WaterQualityController`
- [backend/src/modules/water-quality/water-quality.service.ts:21](../../backend/src/modules/water-quality/water-quality.service.ts#L21) — `create`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/water-quality/water-quality.service.ts:96](../../backend/src/modules/water-quality/water-quality.service.ts#L96) — `dispatchWaterQualityNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/notifications/notifications.service.ts:234](../../backend/src/modules/notifications/notifications.service.ts#L234) — `notifyWaterQualityUpdate`
- [backend/src/modules/notifications/notifications.service.ts:318](../../backend/src/modules/notifications/notifications.service.ts#L318) — `notifyShrimpHealthUpdate`
- [backend/src/modules/notifications/notifications.service.ts:403](../../backend/src/modules/notifications/notifications.service.ts#L403) — `notifyGrowthUpdate`
- [backend/src/modules/notifications/notifications.gateway.ts:85](../../backend/src/modules/notifications/notifications.gateway.ts#L85) — `sendNotificationToUser`

### FE-39 — Retrieve Real-Time Weather and Forecast Data

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View current weather → Verify user, role and input → Start weather risk check → Load farm address → Find location and load current weather.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [FE-40](FE-40.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **WeatherController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WeatherService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **Open-Meteo**: Performs the supporting action shown in its messages.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **NotificationsService**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/weather/weather.controller.ts:9](../../backend/src/modules/weather/weather.controller.ts#L9) — `WeatherController`
- [backend/src/modules/weather/weather.service.ts:207](../../backend/src/modules/weather/weather.service.ts#L207) — `getWeather`
- [backend/src/modules/weather/weather.service.ts:312](../../backend/src/modules/weather/weather.service.ts#L312) — `syncDisasterAlerts`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/notifications/notifications.service.ts:62](../../backend/src/modules/notifications/notifications.service.ts#L62) — `createDisasterNotification`

### FE-40 — Generate Weather-Induced Risk Warnings

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Check weather risks for the farm → Verify user, role and input → Load farm and active recipients → Load location and 14-day forecast → Create a non-duplicate weather alert.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **WeatherController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WeatherService**: Applies the feature rules and coordinates storage or supporting services.
- **NotificationsService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **Open-Meteo**: Performs the supporting action shown in its messages.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/weather/weather.controller.ts:9](../../backend/src/modules/weather/weather.controller.ts#L9) — `WeatherController`
- [backend/src/modules/weather/weather.service.ts:312](../../backend/src/modules/weather/weather.service.ts#L312) — `syncDisasterAlerts`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/notifications/notifications.service.ts:62](../../backend/src/modules/notifications/notifications.service.ts#L62) — `createDisasterNotification`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-41 — View Environmental Warning History and Resolution Logs

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: View environmental warning history → Verify user, role and input → Check farm access → Load warnings and recorded resolutions → Save resolution and warning status.

**Actor:** Farm User / Farm Manager. **Trạng thái:** Proposed design.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User / Farm Manager**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **EnvironmentController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **EnvironmentService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- A warning-resolution record is proposed. Current water history has computed status; current incident treatment history is a separate workflow. Report 4 does not specify resolution fields or approval rules.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/environment/environment.controller.ts:8](../../backend/src/modules/environment/environment.controller.ts#L8) — `EnvironmentController`
- [backend/src/modules/environment/environment.service.ts:4](../../backend/src/modules/environment/environment.service.ts#L4) — `EnvironmentService`
- [backend/src/modules/water-quality/water-quality.service.ts:206](../../backend/src/modules/water-quality/water-quality.service.ts#L206) — `findHistory`
- [backend/src/modules/incidents/incidents.service.ts:309](../../backend/src/modules/incidents/incidents.service.ts#L309) — `resolve`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-42 — Create Incident Record and Assign Technician

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-42-REPORT](FE-42-REPORT.puml), [FE-42-ASSIGN](FE-42-ASSIGN.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **Farmer / Technician / Farm Manager**: Initiates the selected workflow.
- **IncidentsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **IncidentsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **Farm Manager**: Initiates the selected workflow.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/incidents/incidents.controller.ts:27](../../backend/src/modules/incidents/incidents.controller.ts#L27) — `IncidentsController`
- [backend/src/modules/incidents/incidents.service.ts:154](../../backend/src/modules/incidents/incidents.service.ts#L154) — `create`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/incidents/incidents.service.ts:186](../../backend/src/modules/incidents/incidents.service.ts#L186) — `assign`
- [backend/src/modules/farm-access/farm-access.service.ts:54](../../backend/src/modules/farm-access/farm-access.service.ts#L54) — `assertCanManageFarm`

### FE-43 — Track Treatment Timeline and Update Clinical Progress

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-43-VIEW](FE-43-VIEW.puml), [FE-43-START](FE-43-START.puml), [FE-43-UPDATE](FE-43-UPDATE.puml), [FE-43-RESOLVE](FE-43-RESOLVE.puml), [FE-43-REOPEN](FE-43-REOPEN.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **IncidentsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **IncidentsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **Farm Manager / Assigned Technician**: Initiates the selected workflow.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Current service treatment checks reject Admin despite some route role lists including Admin. Treatment remains restricted to a manager or assigned technician.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/incidents/incidents.controller.ts:27](../../backend/src/modules/incidents/incidents.controller.ts#L27) — `IncidentsController`
- [backend/src/modules/incidents/incidents.service.ts:131](../../backend/src/modules/incidents/incidents.service.ts#L131) — `findOne`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/incidents/incidents.service.ts:235](../../backend/src/modules/incidents/incidents.service.ts#L235) — `startTreatment`
- [backend/src/modules/incidents/incidents.service.ts:270](../../backend/src/modules/incidents/incidents.service.ts#L270) — `addTreatmentUpdate`
- [backend/src/modules/incidents/incidents.service.ts:309](../../backend/src/modules/incidents/incidents.service.ts#L309) — `resolve`
- [backend/src/modules/incidents/incidents.service.ts:343](../../backend/src/modules/incidents/incidents.service.ts#L343) — `reopen`

### FE-44 — Evaluate Water Quality Status and Diagnose Risk

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Request water risk assessment → Verify user, role and input → Load selected pond → Check farm access → Load recent water measurements → Assess water condition and explain risks.

**Actor:** Farm User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **EnvironmentController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **EnvironmentService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **FastAPI AI Service**: Performs the supporting action shown in its messages.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- The server AI assessment endpoint is proposed. Current EnvironmentAIAssessment uses frontend rules/defaults and does not call AI. The target avoids presenting default measurements as observed pond data.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/environment/environment.controller.ts:8](../../backend/src/modules/environment/environment.controller.ts#L8) — `EnvironmentController`
- [backend/src/modules/environment/environment.service.ts:4](../../backend/src/modules/environment/environment.service.ts#L4) — `EnvironmentService`
- [frontend-web/src/features/environment/EnvironmentAIAssessment.tsx:223](../../frontend-web/src/features/environment/EnvironmentAIAssessment.tsx#L223) — `const aiEvaluation`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-45 — Request AI Farming Advice and Inquire About Shrimp Disease Symptoms

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit a farming question → Verify user, role and input → Load pond, crop and latest water readings → Check selected pond farm access → Load permitted medicine and chemical context → Load weather for the question → Request farming advice → Retrieve knowledge and prepare answer.

**Actor:** Farm User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [FARM-SCOPE-CHECK](FARM-SCOPE-CHECK.puml), [CHAT-INVENTORY](CHAT-INVENTORY.puml), [RAG-ANSWER](RAG-ANSWER.puml), [CHAT-FALLBACK](CHAT-FALLBACK.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **ChatbotController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ChatbotService**: Thực hiện tương tác đã ghi trên lifeline.
- **Chatbot WeatherService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **FastAPI AI Service**: Performs the supporting action shown in its messages.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **RAGService**: Thực hiện tương tác đã ghi trên lifeline.
- **VectorStoreService**: Performs the supporting action shown in its messages.
- **ChromaDB (proposed)**: Performs the supporting action shown in its messages.
- **OpenAI API**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.
- Current Python retrieval uses vector_store.json. ChromaDB is the planned store in Report 4 and is explicitly proposed here.

**Căn cứ mã nguồn:**

- [backend/src/modules/chatbot/chatbot.controller.ts:21](../../backend/src/modules/chatbot/chatbot.controller.ts#L21) — `ChatbotController`
- [backend/src/modules/chatbot/chatbot.service.ts:327](../../backend/src/modules/chatbot/chatbot.service.ts#L327) — `ask`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [ai-service/app/services/rag_service.py:108](../../ai-service/app/services/rag_service.py#L108) — `def ask`
- [ai-service/app/services/vector_store.py:143](../../ai-service/app/services/vector_store.py#L143) — `similarity_search`
- [backend/src/modules/chatbot/chatbot.service.ts:64](../../backend/src/modules/chatbot/chatbot.service.ts#L64) — `getEmbedding`
- [backend/src/modules/chatbot/chatbot.service.ts:688](../../backend/src/modules/chatbot/chatbot.service.ts#L688) — `buildFallbackResponse`

### FE-46 — Generate Crop Harvest Review and Next-Crop Recommendations

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Confirm harvest and request review → Verify user, role and input → Load crop and pond → Check farm access → Load previous harvest for comparison → Prepare harvest evaluation and next-crop advice → Save harvest quantities, finances and review.

**Actor:** Farm Manager / Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager / Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **crop-review.generator.ts**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Review generation follows the current deterministic rules. The FE title does not specify an LLM, so no new LLM call is invented.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:1387](../../backend/src/modules/crops/crops.service.ts#L1387) — `harvest`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/crops/crop-review.generator.ts:36](../../backend/src/modules/crops/crop-review.generator.ts#L36) — `generateHarvestReview`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-47 — Ask Aquaculture Technical Questions

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit a farming question → Verify user, role and input → Load pond, crop and latest water readings → Check selected pond farm access → Load permitted medicine and chemical context → Load weather for the question → Request farming advice → Retrieve knowledge and prepare answer.

**Actor:** Farm User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [FARM-SCOPE-CHECK](FARM-SCOPE-CHECK.puml), [CHAT-INVENTORY](CHAT-INVENTORY.puml), [RAG-ANSWER](RAG-ANSWER.puml), [CHAT-FALLBACK](CHAT-FALLBACK.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **ChatbotController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ChatbotService**: Thực hiện tương tác đã ghi trên lifeline.
- **Chatbot WeatherService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **FastAPI AI Service**: Performs the supporting action shown in its messages.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **RAGService**: Thực hiện tương tác đã ghi trên lifeline.
- **VectorStoreService**: Performs the supporting action shown in its messages.
- **ChromaDB (proposed)**: Performs the supporting action shown in its messages.
- **OpenAI API**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.
- Current Python retrieval uses vector_store.json. ChromaDB is the planned store in Report 4 and is explicitly proposed here.

**Căn cứ mã nguồn:**

- [backend/src/modules/chatbot/chatbot.controller.ts:21](../../backend/src/modules/chatbot/chatbot.controller.ts#L21) — `ChatbotController`
- [backend/src/modules/chatbot/chatbot.service.ts:327](../../backend/src/modules/chatbot/chatbot.service.ts#L327) — `ask`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [ai-service/app/services/rag_service.py:108](../../ai-service/app/services/rag_service.py#L108) — `def ask`
- [ai-service/app/services/vector_store.py:143](../../ai-service/app/services/vector_store.py#L143) — `similarity_search`
- [backend/src/modules/chatbot/chatbot.service.ts:64](../../backend/src/modules/chatbot/chatbot.service.ts#L64) — `getEmbedding`
- [backend/src/modules/chatbot/chatbot.service.ts:688](../../backend/src/modules/chatbot/chatbot.service.ts#L688) — `buildFallbackResponse`

### FE-48 — Manage and Ingest Knowledge Documents

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** Authorized User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [FE-48-INGEST](FE-48-INGEST.puml), [FE-48-MANAGE](FE-48-MANAGE.puml), [FE-48-DRIVE](FE-48-DRIVE.puml).

**Thành phần và trách nhiệm:**

- **Authorized User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **Admin / Farm Manager / Technician**: Initiates the selected workflow.
- **ChatbotController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ChatbotService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **FastAPI AI Service**: Thực hiện tương tác đã ghi trên lifeline.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **VectorStoreService**: Performs the supporting action shown in its messages.
- **ChunkingService**: Performs the supporting action shown in its messages.
- **EmbeddingService**: Performs the supporting action shown in its messages.
- **ChromaDB (proposed)**: Performs the supporting action shown in its messages.
- **Admin / Farm Manager**: Initiates the selected workflow.
- **DriveSyncService**: Performs the supporting action shown in its messages.
- **Google Drive API**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Unified ingestion into planned ChromaDB is proposed. Current NestJS document ingestion writes PostgreSQL chunks; Python keeps an independent JSON vector store.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.
- The current chunking/embedding workflow is the basis. The ChromaDB persistence and automatic NestJS-to-Python synchronization are target extensions.

**Căn cứ mã nguồn:**

- [backend/src/modules/chatbot/chatbot.controller.ts:21](../../backend/src/modules/chatbot/chatbot.controller.ts#L21) — `ChatbotController`
- [backend/src/modules/chatbot/chatbot.service.ts:160](../../backend/src/modules/chatbot/chatbot.service.ts#L160) — `createDocument`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [ai-service/app/services/vector_store.py:49](../../ai-service/app/services/vector_store.py#L49) — `add_document`
- [ai-service/app/services/embedding_service.py:28](../../ai-service/app/services/embedding_service.py#L28) — `get_embedding`
- [backend/src/modules/chatbot/chatbot.service.ts:200](../../backend/src/modules/chatbot/chatbot.service.ts#L200) — `getAllDocuments`
- [backend/src/modules/chatbot/chatbot.service.ts:222](../../backend/src/modules/chatbot/chatbot.service.ts#L222) — `deleteDocument`
- [backend/src/modules/chatbot/chatbot.service.ts:246](../../backend/src/modules/chatbot/chatbot.service.ts#L246) — `syncDriveDocuments`
- [ai-service/app/services/drive_sync_service.py:182](../../ai-service/app/services/drive_sync_service.py#L182) — `sync_folder`

### FE-49 — Generate Context-Aware Consultation Using Pond Metrics and Weather Data

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Submit a farming question → Verify user, role and input → Load pond, crop and latest water readings → Check selected pond farm access → Load permitted medicine and chemical context → Load weather for the question → Request farming advice → Retrieve knowledge and prepare answer.

**Actor:** Farm User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml), [FARM-SCOPE-CHECK](FARM-SCOPE-CHECK.puml), [CHAT-INVENTORY](CHAT-INVENTORY.puml), [RAG-ANSWER](RAG-ANSWER.puml), [CHAT-FALLBACK](CHAT-FALLBACK.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **ChatbotController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ChatbotService**: Thực hiện tương tác đã ghi trên lifeline.
- **Chatbot WeatherService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **FastAPI AI Service**: Performs the supporting action shown in its messages.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **RAGService**: Thực hiện tương tác đã ghi trên lifeline.
- **VectorStoreService**: Performs the supporting action shown in its messages.
- **ChromaDB (proposed)**: Performs the supporting action shown in its messages.
- **OpenAI API**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.
- Current Python retrieval uses vector_store.json. ChromaDB is the planned store in Report 4 and is explicitly proposed here.

**Căn cứ mã nguồn:**

- [backend/src/modules/chatbot/chatbot.controller.ts:21](../../backend/src/modules/chatbot/chatbot.controller.ts#L21) — `ChatbotController`
- [backend/src/modules/chatbot/chatbot.service.ts:327](../../backend/src/modules/chatbot/chatbot.service.ts#L327) — `ask`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [ai-service/app/services/rag_service.py:108](../../ai-service/app/services/rag_service.py#L108) — `def ask`
- [ai-service/app/services/vector_store.py:143](../../ai-service/app/services/vector_store.py#L143) — `similarity_search`
- [backend/src/modules/chatbot/chatbot.service.ts:64](../../backend/src/modules/chatbot/chatbot.service.ts#L64) — `getEmbedding`
- [backend/src/modules/chatbot/chatbot.service.ts:688](../../backend/src/modules/chatbot/chatbot.service.ts#L688) — `buildFallbackResponse`

### FE-50 — Dispatch Real-Time Alerts and In-App Push Notifications

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Open notifications → Connect for live notifications → Deliver notifications created by business events → Deliver an alert through the planned push channel.

**Actor:** User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [NOTIFICATION-DELIVERY](NOTIFICATION-DELIVERY.puml), [MOBILE-PUSH](MOBILE-PUSH.puml).

**Thành phần và trách nhiệm:**

- **User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **NotificationsGateway**: Thực hiện tương tác đã ghi trên lifeline.
- **NotificationsService**: Thực hiện tương tác đã ghi trên lifeline.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **Expo Push Service (proposed)**: Performs the supporting action shown in its messages.
- **FCM / APNs (proposed)**: Delivers the accepted alert to the device.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Live gateway delivery exists for active web clients; mobile currently polls. Unified live clients and Expo/FCM/APNs push are target-design extensions, not implemented channels.
- Report 4 section 1.1.2.10 proposes this channel. Device registration, consent, retries and final delivery guarantees require specification; an accepted push request does not guarantee delivery.

**Căn cứ mã nguồn:**

- [backend/src/modules/notifications/notifications.gateway.ts:41](../../backend/src/modules/notifications/notifications.gateway.ts#L41) — `handleConnection`
- [backend/src/modules/notifications/notifications.service.ts:234](../../backend/src/modules/notifications/notifications.service.ts#L234) — `notifyWaterQualityUpdate`
- [backend/src/modules/notifications/notifications.service.ts:318](../../backend/src/modules/notifications/notifications.service.ts#L318) — `notifyShrimpHealthUpdate`
- [backend/src/modules/notifications/notifications.service.ts:403](../../backend/src/modules/notifications/notifications.service.ts#L403) — `notifyGrowthUpdate`
- [backend/src/modules/notifications/notifications.gateway.ts:85](../../backend/src/modules/notifications/notifications.gateway.ts#L85) — `sendNotificationToUser`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/notifications/notifications.service.ts:7](../../backend/src/modules/notifications/notifications.service.ts#L7) — `NotificationsService`

### FE-51 — Manage Notifications, Mark as Read, and Filter by Severity

Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.

**Actor:** User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [FE-51-LIST](FE-51-LIST.puml), [FE-51-READ](FE-51-READ.puml), [FE-51-DELETE](FE-51-DELETE.puml).

**Thành phần và trách nhiệm:**

- **User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **NotificationsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **NotificationsService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/notifications/notifications.controller.ts:15](../../backend/src/modules/notifications/notifications.controller.ts#L15) — `NotificationsController`
- [backend/src/modules/notifications/notifications.service.ts:484](../../backend/src/modules/notifications/notifications.service.ts#L484) — `getUserNotifications`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/notifications/notifications.service.ts:525](../../backend/src/modules/notifications/notifications.service.ts#L525) — `markAsRead`
- [backend/src/modules/notifications/notifications.service.ts:533](../../backend/src/modules/notifications/notifications.service.ts#L533) — `markAllAsRead`
- [backend/src/modules/notifications/notifications.service.ts:541](../../backend/src/modules/notifications/notifications.service.ts#L541) — `deleteNotification`
- [backend/src/modules/notifications/notifications.service.ts:548](../../backend/src/modules/notifications/notifications.service.ts#L548) — `clearAllNotifications`

### FE-52 — View Farm Manager Executive Performance Dashboard

Người dùng mở dashboard; hệ thống tải các phần dữ liệu được chỉ ra trong ref và hiển thị kết quả trong phạm vi quyền truy cập.

**Actor:** Farm Manager. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [OVERVIEW-DATA](OVERVIEW-DATA.puml), [INCIDENT-LIST](INCIDENT-LIST.puml), [MANAGER-SUMMARY](MANAGER-SUMMARY.puml), [MANAGER-WATER](MANAGER-WATER.puml).

**Thành phần và trách nhiệm:**

- **Farm Manager**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **PondsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **PondsService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **IncidentsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **IncidentsService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **WaterQualityController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WaterQualityService**: Applies the feature rules and coordinates storage or supporting services.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [frontend-web/src/features/manager/ManagerDashboardHome.tsx:79](../../frontend-web/src/features/manager/ManagerDashboardHome.tsx#L79) — `loadDashboard`
- [backend/src/modules/ponds/ponds.controller.ts:21](../../backend/src/modules/ponds/ponds.controller.ts#L21) — `PondsController`
- [backend/src/modules/ponds/ponds.service.ts:84](../../backend/src/modules/ponds/ponds.service.ts#L84) — `findOverview`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/incidents/incidents.controller.ts:27](../../backend/src/modules/incidents/incidents.controller.ts#L27) — `IncidentsController`
- [backend/src/modules/incidents/incidents.service.ts:26](../../backend/src/modules/incidents/incidents.service.ts#L26) — `findAll`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:138](../../backend/src/modules/crops/crops.service.ts#L138) — `getManagerSummary`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/water-quality/water-quality.controller.ts:23](../../backend/src/modules/water-quality/water-quality.controller.ts#L23) — `WaterQualityController`
- [backend/src/modules/water-quality/water-quality.service.ts:650](../../backend/src/modules/water-quality/water-quality.service.ts#L650) — `getManagerTrends`

### FE-53 — View Technician Environmental and Pond Health Dashboard

Người dùng mở dashboard; hệ thống tải các phần dữ liệu được chỉ ra trong ref và hiển thị kết quả trong phạm vi quyền truy cập.

**Actor:** Technician. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [GROWTH-DATA](GROWTH-DATA.puml), [WATER-TREND-DATA](WATER-TREND-DATA.puml).

**Thành phần và trách nhiệm:**

- **Technician**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **WaterQualityController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WaterQualityService**: Thực hiện tương tác đã ghi trên lifeline.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.
- A missing selected pond is rejected. Current trend code tolerates a missing crop rather than always returning not found.

**Căn cứ mã nguồn:**

- [frontend-web/src/features/growth/TechnicianOverviewDashboard.tsx:286](../../frontend-web/src/features/growth/TechnicianOverviewDashboard.tsx#L286) — `fetchGrowthData`
- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:1730](../../backend/src/modules/crops/crops.service.ts#L1730) — `getGrowthTrajectory90d`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/water-quality/water-quality.controller.ts:23](../../backend/src/modules/water-quality/water-quality.controller.ts#L23) — `WaterQualityController`
- [backend/src/modules/water-quality/water-quality.service.ts:406](../../backend/src/modules/water-quality/water-quality.service.ts#L406) — `findTrends`

### FE-54 — View Farmer Daily Task Dashboard on the Web

Người dùng mở dashboard; hệ thống tải các phần dữ liệu được chỉ ra trong ref và hiển thị kết quả trong phạm vi quyền truy cập.

**Actor:** Farmer. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [OVERVIEW-DATA](OVERVIEW-DATA.puml), [WATER-HISTORY-DATA](WATER-HISTORY-DATA.puml), [FEEDING-LIST](FEEDING-LIST.puml), [INCIDENT-LIST](INCIDENT-LIST.puml), [HEALTH-LIST](HEALTH-LIST.puml).

**Thành phần và trách nhiệm:**

- **Farmer**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **PondsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **PondsService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.
- **WaterQualityController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **WaterQualityService**: Thực hiện tương tác đã ghi trên lifeline.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **FeedingLogsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **FeedingLogsService**: Applies the feature rules and coordinates storage or supporting services.
- **IncidentsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **IncidentsService**: Thực hiện tương tác đã ghi trên lifeline.
- **ShrimpHealthController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **ShrimpHealthService**: Thực hiện tương tác đã ghi trên lifeline.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- Daily tasks are assembled from logs and incidents. No independent task-assignment model is assumed. Client fallback lists can be used if the optimized overview fails.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [frontend-web/src/features/farmer/FarmerDashboardHome.tsx:81](../../frontend-web/src/features/farmer/FarmerDashboardHome.tsx#L81) — `fetchAllData`
- [backend/src/modules/ponds/ponds.controller.ts:21](../../backend/src/modules/ponds/ponds.controller.ts#L21) — `PondsController`
- [backend/src/modules/ponds/ponds.service.ts:84](../../backend/src/modules/ponds/ponds.service.ts#L84) — `findOverview`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`
- [backend/src/modules/water-quality/water-quality.controller.ts:23](../../backend/src/modules/water-quality/water-quality.controller.ts#L23) — `WaterQualityController`
- [backend/src/modules/water-quality/water-quality.service.ts:206](../../backend/src/modules/water-quality/water-quality.service.ts#L206) — `findHistory`
- [backend/src/modules/farm-access/farm-access.service.ts:13](../../backend/src/modules/farm-access/farm-access.service.ts#L13) — `getAccessibleFarmIds`
- [backend/src/modules/feeding-logs/feeding-logs.controller.ts:21](../../backend/src/modules/feeding-logs/feeding-logs.controller.ts#L21) — `FeedingLogsController`
- [backend/src/modules/feeding-logs/feeding-logs.service.ts:295](../../backend/src/modules/feeding-logs/feeding-logs.service.ts#L295) — `findAllGrouped`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/incidents/incidents.controller.ts:27](../../backend/src/modules/incidents/incidents.controller.ts#L27) — `IncidentsController`
- [backend/src/modules/incidents/incidents.service.ts:26](../../backend/src/modules/incidents/incidents.service.ts#L26) — `findAll`
- [backend/src/modules/shrimp-health/shrimp-health.controller.ts:22](../../backend/src/modules/shrimp-health/shrimp-health.controller.ts#L22) — `ShrimpHealthController`
- [backend/src/modules/shrimp-health/shrimp-health.service.ts:211](../../backend/src/modules/shrimp-health/shrimp-health.service.ts#L211) — `findHistory`

### FE-55 — View System Administration and System Metrics Dashboard

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Open system administration dashboard → Verify user, role and input → Load user, farm, active pond and crop totals → Load daily registrations and role distribution → Load recent user and farm activity.

**Actor:** Admin. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Admin**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **AdminController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **AdminService**: Applies the feature rules and coordinates storage or supporting services.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- System metrics mean the existing business/entity statistics. CPU, uptime and infrastructure-health telemetry are not specified in the FE and are not invented.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/admin/admin.controller.ts:9](../../backend/src/modules/admin/admin.controller.ts#L9) — `AdminController`
- [backend/src/modules/admin/admin.service.ts:8](../../backend/src/modules/admin/admin.service.ts#L8) — `getDashboardStats`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-56 — Generate Comprehensive Farming Performance Report

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Request farming performance report → Verify user, role and input → Load crop and pond → Check farm access → Load crop records and costs.

**Actor:** Farm User. **Trạng thái:** Existing workflow.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- The report covers the selected crop. Parent/child crop links provide context, not automatic aggregation of every child log into the parent report.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:913](../../backend/src/modules/crops/crops.service.ts#L913) — `getDetailedReport`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

### FE-57 — Export Analytical Reports and Historical Logs as PDF, Excel, or CSV

Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: Load report for export → Verify user, role and input → Load crop and pond → Check farm access → Load crop records and costs → Choose export format → Open report printing → Create selected report file.

**Actor:** Farm User. **Trạng thái:** Existing + proposed extension.

**Luồng chi tiết:** [REQUEST-CHECKS](REQUEST-CHECKS.puml).

**Thành phần và trách nhiệm:**

- **Farm User**: Initiates the selected workflow.
- **SSFM Interface**: Collects user input and displays the result; no platform distinction.
- **CropsController**: Handles the selected request; the endpoint boundary includes NestJS request checks.
- **CropsService**: Applies the feature rules and coordinates storage or supporting services.
- **FarmAccessService**: Performs the supporting action shown in its messages.
- **Report Exporter (proposed)**: Performs the supporting action shown in its messages.
- **PrismaService**: Translates the storage operation into PostgreSQL access.
- **PostgreSQL**: Stores and returns the requested application records.
- **Print Dialog**: Performs the supporting action shown in its messages.
- **NestJS request pipeline**: Thực hiện tương tác đã ghi trên lifeline.
- **ThrottlerGuard**: Performs the supporting action shown in its messages.
- **JwtAuthGuard**: Performs the supporting action shown in its messages.
- **JwtStrategy**: Performs the supporting action shown in its messages.
- **UsersService**: Performs the supporting action shown in its messages.
- **RolesGuard**: Performs the supporting action shown in its messages.
- **ValidationPipe**: Performs the supporting action shown in its messages.

**Giả định, phần thiếu hoặc khác hiện trạng:**

- PDF currently uses browser print / Save as PDF. Excel/CSV formatting is a proposed client export component; no server file-export API is invented. Saving PDF occurs within the print dialog.
- This is a request-boundary abstraction of NestJS guards and pipes; controller code does not call these classes directly. Only guards and DTO rules declared for the selected endpoint apply.

**Căn cứ mã nguồn:**

- [frontend-web/src/components/CropDetailReportModal.tsx:121](../../frontend-web/src/components/CropDetailReportModal.tsx#L121) — `handlePrint`
- [backend/src/modules/crops/crops.controller.ts:27](../../backend/src/modules/crops/crops.controller.ts#L27) — `CropsController`
- [backend/src/modules/crops/crops.service.ts:913](../../backend/src/modules/crops/crops.service.ts#L913) — `getDetailedReport`
- [backend/src/prisma/prisma.service.ts:11](../../backend/src/prisma/prisma.service.ts#L11) — `PrismaService`
- [backend/src/modules/farm-access/farm-access.service.ts:43](../../backend/src/modules/farm-access/farm-access.service.ts#L43) — `assertCanAccessFarm`
- [backend/src/modules/auth/guards/jwt-auth.guard.ts:5](../../backend/src/modules/auth/guards/jwt-auth.guard.ts#L5) — `JwtAuthGuard`
- [backend/src/modules/auth/strategies/jwt.strategy.ts:31](../../backend/src/modules/auth/strategies/jwt.strategy.ts#L31) — `validate`
- [backend/src/modules/users/users.service.ts:113](../../backend/src/modules/users/users.service.ts#L113) — `findById`
- [backend/src/modules/auth/guards/roles.guard.ts:9](../../backend/src/modules/auth/guards/roles.guard.ts#L9) — `canActivate`
- [backend/src/main.ts:2](../../backend/src/main.ts#L2) — `ValidationPipe`
- [backend/src/app.module.ts:28](../../backend/src/app.module.ts#L28) — `ThrottlerGuard`

## Dựng lại

<code>node docs/report4-sequences/tools/generate.cjs</code>

<code>java -jar &lt;plantuml.jar&gt; -charset UTF-8 -tsvg -o svg "docs/report4-sequences/*.puml"</code>

<code>node docs/report4-sequences/tools/validate.cjs --rendered</code>

manifest.json lưu quan hệ FE–mục báo cáo–sơ đồ–nguồn–ref và số thông điệp. VALIDATION.md ghi kết quả kiểm tra. Không chạy migration, sửa dependency hoặc thay đổi logic ứng dụng để vẽ sơ đồ.
