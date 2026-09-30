from app.core.logging import logger
from app.services.vector_store import vector_store

DEFAULT_KNOWLEDGE_DOCS = [
    {
        "title": "Quy Chuẩn Chất Lượng Nước Nuôi Tôm Thẻ Chân Trắng",
        "category": "WATER_QUALITY",
        "content": """Quy chuẩn kỹ thuật quốc gia về môi trường nước ao nuôi tôm thẻ chân trắng (Litopenaeus vannamei):
1. Độ pH: Dao động tối ưu từ 7.5 đến 8.3. Chênh lệch pH giữa sáng (6h) và chiều (14h) không được vượt quá 0.5 đơn vị. Nếu pH dưới 7.5, tôm khó lột xác, mềm vỏ; cần tạt vôi nông nghiệp CaCO3 hoặc vôi tôi Ca(OH)2 liều lượng 10-15 kg/1.000 m3. Nếu pH trên 8.5, khí độc NH3 trở nên cực kỳ độc; cần tạt mật đường hoặc mật rỉ kết hợp vi sinh để kìm hãm sự phát triển của tảo.
2. Hàm lượng Oxy hòa tan (DO): Phải duy trì tối thiểu >= 5.0 mg/L ở mọi tầng nước, đặc biệt là tầng đáy ao. Khi oxy hòa tan xuống dưới 4.0 mg/L, tôm giảm ăn rõ rệt; dưới 3.0 mg/L, tôm nổi đầu tấp mé và nguy cơ chết hàng loạt. Cần bố trí hệ thống quạt nước và sục khí đáy hoạt động liên tục từ 22h đêm đến 6h sáng.
3. Độ kiềm (Alkalinity): Mức an toàn là 120 - 160 mg/L tính theo CaCO3. Độ kiềm giữ ổn định pH. Khi độ kiềm thấp (< 100 mg/L), sử dụng Sodium Bicarbonate (NaHCO3 - soda lạnh) vào ban đêm liều 15-20 kg/1.000 m3.
4. Khí độc: Hàm lượng NH3/NH4+ tự do phải < 0.1 mg/L, Nitrit (NO2-) < 0.2 mg/L, Hydro sulfide (H2S) < 0.03 mg/L. Khi phát hiện khí độc vượt ngưỡng, lập tức giảm 30-50% lượng thức ăn, tăng cường quạt sục khí và tạt vi sinh Yucca hấp thụ khí độc."""
    },
    {
        "title": "Quản Lý Thức Ăn Và Kéo Giảm Hệ Số Chuyển Đổi FCR",
        "category": "FEEDING",
        "content": """Hướng dẫn kỹ thuật quản lý thức ăn và tối ưu hóa hệ số FCR trong nuôi tôm công nghệ cao:
1. Công thức tính FCR: Hệ số FCR = Tổng khối lượng thức ăn đã cho tôm ăn (kg) chia cho Tổng sản lượng tôm thu hoạch (kg). Chỉ số FCR lý tưởng cho tôm thẻ là từ 1.05 đến 1.25.
2. Quy tắc canh nhá (vó ăn):
- Sau khi thả tôm 20 ngày tuổi, bắt đầu đặt nhá để theo dõi sức ăn.
- Mỗi nhá đặt khoảng 0.8 - 1% lượng thức ăn của cữ ăn đó.
- Kiểm tra nhá sau 1.5 - 2 giờ: Nếu nhá hết sạch thức ăn và đường ruột tôm đầy đặn, tăng 5% lượng thức ăn ở cữ tiếp theo. Nếu nhá còn thừa thức ăn từ 5-10%, giữ nguyên cữ sau. Nếu còn thừa > 10%, giảm ngay 20-30% thức ăn hoặc cắt cữ tiếp theo để tránh làm ô nhiễm đáy ao.
3. Chia cữ ăn khoa học: Nên chia làm 4 - 5 cữ ăn mỗi ngày (6h00, 10h00, 14h00, 18h00, 21h00). Cữ ăn sáng và chiều tối nên cho lượng thức ăn nhiều hơn cữ trưa khi nhiệt độ nước quá cao.
4. Bổ sung dưỡng chất: Trộn men vi sinh đường ruột (Bacillus subtilis, Lactobacillus), Beta-glucan tăng miễn dịch và Acid hữu cơ để bảo vệ gan tụy và cải thiện khả năng tiêu hóa, giúp tôm hấp thụ triệt để thức ăn."""
    },
    {
        "title": "Phòng Ngừa Và Điều Trị Bệnh Đục Cơ Và Phân Trắng",
        "category": "SHRIMP_DISEASE",
        "content": """Phác đồ phòng trị các bệnh phổ biến trên tôm nuôi nước lợ:
1. Bệnh Đục Cơ và Cong Thân (Muscle Necrosis):
- Nguyên nhân: Do tôm bị sốc nhiệt khi kiểm tra nhá vào lúc trời nắng gắt, hoặc do thiếu hụt các khoáng chất vi lượng thiết yếu như Canxi, Magie, Kali (tỷ lệ Ca:Mg:K mất cân bằng).
- Biểu hiện: Cơ thịt phần đuôi hoặc toàn thân tôm bị mờ đục như nước gạo, cơ co quắp không duỗi thẳng được, tôm lột xác dính vỏ và rớt đáy.
- Phác đồ điều trị: Tuyệt đối không kéo nhá hoặc tác động mạnh vào ao lúc trời nắng gắt từ 11h - 14h. Tạt khoáng tạt chuyên dụng vào ban đêm (liều lượng 5 - 10 kg/1.000 m3) kết hợp bổ sung Kali (KCl) và Magie (MgCl2) liên tục trong 3 ngày.
2. Bệnh Phân Trắng (White Feces Disease):
- Nguyên nhân: Do nhiễm khuẩn Vibrio parahaemolyticus hoặc vi bào tử trùng Enterocytozoon hepatopenaei (EHP) kết hợp với thức ăn bị ẩm mốc độc tố mycotoxin.
- Biểu hiện: Xuất hiện các sợi phân màu trắng nổi trên mặt nước theo hướng gió, tôm bị ốp thân, ruột đứt khúc hoặc rỗng ruột, gan tụy teo nhợt nhạt.
- Phác đồ điều trị: Ngừng cho ăn hoàn toàn 1 ngày. Xi-phông sạch đáy ao và diệt khuẩn nước nguồn bằng Iodine hoặc BKC lúc 18h tối. Sau đó cho ăn lại với 50% khẩu phần, trộn tinh dầu tỏi lên men, thảo dược bảo vệ gan và men tiêu hóa sống liều cao liên tục 5 - 7 ngày."""
    }
]

def seed_default_knowledge():
    """Tự động kiểm tra và nạp sẵn 3 tài liệu cẩm nang nếu Vector Store đang trống."""
    docs = vector_store.get_all_documents()
    if not docs:
        logger.info("Vector Store is empty. Seeding initial smart shrimp farming knowledge base...")
        for doc in DEFAULT_KNOWLEDGE_DOCS:
            vector_store.add_document(
                title=doc["title"],
                content=doc["content"],
                category=doc["category"],
                file_type="seed",
                uploaded_by="SYSTEM_SEED"
            )
        logger.info("Successfully seeded 3 default knowledge documents with vector chunks.")
