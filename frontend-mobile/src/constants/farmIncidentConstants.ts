export type FarmIncidentTab = 'all' | 'open' | 'treating' | 'resolved';

export interface FarmIncidentCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  examples: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const FARM_INCIDENT_CATEGORIES: FarmIncidentCategory[] = [
  {
    id: 'Thiết bị & Máy móc',
    label: 'Thiết bị & Máy móc',
    icon: '⚙️',
    description: 'Quạt nước, máy sục khí O2, máy cho ăn tự động, máy bơm nước, đường ống...',
    examples: 'VD: Dàn quạt số 2 bị kẹt trục bốc khói; Máy cho ăn tự động bị kẹt cánh quạt.',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    badgeBorder: '#fde68a',
  },
  {
    id: 'Điện lưới & Năng lượng',
    label: 'Điện & Năng lượng',
    icon: '⚡',
    description: 'Chập điện, mất điện, máy phát điện dự phòng, tủ điện, đứt dây cáp...',
    examples: 'VD: Trạm biến áp bị nhảy aptomat liên tục; Máy phát điện dự phòng không tự nổ khi mất điện.',
    badgeBg: '#fef9c3',
    badgeText: '#854d0e',
    badgeBorder: '#fef08a',
  },
  {
    id: 'Bờ ao, Bạt lót & Cống',
    label: 'Bờ ao & Bạt HDPE',
    icon: '🏗️',
    description: 'Rách/thủng bạt đáy HDPE, sạt lở bờ bao, hỏng van cống xả, bung lưới chắn rác...',
    examples: 'VD: Rách bạt lót đáy bờ tây ao; Cống thoát nước đáy bị rò rỉ rỉ nước ra ngoài.',
    badgeBg: '#ecfdf5',
    badgeText: '#065f46',
    badgeBorder: '#a7f3d0',
  },
  {
    id: 'Kênh cấp & Nguồn nước',
    label: 'Kênh cấp & Nguồn nước',
    icon: '💧',
    description: 'Nước ngoài sông/kênh cấp ô nhiễm váng dầu, tắc nghẽn dòng chảy cống lấy nước...',
    examples: 'VD: Nước kênh cấp ngoài có váng bùn lạ; Miệng cống lấy nước bị lục bình bít kín.',
    badgeBg: '#ecfeff',
    badgeText: '#155e75',
    badgeBorder: '#a5f3fc',
  },
  {
    id: 'Kho bãi & Vật tư',
    label: 'Kho bãi & Vật tư',
    icon: '📦',
    description: 'Ẩm mốc cám/thức ăn, chuột bọ cắn phá, rò rỉ bao vôi/hóa chất, hỏng cửa kho...',
    examples: 'VD: Bao thức ăn trong kho số 2 bị dột nước mưa; Chuột cắn rách bao cám.',
    badgeBg: '#faf5ff',
    badgeText: '#6b21a8',
    badgeBorder: '#e9d5ff',
  },
  {
    id: 'An ninh & Sự cố khác',
    label: 'An ninh & Khẩn cấp',
    icon: '🚨',
    description: 'Mưa dông bão tốc mái che, sạt lở đường nội bộ, trộm cắp, tai nạn lao động...',
    examples: 'VD: Mưa dông làm tốc mái chòi trực bờ đông; Người lạ đột nhập khu vực ao nuôi ban đêm.',
    badgeBg: '#fff1f2',
    badgeText: '#9f1239',
    badgeBorder: '#fecdd3',
  },
];

export const FARM_INCIDENT_SEVERITIES = [
  {
    id: 'Khẩn cấp',
    label: 'Khẩn cấp',
    sublabel: 'Nguy cơ thiệt hại tức thì / Mất an toàn',
    badgeBg: '#ef4444',
    badgeText: '#ffffff',
    badgeBorder: '#dc2626',
    bg: '#ef4444',
    color: '#ffffff',
  },
  {
    id: 'Cao',
    label: 'Mức cao',
    sublabel: 'Cần xử lý sớm trong ca trực',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    badgeBorder: '#fcd34d',
    bg: '#fef3c7',
    color: '#b45309',
  },
  {
    id: 'Trung bình',
    label: 'Trung bình',
    sublabel: 'Kiểm tra & sửa chữa trong ngày',
    badgeBg: '#eff6ff',
    badgeText: '#1d4ed8',
    badgeBorder: '#bfdbfe',
    bg: '#eff6ff',
    color: '#1d4ed8',
  },
  {
    id: 'Thấp',
    label: 'Mức thấp',
    sublabel: 'Theo dõi & bảo dưỡng định kỳ',
    badgeBg: '#f1f5f9',
    badgeText: '#475569',
    badgeBorder: '#cbd5e1',
    bg: '#f1f5f9',
    color: '#475569',
  },
];

