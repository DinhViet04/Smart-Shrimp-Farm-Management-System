import { sortPondsActiveFirst } from './pond-order';

describe('sortPondsActiveFirst', () => {
  it('ao đang nuôi lên trước, ao trống xuống sau; trong nhóm sắp theo tên tự nhiên', () => {
    const ponds = [
      { id: '1', name: 'Ao A10', farmId: 'f1' },
      { id: '2', name: 'Ao A2', farmId: 'f1' },
      { id: '3', name: 'Ao A1', farmId: 'f1' },
      { id: '4', name: 'Ao B1', farmId: 'f2' },
      { id: '5', name: 'Ao A3', farmId: 'f1' },
    ];
    const sorted = sortPondsActiveFirst(ponds, new Set(['1', '5', '4']));

    expect(sorted.map((p) => p.name)).toEqual(['Ao A3', 'Ao A10', 'Ao B1', 'Ao A1', 'Ao A2']);
    // Lọc theo trang trại vẫn giữ thứ tự: ao đang nuôi trước
    expect(sorted.filter((p) => p.farmId === 'f1').map((p) => p.name)).toEqual(['Ao A3', 'Ao A10', 'Ao A1', 'Ao A2']);
    // Không thay đổi mảng gốc
    expect(ponds[0].name).toBe('Ao A10');
  });
});
