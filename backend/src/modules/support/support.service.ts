import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationLevel,
  Prisma,
  Role,
  SupportTicketScope,
  SupportTicketStatus,
  WorkspaceStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto.js';
import { GetSupportTicketsQueryDto } from './dto/get-support-tickets-query.dto.js';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto.js';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(
    userId: string,
    role: string,
    query: GetSupportTicketsQueryDto,
  ) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
      ...(role === Role.ADMIN
        ? {}
        : {
            requesterId: userId,
            OR: [
              { scope: SupportTicketScope.SYSTEM },
              {
                workspace: {
                  members: { some: { userId, isActive: true } },
                },
              },
            ],
          }),
    };
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          workspace: { select: { id: true, name: true } },
          requester: { select: { id: true, fullName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async create(dto: CreateSupportTicketDto, requesterId: string) {
    const subject = dto.subject.trim();
    const description = dto.description.trim();
    if (!subject || !description)
      throw new BadRequestException(
        'Tiêu đề và nội dung yêu cầu không được để trống',
      );
    const scope = dto.scope ?? SupportTicketScope.WORKSPACE;
    if (scope === SupportTicketScope.SYSTEM && dto.workspaceId)
      throw new BadRequestException(
        'Yêu cầu hỗ trợ hệ thống không được gắn với workspace',
      );
    if (scope === SupportTicketScope.WORKSPACE) {
      if (!dto.workspaceId)
        throw new BadRequestException(
          'Phải chọn workspace cho yêu cầu hỗ trợ workspace',
        );
      const membership = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId: dto.workspaceId,
          userId: requesterId,
          isActive: true,
          workspace: { status: WorkspaceStatus.ACTIVE },
        },
      });
      if (!membership)
        throw new ForbiddenException(
          'Bạn không thuộc workspace hoặc workspace đã bị tạm ngưng',
        );
    }
    const ticket = await this.prisma.supportTicket.create({
      data: {
        scope,
        workspaceId:
          scope === SupportTicketScope.WORKSPACE ? dto.workspaceId : null,
        requesterId,
        subject,
        description,
        priority: dto.priority,
      },
      include: {
        workspace: { select: { id: true, name: true } },
        requester: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
    });
    this.notifications.emitSupportTicketCreated(ticket);
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });
    await Promise.allSettled(
      admins.map(({ id }) =>
        this.notifications.createSupportNotification(
          id,
          'Yêu cầu hỗ trợ mới',
          `${ticket.workspace?.name ?? 'Hệ thống SSFM'}: ${ticket.subject}`,
          dto.priority === 'URGENT'
            ? NotificationLevel.DANGER
            : dto.priority === 'HIGH'
              ? NotificationLevel.WARNING
              : NotificationLevel.INFO,
        ),
      ),
    );
    return ticket;
  }

  async update(id: string, dto: UpdateSupportTicketDto, adminId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) throw new NotFoundException('Không tìm thấy yêu cầu hỗ trợ');
    const statusChanged = Boolean(dto.status && dto.status !== ticket.status);
    if (dto.status) this.assertStatusTransition(ticket.status, dto.status);
    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
        select: { role: true, isActive: true },
      });
      if (!assignee || assignee.role !== Role.ADMIN || !assignee.isActive)
        throw new BadRequestException(
          'Người xử lý phải là Admin đang hoạt động',
        );
    }
    if (dto.status === SupportTicketStatus.RESOLVED && !dto.resolution?.trim())
      throw new BadRequestException(
        'Phải nhập kết quả xử lý trước khi hoàn tất yêu cầu',
      );
    if (
      dto.status === SupportTicketStatus.RESOLVED &&
      !ticket.assignedToId &&
      !dto.assignedToId
    )
      throw new BadRequestException(
        'Phải tiếp nhận yêu cầu trước khi hoàn tất xử lý',
      );
    if (
      ticket.status === SupportTicketStatus.OPEN &&
      dto.status === SupportTicketStatus.IN_PROGRESS &&
      !dto.assignedToId
    )
      throw new BadRequestException(
        'Phải chỉ định Admin phụ trách khi tiếp nhận yêu cầu',
      );
    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id },
        data: {
          ...dto,
          resolution:
            dto.status === SupportTicketStatus.IN_PROGRESS &&
            ticket.status === SupportTicketStatus.RESOLVED
              ? null
              : dto.resolution?.trim(),
          resolvedAt:
            dto.status === SupportTicketStatus.RESOLVED
              ? new Date()
              : dto.status === SupportTicketStatus.IN_PROGRESS
                ? null
                : undefined,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: adminId,
          action: 'SUPPORT_TICKET_UPDATED',
          targetType: 'SUPPORT_TICKET',
          targetId: id,
          details: { fromStatus: ticket.status, toStatus: updated.status },
        },
      });
      return updated;
    });
    const statusLabel: Record<SupportTicketStatus, string> = {
      OPEN: 'mới được tạo',
      IN_PROGRESS: 'đã được tiếp nhận',
      RESOLVED: 'đã được xử lý xong',
      CLOSED: 'đã được đóng',
    };
    this.notifications.emitSupportTicketUpdated(ticket.requesterId, updated);
    if (statusChanged)
      await Promise.allSettled([
        this.notifications.createSupportNotification(
          ticket.requesterId,
          'Cập nhật yêu cầu hỗ trợ',
          `Yêu cầu "${ticket.subject}" ${statusLabel[updated.status]}.`,
          NotificationLevel.INFO,
        ),
      ]);
    return updated;
  }

  private assertStatusTransition(
    current: SupportTicketStatus,
    next: SupportTicketStatus,
  ) {
    if (current === next) return;
    const allowed: Record<SupportTicketStatus, SupportTicketStatus[]> = {
      OPEN: [SupportTicketStatus.IN_PROGRESS],
      IN_PROGRESS: [SupportTicketStatus.RESOLVED],
      RESOLVED: [SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.CLOSED],
      CLOSED: [],
    };
    if (!allowed[current].includes(next))
      throw new BadRequestException(
        `Không thể chuyển ticket từ ${current} sang ${next}`,
      );
  }
}
