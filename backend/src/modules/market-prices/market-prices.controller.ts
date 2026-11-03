import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  MarketPricesService,
  SeedMarketPriceResult,
  CommercialShrimpSize,
  ShrimpPriceCalculation,
} from './market-prices.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('market-prices')
export class MarketPricesController {
  constructor(private readonly marketPricesService: MarketPricesService) {}

  /**
   * Lấy giá tôm giống thị trường hiện tại (mặc định Tôm thẻ chân trắng Post 10 từ Tép Bạc)
   */
  @Get('shrimp-seed')
  async getShrimpSeedPrice(): Promise<SeedMarketPriceResult> {
    return this.marketPricesService.getSeedPrice(false);
  }

  /**
   * Lấy danh sách các mốc giá tôm thương phẩm theo size chuẩn (Size 20, 30, 40, ...)
   */
  @Get('commercial-sizes')
  async getCommercialSizes(): Promise<CommercialShrimpSize[]> {
    return this.marketPricesService.getCommercialPrices(false);
  }

  /**
   * Tính giá tôm 1kg theo size thu hoạch (hỗ trợ size lẻ như 32, 48,... bằng công thức nội suy thị trường)
   */
  @Get('calculate-harvest-price')
  async calculateHarvestPrice(
    @Query('size') sizeStr: string,
  ): Promise<ShrimpPriceCalculation> {
    const size = parseFloat(sizeStr) || 30;
    return this.marketPricesService.calculatePriceForSize(size);
  }

  /**
   * Bắt buộc làm mới toàn bộ giá thị trường (Tép Bạc)
   */
  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refreshAllPrices(): Promise<{ success: boolean; message: string }> {
    await this.marketPricesService.syncAllPricesFromTepbac();
    return {
      success: true,
      message: 'Đã cập nhật toàn bộ giá thị trường thủy sản từ Tép Bạc thành công!',
    };
  }
}
