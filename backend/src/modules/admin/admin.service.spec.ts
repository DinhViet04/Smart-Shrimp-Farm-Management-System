import { AdminService } from './admin.service.js';

describe('AdminService', () => {
  it('loads dashboard aggregates in parallel-friendly grouped queries', async () => {
    const prisma = {
      user: {
        count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(8),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ createdAt: new Date() }])
          .mockResolvedValueOnce([
            { fullName: 'User A', createdAt: new Date() },
          ]),
        groupBy: jest.fn().mockResolvedValue([{ role: 'ADMIN', _count: 2 }]),
      },
      farm: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest
          .fn()
          .mockResolvedValue([{ name: 'Farm A', createdAt: new Date() }]),
      },
      pond: { count: jest.fn().mockResolvedValue(4) },
      crop: { count: jest.fn().mockResolvedValue(5) },
      incident: { count: jest.fn().mockResolvedValue(2) },
    };
    const service = new AdminService(prisma as any);

    const result = await service.getDashboardStats(7);

    expect(result.statCards[0]).toEqual(
      expect.objectContaining({ value: 10, context: '8 đang hoạt động' }),
    );
    expect(result.growthData).toHaveLength(7);
    expect(result.roleDistrib).toEqual([
      { label: 'Admin', value: 2, color: '#e11d48' },
    ]);
    expect(prisma.farm.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });

  it('returns paginated audit logs with the acting admin', async () => {
    const prisma = {
      adminAuditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'audit-1',
            action: 'USER_DEACTIVATED',
            actor: {
              id: 'admin-id',
              fullName: 'Admin',
              email: 'admin@test.com',
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new AdminService(prisma as any);

    const result = await service.getAuditLogs({ page: 1, pageSize: 20 });

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(result.items).toHaveLength(1);
  });

  it('limits annual report groups and harvest totals to the selected year', async () => {
    const groupBy = jest.fn().mockResolvedValue([]);
    const prisma = {
      user: { groupBy },
      farm: { groupBy },
      crop: {
        groupBy,
        aggregate: jest.fn().mockResolvedValue({
          _count: 1,
          _sum: { actualHarvestRevenue: 1_000_000 },
        }),
      },
      incident: { groupBy },
    };
    const service = new AdminService(prisma as any);

    const result = await service.getReport(2026);

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date(2026, 0, 1),
            lt: new Date(2027, 0, 1),
          },
        },
      }),
    );
    expect(prisma.crop.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          actualHarvestDate: {
            gte: new Date(2026, 0, 1),
            lt: new Date(2027, 0, 1),
          },
        },
      }),
    );
    expect(result.harvest).toEqual(
      expect.objectContaining({ count: 1, actualHarvestRevenue: 1_000_000 }),
    );
  });
});
