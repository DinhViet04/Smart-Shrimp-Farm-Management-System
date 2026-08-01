import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IncidentsService } from './incidents.service.js';

describe('IncidentsService', () => {
  const incident = {
    id: 'incident-id',
    status: 'OPEN',
    assignedToId: 'technician-id',
    startedAt: null,
    crop: { pond: { farmId: 'farm-id' } },
  };

  const prisma = {
    crop: {
      findUnique: jest.fn(),
    },
    farmStaff: {
      findFirst: jest.fn(),
    },
    incident: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    incidentTreatmentUpdate: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const farmAccess = {
    assertCanAccessFarm: jest.fn(),
    assertCanManageFarm: jest.fn(),
    getAccessibleFarmIds: jest.fn(),
  };
  const service = new IncidentsService(prisma as any, farmAccess as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.incident.findUnique.mockResolvedValue(incident);
    prisma.crop.findUnique.mockResolvedValue({ id: 'crop-id', status: 'ACTIVE', pond: { farmId: 'farm-id', farm: { id: 'farm-id' } } });
    prisma.farmStaff.findFirst.mockResolvedValue({ user: { id: 'technician-id', fullName: 'Kỹ thuật viên', email: 'tech@example.com' } });
    prisma.incident.create.mockResolvedValue({ id: 'new-incident' });
    prisma.incident.update.mockResolvedValue({ ...incident, status: 'TREATING' });
    prisma.incident.findMany.mockResolvedValue([]);
    prisma.incident.count.mockResolvedValue(0);
    prisma.incidentTreatmentUpdate.create.mockResolvedValue({ id: 'update-id' });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => unknown) => callback(prisma));
    farmAccess.assertCanAccessFarm.mockResolvedValue(undefined);
    farmAccess.assertCanManageFarm.mockResolvedValue(undefined);
    farmAccess.getAccessibleFarmIds.mockResolvedValue(['farm-id']);
  });

  it('starts treatment for an open incident', async () => {
    await service.startTreatment({ userId: 'technician-id', role: 'TECHNICIAN' }, incident.id);

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      { userId: 'technician-id', role: 'TECHNICIAN' },
      'farm-id',
    );
    expect(prisma.incident.update).toHaveBeenCalledWith({
      where: { id: incident.id },
      data: { status: 'TREATING', startedAt: expect.any(Date) },
    });
  });

  it('limits the incident list to accessible farms', async () => {
    await service.findAll(
      { userId: 'technician-id', role: 'TECHNICIAN' },
      { page: 0, size: 20 },
    );

    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { crop: { pond: { farmId: { in: ['farm-id'] } } } },
      }),
    );
  });

  it('loads incident detail with a single database query', async () => {
    await service.findOne(
      { userId: 'technician-id', role: 'TECHNICIAN' },
      incident.id,
    );

    expect(prisma.incident.findUnique).toHaveBeenCalledTimes(1);
    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      { userId: 'technician-id', role: 'TECHNICIAN' },
      'farm-id',
    );
  });

  it('creates an incident for an active crop in an accessible farm', async () => {
    await service.create(
      { userId: 'farmer-id', role: 'FARMER' },
      { cropId: 'crop-id', title: ' Tôm nổi đầu ', description: ' Phát hiện lúc sáng ' },
    );

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      { userId: 'farmer-id', role: 'FARMER' },
      'farm-id',
    );
    expect(prisma.incident.create).toHaveBeenCalledWith({
      data: { cropId: 'crop-id', title: 'Tôm nổi đầu', description: 'Phát hiện lúc sáng', reporterId: 'farmer-id' },
    });
    expect(prisma.incidentTreatmentUpdate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authorId: 'farmer-id', eventType: 'REPORTED', status: 'OPEN' }),
    });
  });

  it('rejects creating an incident for a finished crop', async () => {
    prisma.crop.findUnique.mockResolvedValue({ id: 'crop-id', status: 'HARVESTED', pond: { farmId: 'farm-id', farm: { id: 'farm-id' } } });

    await expect(
      service.create(
        { userId: 'farmer-id', role: 'FARMER' },
        { cropId: 'crop-id', title: 'Sự cố', description: 'Mô tả' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('automatically assigns an incident reported by a technician', async () => {
    await service.create(
      { userId: 'technician-id', role: 'TECHNICIAN' },
      { cropId: 'crop-id', title: 'Sự cố', description: 'Mô tả' },
    );

    expect(prisma.incident.create).toHaveBeenCalledWith({
      data: {
        cropId: 'crop-id',
        title: 'Sự cố',
        description: 'Mô tả',
        reporterId: 'technician-id',
        assignedToId: 'technician-id',
      },
    });
  });

  it('assigns an active technician from the same farm', async () => {
    await service.assign(
      { userId: 'manager-id', role: 'FARM_MANAGER' },
      incident.id,
      { assignedToId: 'technician-id' },
    );

    expect(farmAccess.assertCanManageFarm).toHaveBeenCalledWith(
      { userId: 'manager-id', role: 'FARM_MANAGER' },
      'farm-id',
    );
    expect(prisma.farmStaff.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          farmId: 'farm-id',
          userId: 'technician-id',
          isActive: true,
          user: { role: 'TECHNICIAN', isActive: true },
        },
      }),
    );
    expect(prisma.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assignedToId: 'technician-id' } }),
    );
  });

  it('rejects admin assignment even though admin can view every farm', async () => {
    await expect(
      service.assign(
        { userId: 'admin-id', role: 'ADMIN' },
        incident.id,
        { assignedToId: 'technician-id' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects reassignment after an incident is resolved', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, status: 'RESOLVED' });

    await expect(
      service.assign(
        { userId: 'manager-id', role: 'FARM_MANAGER' },
        incident.id,
        { assignedToId: 'technician-id' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects starting an incident that is not open', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, status: 'TREATING' });

    await expect(
      service.startTreatment({ userId: 'technician-id', role: 'TECHNICIAN' }, incident.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a technician when another technician is assigned', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, assignedToId: 'other-technician' });

    await expect(
      service.startTreatment({ userId: 'technician-id', role: 'TECHNICIAN' }, incident.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an admin attempting to intervene in an assigned incident', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, assignedToId: 'technician-id' });

    await expect(
      service.startTreatment({ userId: 'admin-id', role: 'ADMIN' }, incident.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a technician when the incident has not been assigned', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, assignedToId: null });

    await expect(
      service.startTreatment({ userId: 'technician-id', role: 'TECHNICIAN' }, incident.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stores a treatment update and changes the incident status', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, status: 'TREATING' });

    await service.addTreatmentUpdate(
      { userId: 'technician-id', role: 'TECHNICIAN' },
      incident.id,
      { treatment: 'Tăng cường quạt nước', observation: 'DO thấp' },
    );

    expect(prisma.incidentTreatmentUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorId: 'technician-id',
          treatment: 'Tăng cường quạt nước',
          status: 'TREATING',
          eventType: 'TREATMENT',
        }),
      }),
    );
    expect(prisma.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'TREATING' }) }),
    );
  });

  it('rejects updates on a resolved incident', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, status: 'RESOLVED' });

    await expect(
      service.addTreatmentUpdate(
        { userId: 'technician-id', role: 'TECHNICIAN' },
        incident.id,
        { treatment: 'Cập nhật thêm' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects treatment updates before treatment has started', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, status: 'OPEN' });

    await expect(
      service.addTreatmentUpdate(
        { userId: 'technician-id', role: 'TECHNICIAN' },
        incident.id,
        { treatment: 'Bỏ qua bước bắt đầu' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reopens a resolved incident and records the reason', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, status: 'RESOLVED' });

    await service.reopen(
      { userId: 'technician-id', role: 'TECHNICIAN' },
      incident.id,
      { reason: 'Tôm tái phát triệu chứng' },
    );

    expect(prisma.incidentTreatmentUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ treatment: 'Mở lại sự cố: Tôm tái phát triệu chứng' }),
      }),
    );
    expect(prisma.incident.update).toHaveBeenCalledWith({
      where: { id: incident.id },
      data: { status: 'TREATING', resolvedAt: null },
    });
  });

  it('allows the farm manager to reopen a resolved incident', async () => {
    prisma.incident.findUnique.mockResolvedValue({ ...incident, status: 'RESOLVED' });

    await service.reopen(
      { userId: 'manager-id', role: 'FARM_MANAGER' },
      incident.id,
      { reason: 'Cần xử lý bổ sung' },
    );

    expect(farmAccess.assertCanManageFarm).toHaveBeenCalledWith(
      { userId: 'manager-id', role: 'FARM_MANAGER' },
      'farm-id',
    );
  });
});
