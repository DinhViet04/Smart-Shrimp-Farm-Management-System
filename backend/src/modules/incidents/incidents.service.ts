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
    const crop = await this.getCropWithFarm(dto.cropId);
    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);
    if (crop.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Chỉ được ghi nhận sự cố cho vụ nuôi đang hoạt động',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          cropId: dto.cropId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          reporterId: user.userId,
          ...(user.role === 'TECHNICIAN' ? { assignedToId: user.userId } : {}),
        },
      });
      await tx.incidentTreatmentUpdate.create({
        data: {
          incidentId: incident.id,
          authorId: user.userId,
          treatment: 'Đã báo cáo sự cố',
          status: 'OPEN',
          eventType: 'REPORTED',
        },
      });
      return incident;
    });
  }

  async assign(user: AuthUser, id: string, dto: AssignIncidentDto) {
    const incident = await this.getIncident(id);
    const farmId = incident.crop.pond.farmId;
    await this.farmAccess.assertCanManageFarm(user, farmId);
    if (user.role !== 'FARM_MANAGER') {
      throw new ForbiddenException(
        'Chỉ quản lý trang trại được phân công kỹ thuật viên',
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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: { assignedToId: dto.assignedToId },
        include: {
          assignedTo: { select: { id: true, fullName: true, email: true } },
        },
      });
      await tx.incidentTreatmentUpdate.create({
        data: {
          incidentId: id,
          authorId: user.userId,
          treatment: `Phân công kỹ thuật viên: ${technician.user.fullName}`,
          status: incident.status,
          eventType: 'ASSIGNED',
        },
      });
      return updated;
    });
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
    if (incident.status === 'RESOLVED') {
      throw new BadRequestException('Không thể cập nhật sự cố đã xử lý xong');
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
          ...(!incident.startedAt ? { startedAt: new Date() } : {}),
        },
      });
      return update;
    });
  }

  async resolve(user: AuthUser, id: string, dto: ResolveIncidentDto) {
    const incident = await this.getIncident(id);
    await this.assertCanTreat(user, incident);
    if (incident.status === 'RESOLVED') {
      throw new BadRequestException('Sự cố này đã xử lý xong');
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
          ...(!incident.startedAt ? { startedAt: new Date() } : {}),
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
      include: { crop: { include: { pond: true } } },
    });
    if (!incident) throw new NotFoundException('Không tìm thấy sự cố');
    return incident;
  }

  private async assertCanTreat(
    user: AuthUser,
    incident: Awaited<ReturnType<IncidentsService['getIncident']>>,
  ) {
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
