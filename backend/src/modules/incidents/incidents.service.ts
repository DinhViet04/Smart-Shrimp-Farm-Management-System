import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateIncidentDto } from './dto/create-incident.dto.js';
import { GetIncidentsDto } from './dto/get-incidents.dto.js';
import { AssignIncidentDto } from './dto/assign-incident.dto.js';
import { CreateTreatmentUpdateDto } from './dto/create-treatment-update.dto.js';
import { ResolveIncidentDto } from './dto/resolve-incident.dto.js';
import { ReopenIncidentDto } from './dto/reopen-incident.dto.js';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(user: AuthUser, query: GetIncidentsDto) {
    const page = query.page ?? 0;
    const size = query.size ?? 100;
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);
    const where: any = {};

    const cropWhere: any = {};

    if (query.farmId) {
      await this.farmAccess.assertCanAccessFarm(user, query.farmId);
      cropWhere.pond = { ...(cropWhere.pond || {}), farmId: query.farmId };
    } else if (accessibleFarmIds) {
      cropWhere.pond = {
        ...(cropWhere.pond || {}),
        farmId: { in: accessibleFarmIds },
      };
    }

    if (query.pondId) {
      const pond = await this.prisma.pond.findUnique({
        where: { id: query.pondId },
      });
      if (!pond) throw new NotFoundException('Không tìm thấy ao nuôi');
      await this.farmAccess.assertCanAccessFarm(user, pond.farmId);
      cropWhere.pondId = query.pondId;
    }

    if (query.cropId) {
      const crop = await this.getCropWithFarm(query.cropId);
      await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

      const rootId = crop.parentCropId || crop.id;
      const seasonCrops = await this.prisma.crop.findMany({
        where: {
          OR: [{ id: rootId }, { parentCropId: rootId }],
        },
        select: { id: true },
      });
      const seasonCropIds = seasonCrops.map((c) => c.id);
      cropWhere.id = { in: seasonCropIds };
    }

    if (Object.keys(cropWhere).length > 0) {
      where.crop = cropWhere;
    }

    if (query.status) where.status = query.status;
    else if (query.activeOnly) where.status = { in: ['OPEN', 'TREATING'] };
    if (user.role === 'FARMER') {
      where.reporterId = user.userId;
    } else if (query.reportedByMe) {
      where.reporterId = user.userId;
    }
    if (query.assignedToMe) where.assignedToId = user.userId;
    if (query.search?.trim()) {
      where.OR = [
        { title: { contains: query.search.trim(), mode: 'insensitive' } },
        { description: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    } else if (query.year) {
      const startYear = new Date(query.year, 0, 1);
      const endYear = new Date(query.year, 11, 31, 23, 59, 59, 999);
      where.createdAt = { gte: startYear, lte: endYear };
    }

    const include = {
      crop: {
        select: {
          id: true,
          startDate: true,
          pond: {
            select: {
              id: true,
              name: true,
              farm: { select: { id: true, name: true } },
            },
          },
        },
      },
      reporter: { select: { id: true, fullName: true, role: true } },
      assignedTo: { select: { id: true, fullName: true, email: true } },
      _count: { select: { updates: true } },
    } as const;

    const [content, totalElements] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip: page * size,
        take: size,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { content, page, size, totalElements };
  }

  async findOne(user: AuthUser, id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        crop: {
          include: { pond: { include: { farm: true } } },
        },
        reporter: { select: { id: true, fullName: true, role: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
        updates: {
          include: {
            author: { select: { id: true, fullName: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!incident) throw new NotFoundException('Không tìm thấy sự cố');

    await this.farmAccess.assertCanAccessFarm(user, incident.crop.pond.farmId);
    return incident;
  }

  async create(user: AuthUser, dto: CreateIncidentDto) {
    if (user.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admin chỉ được giám sát, không được tạo hoặc can thiệp xử lý sự cố',
      );
    }
    let targetCropId = dto.cropId;

    if (!targetCropId) {
      if (dto.pondId) {
        const pondCrop = await this.prisma.crop.findFirst({
          where: { pondId: dto.pondId },
          orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        });
        if (pondCrop) targetCropId = pondCrop.id;
      }

      if (!targetCropId && dto.farmId) {
        const farmCrop = await this.prisma.crop.findFirst({
          where: { pond: { farmId: dto.farmId } },
          orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        });
        if (farmCrop) targetCropId = farmCrop.id;
      }

      if (!targetCropId) {
        const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);
        const anyCrop = await this.prisma.crop.findFirst({
          where: accessibleFarmIds ? { pond: { farmId: { in: accessibleFarmIds } } } : {},
          orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        });
        if (anyCrop) targetCropId = anyCrop.id;
      }
    }

    if (!targetCropId) {
      throw new BadRequestException('Không tìm thấy ao nuôi hoặc vụ nuôi tham chiếu cho trang trại');
    }

    const crop = await this.getCropWithFarm(targetCropId);
    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

    // Định dạng tiêu đề & mô tả nếu có danh mục / mức độ / vị trí cụ thể
    let finalTitle = dto.title.trim();
    if (dto.category && !finalTitle.toUpperCase().startsWith('[') && !finalTitle.includes(dto.category)) {
      finalTitle = `[${dto.category}] ${finalTitle}`;
    }

    let finalDescription = dto.description.trim();
    const metaTags: string[] = [];
    if (dto.category) metaTags.push(`[Phân loại: ${dto.category}]`);
    if (dto.severity) metaTags.push(`[Mức độ: ${dto.severity}]`);
    if (dto.location) metaTags.push(`[Vị trí: ${dto.location}]`);
    if (metaTags.length > 0 && !finalDescription.startsWith('[')) {
      finalDescription = `${metaTags.join(' ')}\n\n${finalDescription}`;
    }

    // Role FARMER và TECHNICIAN chỉ có quyền báo cáo sự cố lên Quản lý (không tự phân công).
    // Chỉ FARM_MANAGER mới có thể tự tiếp nhận ngay khi tạo sự cố nếu muốn.
    const canSelfAssign = user.role === 'FARM_MANAGER' && Boolean(dto.selfAssign);

    const incident = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data: {
          cropId: targetCropId,
          title: finalTitle,
          description: finalDescription,
          reporterId: user.userId,
          ...(canSelfAssign ? { assignedToId: user.userId, status: 'TREATING' } : {}),
        },
      });
      await tx.incidentTreatmentUpdate.create({
        data: {
          incidentId: created.id,
          authorId: user.userId,
          treatment: canSelfAssign
            ? 'Quản lý tự tiếp nhận và xử lý sự cố'
            : 'Đã báo cáo sự cố lên Quản lý trang trại để tiếp nhận & phân công nhân sự khắc phục',
          status: canSelfAssign ? 'TREATING' : 'OPEN',
          eventType: 'REPORTED',
        },
      });
      return created;
    });

    // Gửi thông báo thời gian thực tới Farm Manager / Owner
    try {
      const farmId = crop.pond.farmId;
      const farm = await this.prisma.farm?.findUnique?.({
        where: { id: farmId },
        select: { ownerId: true, name: true },
      });

      const managerStaff =
        (await this.prisma.farmStaff?.findMany?.({
          where: {
            farmId,
            role: 'FARM_MANAGER',
            isActive: true,
          },
          select: { userId: true },
        })) || [];

      const managerIds = new Set<string>();
      if (farm?.ownerId && farm.ownerId !== user.userId) {
        managerIds.add(farm.ownerId);
      }
      for (const m of managerStaff) {
        if (m.userId !== user.userId) {
          managerIds.add(m.userId);
        }
      }

      if (managerIds.size > 0 && this.notificationsService?.notifyIncidentReported) {
        const reporter = await this.prisma.user?.findUnique?.({
          where: { id: user.userId },
          select: { fullName: true },
        });

        await this.notificationsService.notifyIncidentReported({
          farmId,
          farmName: farm?.name || 'Trang trại',
          pondId: crop.pond.id,
          pondName: crop.pond.name,
          incidentId: incident.id,
          title: incident.title,
          reporterName: reporter?.fullName || 'Nhân viên trang trại',
          reporterRole: user.role,
          category: dto.category,
          severity: dto.severity,
          recipientUserIds: Array.from(managerIds),
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send incident notification to managers:', notifErr);
    }

    return incident;
  }

  async assign(user: AuthUser, id: string, dto: AssignIncidentDto) {
    const incident = await this.getIncident(id);
    const farmId = incident.crop.pond.farmId;
    await this.farmAccess.assertCanManageFarm(user, farmId);
    if (user.role !== 'FARM_MANAGER') {
      throw new ForbiddenException(
        'Chỉ quản lý trang trại mới được phân công nhân sự xử lý sự cố',
      );
    }
    if (incident.status === 'RESOLVED') {
      throw new BadRequestException('Không thể phân công lại sự cố đã xử lý');
    }

    const technician = await this.prisma.farmStaff.findFirst({
      where: {
        farmId,
        userId: dto.assignedToId,
        isActive: true,
        user: { role: 'TECHNICIAN', isActive: true },
      },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!technician) {
      throw new BadRequestException(
        'Kỹ thuật viên chưa được phân công vào trang trại này',
      );
    }

    const nextStatus = incident.status === 'OPEN' ? 'TREATING' : incident.status;
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: { assignedToId: dto.assignedToId, status: nextStatus },
        include: {
          assignedTo: { select: { id: true, fullName: true, email: true } },
        },
      });
      await tx.incidentTreatmentUpdate.create({
        data: {
          incidentId: id,
          authorId: user.userId,
          treatment: `Quản lý phân công xử lý: ${technician.user.fullName}`,
          status: nextStatus,
          eventType: 'ASSIGNED',
        },
      });
      return updated;
    });

    try {
      if (this.notificationsService?.notifyIncidentAssigned) {
        const manager = await this.prisma.user?.findUnique?.({
          where: { id: user.userId },
          select: { fullName: true },
        });
        await this.notificationsService.notifyIncidentAssigned({
          farmId,
          farmName: incident.crop.pond.farm?.name || 'Trang trại',
          pondId: incident.crop.pond.id,
          pondName: incident.crop.pond.name,
          incidentId: incident.id,
          title: incident.title,
          assigneeId: dto.assignedToId,
          managerName: manager?.fullName || 'Quản lý trang trại',
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send assignment notification to technician:', notifErr);
    }

    return result;
  }

  async startTreatment(user: AuthUser, id: string) {
    const incident = await this.getIncident(id);
    await this.assertCanTreat(user, incident);
    if (incident.status === 'RESOLVED') {
      throw new BadRequestException('Sự cố này đã xử lý xong');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: {
          status: 'TREATING',
          ...(!incident.startedAt ? { startedAt: new Date() } : {}),
        },
        include: {
          crop: {
            include: { pond: { include: { farm: true } } },
          },
          reporter: { select: { id: true, fullName: true, role: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
        },
      });
      await tx.incidentTreatmentUpdate.create({
        data: {
          incidentId: id,
          authorId: user.userId,
          treatment: 'Bắt đầu xử lý sự cố',
          status: 'TREATING',
          eventType: 'STARTED',
        },
      });
      return updated;
    });
  }

  async addTreatmentUpdate(
    user: AuthUser,
    id: string,
    dto: CreateTreatmentUpdateDto,
  ) {
    const incident = await this.getIncident(id);
    await this.assertCanTreat(user, incident);
    if (incident.status !== 'TREATING') {
      throw new BadRequestException(
        'Chỉ có thể cập nhật sau khi đã bắt đầu điều trị sự cố',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const update = await tx.incidentTreatmentUpdate.create({
        data: {
          incidentId: id,
          authorId: user.userId,
          treatment: dto.treatment.trim(),
          observation: dto.observation?.trim() || null,
          result: dto.result?.trim() || null,
          status: 'TREATING',
          eventType: 'TREATMENT',
        },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
        },
      });

      await tx.incident.update({
        where: { id },
        data: {
          treatment: dto.treatment.trim(),
          status: 'TREATING',
        },
      });
      return update;
    });
  }

  async resolve(user: AuthUser, id: string, dto: ResolveIncidentDto) {
    const incident = await this.getIncident(id);
    await this.assertCanTreat(user, incident);
    if (incident.status !== 'TREATING') {
      throw new BadRequestException(
        'Chỉ có thể hoàn tất sự cố đang được điều trị',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const update = await tx.incidentTreatmentUpdate.create({
        data: {
          incidentId: id,
          authorId: user.userId,
          treatment: dto.treatment.trim(),
          result: dto.result?.trim() || null,
          status: 'RESOLVED',
          eventType: 'RESOLVED',
        },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
        },
      });
      await tx.incident.update({
        where: { id },
        data: {
          treatment: dto.treatment.trim(),
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });
      return update;
    });
  }

  async reopen(user: AuthUser, id: string, dto: ReopenIncidentDto) {
    const incident = await this.getIncident(id);
    await this.assertCanReopen(user, incident);
    if (incident.status !== 'RESOLVED') {
      throw new BadRequestException('Chỉ có thể mở lại sự cố đã xử lý');
    }

    return this.prisma.$transaction(async (tx) => {
      const update = await tx.incidentTreatmentUpdate.create({
        data: {
          incidentId: id,
          authorId: user.userId,
          treatment: `Mở lại sự cố: ${dto.reason.trim()}`,
          status: 'OPEN',
          eventType: 'REOPENED',
        },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
        },
      });
      await tx.incident.update({
        where: { id },
        data: { status: 'OPEN', resolvedAt: null },
      });
      return update;
    });
  }

  private async getCropWithFarm(id: string) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: { pond: { include: { farm: true } } },
    });
    if (!crop) throw new NotFoundException('Không tìm thấy vụ nuôi');
    return crop;
  }

  private async getIncident(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: { crop: { include: { pond: { include: { farm: true } } } } },
    });
    if (!incident) throw new NotFoundException('Không tìm thấy sự cố');
    return incident;
  }

  private async assertCanTreat(
    user: AuthUser,
    incident: Awaited<ReturnType<IncidentsService['getIncident']>>,
  ) {
    if (user.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admin chỉ được giám sát, không được can thiệp xử lý sự cố',
      );
    }
    await this.farmAccess.assertCanAccessFarm(user, incident.crop.pond.farmId);
    if (user.role === 'FARM_MANAGER') {
      return;
    }
    if (user.role !== 'TECHNICIAN' || incident.assignedToId !== user.userId) {
      throw new ForbiddenException(
        'Chỉ kỹ thuật viên được phân công hoặc Quản lý trang trại mới có thể điều trị sự cố',
      );
    }
  }

  private async assertCanReopen(
    user: AuthUser,
    incident: Awaited<ReturnType<IncidentsService['getIncident']>>,
  ) {
    if (user.role === 'FARM_MANAGER') {
      await this.farmAccess.assertCanManageFarm(
        user,
        incident.crop.pond.farmId,
      );
      return;
    }
    await this.assertCanTreat(user, incident);
  }
}
