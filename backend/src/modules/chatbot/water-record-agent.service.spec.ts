import { ForbiddenException } from '@nestjs/common';
import { WaterRecordAgentService } from './water-record-agent.service';
import { AgentActionService } from './agent-action.service';

const tech = { userId: 'tech-1', role: 'TECHNICIAN' } as any;

const POND = {
  id: 'pond-1',
  name: 'Ao 1',
  farmId: 'farm-1',
  areaSize: 1500,
  depth: 1.2,
  farm: { name: 'Trại Bạc Liêu' },
  crops: [],
};

function setup(ponds: any[] = [POND]) {
  const prisma = {
    pond: {
      findMany: jest.fn().mockResolvedValue(ponds),
      findUnique: jest.fn().mockResolvedValue({
        name: 'Ao 1',
        farmId: 'farm-1',
        farm: { name: 'Trại Bạc Liêu' },
      }),
    },
    waterQualityRecord: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const farmAccess = {
    getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-1']),
  };
  const waterQualityService = {
    create: jest.fn().mockResolvedValue({ id: 'wq-1', message: 'ok' }),
  };
  const service = new WaterRecordAgentService(
    prisma as any,
    farmAccess as any,
    waterQualityService as any,
  );
  return { service, prisma, waterQualityService };
}

const FULL =
  'Nhập số đo ao 1: nhiệt độ 29, pH 8.3, DO 5.2, mặn 15, kiềm 120, NH3 0.1, độ trong 35';

describe('WaterRecordAgentService – nhận diện ý định', () => {
  it('nhận ra yêu cầu nhập số đo rõ ràng', () => {
    expect(WaterRecordAgentService.detectIntent('Ghi nhận thông số nước ao 2').explicit).toBe(true);
    expect(WaterRecordAgentService.detectIntent('vừa đo pH 8.1').explicit).toBe(true);
  });

  it('nhận ra dãy số đo không kèm động từ', () => {
    const r = WaterRecordAgentService.detectIntent('Ao 1 pH 8.2 DO 5 nhiệt độ 29');
    expect(r).toEqual({ explicit: false, implicit: true });
  });

  it('câu hỏi đánh giá không bị coi là nhập liệu', () => {
    const r = WaterRecordAgentService.detectIntent('pH 7.2, DO 3, nhiệt độ 31 thì có ổn không?');
    expect(r).toEqual({ explicit: false, implicit: false });
  });

  it('"nhiet do" viết không dấu không bị hiểu nhầm là DO', () => {
    expect(WaterRecordAgentService.countMeasurements('nhiet do 29')).toBe(1);
  });
});

describe('WaterRecordAgentService – hội thoại nhập số đo', () => {
  it('đủ thông tin -> phiếu xác nhận kèm đánh giá theo ngưỡng', async () => {
    const { service } = setup();
    const res = await service.handleConversation(FULL, tech);

    expect(res.actionDraft?.type).toBe('CONFIRM_ACTION');
    expect(res.actionDraft?.intent).toBe('RECORD_WATER_QUALITY');
    expect(res.actionDraft?.collectedData).toMatchObject({
      pondId: 'pond-1',
      temperature: 29,
      ph: 8.3,
      dissolvedOxygen: 5.2,
      salinity: 15,
      alkalinity: 120,
      nh3: 0.1,
      transparency: 35,
    });
    expect(res.actionDraft?.summary?.['Đánh giá tổng quan']).toContain('Tối ưu');
  });

  it('thiếu chỉ số -> hỏi bổ sung, lượt sau gộp tiếp dữ liệu', async () => {
    const { service } = setup();
    const first = await service.handleConversation('Ao 1 pH 7.2 DO 3.1 nhiệt độ 29', tech);
    expect(first.actionDraft?.type).toBe('SLOT_FILLING');
    expect(first.actionDraft?.missingFields).toEqual(['salinity', 'alkalinity', 'nh3', 'transparency']);

    const second = await service.handleConversation(
      'mặn 15, kiềm 110, NH3 0.2, độ trong 30',
      tech,
      first.actionDraft?.collectedData,
    );
    expect(second.actionDraft?.type).toBe('CONFIRM_ACTION');
    expect(second.answer).toContain('Chỉ số cần chú ý');
    expect(second.actionDraft?.summary?.['Đánh giá tổng quan']).toContain('Nguy hiểm');
  });

  it('"nhập số đo nước" chưa rõ ao -> hỏi ao trước, CHƯA mở thẻ', async () => {
    const { service } = setup([POND, { ...POND, id: 'pond-2', name: 'Ao 2' }]);
    const res = await service.handleConversation('Nhập số đo nước', tech);
    expect(res.actionDraft?.type).toBe('SLOT_FILLING');
    expect(res.answer).toContain('bạn đo ở **ao nào**');
    expect(res.actionDraft?.quickSuggestions).toEqual(['Ao 1', 'Ao 2']);
    expect(res.actionDraft?.pondOptions).toBeUndefined();
  });

  it('chọn ao xong -> mở thẻ trống kèm bảng dữ liệu ao', async () => {
    const { service } = setup([POND, { ...POND, id: 'pond-2', name: 'Ao 2' }]);
    const first = await service.handleConversation('Nhập số đo nước', tech);
    const res = await service.handleConversation('Ao 2', tech, first.actionDraft?.collectedData);
    expect(res.answer).toContain('thẻ bên dưới');
    expect(res.actionDraft?.collectedData.pondId).toBe('pond-2');
    expect(res.actionDraft?.pondOptions).toEqual([
      expect.objectContaining({ id: 'pond-1', name: 'Ao 1', farmName: 'Trại Bạc Liêu', waterVolume: 1800 }),
      expect.objectContaining({ id: 'pond-2', name: 'Ao 2', farmName: 'Trại Bạc Liêu' }),
    ]);
  });

  it('nhiều trang trại -> hỏi trang trại trước, rồi ao, rồi mới mở thẻ', async () => {
    const A1 = { ...POND, id: 'a1', name: 'Ao A1', farmId: 'f-a', farm: { name: 'Trại A' } };
    const A2 = { ...POND, id: 'a2', name: 'Ao A2', farmId: 'f-a', farm: { name: 'Trại A' } };
    const B1 = { ...POND, id: 'b1', name: 'Ao B1', farmId: 'f-b', farm: { name: 'Trại B' } };
    const { service } = setup([A1, A2, B1]);

    const step1 = await service.handleConversation('tôi muốn ghi thông số nước', tech);
    expect(step1.answer).toContain('trang trại nào');
    expect(step1.actionDraft?.quickSuggestions).toEqual(['Trại A', 'Trại B']);
    expect(step1.actionDraft?.pondOptions).toBeUndefined();

    const step2 = await service.handleConversation('Trại A', tech, step1.actionDraft?.collectedData);
    expect(step2.answer).toContain('ao nào** của **Trại A**');
    expect(step2.actionDraft?.quickSuggestions).toEqual(['Ao A1', 'Ao A2']);
    expect(step2.actionDraft?.pondOptions).toBeUndefined();

    const step3 = await service.handleConversation('Ao A2', tech, step2.actionDraft?.collectedData);
    expect(step3.actionDraft?.collectedData).toMatchObject({ pondId: 'a2', farmId: 'f-a' });
    expect(step3.actionDraft?.pondOptions).toBeDefined();
  });

  it('gửi số đo khi chưa rõ ao -> giữ số đo, hỏi ao', async () => {
    const { service } = setup([POND, { ...POND, id: 'pond-2', name: 'Ao 2' }]);
    const res = await service.handleConversation('ghi số đo pH 8.2 DO 5', tech);
    expect(res.answer).toContain('Tôi đã ghi tạm');
    expect(res.actionDraft?.collectedData).toMatchObject({ ph: 8.2, dissolvedOxygen: 5 });
    expect(res.actionDraft?.pondOptions).toBeUndefined();
  });

  it('bảng dữ liệu ao: kèm DOC vụ đang nuôi và lần đo gần nhất', async () => {
    const { service } = setup([
      {
        ...POND,
        crops: [{ id: 'c1', startDate: new Date(Date.now() - 10 * 86_400_000) }],
        waterQualityRecords: [
          {
            recordTime: new Date('2026-11-17T23:00:00Z'),
            temperature: 28.5, ph: 8.1, dissolvedOxygen: 4.8, salinity: 15,
            alkalinity: 120, nh3: 0.05, no2: 0, h2s: 0.01, transparency: 35, waterColor: 'Xanh lục',
          },
        ],
      },
    ]);
    const res = await service.handleConversation('Nhập số đo nước', tech);
    expect(res.actionDraft?.pondOptions?.[0]).toMatchObject({
      doc: 10,
      lastRecord: { ph: 8.1, dissolvedOxygen: 4.8, waterColor: 'Xanh lục' },
    });
  });

  it('ao đã nhắc ở tin nhắn trước được tự chọn trên thẻ', async () => {
    const { service } = setup([POND, { ...POND, id: 'pond-2', name: 'Ao 2' }]);
    const res = await service.handleConversation('Nhập số đo nước', tech, undefined, undefined, [
      { sender: 'user', text: 'Nước ao 2 hôm qua thế nào?' },
      { sender: 'ai', text: 'Ao 2 có DO hơi thấp...' },
      { sender: 'user', text: 'Nhập số đo nước' },
    ]);
    expect(res.actionDraft?.collectedData.pondId).toBe('pond-2');
  });

  describe('tên ao/trại gọi tắt (giống dữ liệu thật: "Ao nuôi C1", "Trang trại công nghệ cao Quảng Trị")', () => {
    const mk = (id: string, name: string, farmId: string, farmName: string) => ({
      ...POND,
      id,
      name,
      farmId,
      farm: { name: farmName },
    });
    const HAL = 'Hoàng Anh Long';
    const QT = 'Trang trại công nghệ cao Quảng Trị';
    const BL = 'Trang Trại Công Nghệ cao Bạc Liêu';
    const PONDS = [
      mk('hal-c1', 'Ao nuôi C1', 'f-hal', HAL),
      mk('hal-c2', 'Ao nuôi C2', 'f-hal', HAL),
      mk('hal-a1', 'Ao nuôi A1', 'f-hal', HAL),
      mk('hal-b2', 'Ao nuôi B2', 'f-hal', HAL),
      mk('qt-a1', 'Ao nuôi A1', 'f-qt', QT),
      mk('bl-1', 'Trang Trại Ao 1', 'f-bl', BL),
    ];
    const pondOf = async (text: string, history?: any[]) => {
      const { service } = setup(PONDS);
      const res = await service.handleConversation(text, tech, undefined, undefined, history);
      return res.actionDraft?.collectedData;
    };

    it('"ao C1" -> Ao nuôi C1', async () => {
      expect(await pondOf('Nhập số đo ao C1 nhiệt độ 29')).toMatchObject({ pondId: 'hal-c1', farmId: 'f-hal' });
    });

    it('chỉ gõ mã ao "C2" -> Ao nuôi C2', async () => {
      expect(await pondOf('C2 pH 8.2, DO 5, nhiệt độ 29')).toMatchObject({ pondId: 'hal-c2' });
    });

    it('"ao A1" có ở 2 trại + "trại Quảng Trị" (gọi tắt) -> đúng ao của Quảng Trị', async () => {
      expect(await pondOf('nhập số đo ao A1 trại Quảng Trị')).toMatchObject({ pondId: 'qt-a1', farmId: 'f-qt' });
    });

    it('"ao A1" không nêu trại -> chưa chọn ao (để hỏi lại), không đoán bừa', async () => {
      expect((await pondOf('nhập số đo ao A1'))?.pondId).toBeUndefined();
    });

    it('"trại Bạc Liêu ao 1" -> Trang Trại Ao 1', async () => {
      expect(await pondOf('nhập số đo trại Bạc Liêu ao 1')).toMatchObject({ pondId: 'bl-1', farmId: 'f-bl' });
    });

    it('số đo "nhiệt độ 1x" không bị hiểu nhầm thành ao "1"', async () => {
      expect((await pondOf('nhập số đo nhiệt độ 29, pH 1'))?.pondId).toBeUndefined();
    });

    it('ao gọi tắt ở tin nhắn trước -> tự chọn', async () => {
      expect(
        await pondOf('Nhập số đo nước', [{ sender: 'user', text: 'Nước ao nuôi B2 hôm qua thế nào?' }]),
      ).toMatchObject({ pondId: 'hal-b2' });
    });
  });

  describe('nhận diện trang trại', () => {
    const HUE_1 = { ...POND, id: 'hue-1', name: 'Ao 1', farmId: 'farm-hue', farm: { name: 'Trang trại Tôm Huế' } };
    const HUE_2 = { ...POND, id: 'hue-2', name: 'Ao 2', farmId: 'farm-hue', farm: { name: 'Trang trại Tôm Huế' } };
    const CM_1 = { ...POND, id: 'cm-1', name: 'Ao 1', farmId: 'farm-cm', farm: { name: 'Trang trại Cà Mau' } };

    it('tên ao trùng giữa 2 trại -> chọn đúng ao theo tên trại (gọi tắt "trại Cà Mau")', async () => {
      const { service } = setup([HUE_1, HUE_2, CM_1]);
      const res = await service.handleConversation('nhập số đo trại Cà Mau ao 1', tech);
      expect(res.actionDraft?.collectedData).toMatchObject({
        pondId: 'cm-1',
        farmId: 'farm-cm',
        farmName: 'Trang trại Cà Mau',
      });
    });

    it('chỉ nêu trang trại -> thẻ chọn sẵn trại, hỏi ao của trại đó', async () => {
      const { service } = setup([HUE_1, HUE_2, CM_1]);
      const res = await service.handleConversation('Nhập số đo nước Tôm Huế', tech);
      expect(res.actionDraft?.collectedData).toMatchObject({ farmId: 'farm-hue', farmName: 'Trang trại Tôm Huế' });
      expect(res.actionDraft?.collectedData.pondId).toBeUndefined();
      expect(res.answer).toContain('ao nào** của **Trang trại Tôm Huế**');
      expect(res.actionDraft?.quickSuggestions).toEqual(['Ao 1 (Trang trại Tôm Huế)', 'Ao 2']);
    });

    it('trại chỉ có 1 ao -> tự chọn ao đó', async () => {
      const { service } = setup([HUE_1, HUE_2, CM_1]);
      const res = await service.handleConversation('Nhập số đo nước trang trại Cà Mau', tech);
      expect(res.actionDraft?.collectedData).toMatchObject({ pondId: 'cm-1', farmId: 'farm-cm' });
    });

    it('trang trại nhắc ở tin nhắn trước được dùng làm mặc định', async () => {
      const { service } = setup([HUE_1, HUE_2, CM_1]);
      const res = await service.handleConversation('Nhập số đo nước', tech, undefined, undefined, [
        { sender: 'user', text: 'Tình hình trại Cà Mau thế nào?' },
      ]);
      expect(res.actionDraft?.collectedData).toMatchObject({ farmId: 'farm-cm', pondId: 'cm-1' });
    });

    it('đổi sang trại khác ở lượt sau -> bỏ ao cũ không thuộc trại mới', async () => {
      const { service } = setup([HUE_1, HUE_2, CM_1]);
      const res = await service.handleConversation('à không, trại Tôm Huế', tech, {
        pondId: 'cm-1',
        farmId: 'farm-cm',
        ph: 8.2,
      });
      expect(res.actionDraft?.collectedData).toMatchObject({ farmId: 'farm-hue', ph: 8.2 });
      expect(res.actionDraft?.collectedData.pondId).toBeUndefined();
    });

    it('danh sách ao trong thẻ có farmId để lọc theo trại', async () => {
      const { service } = setup([HUE_1, CM_1]);
      const res = await service.handleConversation('Nhập số đo nước ao 1 trại Tôm Huế', tech);
      expect(res.actionDraft?.pondOptions?.map((p: any) => p.farmId)).toEqual(['farm-hue', 'farm-cm']);
    });
  });

  it('tin nhắn cũ liệt kê nhiều ao -> không tự đoán ao', async () => {
    const { service } = setup([POND, { ...POND, id: 'pond-2', name: 'Ao 2' }]);
    const res = await service.handleConversation('Nhập số đo nước', tech, undefined, undefined, [
      { sender: 'ai', text: 'Bạn phụ trách Ao 1 và Ao 2' },
    ]);
    expect(res.actionDraft?.collectedData.pondId).toBeUndefined();
    expect(res.actionDraft?.missingFields).toContain('pondId');
  });

  it('quá số chữ số thập phân cho phép -> bị bỏ và báo lại', async () => {
    const { service } = setup();
    const res = await service.handleConversation(
      'Ao 1 nhiệt độ 29, pH 8.333, DO 5, mặn 15, kiềm 120, NH3 0.1234, độ trong 35',
      tech,
    );
    expect(res.actionDraft?.missingFields).toEqual(['ph', 'nh3']);
    expect(res.answer).toContain('tối đa 2 chữ số thập phân');
    expect(res.answer).toContain('tối đa 3 chữ số thập phân');
  });

  it('giá trị ngoài giới hạn hợp lệ bị bỏ và báo lại', async () => {
    const { service } = setup();
    const res = await service.handleConversation(
      'Ao 1 nhiệt độ 29, pH 14, DO 5, mặn 15, kiềm 120, NH3 0.1, độ trong 35',
      tech,
    );
    expect(res.actionDraft?.type).toBe('SLOT_FILLING');
    expect(res.actionDraft?.missingFields).toEqual(['ph']);
    expect(res.answer).toContain('ngoài giới hạn hợp lệ');
  });

  it('nhiều ao -> hỏi chọn ao khi tin nhắn không nêu ao', async () => {
    const { service } = setup([
      POND,
      { ...POND, id: 'pond-2', name: 'Ao 2' },
    ]);
    const res = await service.handleConversation(
      'nhiệt độ 29, pH 8.3, DO 5.2, mặn 15, kiềm 120, NH3 0.1, độ trong 35',
      tech,
    );
    expect(res.actionDraft?.missingFields).toEqual(['pondId']);
    expect(res.actionDraft?.quickSuggestions).toEqual(['Ao 1', 'Ao 2']);
  });
});

describe('WaterRecordAgentService – lưu bản ghi', () => {
  const data = {
    pondId: 'pond-1',
    recordTime: new Date(Date.now() - 60_000).toISOString(),
    temperature: 29,
    ph: 8.3,
    dissolvedOxygen: 5.2,
    salinity: 15,
    alkalinity: 120,
    nh3: 0.1,
    transparency: 35,
  };

  it('Kỹ thuật viên lưu qua WaterQualityService (kiểm quyền + thông báo dùng chung)', async () => {
    const { service, waterQualityService } = setup();
    const res = await service.execute(data, tech);
    expect(waterQualityService.create).toHaveBeenCalledWith(
      tech,
      expect.objectContaining({ pondId: 'pond-1', ph: 8.3, note: 'Nhập qua Trợ lý AI' }),
    );
    expect(res).toMatchObject({ success: true, type: 'WATER_QUALITY', entity: { id: 'wq-1', farmId: 'farm-1' } });
  });

  it('role khác Kỹ thuật viên bị chặn', async () => {
    const { service, waterQualityService } = setup();
    await expect(
      service.execute(data, { userId: 'm', role: 'FARM_MANAGER' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(waterQualityService.create).not.toHaveBeenCalled();
  });

  it('dữ liệu ngoài giới hạn bị chặn trước khi lưu', async () => {
    const { service, waterQualityService } = setup();
    await expect(service.execute({ ...data, ph: 12 }, tech)).rejects.toThrow('nằm ngoài giới hạn hợp lệ (5 - 10)');
    expect(waterQualityService.create).not.toHaveBeenCalled();
  });

  it('báo gộp mọi lỗi một lần: thiếu ao, thiếu chỉ số, chữ, thập phân, tương lai, ghi chú dài', async () => {
    const { service, waterQualityService } = setup();
    const err = await service
      .execute(
        {
          ...data,
          pondId: '',
          salinity: undefined,
          ph: 'abc',
          nh3: 0.1234,
          h2s: -1,
          recordTime: new Date(Date.now() + 3_600_000).toISOString(),
          note: 'x'.repeat(501),
        },
        tech,
      )
      .catch((e) => e);
    const msg = String(err.message);
    expect(msg).toContain('Chưa chọn ao nuôi');
    expect(msg).toContain('Độ mặn (‰): chưa nhập');
    expect(msg).toContain('"abc" không phải số hợp lệ');
    expect(msg).toContain('tối đa 3 chữ số thập phân');
    expect(msg).toContain('H2S (mg/L) = -1 nằm ngoài giới hạn');
    expect(msg).toContain('tương lai');
    expect(msg).toContain('Ghi chú tối đa 500 ký tự');
    expect(waterQualityService.create).not.toHaveBeenCalled();
  });

  it('chấp nhận số dạng chuỗi có dấu phẩy thập phân', async () => {
    const { service, waterQualityService } = setup();
    await service.execute({ ...data, ph: '8,3', nh3: '0,05' }, tech);
    expect(waterQualityService.create).toHaveBeenCalledWith(
      tech,
      expect.objectContaining({ ph: 8.3, nh3: 0.05 }),
    );
  });
});

describe('AgentActionService – định tuyến nhập số đo nước', () => {
  const build = (waterAgent: any) =>
    new AgentActionService(
      { farm: { findMany: jest.fn().mockResolvedValue([]) } } as any,
      { getAccessibleFarmIds: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
      {} as any,
      {} as any,
      waterAgent,
    );

  it('Kỹ thuật viên -> chuyển sang bộ nhập số đo nước', async () => {
    const waterAgent = { handleConversation: jest.fn().mockResolvedValue({ isAgentAction: true, answer: 'x' }) };
    await build(waterAgent).handleAgentConversation(FULL, tech);
    expect(waterAgent.handleConversation).toHaveBeenCalledWith(FULL, tech, undefined, undefined, undefined);
  });

  it('Quản lý yêu cầu nhập số đo -> được giải thích chỉ KTV nhập', async () => {
    const waterAgent = { handleConversation: jest.fn() };
    const res = await build(waterAgent).handleAgentConversation(FULL, {
      userId: 'm',
      role: 'FARM_MANAGER',
    } as any);
    expect(res?.answer).toContain('Kỹ thuật viên');
    expect(waterAgent.handleConversation).not.toHaveBeenCalled();
  });

  it('Câu hỏi chen ngang khi đang nhập -> nhường cho luồng tư vấn', async () => {
    const waterAgent = { handleConversation: jest.fn() };
    const res = await build(waterAgent).handleAgentConversation(
      'DO thấp thì nên làm gì?',
      tech,
      undefined,
      { intent: 'RECORD_WATER_QUALITY', collectedData: { ph: 8 } },
    );
    expect(res).toBeNull();
    expect(waterAgent.handleConversation).not.toHaveBeenCalled();
  });
});
