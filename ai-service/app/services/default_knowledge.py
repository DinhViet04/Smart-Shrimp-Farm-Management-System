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

WEATHER_KNOWLEDGE_DOCS = [
    {
        "title": "Ảnh Hưởng Của Thời Tiết Và Nhiệt Độ Đến Ao Nuôi Tôm",
        "category": "WEATHER",
        "content": """Cẩm nang kỹ thuật xử lý ảnh hưởng thời tiết và biến động nhiệt độ đến ao nuôi tôm thẻ chân trắng:

1. NHIỆT ĐỘ NƯỚC AO:
- Khoảng nhiệt độ tối ưu cho tôm thẻ chân trắng: 28 - 32°C.
- Khi nhiệt độ nước < 20°C: Tôm bỏ ăn, di chuyển chậm, hệ miễn dịch giảm, dễ nhiễm bệnh; cần giảm 50% lượng thức ăn, tránh kéo nhá hoặc thao tác mạnh vào ao.
- Khi nhiệt độ nước > 34°C (thường vào mùa hè 11h - 14h): Tôm bị stress nhiệt, DO giảm mạnh, tảo chết hàng loạt có thể gây sốc môi trường. Cần bật toàn bộ quạt nước, giảm hoặc bỏ cữ ăn trưa, che bạt lưới lan che nắng.
- Chênh lệch nhiệt độ sáng - chiều vượt quá 5°C: Là dấu hiệu nguy hiểm cần theo dõi liên tục.

2. MÙA MƯA VÀ MƯA LỚN ĐỘT NGỘT:
- Mưa làm giảm độ mặn, hạ pH đột ngột (do CO2 hòa tan tăng), hạ nhiệt độ nước, và pha loãng nồng độ khoáng chất trong ao.
- Xử lý khẩn cấp khi mưa lớn: Tăng cường chạy quạt nước ngay; Rải vôi nông nghiệp (CaCO3) hoặc Dolomite quanh bờ ao trước khi mưa để đệm pH (liều 15-20 kg/1.000 m3); Bón bổ sung khoáng tổng hợp sau mưa để bù lại lượng khoáng bị pha loãng; Kiểm tra pH và DO ngay sau mưa và 2 giờ sau đó.
- Lưu ý: Tôm sau 30 - 40 ngày tuổi đặc biệt nhạy cảm với mưa, dễ rớt đáy hàng loạt.

3. GIAO MÙA VÀ THỜI TIẾT BẤT THƯỜNG:
- Giao mùa từ mùa khô sang mùa mưa (tháng 4 - 6): Tảo nở hoa bùng phát rồi tàn lụi đột ngột, dẫn đến biến động oxy và pH cực lớn. Nên giảm mật độ thả giống, tăng cường theo dõi hàng ngày và dự phòng chế phẩm vi sinh.
- Gió mạnh và bão: Gió làm tăng cường bốc hơi nước, tăng độ mặn cục bộ; sóng đánh bờ đục vẩn đáy ao. Cần che chắn lưới gió bảo vệ ao, giảm thức ăn và tăng cường aeration.
- Nắng hạn kéo dài: Nhiệt độ nước tăng cao, pH ban chiều tăng vọt > 8.8 do tảo quang hợp mạnh, độ mặn tăng do bốc hơi. Xử lý: tạt mật đường + vi sinh chiều tối, cắt giảm thức ăn 30%."""
    },
    {
        "title": "Phòng Bị Trước Thời Tiết Xấu Và Xử Lý Sau Mưa Bão",
        "category": "WEATHER",
        "content": """Quy trình phòng bị và xử lý ao nuôi tôm khi có mưa bão và thời tiết cực đoan:

1. CHUẨN BỊ TRƯỚC KHI MƯA/BÃO:
- Theo dõi dự báo thời tiết 24-48 giờ trước; nếu cảnh báo mưa lớn hoặc bão cấp 6 trở lên, tiến hành ngay:
  + Tạt vôi CaCO3 hoặc Dolomite quanh bờ và xuống ao (15-20 kg/1.000 m3) để đệm pH.
  + Kiểm tra và gia cố bờ ao, cống thoát nước tràn, lưới che đầu gió.
  + Đảm bảo hệ thống máy phát điện dự phòng sẵn sàng (mất điện lúc mưa bão là nguyên nhân hàng đầu gây chết tôm hàng loạt do thiếu oxy).
  + Giảm 30-50% lượng thức ăn cữ chiều tối trước ngày bão.

2. XỬ LÝ TRONG VÀ NGAY SAU MƯA:
- Bật toàn bộ quạt nước, sục khí đáy liên tục 24/24.
- Không cho ăn trong và 2-4 giờ sau mưa lớn.
- Xả bỏ nước tầng mặt: Nếu mưa quá lớn, nước ngọt tích tụ tầng mặt làm tôm ngộ độc thẩm thấu; mở cống xả nước mặt 15-20 cm để thải nước nhạt ra ngoài.
- Đo pH và DO ngay sau mưa, rồi kiểm tra lại mỗi 2 giờ trong 8 giờ tiếp theo.

3. PHÁC ĐỒ PHỤC HỒI SAU MƯA BÃO (ngày 1-3):
- Ngày 1 sau mưa: Tạt khoáng tổng hợp Ca-Mg-K (5-10 kg/1.000 m3) lúc 20h tối để bù khoáng; Bổ sung vi sinh đường ruột và gan vào thức ăn để phục hồi sức ăn; Cho ăn 50-60% lượng thức ăn bình thường.
- Ngày 2: Nếu tảo ổn định, pH trong ngưỡng 7.5-8.3, DO > 5 mg/L thì tăng dần thức ăn lên 80%.
- Ngày 3: Kiểm tra màu nước; nếu nước trong quá (tảo chết sau mưa) cần gây màu nước lại bằng cám gạo + phân vi sinh ủ.

4. XỬ LÝ KHI NHIỆT ĐỘ CAO BẤT THƯỜNG (nắng hạn):
- Từ 10h00 - 14h00: Không kéo nhá, không thao tác ao, không bắt tôm kiểm tra.
- Tăng mực nước ao lên mức cao nhất có thể (1.3 - 1.5 m) để giảm biên độ nhiệt.
- Lắp thêm hệ thống phun sương mặt ao hoặc lưới che bạt 30-50% để giảm bức xạ nhiệt trực tiếp.
- Theo dõi và đo oxy đáy ao lúc 3h-5h sáng (thời điểm DO xuống thấp nhất trong ngày)."""
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


def seed_weather_knowledge():
    """Nạp bổ sung 2 tài liệu cẩm nang về thời tiết vào Vector Store nếu chưa có."""
    existing_docs = vector_store.get_all_documents()
    existing_titles = {d.get("title", "") for d in existing_docs}

    seeded = 0
    for doc in WEATHER_KNOWLEDGE_DOCS:
        if doc["title"] not in existing_titles:
            vector_store.add_document(
                title=doc["title"],
                content=doc["content"],
                category=doc["category"],
                file_type="seed",
                uploaded_by="SYSTEM_SEED"
            )
            logger.info(f"Seeded weather knowledge: {doc['title']}")
            seeded += 1

    if seeded > 0:
        logger.info(f"Successfully seeded {seeded} weather knowledge documents.")
    else:
        logger.info("Weather knowledge documents already exist. Skipping seed.")
