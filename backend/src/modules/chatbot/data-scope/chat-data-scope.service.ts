import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuthUser,
  FarmAccessService,
} from '../../farm-access/farm-access.service';

/**
 * Các nhóm dữ liệu nghiệp vụ mà AI có thể tra cứu.
 */
export type ChatDomain =
  | 'CROP_RESULTS' // Kết quả thu hoạch, chi phí, lợi nhuận, FCR, bài học
  | 'FEEDING'
  | 'WATER'
  | 'HEALTH'
  | 'GROWTH'
  | 'INCIDENT'
  | 'MORTALITY'
  | 'INVENTORY'
  | 'FARM_INFO' // Trang trại, ao, nhân sự trang trại, nhà cung cấp
  | 'STAFF_FILTER'; // Lọc dữ liệu theo tên nhân viên

/**
 * MA TRẬN PHÂN QUYỀN TRA CỨU LỊCH SỬ CHO AI
 * - ADMIN / FARM_MANAGER: toàn bộ dữ liệu trong phạm vi trang trại (của mình và của nhân viên).
 * - MÔI TRƯỜNG NƯỚC (WATER): mọi role xem toàn bộ dữ liệu nước (số đo, xu hướng, đánh giá,
 *   lịch sử xử lý nước, hóa chất xử lý sẵn có) của các trang trại mình được phân công —
 *   khớp quyền của API /water-quality/history (FARMER, TECHNICIAN, FARM_MANAGER, ADMIN).
 * - TECHNICIAN: đọc TOÀN BỘ dữ liệu của các trang trại mình được phân công — khớp những gì
 *   Kỹ thuật viên xem được trên app (API GET cho phép TECHNICIAN ở cấp trang trại):
 *   trang trại/ao/vụ nuôi & báo cáo chi tiết vụ (gồm kết quả, nhật ký cho ăn), nước, sức khỏe,
 *   tăng trưởng, sự cố, tôm hao, kho & lịch sử kho, nhà cung cấp, nhân sự trang trại.
 *   Chỉ ĐỌC — AI không ghi/sửa gì ngoài luồng nhập số đo nước có xác nhận.
 * - FARMER: giống TECHNICIAN — hỏi / xem được toàn bộ dữ liệu của các trang trại được phân công.
 *
 * QUYỀN GHI qua trợ lý (không thuộc file này, xem AgentActionService.getActionToolDefinitions):
 * chỉ FARM_MANAGER được tạo trang trại/ao/vụ và nhập/xuất kho; TECHNICIAN chỉ nhập số đo nước;
 * FARMER và ADMIN không ghi gì.
 */
const ROLE_DOMAINS: Record<string, ChatDomain[]> = {
  ADMIN: [
    'CROP_RESULTS',
    'FEEDING',
    'WATER',
    'HEALTH',
    'GROWTH',
    'INCIDENT',
    'MORTALITY',
    'INVENTORY',
    'FARM_INFO',
    'STAFF_FILTER',
  ],
  FARM_MANAGER: [
    'CROP_RESULTS',
    'FEEDING',
    'WATER',
    'HEALTH',
    'GROWTH',
    'INCIDENT',
    'MORTALITY',
    'INVENTORY',
    'FARM_INFO',
    'STAFF_FILTER',
  ],
  TECHNICIAN: [
    'CROP_RESULTS',
    'FEEDING',
    'WATER',
    'HEALTH',
    'GROWTH',
    'INCIDENT',
    'MORTALITY',
    'INVENTORY',
    'FARM_INFO',
    'STAFF_FILTER',
  ],
  // Nông dân: xem / hỏi được mọi thứ như Kỹ thuật viên (chỉ khác ở quyền ghi)
  FARMER: [
    'CROP_RESULTS',
    'FEEDING',
    'WATER',
    'HEALTH',
    'GROWTH',
    'INCIDENT',
    'MORTALITY',
    'INVENTORY',
    'FARM_INFO',
    'STAFF_FILTER',
  ],
};

export interface ChatScope {
  userId: string;
  role: string;
  /** undefined = ADMIN (toàn hệ thống); [] = không có trang trại nào */
  farmIds: string[] | undefined;
}

@Injectable()
export class ChatDataScopeService {
  constructor(private readonly farmAccess: FarmAccessService) {}

  async resolveScope(user: AuthUser): Promise<ChatScope> {
    const userId = user.userId || (user as any).id;
    const farmIds = await this.farmAccess.getAccessibleFarmIds(user);
    return {
      userId,
      role: user.role,
      farmIds: farmIds ?? (user.role === 'ADMIN' ? undefined : []),
    };
  }

  allowedDomains(scope: ChatScope): ChatDomain[] {
    return ROLE_DOMAINS[scope.role] ?? [];
  }

  canAccess(scope: ChatScope, domain: ChatDomain): boolean {
    return this.allowedDomains(scope).includes(domain);
  }

  /**
   * Xem dữ liệu ở cấp trang trại (không chỉ bản ghi của mình).
   * Hiện tại MỌI role (Admin, Quản lý, Kỹ thuật viên, Nông dân) đều đọc toàn bộ dữ liệu của các
   * trang trại được phân công. Các nhánh lọc theo người tạo (createdBy / recordedBy / reporterId)
   * bên dưới chỉ áp dụng nếu sau này thêm role không nằm trong danh sách này.
   */
  isFarmLevelReader(scope: ChatScope) {
    return (
      scope.role === 'ADMIN' ||
      scope.role === 'FARM_MANAGER' ||
      scope.role === 'TECHNICIAN' ||
      scope.role === 'FARMER'
    );
  }