export const TITLE_SUGGESTIONS: Record<string, string[]> = {
  'Thiết bị & Máy móc': [
    'Quạt nước ao bị hỏng mô-tơ',
    'Máy cho ăn tự động bị kẹt cánh quạt',
    'Máy bơm nước cấp không lên áp lực',
    'Máy sục khí đáy bị rách ống nano',
    'Dàn quạt nước số 2 bị gãy trục cánh',
  ],
  'Điện lưới & Năng lượng': [
    'Tủ điện biến áp bị nhảy aptomat liên tục',
    'Máy phát điện dự phòng không khởi động được',
    'Đứt dây cáp truyền tải điện ra khu quạt nước',
    'Hỏng phao cảm biến điện tự ngắt',
  ],
  'Bờ ao, Bạt lót & Cống': [
    'Bờ bao ao bị rò rỉ nước chân bờ',
    'Rách bạt lót đáy HDPE cần dán vá khẩn cấp',
    'Van cống thoát nước đáy bị kẹt không đóng kín',
    'Lưới chắn cá tạp miệng cống bị bung',
  ],
  'Kênh cấp & Nguồn nước': [
    'Kênh dẫn nước vào ao lắng bị tắc nghẽn',
    'Nguồn nước kênh chính có váng dầu/ô nhiễm',
    'Sạt lở bờ kênh cấp nước chung',
  ],
  'Kho bãi & Vật tư': [
    'Mái kho cám bị dột nước khi mưa lớn',
    'Phát hiện chuột bọ phá hoại bao thức ăn',
    'Bao hóa chất xử lý nước bị rách/ẩm ướt',
    'Cửa kho vật tư bị hỏng khóa',
  ],
  'An ninh & Sự cố khác': [
    'Mưa bão làm tốc mái chòi trực bờ ao',
    'Phát hiện dấu hiệu xâm nhập trái phép khu ao',
    'Sạt lở đường nội bộ xe chở cám đi qua',
    'Đèn chiếu sáng an ninh ban đêm bị cháy hỏng',
  ],
};

export const COMMON_INCIDENT_TITLE_SUGGESTIONS = TITLE_SUGGESTIONS;

export const LOCATION_SUGGESTIONS = [
  '⚡ Trạm biến áp trung tâm',
  '💧 Trạm bơm cấp nước số 1',
  '💧 Trạm bơm cấp nước số 2',
  '📦 Kho thức ăn & vật tư A',
  '📦 Kho hóa chất & vôi',
  '⚙️ Dàn quạt nước bờ tây',
  '⚙️ Dàn quạt nước bờ đông',
  '🏗️ Cống xả đáy ao',
  '🏗️ Bờ bao thoát lũ',
  '🌊 Khu vực xử lý nước lắng',
  '🚨 Cổng rào & chòi bảo vệ',
  '🛣️ Đường nội bộ trang trại',
];

export function parseIncidentMetadata(title?: string | null, description?: string | null) {
  const safeTitle = (title || '').trim();
  const safeDesc = (description || '').trim();
  let category = '';
  let cleanTitle = safeTitle;
  const catMatch = safeTitle.match(/^\[(.*?)\]/);
  if (catMatch) {
    category = catMatch[1];
    cleanTitle = safeTitle.replace(/^\[(.*?)\]\s*/, '');
  } else {
    const descCatMatch = safeDesc.match(/\[Phân loại:\s*(.*?)\]/i);
    if (descCatMatch) category = descCatMatch[1];
  }

  let severity = 'Trung bình';
  const descSevMatch = safeDesc.match(/\[Mức độ:\s*(.*?)\]/i);
  if (descSevMatch) severity = descSevMatch[1];

  let location = '';
  const descLocMatch = safeDesc.match(/\[Vị trí:\s*(.*?)\]/i);
  if (descLocMatch) location = descLocMatch[1];

  const cleanDescription = safeDesc.replace(/^(\[.*?\]\s*)+\n*/, '').trim();

  return { category, severity, location, cleanTitle, cleanDescription };
}

/**
 * Valid objective farm incident category check (whitelist)
 * Excludes all biological shrimp diseases and water chemistry records
 */
export function isFarmInfrastructureIncident(title?: string | null, description?: string | null): boolean {
  const { category, cleanTitle } = parseIncidentMetadata(title, description);
  const catLower = (category || '').trim().toLowerCase();
  const titleLower = (cleanTitle || '').trim().toLowerCase();

  // Explicit blacklist: shrimp diseases and biological water conditions
  if (
    catLower.includes('sức khỏe') ||
    catLower.includes('dịch bệnh') ||
    catLower.includes('bệnh tôm') ||
    catLower.includes('môi trường') ||
    catLower.includes('nước ao') ||
    catLower.includes('sức khoẻ') ||
    titleLower.includes('sự cố sức khỏe') ||
    titleLower.includes('bệnh đốm trắng') ||
    titleLower.includes('gan tụy') ||
    titleLower.includes('phân trắng') ||
    titleLower.includes('lờ đờ') ||
    titleLower.includes('bơi yếu')
  ) {
    return false;
  }

  // Categories allowed for objective farm incidents
  const VALID_FARM_CATEGORIES = [
    'thiết bị & máy móc',
    'thiết bị',
    'điện lưới & năng lượng',
    'điện & năng lượng',
    'điện & máy phát',
    'bờ ao, bạt lót & cống',
    'bờ ao & bạt hdpe',
    'bờ ao & hạ tầng',
    'kênh cấp & nguồn nước',
    'kho bãi & vật tư',
    'kho thức ăn & vật tư',
    'kho thức ăn & thuốc',
    'an ninh & sự cố khác',
    'an ninh & khẩn cấp',
    'sự cố khác / an ninh',
  ];

  if (!catLower) {
    // If no category tag, check if title mentions infrastructure keywords
    const INFRA_KEYWORDS = ['quạt', 'bơm', 'máy', 'điện', 'cáp', 'bạt', 'cống', 'sạt lở', 'dột', 'kho', 'hỏng', 'gãy', 'cháy', 'trục'];
    return INFRA_KEYWORDS.some((kw) => titleLower.includes(kw));
  }

  return VALID_FARM_CATEGORIES.some(
    (validCat) => catLower.includes(validCat) || validCat.includes(catLower)
  );
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}
