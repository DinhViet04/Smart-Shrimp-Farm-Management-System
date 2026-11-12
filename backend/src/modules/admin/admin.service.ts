import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GetAuditLogsQueryDto } from './dto/get-audit-logs-query.dto.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(days: 7 | 30 = 7) {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setHours(0, 0, 0, 0);
    periodStart.setDate(periodStart.getDate() - (days - 1));
    const [
      totalUsers,
      activeUsers,
      totalFarms,
      activePonds,
      activeCrops,
      openIncidents,
      registrations,
      roleGroup,
      recentUsers,
      recentFarms,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.farm.count({ where: { deletedAt: null } }),
      this.prisma.pond.count({
        where: {
          farm: { deletedAt: null },
          crops: { some: { status: 'ACTIVE' } },
        },
      }),
      this.prisma.crop.count({
        where: { status: 'ACTIVE', pond: { farm: { deletedAt: null } } },
      }),
      this.prisma.incident.count({
        where: { status: { in: ['OPEN', 'TREATING'] } },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: periodStart } },
        select: { createdAt: true },
      }),
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { fullName: true, createdAt: true },
      }),
      this.prisma.farm.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { name: true, createdAt: true },
      }),
    ]);

    const byDay = new Map<string, number>();
    registrations.forEach((user) =>
      byDay.set(
        this.dateKey(user.createdAt),
        (byDay.get(this.dateKey(user.createdAt)) ?? 0) + 1,
      ),
    );
    const growthData: number[] = [];
    const growthLabels: string[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - offset);
      growthData.push(byDay.get(this.dateKey(date)) ?? 0);
      growthLabels.push(
        days === 7
          ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]
          : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
      );
    }

    const labels: Record<string, string> = {
      ADMIN: 'Admin',
      FARM_MANAGER: 'Quản lý',
      TECHNICIAN: 'Kỹ thuật viên',
      FARMER: 'Nông dân',
    };
    const colors: Record<string, string> = {
      ADMIN: '#e11d48',
      FARM_MANAGER: '#059669',
      TECHNICIAN: '#d97706',
      FARMER: '#2563eb',
    };
    const activities = [
      ...recentUsers.map((user) => ({
        text: `Người dùng mới: ${user.fullName}`,
        date: user.createdAt,
        color: 'bg-blue-500',
      })),
      ...recentFarms.map((farm) => ({
        text: `Trang trại mới: ${farm.name}`,
        date: farm.createdAt,
        color: 'bg-emerald-500',
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6);

    return {
      statCards: [
        {
          label: 'Tổng người dùng',
          value: totalUsers,
          context: `${activeUsers} đang hoạt động`,
          color: '#2563eb',
        },
        {
          label: 'Trang trại',
          value: totalFarms,
          context: 'Không gồm trang trại đã xóa',
          color: '#059669',
        },
        {
          label: 'Vụ nuôi đang chạy',
          value: activeCrops,
          context: `${activePonds} ao đang nuôi`,
          color: '#7c3aed',
        },
        {
          label: 'Sự cố cần theo dõi',
          value: openIncidents,
          context: 'Đang mở hoặc điều trị',
          color: '#d97706',
        },
      ],
      growthData,
      growthLabels,
      roleDistrib: roleGroup.map((item) => ({
        label: labels[item.role] ?? item.role,
        value: item._count,
        color: colors[item.role] ?? '#64748b',
      })),
      recentActivity: activities.map((activity) => ({
        text: activity.text,
        sub: this.relativeTime(activity.date, now),
        color: activity.color,
      })),
      periodDays: days,
    };
  }

  async getAuditLogs(query: GetAuditLogsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where = query.action ? { action: query.action } : {};
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          details: true,
          createdAt: true,
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.adminAuditLog.count({ where }),
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

  async getSystemHealth() {
    const checkedAt = new Date();
    const started = Date.now();
    let database: 'UP' | 'DOWN' = 'UP';
    let databaseLatencyMs: number | null = null;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseLatencyMs = Date.now() - started;
    } catch {
      database = 'DOWN';
    }

    const aiStatus = await this.checkAiServiceHealth();

    return {
      status: database === 'UP' ? 'HEALTHY' : 'DEGRADED',
      checkedAt,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        usedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        totalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      services: [
        {
          name: 'API',
          status: 'UP',
          detail: `Uptime ${Math.floor(process.uptime() / 60)} phút`,
        },
        {
          name: 'Database',
          status: database,
          detail:
            databaseLatencyMs === null
              ? 'Không thể kết nối'
              : `${databaseLatencyMs} ms`,
        },
        {
          name: 'Email',
          status: process.env.SMTP_HOST ? 'UP' : 'NOT_CONFIGURED',
          detail: process.env.SMTP_HOST
            ? 'Đã cấu hình SMTP'
            : 'Chưa cấu hình SMTP',
        },
        aiStatus,
      ],
    };
  }

  private async checkAiServiceHealth(): Promise<{
    name: string;
    status: string;
    detail: string;
  }> {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const started = Date.now();
    try {
      const response = await fetch(`${aiServiceUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const latencyMs = Date.now() - started;
        const body = (await response.json().catch(() => ({}))) as {
          openaiConnected?: boolean;
        };
        const mode =
          body.openaiConnected || process.env.OPENAI_API_KEY
            ? 'OpenAI RAG'
            : 'RAG cục bộ';
        return {
          name: 'Chatbot AI',
          status: 'UP',
          detail: `AI Service trực tuyến (${mode} · ${latencyMs} ms)`,
        };
      }
    } catch {
      // Fallback to Backend built-in chatbot check
    }
    return {
      name: 'Chatbot AI',
      status: process.env.OPENAI_API_KEY ? 'UP' : 'FALLBACK',
      detail: process.env.OPENAI_API_KEY
        ? 'Đã cấu hình OpenAI (Backend RAG)'
        : 'Đang dùng đối sánh cục bộ (AI Microservice tắt)',
    };
  }

  async getSaasMetrics() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      totalWorkspaces,
      activeWorkspaces,
      suspendedWorkspaces,
      newWorkspaces,
      activeMemberships,
      workspaceFarms,
      openTickets,
      unresolvedUrgentTickets,
    ] = await Promise.all([
      this.prisma.workspace.count(),
      this.prisma.workspace.count({ where: { status: 'ACTIVE' } }),
      this.prisma.workspace.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.workspace.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.workspaceMember.count({ where: { isActive: true } }),
      this.prisma.farm.count({
        where: { deletedAt: null, workspace: { status: 'ACTIVE' } },
      }),
      this.prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.supportTicket.count({
        where: {
          priority: 'URGENT',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
    ]);
    return {
      totalWorkspaces,
      activeWorkspaces,
      suspendedWorkspaces,
      newWorkspacesLast30Days: newWorkspaces,
      activeMemberships,
      workspaceFarms,
      openTickets,
      unresolvedUrgentTickets,
      billing: {
        status: 'DEFERRED',
        note: 'Gói dịch vụ và thanh toán đang được thiết kế',
      },
    };
  }

  async getSystemAlerts() {
    const staleAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      unassigned,
      stale,
      inactiveFarms,
      lockedUsers,
      suspendedWorkspaces,
      urgentTickets,
    ] = await Promise.all([
      this.prisma.incident.count({
        where: { status: 'OPEN', assignedToId: null },
      }),
      this.prisma.incident.count({
        where: {
          status: { in: ['OPEN', 'TREATING'] },
          updatedAt: { lt: staleAt },
        },
      }),
      this.prisma.farm.count({
        where: { deletedAt: null, status: { not: 'ACTIVE' } },
      }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.workspace.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.supportTicket.count({
        where: {
          priority: 'URGENT',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
    ]);
    return [
      {
        code: 'UNASSIGNED_INCIDENTS',
        level: unassigned ? 'WARNING' : 'INFO',
        title: 'Sự cố chưa phân công',
        count: unassigned,
        description: 'Sự cố đang mở nhưng chưa có kỹ thuật viên phụ trách.',
      },
      {
        code: 'STALE_INCIDENTS',
        level: stale ? 'DANGER' : 'INFO',
        title: 'Sự cố tồn đọng trên 24 giờ',
        count: stale,
        description: 'Cần quản lý trang trại kiểm tra tiến độ xử lý.',
      },
      {
        code: 'INACTIVE_FARMS',
        level: inactiveFarms ? 'WARNING' : 'INFO',
        title: 'Trang trại không hoạt động',
        count: inactiveFarms,
        description: 'Trang trại đang ở trạng thái khác ACTIVE.',
      },
      {
        code: 'LOCKED_USERS',
        level: 'INFO',
        title: 'Tài khoản bị khóa',
        count: lockedUsers,
        description: 'Tổng số tài khoản hiện không hoạt động.',
      },
      {
        code: 'SUSPENDED_WORKSPACES',
        level: suspendedWorkspaces ? 'WARNING' : 'INFO',
        title: 'Workspace đang tạm ngưng',
        count: suspendedWorkspaces,
        description: 'Khách hàng trong workspace không thể truy cập nghiệp vụ.',
      },
      {
        code: 'URGENT_SUPPORT_TICKETS',
        level: urgentTickets ? 'DANGER' : 'INFO',
        title: 'Yêu cầu hỗ trợ khẩn cấp',
        count: urgentTickets,
        description: 'Ticket khẩn cấp chưa được hoàn tất xử lý.',
      },
    ];
  }

  async getReport(year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const [users, farms, crops, incidents, harvest] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        where: { createdAt: { gte: start, lt: end } },
        _count: true,
      }),
      this.prisma.farm.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lt: end } },
        _count: true,
      }),
      this.prisma.crop.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lt: end } },
        _count: true,
      }),
      this.prisma.incident.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lt: end } },
        _count: true,
      }),
      this.prisma.crop.aggregate({
        where: { actualHarvestDate: { gte: start, lt: end } },
        _count: true,
        _sum: {
          actualHarvestKg: true,
          actualHarvestRevenue: true,
          actualHarvestCost: true,
          actualHarvestProfit: true,
        },
      }),
    ]);
    return {
      year,
      generatedAt: new Date(),
      users,
      farms,
      crops,
      incidents,
      harvest: { count: harvest._count, ...harvest._sum },
    };
  }

  private dateKey(value: Date) {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  private relativeTime(value: Date, now: Date) {
    const minutes = Math.max(
      0,
      Math.floor((now.getTime() - value.getTime()) / 60_000),
    );
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    return hours < 24
      ? `${hours} giờ trước`
      : `${Math.floor(hours / 24)} ngày trước`;
  }
}