  /** Ao nuôi trong phạm vi trang trại của người dùng */
  pondWhere(scope: ChatScope): Prisma.PondWhereInput {
    return { farmId: this.farmFilter(scope), farm: { deletedAt: null } };
  }

  /** Nhân sự trang trại */
  staffWhere(scope: ChatScope): Prisma.FarmStaffWhereInput | null {
    if (!this.canAccess(scope, 'FARM_INFO')) return null;
    return { farmId: this.farmFilter(scope), farm: { deletedAt: null } };
  }

  /** Nhà cung cấp vật tư */
  supplierWhere(scope: ChatScope): Prisma.SupplierWhereInput | null {
    if (!this.canAccess(scope, 'FARM_INFO')) return null;
    return { farmId: this.farmFilter(scope), deletedAt: null, farm: { deletedAt: null } };
  }

  private farmFilter(scope: ChatScope) {
    return scope.farmIds === undefined ? {} : { in: scope.farmIds };
  }

  farmWhere(scope: ChatScope): Prisma.FarmWhereInput {
    return scope.farmIds === undefined
      ? { deletedAt: null }
      : { deletedAt: null, id: { in: scope.farmIds } };
  }

  /** Vụ nuôi (thông tin cơ bản) — mọi role được thấy các vụ thuộc trang trại mình được phép */
  cropWhere(scope: ChatScope): Prisma.CropWhereInput {
    return {
      pond: { farmId: this.farmFilter(scope), farm: { deletedAt: null } },
    };
  }

  feedingWhere(scope: ChatScope): Prisma.FeedingLogWhereInput | null {
    if (!this.canAccess(scope, 'FEEDING')) return null;
    const where: Prisma.FeedingLogWhereInput = {
      farmId: this.farmFilter(scope),
    };
    if (!this.isFarmLevelReader(scope)) where.createdBy = scope.userId;
    return where;
  }

  /** Dữ liệu nước theo phạm vi trang trại (không lọc người đo) - khớp API lịch sử nước */
  waterWhere(scope: ChatScope): Prisma.WaterQualityRecordWhereInput | null {
    if (!this.canAccess(scope, 'WATER')) return null;
    return { pond: { farmId: this.farmFilter(scope), farm: { deletedAt: null } } };
  }

  /** Ao nuôi trong phạm vi được xem dữ liệu nước */
  waterPondWhere(scope: ChatScope): Prisma.PondWhereInput | null {
    if (!this.canAccess(scope, 'WATER')) return null;
    return { farmId: this.farmFilter(scope), farm: { deletedAt: null } };
  }

  /**
   * Lịch sử xử lý nước = xuất kho hóa chất/thuốc có gắn ao hoặc ghi chú "Xử lý môi trường".
   * Thuộc nhóm WATER (không cần quyền xem toàn bộ kho).
   */
  waterTreatmentWhere(scope: ChatScope): Prisma.InventoryUsageLogWhereInput | null {
    if (!this.canAccess(scope, 'WATER')) return null;
    return {
      inventory: {
        farmId: this.farmFilter(scope),
        deletedAt: null,
        category: { in: ['CHEMICAL', 'MEDICINE'] },
      },
      // Bỏ phiếu nhập kho, chỉ giữ lượt xuất dùng (notes null vẫn là xuất dùng)
      OR: [{ notes: null }, { NOT: { notes: { startsWith: '[NHẬP KHO' } } }],
    };
  }

  /** Hóa chất / thuốc xử lý nước đang có trong kho (để AI đối chiếu khi tư vấn) */
  treatmentStockWhere(scope: ChatScope): Prisma.InventoryWhereInput | null {
    if (!this.canAccess(scope, 'WATER')) return null;
    return {
      farmId: this.farmFilter(scope),
      deletedAt: null,
      category: { in: ['CHEMICAL', 'MEDICINE'] },
    };
  }

  healthWhere(scope: ChatScope): Prisma.ShrimpHealthRecordWhereInput | null {
    if (!this.canAccess(scope, 'HEALTH')) return null;
    const where: Prisma.ShrimpHealthRecordWhereInput = {
      farmId: this.farmFilter(scope),
    };
    if (!this.isFarmLevelReader(scope)) where.recordedBy = scope.userId;
    return where;
  }

  growthWhere(scope: ChatScope): Prisma.ShrimpSizeSampleWhereInput | null {
    if (!this.canAccess(scope, 'GROWTH')) return null;
    const where: Prisma.ShrimpSizeSampleWhereInput = {
      pond: { farmId: this.farmFilter(scope) },
    };
    if (!this.isFarmLevelReader(scope)) where.createdBy = scope.userId;
    return where;
  }

  incidentWhere(scope: ChatScope): Prisma.IncidentWhereInput | null {
    if (!this.canAccess(scope, 'INCIDENT')) return null;
    const where: Prisma.IncidentWhereInput = {
      crop: { pond: { farmId: this.farmFilter(scope) } },
    };
    // Role không đọc cấp trang trại chỉ thấy sự cố do mình báo cáo
    if (!this.isFarmLevelReader(scope)) where.reporterId = scope.userId;
    return where;
  }

  mortalityWhere(scope: ChatScope): Prisma.MortalityLogWhereInput | null {
    if (!this.canAccess(scope, 'MORTALITY')) return null;
    return { crop: { pond: { farmId: this.farmFilter(scope) } } };
  }

  inventoryWhere(scope: ChatScope): Prisma.InventoryWhereInput | null {
    if (!this.canAccess(scope, 'INVENTORY')) return null;
    return { farmId: this.farmFilter(scope), deletedAt: null };
  }
}
