export interface HarvestReviewMetrics {
  initialShrimpCount: number;
  targetHarvestSize: number | null;
  targetSurvivalRate: number | null;
  actualHarvestKg: number;
  actualHarvestRevenue: number;
  actualHarvestCost: number;
  actualHarvestProfit: number;
  actualHarvestFcr: number | null;
  actualHarvestSurvivalRate: number;
}

export interface PreviousHarvestMetrics {
  actualHarvestKg: number | null;
  actualHarvestProfit: number | null;
  actualHarvestFcr: number | null;
  actualHarvestSurvivalRate: number | null;
}

export interface GeneratedHarvestReview {
  evaluation: string;
  lessonsLearned: string;
  nextRecommendation: string;
}

const number = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits }).format(value);

const money = (value: number) => `${number(Math.round(value), 0)} đ`;

const signedChange = (current: number, previous: number, unit: string) => {
  const difference = current - previous;
  return `${difference >= 0 ? 'tăng' : 'giảm'} ${number(Math.abs(difference))}${unit}`;
};

export function generateHarvestReview(
  current: HarvestReviewMetrics,
  previous: PreviousHarvestMetrics | null,
): GeneratedHarvestReview {
  const margin = current.actualHarvestRevenue > 0
    ? (current.actualHarvestProfit / current.actualHarvestRevenue) * 100
    : 0;
  const evaluation = [
    `Vụ nuôi thu ${number(current.actualHarvestKg)} kg, doanh thu ${money(current.actualHarvestRevenue)}, ${current.actualHarvestProfit >= 0 ? 'lợi nhuận' : 'lỗ'} ${money(Math.abs(current.actualHarvestProfit))} và biên lợi nhuận ${number(margin)}%.`,
    `Tỷ lệ sống đạt ${number(current.actualHarvestSurvivalRate)}%${current.targetSurvivalRate !== null ? `, ${signedChange(current.actualHarvestSurvivalRate, current.targetSurvivalRate, ' điểm phần trăm')} so với mục tiêu ${number(current.targetSurvivalRate)}%` : ''}.`,
    current.actualHarvestFcr !== null
      ? `FCR thực tế là ${number(current.actualHarvestFcr, 2)}.`
      : 'Chưa có khối lượng thức ăn để tính FCR.',
  ];

  const targetHarvestKg = current.targetHarvestSize && current.targetSurvivalRate
    ? current.initialShrimpCount * (current.targetSurvivalRate / 100) / current.targetHarvestSize
    : null;
  if (targetHarvestKg !== null) {
    const differencePercent = targetHarvestKg > 0
      ? ((current.actualHarvestKg - targetHarvestKg) / targetHarvestKg) * 100
      : 0;
    evaluation.splice(1, 0, `Sản lượng ${differencePercent >= 0 ? 'vượt' : 'thấp hơn'} mục tiêu ${number(Math.abs(differencePercent))}% (${number(targetHarvestKg)} kg).`);
  }

  const comparison: string[] = [];
  if (previous) {
    if (previous.actualHarvestProfit !== null) {
      if (previous.actualHarvestProfit > 0) {
        const change = ((current.actualHarvestProfit - previous.actualHarvestProfit) / previous.actualHarvestProfit) * 100;
        comparison.push(`lợi nhuận ${change >= 0 ? 'tăng' : 'giảm'} ${number(Math.abs(change))}%`);
      } else {
        comparison.push(`lợi nhuận ${signedChange(current.actualHarvestProfit, previous.actualHarvestProfit, ' đ')}`);
      }
    }
    if (current.actualHarvestFcr !== null && previous.actualHarvestFcr !== null) {
      const difference = current.actualHarvestFcr - previous.actualHarvestFcr;
      comparison.push(`FCR ${difference <= 0 ? 'cải thiện' : 'tăng'} ${number(Math.abs(difference), 2)}`);
    }
    if (previous.actualHarvestSurvivalRate !== null) {
      comparison.push(`tỷ lệ sống ${signedChange(current.actualHarvestSurvivalRate, previous.actualHarvestSurvivalRate, ' điểm phần trăm')}`);
    }
  }
  const lessonsLearned = comparison.length > 0
    ? `So với vụ thu hoạch gần nhất cùng ao: ${comparison.join('; ')}. Đây là biến động số liệu, chưa đủ để kết luận nguyên nhân nếu không có nhật ký vận hành liên quan.`
    : 'Chưa có vụ thu hoạch trước cùng ao để đối chiếu. Kết quả này sẽ được dùng làm mốc tham chiếu cho vụ tiếp theo.';

  const recommendations: string[] = [];
  if (current.actualHarvestProfit < 0) {
    recommendations.push('Rà soát giá bán và từng nhóm chi phí trước khi lập kế hoạch vụ mới');
  }
  if (current.targetSurvivalRate !== null && current.actualHarvestSurvivalRate < current.targetSurvivalRate) {
    recommendations.push('đối chiếu nhật ký môi trường, dịch bệnh và hao hụt để cải thiện tỷ lệ sống');
  }
  if (previous?.actualHarvestFcr !== null && previous?.actualHarvestFcr !== undefined && current.actualHarvestFcr !== null && current.actualHarvestFcr > previous.actualHarvestFcr) {
    recommendations.push('rà soát nhật ký cho ăn và dữ liệu sinh khối vì FCR tăng so với vụ trước');
  }
  if (targetHarvestKg !== null && current.actualHarvestKg < targetHarvestKg) {
    recommendations.push('kiểm tra lại mục tiêu sản lượng, mật độ thả và kế hoạch tăng trưởng');
  }
  if (recommendations.length === 0) {
    recommendations.push('Dùng kết quả vụ này làm mốc tham chiếu và tiếp tục duy trì quy trình đang có dữ liệu chứng minh hiệu quả');
  }

  return {
    evaluation: evaluation.join(' '),
    lessonsLearned,
    nextRecommendation: `${recommendations.join('; ')}. Khuyến nghị cần được quản lý xác nhận cùng nhật ký thực địa trước khi áp dụng.`,
  };
}
