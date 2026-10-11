import { generateHarvestReview } from './crop-review.generator.js';

describe('generateHarvestReview', () => {
  const current = {
    initialShrimpCount: 100_000,
    targetHarvestSize: 40,
    targetSurvivalRate: 75,
    actualHarvestKg: 2_000,
    actualHarvestRevenue: 240_000_000,
    actualHarvestCost: 125_000_000,
    actualHarvestProfit: 115_000_000,
    actualHarvestFcr: 1.3,
    actualHarvestSurvivalRate: 80,
  };

  it('generates factual evaluation from harvest results and targets', () => {
    const result = generateHarvestReview(current, null);

    expect(result.evaluation).toContain('2.000 kg');
    expect(result.evaluation).toContain('vượt mục tiêu');
    expect(result.evaluation).toContain('FCR thực tế là 1,3');
    expect(result.lessonsLearned).toContain('Chưa có vụ thu hoạch trước');
  });

  it('compares with the previous crop without inventing a cause', () => {
    const result = generateHarvestReview(current, {
      actualHarvestKg: 1_800,
      actualHarvestProfit: 100_000_000,
      actualHarvestFcr: 1.4,
      actualHarvestSurvivalRate: 76,
    });

    expect(result.lessonsLearned).toContain('lợi nhuận tăng 15%');
    expect(result.lessonsLearned).toContain('FCR cải thiện 0,1');
    expect(result.lessonsLearned).toContain('chưa đủ để kết luận nguyên nhân');
  });

  it('recommends reviewing evidence when targets worsen', () => {
    const result = generateHarvestReview({
      ...current,
      actualHarvestKg: 1_500,
      actualHarvestProfit: -10_000_000,
      actualHarvestFcr: 1.6,
      actualHarvestSurvivalRate: 60,
    }, {
      actualHarvestKg: 1_800,
      actualHarvestProfit: 20_000_000,
      actualHarvestFcr: 1.4,
      actualHarvestSurvivalRate: 70,
    });

    expect(result.nextRecommendation).toContain('Rà soát giá bán');
    expect(result.nextRecommendation).toContain('nhật ký môi trường');
    expect(result.nextRecommendation).toContain('nhật ký cho ăn');
  });
});
