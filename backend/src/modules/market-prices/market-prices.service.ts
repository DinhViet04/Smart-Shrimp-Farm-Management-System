import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface SeedMarketPriceResult {
  code: string;
  name: string;
  species: string;
  sizeStage: string;
  price: number;
  unit: string;
  source: string;
  sourceUrl: string;
  updatedAt: Date;
  isLive: boolean;
  note?: string;
}

export interface CommercialShrimpSize {
  code: string;
  size: number;
  name: string;
  price: number;
  unit: string;
  source: string;
  sourceUrl: string;
  updatedAt: Date;
}

export interface ShrimpPriceCalculation {
  targetSize: number;
  price: number;
  unit: string;
  isInterpolated: boolean;
  lowerBound?: { size: number; price: number };
  upperBound?: { size: number; price: number };
  source: string;
  sourceUrl: string;
  updatedAt: Date;
}

export const DEFAULT_SHRIMP_SIZES: Array<{ code: string; size: number; price: number; name: string }> = [
  { code: 'THE20', size: 20, price: 200000, name: 'Tôm thẻ 20 con/kg tại ao' },
  { code: 'THE30', size: 30, price: 155000, name: 'Tôm thẻ 30 con/kg tại ao' },
  { code: 'THE40', size: 40, price: 132000, name: 'Tôm thẻ 40 con/kg tại ao' },
  { code: 'THE50', size: 50, price: 122000, name: 'Tôm thẻ 50 con/kg tại ao' },
  { code: 'THE60', size: 60, price: 113000, name: 'Tôm thẻ 60 con/kg tại ao' },
  { code: 'THE70', size: 70, price: 110000, name: 'Tôm thẻ 70 con/kg tại ao' },
  { code: 'THE80', size: 80, price: 107000, name: 'Tôm thẻ 80 con/kg tại ao' },
  { code: 'THE90', size: 90, price: 104000, name: 'Tôm thẻ 90 con/kg tại ao' },
  { code: 'THE100', size: 100, price: 100000, name: 'Tôm thẻ 100 con/kg tại ao' },
  { code: 'THE150', size: 150, price: 64000, name: 'Tôm thẻ 150 con/kg tại ao' },
];

