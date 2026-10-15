import { Injectable, Logger } from '@nestjs/common';

export interface WeatherData {
  cityName: string;
  temperature: number;         // Nhiệt độ không khí (°C)
  feelsLike: number;           // Nhiệt độ cảm giác (°C)
  humidity: number;            // Độ ẩm (%)
  description: string;         // Mô tả thời tiết (Trời nắng, Mưa rào, Nhiều mây...)
  windSpeed: number;           // Tốc độ gió (m/s)
  windDegree?: number;         // Hướng gió (độ)
  cloudiness: number;          // Độ che phủ mây (%)
  rain1h: number;              // Lượng mưa (mm)
  pressure: number;            // Áp suất khí quyển (hPa)
  isRaining: boolean;          // Đang mưa hay không
  isHot: boolean;              // Nắng gắt (> 34°C)
  isCold: boolean;             // Lạnh (< 20°C)
  isWindy: boolean;            // Gió mạnh (> 9 m/s)
  provider: string;            // 'Open-Meteo' | 'wttr.in' | 'OpenWeatherMap'
  recordedAt: string;          // Thời điểm ghi nhận
}

interface CityCoord {
  name: string;
  lat: number;
  lon: number;
}

// Từ điển tọa độ các tỉnh thành & vùng nuôi tôm trọng điểm Việt Nam
const VIETNAM_PROVINCES: Record<string, CityCoord> = {
  // Miền Trung & Huế (Khắc phục trường hợp người dùng hỏi về Huế)
  'huế': { name: 'Thừa Thiên Huế', lat: 16.4619, lon: 107.5955 },
  'hue': { name: 'Thừa Thiên Huế', lat: 16.4619, lon: 107.5955 },
  'thừa thiên huế': { name: 'Thừa Thiên Huế', lat: 16.4619, lon: 107.5955 },
  'thua thien hue': { name: 'Thừa Thiên Huế', lat: 16.4619, lon: 107.5955 },
  'đà nẵng': { name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022 },
  'da nang': { name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022 },
  'quảng nam': { name: 'Quảng Nam', lat: 15.5994, lon: 108.0000 },
  'quang nam': { name: 'Quảng Nam', lat: 15.5994, lon: 108.0000 },
  'quảng ngãi': { name: 'Quảng Ngãi', lat: 15.1205, lon: 108.7923 },
  'quang ngai': { name: 'Quảng Ngãi', lat: 15.1205, lon: 108.7923 },
  'quảng bình': { name: 'Quảng Bình', lat: 17.4678, lon: 106.6022 },
  'quang binh': { name: 'Quảng Bình', lat: 17.4678, lon: 106.6022 },
  'quảng trị': { name: 'Quảng Trị', lat: 16.7500, lon: 107.1856 },
  'quang tri': { name: 'Quảng Trị', lat: 16.7500, lon: 107.1856 },
  'hà tĩnh': { name: 'Hà Tĩnh', lat: 18.3435, lon: 105.9058 },
  'ha tinh': { name: 'Hà Tĩnh', lat: 18.3435, lon: 105.9058 },
  'nghệ an': { name: 'Nghệ An', lat: 19.2342, lon: 104.9200 },
  'nghe an': { name: 'Nghệ An', lat: 19.2342, lon: 104.9200 },
  'thanh hóa': { name: 'Thanh Hóa', lat: 19.8067, lon: 105.7852 },
  'thanh hoa': { name: 'Thanh Hóa', lat: 19.8067, lon: 105.7852 },
  'bình định': { name: 'Bình Định', lat: 14.1667, lon: 108.9000 },
  'binh dinh': { name: 'Bình Định', lat: 14.1667, lon: 108.9000 },
  'quy nhơn': { name: 'Quy Nhơn', lat: 13.7820, lon: 109.2194 },
  'phú yên': { name: 'Phú Yên', lat: 13.0882, lon: 109.0926 },
  'khánh hòa': { name: 'Khánh Hòa', lat: 12.2388, lon: 109.1967 },
  'nha trang': { name: 'Nha Trang', lat: 12.2388, lon: 109.1967 },
  'ninh thuận': { name: 'Ninh Thuận', lat: 11.6667, lon: 108.9167 },
  'bình thuận': { name: 'Bình Thuận', lat: 11.0904, lon: 108.0722 },
  'phan thiết': { name: 'Phan Thiết', lat: 10.9804, lon: 108.2615 },

  // Miền Tây Nam Bộ (Trọng điểm nuôi tôm)
  'cà mau': { name: 'Cà Mau', lat: 9.1768, lon: 105.1524 },
  'ca mau': { name: 'Cà Mau', lat: 9.1768, lon: 105.1524 },
  'năm căn': { name: 'Năm Căn (Cà Mau)', lat: 8.7590, lon: 104.9929 },
  'đầm dơi': { name: 'Đầm Dơi (Cà Mau)', lat: 9.0436, lon: 105.2100 },
  'bạc liêu': { name: 'Bạc Liêu', lat: 9.2941, lon: 105.7278 },
  'bac lieu': { name: 'Bạc Liêu', lat: 9.2941, lon: 105.7278 },
  'giá rai': { name: 'Giá Rai (Bạc Liêu)', lat: 9.2319, lon: 105.4419 },
  'sóc trăng': { name: 'Sóc Trăng', lat: 9.6033, lon: 105.9800 },
  'soc trang': { name: 'Sóc Trăng', lat: 9.6033, lon: 105.9800 },
  'vĩnh châu': { name: 'Vĩnh Châu (Sóc Trăng)', lat: 9.3242, lon: 105.9739 },
  'trần đề': { name: 'Trần Đề (Sóc Trăng)', lat: 9.4890, lon: 106.1860 },
  'kiên giang': { name: 'Kiên Giang', lat: 10.0125, lon: 105.0809 },
  'kien giang': { name: 'Kiên Giang', lat: 10.0125, lon: 105.0809 },
  'rạch giá': { name: 'Rạch Giá (Kiên Giang)', lat: 10.0125, lon: 105.0809 },
  'phú quốc': { name: 'Phú Quốc', lat: 10.2899, lon: 103.9840 },
  'bến tre': { name: 'Bến Tre', lat: 10.2415, lon: 106.3758 },
  'ben tre': { name: 'Bến Tre', lat: 10.2415, lon: 106.3758 },
  'ba tri': { name: 'Ba Tri (Bến Tre)', lat: 10.0443, lon: 106.5902 },
  'bình đại': { name: 'Bình Đại (Bến Tre)', lat: 10.1919, lon: 106.7028 },
  'thạnh phú': { name: 'Thạnh Phú (Bến Tre)', lat: 9.9431, lon: 106.5292 },
  'trà vinh': { name: 'Trà Vinh', lat: 9.9347, lon: 106.3455 },
  'tra vinh': { name: 'Trà Vinh', lat: 9.9347, lon: 106.3455 },
  'duyên hải': { name: 'Duyên Hải (Trà Vinh)', lat: 9.6467, lon: 106.5167 },
  'tiền giang': { name: 'Tiền Giang', lat: 10.4287, lon: 106.3385 },
  'tien giang': { name: 'Tiền Giang', lat: 10.4287, lon: 106.3385 },
  'gò công': { name: 'Gò Công (Tiền Giang)', lat: 10.3556, lon: 106.6667 },
  'mỹ tho': { name: 'Mỹ Tho', lat: 10.3538, lon: 106.3610 },
  'long an': { name: 'Long An', lat: 10.6954, lon: 106.2431 },
  'cần thơ': { name: 'Cần Thơ', lat: 10.0452, lon: 105.7469 },
  'can tho': { name: 'Cần Thơ', lat: 10.0452, lon: 105.7469 },
  'hậu giang': { name: 'Hậu Giang', lat: 9.7844, lon: 105.4701 },
  'vĩnh long': { name: 'Vĩnh Long', lat: 10.2537, lon: 105.9722 },
  'an giang': { name: 'An Giang', lat: 10.5216, lon: 105.1259 },
  'đồng tháp': { name: 'Đồng Tháp', lat: 10.4638, lon: 105.6310 },

  // Miền Đông Nam Bộ & Miền Bắc
  'hồ chí minh': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'ho chi minh': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'sài gòn': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'sai gon': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'tp.hcm': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'cần giờ': { name: 'Cần Giờ (TP.HCM)', lat: 10.4114, lon: 106.9550 },
  'vũng tàu': { name: 'Vũng Tàu', lat: 10.3460, lon: 107.0843 },
  'bà rịa': { name: 'Bà Rịa - Vũng Tàu', lat: 10.4963, lon: 107.1685 },
  'hà nội': { name: 'Hà Nội', lat: 21.0285, lon: 105.8542 },
  'ha noi': { name: 'Hà Nội', lat: 21.0285, lon: 105.8542 },
  'hải phòng': { name: 'Hải Phòng', lat: 20.8449, lon: 106.6881 },
  'hai phong': { name: 'Hải Phòng', lat: 20.8449, lon: 106.6881 },
  'quảng ninh': { name: 'Quảng Ninh', lat: 21.0069, lon: 107.2925 },
  'quang ninh': { name: 'Quảng Ninh', lat: 21.0069, lon: 107.2925 },
  'móng cái': { name: 'Móng Cái (Quảng Ninh)', lat: 21.5273, lon: 107.9678 },
  'nam định': { name: 'Nam Định', lat: 20.4344, lon: 106.1800 },
  'thái bình': { name: 'Thái Bình', lat: 20.4463, lon: 106.3365 },
  'ninh bình': { name: 'Ninh Bình', lat: 20.2506, lon: 105.9745 },
};

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly openWeatherApiKey: string | null;
  private readonly cache: Map<string, { data: WeatherData; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // Cache 10 phút

  constructor() {
    this.openWeatherApiKey = process.env.OPENWEATHER_API_KEY || null;
    this.logger.log('Weather Engine initialized with Dual Realtime APIs: Open-Meteo + wttr.in (+ OpenWeatherMap fallback)');
  }

  /**
   * Kiểm tra câu hỏi của người dùng có thực sự hỏi về thời tiết hay không
   */
  isWeatherInquiry(question: string): boolean {
    if (!question) return false;
    const q = question.toLowerCase().trim();

    // 1. Nếu là câu hỏi kỹ thuật/phác đồ xử lý tình huống nuôi tôm (ví dụ "nếu trời bão...", "phải làm sao", "xử lý thế nào", "giảm ăn bao nhiêu",...)
    // thì đây là câu hỏi kỹ thuật nuôi tôm, KHÔNG PHẢI hỏi thời tiết thực tế
    const isTechnicalQuestion = [
      'phải như thế nào', 'như thế nào', 'the nao', 'làm sao', 'lam sao', 'làm gì', 'lam gi',
      'xử lý', 'xu ly', 'phòng ngừa', 'phong ngua', 'phác đồ', 'phac do',
      'cho ăn', 'cho an', 'giảm ăn', 'giam an', 'cắt cữ', 'cat cu',
      'bị sốc', 'bi soc', 'đục cơ', 'duc co', 'tôm', 'ao', 'nếu trời', 'khi trời', 'chuẩn bị gì',
    ].some((kw) => q.includes(kw));

    // 2. Các cụm từ hỏi TRỰC TIẾP về tình hình thời tiết thực tế / dự báo thời tiết
    const explicitWeatherInquiries = [
      'thời tiết hôm nay', 'thoi tiet hom nay',
      'thời tiết hiện tại', 'thoi tiet hien tai',
      'thời tiết ngày mai', 'thoi tiet ngay mai',
      'dự báo thời tiết', 'du bao thoi tiet',
      'dự báo', 'du bao',
      'thời tiết thế nào', 'thoi tiet the nao',
      'thời tiết ra sao', 'thoi tiet ra sao',
      'thời tiết sao', 'thoi tiet sao',
      'thời tiết ở', 'thoi tiet o',
      'thời tiết tại', 'thoi tiet tai',
      'thời tiết khu vực', 'thoi tiet khu vuc',
      'hôm nay trời có mưa không', 'hom nay troi co mua khong',
      'hôm nay có mưa không', 'hom nay co mua khong',
      'trời hôm nay thế nào', 'troi hom nay the nao',
      'nhiệt độ hôm nay', 'nhiet do hom nay',
      'nhiệt độ hiện tại', 'nhiet do hien tai',
      'nhiệt độ ngoài trời', 'nhiet do ngoai troi',
      'độ ẩm không khí', 'do am khong khi',
      'có bão không', 'co bao khong',
      'sắp có bão không', 'sap co bao khong',
      'weather', 'forecast',
    ];

    if (explicitWeatherInquiries.some((kw) => q.includes(kw))) {
      return true;
    }

    if (isTechnicalQuestion) {
      return false;
    }

    // Các cụm từ hỏi thời tiết phụ (chỉ xét khi không phải câu hỏi kỹ thuật)
    const secondaryWeatherKeywords = [
      'thời tiết', 'thoi tiet',
      'có mưa không', 'co mua khong',
      'mưa không', 'mua khong',
      'sắp mưa', 'sap mua',
      'hôm nay trời', 'hom nay troi',
    ];

    if (secondaryWeatherKeywords.some((kw) => q.includes(kw))) {
      return true;
    }

    if (q.includes('nhiệt độ') || q.includes('nhiet do')) {
      const isWaterTemp = q.includes('nước') || q.includes('nuoc') || q.includes('ao') || q.includes('thích hợp') || q.includes('thich hop');
      if (!isWaterTemp) {
        return true;
      }
    }

    return false;
  }

  /**
   * 1. Nhận diện địa danh: Tra cứu từ điển hoặc gọi Geocoding API động
   */
  async resolveLocation(input: string, fallbackHint?: string): Promise<CityCoord> {
    const lower = (input || '').toLowerCase().trim();

    // 1.1 Khớp chính xác hoặc chứa trong từ điển tỉnh thành mở rộng từ input
    const sortedKeys = Object.keys(VIETNAM_PROVINCES).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (lower.includes(key)) {
        return VIETNAM_PROVINCES[key];
      }
    }

    // 1.2 Trích xuất tên địa danh từ câu hỏi tự nhiên bằng Regex (ví dụ "ở Huế", "tại Cần Thơ")
    const match = lower.match(/(?:ở|tại|khu vực|tỉnh|thành phố|tp\.?|huyện|xã)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s+(?:hôm nay|thế nào|sao|có|được|không|\?|\.|\,)|$)/i);
    const candidateName = match ? match[1].trim() : '';

    if (candidateName && candidateName.length >= 2) {
      for (const key of sortedKeys) {
        if (candidateName.includes(key) || key.includes(candidateName)) {
          return VIETNAM_PROVINCES[key];
        }
      }

      const geo = await this.queryGeocoding(candidateName);
      if (geo) return geo;
    }

    // 1.3 Nếu câu hỏi không nhắc địa phương, dùng fallbackHint (địa chỉ trang trại của người dùng)
    if (fallbackHint) {
      const lowerHint = fallbackHint.toLowerCase().trim();
      for (const key of sortedKeys) {
        if (lowerHint.includes(key)) {
          return VIETNAM_PROVINCES[key];
        }
      }
      const geo = await this.queryGeocoding(fallbackHint);
      if (geo) return geo;
    }

    // Mặc định Cà Mau (thủ phủ nuôi tôm)
    return VIETNAM_PROVINCES['cà mau'];
  }

  private async queryGeocoding(placeName: string): Promise<CityCoord | null> {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placeName)}&count=1&language=vi&format=json`;
      const geoRes = await fetch(geoUrl, {
        headers: { 'User-Agent': 'SmartShrimpFarm/1.0' },
        signal: AbortSignal.timeout(4000),
      });

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const first = geoData.results?.[0];
        if (first && first.latitude && first.longitude) {
          this.logger.log(`Geocoded "${placeName}" -> ${first.name} (${first.latitude}, ${first.longitude})`);
          return {
            name: first.name,
            lat: first.latitude,
            lon: first.longitude,
          };
        }
      }
    } catch (geoErr) {
      this.logger.debug(`Geocoding error for "${placeName}": ${geoErr}`);
    }
    return null;
  }

  /**
   * 2. Lấy dữ liệu thời tiết đa nguồn (Dual API: Open-Meteo + wttr.in + OpenWeatherMap)
   */
  async getWeather(locationQuery?: string, fallbackHint?: string): Promise<WeatherData | null> {
    const coord = await this.resolveLocation(locationQuery || '', fallbackHint);
    const cacheKey = coord.name.toLowerCase();

    // Cache hit
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    let weather: WeatherData | null = null;

    // ── API 1: OPEN-METEO (Primary - Realtime vệ tinh toàn cầu) ──
    try {
      weather = await this.fetchFromOpenMeteo(coord);
    } catch (err: any) {
      this.logger.warn(`Open-Meteo failed for ${coord.name}: ${err?.message || err}. Falling back to wttr.in...`);
    }

    // ── API 2: WTTR.IN (Secondary Backup - Toàn cầu, không cần tọa độ) ──
    if (!weather) {
      try {
        weather = await this.fetchFromWttrIn(coord.name);
      } catch (err: any) {
        this.logger.warn(`wttr.in failed for ${coord.name}: ${err?.message || err}`);
      }
    }

    // ── API 3: OPENWEATHERMAP (Nếu có cấu hình key) ──
    if (!weather && this.openWeatherApiKey) {
      try {
        weather = await this.fetchFromOpenWeather(coord);
      } catch (err: any) {
        this.logger.warn(`OpenWeatherMap failed for ${coord.name}: ${err?.message || err}`);
      }
    }

    if (weather) {
      this.cache.set(cacheKey, { data: weather, expiresAt: Date.now() + this.CACHE_TTL_MS });
      this.logger.log(`[Weather Success] ${weather.cityName}: ${weather.temperature}°C, ${weather.description} (Source: ${weather.provider})`);
    }

    return weather;
  }

  /**
   * API 1: Open-Meteo (Tọa độ GPS)
   */
  private async fetchFromOpenMeteo(coord: CityCoord): Promise<WeatherData | null> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m&timezone=Asia%2FBangkok`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartShrimpFarm/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const current = json.current;
    if (!current) return null;

    const temp = parseFloat((current.temperature_2m ?? 28).toFixed(1));
    const feelsLike = parseFloat((current.apparent_temperature ?? temp).toFixed(1));
    const rain = parseFloat((current.rain ?? current.precipitation ?? 0).toFixed(1));
    const windSpeed = parseFloat(((current.wind_speed_10m ?? 0) / 3.6).toFixed(1));
    const weatherCode = current.weather_code ?? 0;
    const description = this.translateWmoCode(weatherCode, rain);
    const isRaining = rain > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode);

    return {
      cityName: coord.name,
      temperature: temp,
      feelsLike,
      humidity: Math.round(current.relative_humidity_2m ?? 75),
      description,
      windSpeed,
      windDegree: current.wind_direction_10m,
      cloudiness: current.cloud_cover ?? 50,
      rain1h: rain,
      pressure: Math.round(current.surface_pressure ?? 1010),
      isRaining,
      isHot: temp >= 34,
      isCold: temp < 20,
      isWindy: windSpeed >= 9,
      provider: 'Open-Meteo (API 1)',
      recordedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
    };
  }

  /**
   * API 2: wttr.in (Dự phòng theo tên thành phố)
   */
  private async fetchFromWttrIn(cityName: string): Promise<WeatherData | null> {
    // Chuẩn hóa tên query sang tiếng Anh không dấu để wttr.in nhận diện chuẩn
    const unaccented = this.removeVietnameseTones(cityName);
    const url = `https://wttr.in/${encodeURIComponent(unaccented)},Vietnam?format=j1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'curl/7.68.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const current = json.current_condition?.[0];
    if (!current) return null;

    const temp = parseFloat(current.temp_C);
    const feelsLike = parseFloat(current.FeelsLikeC || current.temp_C);
    const humidity = parseInt(current.humidity, 10) || 75;
    const windKmph = parseFloat(current.windspeedKmph || '0');
    const windSpeed = parseFloat((windKmph / 3.6).toFixed(1));
    const rain = parseFloat(current.precipMM || '0');
    const rawDesc = current.weatherDesc?.[0]?.value || '';
    const description = this.translateEnglishWeather(rawDesc, rain);
    const isRaining = rain > 0 || /rain|drizzle|shower|thunderstorm/i.test(rawDesc);

    return {
      cityName,
      temperature: temp,
      feelsLike,
      humidity,
      description,
      windSpeed,
      cloudiness: parseInt(current.cloudcover || '50', 10),
      rain1h: rain,
      pressure: parseInt(current.pressure || '1010', 10),
      isRaining,
      isHot: temp >= 34,
      isCold: temp < 20,
      isWindy: windSpeed >= 9,
      provider: 'wttr.in (API 2)',
      recordedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
    };
  }

  /**
   * API 3: OpenWeatherMap (nếu có key)
   */
  private async fetchFromOpenWeather(coord: CityCoord): Promise<WeatherData | null> {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coord.lat}&lon=${coord.lon}&appid=${this.openWeatherApiKey}&units=metric&lang=vi`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const raw = await res.json();
    const rain1h = raw.rain?.['1h'] ?? 0;
    const temp = parseFloat(raw.main?.temp?.toFixed(1));

    return {
      cityName: coord.name,
      temperature: temp,
      feelsLike: parseFloat(raw.main?.feels_like?.toFixed(1)),
      humidity: raw.main?.humidity ?? 70,
      description: raw.weather?.[0]?.description ?? 'Trời quang đãng',
      windSpeed: parseFloat((raw.wind?.speed ?? 0).toFixed(1)),
      windDegree: raw.wind?.deg,
      cloudiness: raw.clouds?.all ?? 0,
      rain1h: parseFloat(rain1h.toFixed(1)),
      pressure: raw.main?.pressure ?? 1012,
      isRaining: rain1h > 0 || raw.weather?.[0]?.main === 'Rain',
      isHot: temp >= 34,
      isCold: temp < 20,
      isWindy: (raw.wind?.speed ?? 0) >= 9,
      provider: 'OpenWeatherMap (API 3)',
      recordedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
    };
  }

  private translateWmoCode(code: number, rainAmount: number): string {
    if (code === 0) return 'Trời quang đãng, nắng';
    if (code === 1) return 'Ít mây, trời nắng nhẹ';
    if (code === 2) return 'Mây rải rác';
    if (code === 3) return 'Nhiều mây, âm u';
    if ([45, 48].includes(code)) return 'Có sương mù';
    if ([51, 53, 55].includes(code)) return 'Mưa phùn lất phất';
    if ([61, 63, 65].includes(code)) return 'Mưa rào nhẹ đến vừa';
    if ([80, 81, 82].includes(code)) return 'Mưa rào rải rác';
    if ([95, 96, 99].includes(code)) return 'Dông sét, mưa to có gió';
    return rainAmount > 0 ? 'Có mưa rào' : 'Thời tiết bình thường';
  }

  private translateEnglishWeather(desc: string, rain: number): string {
    const d = desc.toLowerCase();
    if (d.includes('thunderstorm')) return 'Dông sét, mưa to';
    if (d.includes('heavy rain')) return 'Mưa to diện rộng';
    if (d.includes('rain') || d.includes('drizzle')) return 'Có mưa rào';
    if (d.includes('sunny') || d.includes('clear')) return 'Trời quang đãng, nắng';
    if (d.includes('partly cloudy')) return 'Ít mây, nắng nhẹ';
    if (d.includes('cloudy') || d.includes('overcast')) return 'Nhiều mây, âm u';
    if (d.includes('fog') || d.includes('mist')) return 'Có sương mù';
    return rain > 0 ? 'Có mưa rào' : desc;
  }

  private removeVietnameseTones(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim();
  }

  buildWeatherContextString(w: WeatherData): string {
    const lines = [
      `\n[DỮ LIỆU THỜI TIẾT THỰC TẾ HÔM NAY - KHU VỰC ${w.cityName.toUpperCase()}]:`,
      `- Nhiệt độ không khí hiện tại: ${w.temperature}°C (Cảm giác thực tế: ${w.feelsLike}°C)`,
      `- Hiện trạng thời tiết: ${w.description} (Độ che phủ mây: ${w.cloudiness}%)`,
      `- Độ ẩm không khí: ${w.humidity}% | Áp suất khí quyển: ${w.pressure} hPa`,
      `- Tốc độ gió: ${w.windSpeed} m/s`,
      `- Lượng mưa ghi nhận: ${w.rain1h > 0 ? `${w.rain1h} mm (Đang có mưa)` : 'Không mưa (0.0 mm)'}`,
      `- Thời điểm cập nhật: ${w.recordedAt} (Nguồn cung cấp dữ liệu: ${w.provider})`,
    ];

    if (w.isRaining) {
      lines.push('⚠️ CẢNH BÁO THỜI TIẾT: ĐANG CÓ MƯA - Cần chạy quạt nước liên tục, tạt vôi đệm pH và kiểm tra DO đáy ao.');
    } else if (w.isHot) {
      lines.push('⚠️ CẢNH BÁO THỜI TIẾT: NẮNG NÓNG GẮT (>34°C) - Nguy cơ stress nhiệt và tảo tàn, cắt giảm cữ ăn trưa.');
    } else if (w.isCold) {
      lines.push('⚠️ CẢNH BÁO THỜI TIẾT: LẠNH (<20°C) - Tôm giảm ăn rõ rệt, giảm 50% thức ăn.');
    }

    return lines.join('\n');
  }
}
