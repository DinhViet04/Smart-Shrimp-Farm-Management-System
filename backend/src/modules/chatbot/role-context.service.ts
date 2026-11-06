import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service';
import { CropStatus } from '@prisma/client';

export interface UserScopedDataContext {
  hasAccess: boolean;
  role: string;
  userFullName?: string;
  summaryText: string;
  allowedFarmNames: string[];
  totalFarms: number;
  totalPonds: number;
  activeCropsCount: number;
  harvestedCropsCount: number;
}

@Injectable()
export class RoleContextService {
  private readonly logger = new Logger(RoleContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  /**
   * Truy vấn toàn bộ dữ liệu lịch sử và hiện tại của hệ thống được cô lập đúng theo Role & Quyền hạn người dùng.
   * - ADMIN: Toàn hệ thống.
   * - FARM_MANAGER: Chỉ các trang trại do chính Manager sở hữu (ownerId = user.userId).
   * - TECHNICIAN & FARMER: Chỉ các trang trại / ao nuôi mà user được kích hoạt phân công (farm_staffs.isActive = true).
   */
  async buildUserScopedContext(currentUser: AuthUser, question?: string): Promise<UserScopedDataContext> {
    const role = currentUser.role;
    const uid = currentUser.userId || (currentUser as any).id;

    // 1. Xác định phạm vi các Farm IDs được phép truy cập
    let allowedFarmIds: string[] | undefined = undefined;
    if (role !== 'ADMIN') {
      const ids = await this.farmAccess.getAccessibleFarmIds(currentUser);
      allowedFarmIds = ids || [];
    }

    // Nếu không phải ADMIN và không có trang trại nào thuộc quyền sở hữu/phân công
    if (allowedFarmIds !== undefined && allowedFarmIds.length === 0) {
      return {
        hasAccess: false,
        role,
        summaryText: `[THÔNG TIN PHÂN QUYỀN]: Người dùng này (${role}) hiện chưa sở hữu hoặc chưa được phân công vào bất kỳ trang trại nào trong hệ thống. Nếu người dùng hỏi về dữ liệu ao, trang trại, vụ nuôi hay kho của họ, AI hãy lịch sự giải thích rằng tài khoản này chưa có trang trại nào được giao và hướng dẫn liên hệ quản trị viên hoặc tạo trang trại mới.`,
        allowedFarmNames: [],
        totalFarms: 0,
        totalPonds: 0,
        activeCropsCount: 0,
        harvestedCropsCount: 0,
      };
    }

    const farmWhereCondition: any = { deletedAt: null };
    if (allowedFarmIds !== undefined) {
      farmWhereCondition.id = { in: allowedFarmIds };
    }

    const pondWhereCondition: any = {};
    if (allowedFarmIds !== undefined) {
      pondWhereCondition.farmId = { in: allowedFarmIds };
    }

    // 2. Truy vấn song song đa chiều dữ liệu Quá khứ & Hiện tại trong phạm vi được cô lập
    try {
      const [
        userRecord,
        farms,
        ponds,
        activeCrops,
        harvestedCrops,
        recentWaterRecords,
        recentShrimpHealth,
        recentSizeSamples,
        recentFeedingLogs,
        inventoryItems,
        incidents,
      ] = await Promise.all([
        // Thông tin người dùng
        this.prisma.user.findUnique({
          where: { id: uid },
          select: { fullName: true, email: true, phone: true },
        }),

        // 1. Danh sách Trang trại của User
        this.prisma.farm.findMany({
          where: farmWhereCondition,
          select: {
            id: true,
            name: true,
            address: true,
            area: true,
            farmingModel: true,
            status: true,
            owner: { select: { fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),

        // 2. Danh sách Ao nuôi thuộc các trang trại được phép
        this.prisma.pond.findMany({
          where: pondWhereCondition,
          select: {
            id: true,
            name: true,
            farmId: true,
            farm: { select: { name: true } },
            areaSize: true,
            depth: true,
            crops: {
              where: { status: CropStatus.ACTIVE },
              select: { id: true, startDate: true, initialShrimpCount: true, stage: true },
            },
          },
          orderBy: { name: 'asc' },
          take: 50,
        }),

        // 3. Vụ nuôi HIỆN TẠI (Đang nuôi - ACTIVE)
        this.prisma.crop.findMany({
          where: {
            status: CropStatus.ACTIVE,
            pond: pondWhereCondition,
          },
          select: {
            id: true,
            startDate: true,
            initialShrimpCount: true,
            stage: true,
            targetHarvestSize: true,
            targetSurvivalRate: true,
            pond: { select: { name: true, areaSize: true, farm: { select: { name: true } } } },
          },
          orderBy: { startDate: 'desc' },
          take: 20,
        }),

        // 4. Lịch sử các Vụ nuôi QUÁ KHỨ (Đã thu hoạch - HARVESTED)
        this.prisma.crop.findMany({
          where: {
            status: CropStatus.HARVESTED,
            pond: pondWhereCondition,
          },
          select: {
            id: true,
            startDate: true,
            initialShrimpCount: true,
            actualHarvestKg: true,
            actualHarvestCount: true,
            targetSurvivalRate: true,
            stage: true,
            pond: { select: { name: true, farm: { select: { name: true } } } },
          },
          orderBy: { startDate: 'desc' },
          take: 10,
        }),

        // 5. Chất lượng nước (Chỉ số mới nhất + Lịch sử biến động gần đây)
        this.prisma.waterQualityRecord.findMany({
          where: {
            pond: pondWhereCondition,
          },
          select: {
            id: true,
            recordTime: true,
            ph: true,
            dissolvedOxygen: true,
            salinity: true,
            temperature: true,
            nh3: true,
            no2: true,
            alkalinity: true,
            pond: { select: { name: true, farm: { select: { name: true } } } },
          },
          orderBy: { recordTime: 'desc' },
          take: 20,
        }),

        // 6. Sức khỏe tôm (Triệu chứng, trạng thái sức khỏe)
        this.prisma.shrimpHealthRecord.findMany({
          where: {
            pond: pondWhereCondition,
          },
          select: {
            id: true,
            recordTime: true,
            healthStatus: true,
            severity: true,
            affectedPercentage: true,
            note: true,
            pond: { select: { name: true, farm: { select: { name: true } } } },
          },
          orderBy: { recordTime: 'desc' },
          take: 15,
        }),

        // 7. Mẫu kích cỡ tôm (Đo đạc tăng trưởng DOC, trọng lượng gram)
        this.prisma.shrimpSizeSample.findMany({
          where: {
            pond: pondWhereCondition,
          },
          select: {
            id: true,
            samplingDate: true,
            doc: true,
            abwGram: true,
            sizePerKg: true,
            adgGramPerDay: true,
            pond: { select: { name: true, farm: { select: { name: true } } } },
          },
          orderBy: { samplingDate: 'desc' },
          take: 15,
        }),

        // 8. Nhật ký cho ăn & Dinh dưỡng
        this.prisma.feedingLog.findMany({
          where: {
            pond: pondWhereCondition,
          },
          select: {
            id: true,
            feedingDate: true,
            feedingSession: true,
            feedingTime: true,
            feedAmount: true,
            feedingStatus: true,
            note: true,
            feedProduct: { select: { itemName: true } },
            pond: { select: { name: true, farm: { select: { name: true } } } },
          },
          orderBy: { feedingDate: 'desc' },
          take: 15,
        }),

        // 9. Kho vật tư & Thuốc/Hóa chất tại trang trại của user
        this.prisma.inventory.findMany({
          where: {
            farmId: allowedFarmIds !== undefined ? { in: allowedFarmIds } : undefined,
            deletedAt: null,
          },
          select: {
            id: true,
            itemName: true,
            category: true,
            quantity: true,
            unit: true,
            minThreshold: true,
            farm: { select: { name: true } },
          },
          orderBy: { quantity: 'asc' },
          take: 30,
        }),

        // 10. Sự cố ao nuôi (Hiện đang mở & Lịch sử)
        this.prisma.incident.findMany({
          where: {
            crop: { pond: pondWhereCondition },
          },
          select: {
            id: true,
            title: true,
            description: true,
            treatment: true,
            status: true,
            createdAt: true,
            crop: { select: { pond: { select: { name: true, farm: { select: { name: true } } } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
      ]);

      // 3. Tổng hợp thành văn bản ngữ cảnh súc tích, chuyên sâu cho OpenAI
      const userFullName = userRecord?.fullName || 'Người dùng';
      const farmNames = farms.map((f) => f.name);

      let contextStr = `\n====================================================================\n`;
      contextStr += `[PHÂN QUYỀN DỮ LIỆU CÁ NHÂN HÓA - ROLE: ${role} | NGƯỜI DÙNG: ${userFullName}]\n`;
      contextStr += `(Dưới đây là TOÀN BỘ dữ liệu thực tế trong quá khứ và hiện tại mà tài khoản này ĐƯỢC PHÉP TRUY CẬP HỢP PHÁP. Tuyệt đối không có dữ liệu của người khác):\n\n`;

      // 1. Tổng quan trang trại
      contextStr += `1. TRANG TRẠI THUỘC QUYỀN SỞ HỮU / QUẢN LÝ (${farms.length} trang trại):\n`;
      farms.forEach((f) => {
        const ha = f.area ? (Number(f.area) / 10000).toFixed(1) : 'Chưa rõ';
        contextStr += `   - [${f.name}]: Địa chỉ: ${f.address || 'Chưa cập nhật'}, Quy mô: ${Number(f.area || 0).toLocaleString('vi-VN')} m² (${ha} ha), Mô hình: ${f.farmingModel || 'Công nghệ cao'}, Trạng thái: ${f.status}\n`;
      });

      // 2. Danh sách ao nuôi
      contextStr += `\n2. AO NUÔI THUỘC PHẠM VI (${ponds.length} ao):\n`;
      ponds.forEach((p) => {
        const activeCrop = p.crops[0];
        const statusText = activeCrop
          ? `Đang nuôi (Thả ${activeCrop.initialShrimpCount?.toLocaleString('vi-VN')} con ngày ${new Date(activeCrop.startDate).toLocaleDateString('vi-VN')})`
          : 'Đang trống (Sẵn sàng thả vụ mới)';
        contextStr += `   - [${p.name}] thuộc ${p.farm?.name}: Diện tích ${p.areaSize} m², Sâu ${p.depth} m. Trạng thái: ${statusText}\n`;
      });

      // 3. Vụ nuôi hiện tại
      contextStr += `\n3. VỤ NUÔI ĐANG HOẠT ĐỘNG HIỆN TẠI (${activeCrops.length} vụ):\n`;
      if (activeCrops.length === 0) {
        contextStr += `   (Hiện tại không có vụ nuôi nào đang chạy)\n`;
      } else {
        const now = new Date().getTime();
        activeCrops.forEach((c) => {
          const start = new Date(c.startDate).getTime();
          const doc = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
          const density = c.pond?.areaSize && c.initialShrimpCount ? Math.round(Number(c.initialShrimpCount) / Number(c.pond.areaSize)) : 'N/A';
          contextStr += `   - Ao [${c.pond?.name}] (${c.pond?.farm?.name}): Ngày thả ${new Date(c.startDate).toLocaleDateString('vi-VN')} (DOC: ${doc} ngày). Số lượng giống: ${Number(c.initialShrimpCount).toLocaleString('vi-VN')} con, Mật độ: ${density} con/m², Giai đoạn: ${c.stage || 'Thương phẩm'}\n`;
        });
      }

      // 4. Lịch sử vụ nuôi cũ (Quá khứ)
      contextStr += `\n4. LỊCH SỬ CÁC VỤ NUÔI ĐÃ THU HOẠCH TRƯỚC ĐÂY (${harvestedCrops.length} vụ cũ):\n`;
      if (harvestedCrops.length === 0) {
        contextStr += `   (Chưa có bản ghi vụ nuôi cũ đã thu hoạch)\n`;
      } else {
        harvestedCrops.forEach((hc) => {
          contextStr += `   - Ao [${hc.pond?.name}]: Thả ngày ${new Date(hc.startDate).toLocaleDateString('vi-VN')}, Giống ban đầu: ${hc.initialShrimpCount?.toLocaleString('vi-VN')} con. Sản lượng thu hoạch: ${hc.actualHarvestKg ? hc.actualHarvestKg.toLocaleString('vi-VN') + ' kg' : 'Chưa ghi nhận'}\n`;
        });
      }

      // 5. Chất lượng nước (Gần nhất & Biến động)
      contextStr += `\n5. DỮ LIỆU ĐO MÔI TRƯỜNG NƯỚC (Gần nhất & Biến động lịch sử):\n`;
      if (recentWaterRecords.length === 0) {
        contextStr += `   (Chưa có bản ghi đo chất lượng nước)\n`;
      } else {
        recentWaterRecords.slice(0, 8).forEach((w) => {
          const time = new Date(w.recordTime).toLocaleString('vi-VN');
          contextStr += `   - [${w.pond?.name} - ${time}]: pH=${w.ph ?? '-'}, Oxy=${w.dissolvedOxygen ?? '-'} mg/L, Mặn=${w.salinity ?? '-'}‰, Nhiệt độ=${w.temperature ?? '-'}°C, NH3=${w.nh3 ?? '-'} mg/L, NO2=${w.no2 ?? '-'} mg/L, Kiềm=${w.alkalinity ?? '-'} mg/L\n`;
        });
      }

      // 6. Sức khỏe tôm & Mẫu kích cỡ 5T
      contextStr += `\n6. THEO DÕI SỨC KHỎE TÔM & TĂNG TRƯỞNG SIZE (DOC, Gram):\n`;
      if (recentSizeSamples.length > 0) {
        contextStr += `   * Mẫu kích cỡ tôm gần nhất:\n`;
        recentSizeSamples.slice(0, 5).forEach((s) => {
          contextStr += `     + Ao [${s.pond?.name}]: DOC ${s.doc || '-'} ngày (${new Date(s.samplingDate).toLocaleDateString('vi-VN')}) -> Trọng lượng trung bình: ${s.abwGram} g/con (~${s.sizePerKg || '-'} con/kg), Tốc độ tăng trưởng ADG: ${s.adgGramPerDay || '-'} g/ngày\n`;
        });
      }
      if (recentShrimpHealth.length > 0) {
        contextStr += `   * Ghi nhận tình trạng sức khỏe:\n`;
        recentShrimpHealth.slice(0, 4).forEach((h) => {
          contextStr += `     + Ao [${h.pond?.name} - ${new Date(h.recordTime).toLocaleDateString('vi-VN')}]: Trạng thái: ${h.healthStatus}, Mức độ: ${h.severity}, Tỷ lệ nhiễm: ${h.affectedPercentage}%. Ghi chú: ${h.note || 'Bình thường'}\n`;
        });
      }

      // 7. Nhật ký cho ăn gần đây
      contextStr += `\n7. NHẬT KÝ CHO ĂN GẦN ĐÂY:\n`;
      if (recentFeedingLogs.length === 0) {
        contextStr += `   (Chưa có nhật ký cho ăn)\n`;
      } else {
        recentFeedingLogs.slice(0, 5).forEach((fl) => {
          const dateStr = new Date(fl.feedingDate).toLocaleDateString('vi-VN');
          contextStr += `   - Ao [${fl.pond?.name} - ${dateStr} ${fl.feedingTime} (${fl.feedingSession})]: Cho ăn ${fl.feedAmount} kg (${fl.feedProduct?.itemName || 'Thức ăn'}), Trạng thái ăn: ${fl.feedingStatus}\n`;
        });
      }

      // 8. Tồn kho thuốc & hóa chất khả dụng
      contextStr += `\n8. TỒN KHO THUỐC, MEN VI SINH & HÓA CHẤT TRANG TRẠI:\n`;
      if (inventoryItems.length === 0) {
        contextStr += `   (Kho trang trại hiện chưa có vật tư)\n`;
      } else {
        inventoryItems.slice(0, 10).forEach((inv) => {
          contextStr += `   - [${inv.itemName}]: Tồn ${inv.quantity} ${inv.unit} (${inv.category || 'Vật tư'}) tại ${inv.farm?.name}\n`;
        });
      }

      // 9. Báo cáo sự cố ao nuôi
      contextStr += `\n9. SỰ CỐ AO NUÔI (Hiện tại & Lịch sử):\n`;
      if (incidents.length === 0) {
        contextStr += `   (Không có sự cố nào được ghi nhận)\n`;
      } else {
        incidents.slice(0, 6).forEach((inc) => {
          const time = new Date(inc.createdAt).toLocaleDateString('vi-VN');
          const pondName = inc.crop?.pond?.name || 'Ao nuôi';
          contextStr += `   - [${inc.title}]: Ao ${pondName} (${time}) - Trạng thái: ${inc.status}, Phương án xử lý: ${inc.treatment || 'Chưa ghi nhận'}\n`;
        });
      }

      contextStr += `====================================================================\n`;

      return {
        hasAccess: true,
        role,
        userFullName,
        summaryText: contextStr,
        allowedFarmNames: farmNames,
        totalFarms: farms.length,
        totalPonds: ponds.length,
        activeCropsCount: activeCrops.length,
        harvestedCropsCount: harvestedCrops.length,
      };
    } catch (err: any) {
      this.logger.error(`Error building scoped data context: ${err?.message || err}`, err.stack);
      return {
        hasAccess: false,
        role,
        summaryText: `[LỖI TRUY VẤN DỮ LIỆU PHÂN QUYỀN]: Không thể tải dữ liệu phân quyền do lỗi nội bộ. AI hãy phản hồi dựa trên kiến thức cẩm nang chung.`,
        allowedFarmNames: [],
        totalFarms: 0,
        totalPonds: 0,
        activeCropsCount: 0,
        harvestedCropsCount: 0,
      };
    }
  }
}