@Injectable()
export class MarketPricesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketPricesService.name);

  // Mặc định giống tôm thẻ chân trắng Post 10
  private readonly SEED_CODE = 'THEP10';
  private readonly SEED_NAME = 'Giống tôm thẻ chân trắng Post 10';
  private readonly SPECIES_NAME = 'Tôm thẻ chân trắng';
  private readonly SIZE_STAGE = 'Post 10 (P10)';
  private readonly DEFAULT_SEED_PRICE = 70; // 70 đ/con
  private readonly SEED_UNIT = 'đ/CON';
  private readonly COMMERCIAL_UNIT = 'đ/KG';
  private readonly SOURCE_NAME = 'tepbac.com';
  private readonly SEED_URL = 'https://tepbac.com/gia-thuy-san/giong-tom-the-chan-trang-p10';
  private readonly COMMERCIAL_URL = 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27';

  // Cache duration: 4 giờ
  private readonly CACHE_TTL_MS = 4 * 60 * 60 * 1000;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Chạy đồng bộ giá thị trường khi khởi động server
    this.syncAllPricesFromTepbac().catch((err) => {
      this.logger.warn(`Initial sync of shrimp market prices failed: ${err.message}`);
    });

    // Tự động cập nhật mỗi 6 tiếng
    this.syncTimer = setInterval(
      () => {
        this.logger.log('Triggering periodic market price update from tepbac.com...');
        this.syncAllPricesFromTepbac().catch((err) => {
          this.logger.warn(`Periodic market price update failed: ${err.message}`);
        });
      },
      6 * 60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // =========================================================================
  // 1. GIÁ TÔM GIỐNG (SEED SHRIMP)
  // =========================================================================

  async getSeedPrice(forceRefresh = false): Promise<SeedMarketPriceResult> {
    try {
      const cached = await this.prisma.marketPrice.findUnique({
        where: { code: this.SEED_CODE },
      });

      const now = new Date().getTime();
      const isFresh =
        cached &&
        !forceRefresh &&
        now - new Date(cached.lastFetched).getTime() < this.CACHE_TTL_MS;

      if (isFresh && cached) {
        return {
          code: cached.code,
          name: cached.name,
          species: this.SPECIES_NAME,
          sizeStage: this.SIZE_STAGE,
          price: cached.price,
          unit: cached.unit,
          source: cached.source,
          sourceUrl: cached.sourceUrl || this.SEED_URL,
          updatedAt: cached.lastFetched,
          isLive: true,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed reading seed market price from DB: ${err.message}`);
    }

    await this.syncAllPricesFromTepbac();

    try {
      const refreshed = await this.prisma.marketPrice.findUnique({
        where: { code: this.SEED_CODE },
      });
      if (refreshed) {
        return {
          code: refreshed.code,
          name: refreshed.name,
          species: this.SPECIES_NAME,
          sizeStage: this.SIZE_STAGE,
          price: refreshed.price,
          unit: refreshed.unit,
          source: refreshed.source,
          sourceUrl: refreshed.sourceUrl || this.SEED_URL,
          updatedAt: refreshed.lastFetched,
          isLive: true,
        };
      }
    } catch (ignore) {}

    return {
      code: this.SEED_CODE,
      name: this.SEED_NAME,
      species: this.SPECIES_NAME,
      sizeStage: this.SIZE_STAGE,
      price: this.DEFAULT_SEED_PRICE,
      unit: this.SEED_UNIT,
      source: this.SOURCE_NAME,
      sourceUrl: this.SEED_URL,
      updatedAt: new Date(),
      isLive: false,
      note: 'Giá mặc định chuẩn Tôm thẻ chân trắng Post 10 (70 đ/con)',
    };
  }

  // =========================================================================
  // 2. GIÁ TÔM THƯƠNG PHẨM THEO SIZE (COMMERCIAL SIZES & INTERPOLATION)
  // =========================================================================

  /**
   * Lấy danh sách giá tôm thương phẩm theo các mốc size chuẩn (20, 30, 40, ...)
   */
  async getCommercialPrices(forceRefresh = false): Promise<CommercialShrimpSize[]> {
    try {
      const records = await this.prisma.marketPrice.findMany({
        where: { category: 'SHRIMP_COMMERCIAL' },
        orderBy: { code: 'asc' },
      });

      const now = new Date().getTime();
      const hasFresh =
        records.length > 0 &&
        !forceRefresh &&
        now - new Date(records[0].lastFetched).getTime() < this.CACHE_TTL_MS;

      if (hasFresh) {
        return records.map((r) => {
          const sizeMatch = r.code.match(/THE(\d+)/i);
          const sizeVal = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
          return {
            code: r.code,
            size: sizeVal,
            name: r.name,
            price: r.price,
            unit: r.unit,
            source: r.source,
            sourceUrl: r.sourceUrl || this.COMMERCIAL_URL,
            updatedAt: r.lastFetched,
          };
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed reading commercial shrimp prices from DB: ${err.message}`);
    }

    if (forceRefresh) {
      await this.syncAllPricesFromTepbac();
    }

    // Fallback sang cấu hình mặc định chuẩn thị trường
    return DEFAULT_SHRIMP_SIZES.map((s) => ({
      code: s.code,
      size: s.size,
      name: s.name,
      price: s.price,
      unit: this.COMMERCIAL_UNIT,
      source: this.SOURCE_NAME,
      sourceUrl: this.COMMERCIAL_URL,
      updatedAt: new Date(),
    }));
  }

  /**
   * Tính giá tiền 1kg tôm dựa trên size thu hoạch (hỗ trợ cả size lẻ 32, 48,... bằng nội suy tuyến tính)
   */
  async calculatePriceForSize(targetSize: number): Promise<ShrimpPriceCalculation> {
    const size = Math.max(1, targetSize);
    const standardSizes = await this.getCommercialPrices(false);

    const mapped = standardSizes
      .map((s) => ({ size: s.size, price: s.price }))
      .filter((s) => s.size > 0 && s.price > 0)
      .sort((a, b) => a.size - b.size);

    // Thuật toán nội suy giá theo size tôm (tôm size càng nhỏ con/kg thì tôm càng to -> giá càng đắt)
    let calculatedPrice = 130000;
    let isInterpolated = false;
    let lowerBound: { size: number; price: number } | undefined;
    let upperBound: { size: number; price: number } | undefined;

    // 1. Trường hợp khớp size chẵn có sẵn
    const exact = mapped.find((s) => s.size === size);
    if (exact) {
      calculatedPrice = exact.price;
      isInterpolated = false;
    } else if (size < mapped[0].size) {
      // 2. Tôm siêu to (size nhỏ hơn mốc nhỏ nhất, ví dụ < 20 con/kg)
      const s1 = mapped[0];
      const s2 = mapped[1] || s1;
      const slope = s2.size !== s1.size ? (s2.price - s1.price) / (s2.size - s1.size) : 0;
      calculatedPrice = Math.round((s1.price + (size - s1.size) * slope) / 100) * 100;
      calculatedPrice = Math.max(calculatedPrice, s1.price);
      isInterpolated = true;
      lowerBound = s1;
      upperBound = s2;
    } else if (size > mapped[mapped.length - 1].size) {
      // 3. Tôm nhỏ hơn mốc lớn nhất (size > 150 con/kg)
      const last = mapped[mapped.length - 1];
      const prev = mapped[mapped.length - 2] || last;
      const slope = last.size !== prev.size ? (last.price - prev.price) / (last.size - prev.size) : 0;
      calculatedPrice = Math.round((last.price + (size - last.size) * slope) / 100) * 100;
      calculatedPrice = Math.max(calculatedPrice, 40000); // Giá sàn
      isInterpolated = true;
      lowerBound = prev;
      upperBound = last;
    } else {
      // 4. Size lẻ nằm giữa 2 mốc (ví dụ size 32 nằm giữa 30 và 40, size 48 nằm giữa 40 và 50)
      for (let i = 0; i < mapped.length - 1; i++) {
        const s1 = mapped[i];
        const s2 = mapped[i + 1];
        if (size >= s1.size && size <= s2.size) {
          const t = (size - s1.size) / (s2.size - s1.size);
          const raw = s1.price + t * (s2.price - s1.price);
          // Làm tròn đến 100 đồng
          calculatedPrice = Math.round(raw / 100) * 100;
          isInterpolated = true;
          lowerBound = s1;
          upperBound = s2;
          break;
        }
      }
    }

    return {
      targetSize: size,
      price: calculatedPrice,
      unit: this.COMMERCIAL_UNIT,
      isInterpolated,
      lowerBound,
      upperBound,
      source: this.SOURCE_NAME,
      sourceUrl: this.COMMERCIAL_URL,
      updatedAt: new Date(),
    };
  }

  // =========================================================================
  // 3. CRAWLER & SYNC TỪ TÉP BẠC
  // =========================================================================

  /**
   * Crawl toàn bộ giá tôm giống và giá tôm thương phẩm từ Tép Bạc
   */
  async syncAllPricesFromTepbac(): Promise<void> {
    this.logger.log('Crawling shrimp market prices from tepbac.com...');
    try {
      // Crawl trang danh sách tôm
      const html = await this.fetchWithTimeout('https://tepbac.com/gia-thuy-san/gia/tom', 6000);
      if (!html) return;

      // 1. Crawl giá giống THEP10
      const seedParsed = this.parseSeedPrice(html);
      if (seedParsed && seedParsed > 0) {
        await this.prisma.marketPrice.upsert({
          where: { code: this.SEED_CODE },
          update: {
            price: seedParsed,
            lastFetched: new Date(),
            sourceUrl: this.SEED_URL,
          },
          create: {
            code: this.SEED_CODE,
            name: this.SEED_NAME,
            category: 'SHRIMP_SEED',
            unit: this.SEED_UNIT,
            price: seedParsed,
            source: this.SOURCE_NAME,
            sourceUrl: this.SEED_URL,
            lastFetched: new Date(),
          },
        });
      }

      // 2. Crawl các size tôm thương phẩm THE20 -> THE150
      for (const def of DEFAULT_SHRIMP_SIZES) {
        const price = this.parseCommercialPrice(html, def.code, def.size);
        const finalPrice = price || def.price;
        await this.prisma.marketPrice.upsert({
          where: { code: def.code },
          update: {
            price: finalPrice,
            lastFetched: new Date(),
            sourceUrl: this.COMMERCIAL_URL,
          },
          create: {
            code: def.code,
            name: def.name,
            category: 'SHRIMP_COMMERCIAL',
            unit: this.COMMERCIAL_UNIT,
            price: finalPrice,
            source: this.SOURCE_NAME,
            sourceUrl: this.COMMERCIAL_URL,
            lastFetched: new Date(),
          },
        });
      }

      this.logger.log('Successfully synced all shrimp prices from Tepbac to database.');
    } catch (err: any) {
      this.logger.warn(`Failed to crawl shrimp prices from Tepbac: ${err.message}`);
    }
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en;q=0.9',
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseSeedPrice(html: string): number | null {
    try {
      const m = html.match(/(?:THEP10|Post\s*10)[\s\S]{1,500}?(\d{2,3})\s*(?:đ|d)\s*\/\s*(?:CON|con)/i);
      if (m) {
        const p = parseFloat(m[1]);
        if (!isNaN(p) && p >= 30 && p <= 200) return p;
      }
    } catch {}
    return null;
  }

  private parseCommercialPrice(html: string, code: string, size: number): number | null {
    try {
      // Regex tìm theo mã loài (e.g. THE20, THE30,...) hoặc tên tôm thẻ + size
      const codeRegex = new RegExp(
        `(?:${code}|Tôm thẻ\\s*\\(?${size}\\s*con\\/kg\\)?)[\s\S]{1,400}?(\\d{2,3}(?:[.,]\\d{3})+|\\d{5,6})\\s*(?:đ|d)?\\s*\\/\\s*(?:KG|kg)`,
        'i',
      );
      const match = html.match(codeRegex);
      if (match) {
        const raw = match[1].replace(/[.,]/g, '');
        const val = parseFloat(raw);
        if (!isNaN(val) && val >= 40000 && val <= 400000) {
          return val;
        }
      }
    } catch {}
    return null;
  }
}
