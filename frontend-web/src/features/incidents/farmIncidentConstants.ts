export type FarmIncidentTab = 'open' | 'treating' | 'resolved';

export type IncidentRole = 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';

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
    examples: 'VD: Dàn quạt số 2 bị kẹt bạc đạn bốc khói; Máy cho ăn tự động bị kẹt cánh quạt.',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
  },
  {
    id: 'Điện lưới & Năng lượng',
    label: 'Điện & Năng lượng',
    icon: '⚡',
    description: 'Chập điện, mất điện, máy phát điện dự phòng, tụ điện, đứt dây cáp...',
    examples: 'VD: Trạm biến áp bị nhảy aptomat liên tục; Máy phát điện dự phòng không tự nổ khi mất điện.',
    badgeBg: 'bg-yellow-50',
    badgeText: 'text-yellow-800',
    badgeBorder: 'border-yellow-200',
  },
  {
    id: 'Bờ ao, Bạt lót & Cống',
    label: 'Bờ ao & Bạt HDPE',
    icon: '🏞️',
    description: 'Rách/thủng bạt đáy HDPE, sạt lở bờ bao, hỏng van cống xả, bung lưới chắn rác...',
    examples: 'VD: Rách bạt lót đáy bờ tây ao; Cống thoát nước đáy bị rò rỉ rỉ nước ra ngoài.',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
  },
  {
    id: 'Kênh cấp & Nguồn nước',
    label: 'Kênh cấp & Nguồn nước',
    icon: '💧',
    description: 'Nước ngoài sông/kênh cấp ô nhiễm váng dầu, tắc nghẽn dòng chảy cống lấy nước...',
    examples: 'VD: Nước kênh cấp ngoài có váng bẩn lạ; Miệng cống lấy nước bị lục bình bít kín.',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-800',
    badgeBorder: 'border-cyan-200',
  },
  {
    id: 'Kho bãi & Vật tư',
    label: 'Kho bãi & Vật tư',
    icon: '📦',
    description: 'Ẩm mốc cám/thức ăn, chuột bọ cắn phá, rò rỉ bao vôi/hóa chất, hỏng cửa kho...',
    examples: 'VD: Bao thức ăn trong kho số 2 bị dột nước mưa; Chuột cắn rách bao cám.',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
  },
  {
    id: 'An ninh & Sự cố khác',
    label: 'An ninh & Khẩn cấp',
    icon: '🚨',
    description: 'Mưa dông bão tốc mái che, sạt lở đường nội bộ, trộm cắp, tai nạn lao động...',
    examples: 'VD: Mưa dông làm tốc mái chòi trực bờ đông; Người lạ đột nhập khu vực ao nuôi ban đêm.',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200',
  },
];

export const FARM_INCIDENT_SEVERITIES = [
  {
    id: 'Khẩn cấp',
    label: 'Khẩn cấp',
    sublabel: 'Nguy cơ thiệt hại tức thì / Mất an toàn',
    chipClass: 'border-rose-300 bg-rose-600 text-white shadow-xs',
    badgeClass: 'bg-rose-600 text-white font-black animate-pulse',
  },
  {
    id: 'Cao',
    label: 'Mức cao',
    sublabel: 'Cần xử lý sớm trong ca trực',
    chipClass: 'border-amber-300 bg-amber-500 text-white',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300 font-bold',
  },
  {
    id: 'Trung bình',
    label: 'Trung bình',
    sublabel: 'Kiểm tra & sửa chữa trong ngày',
    chipClass: 'border-blue-300 bg-blue-500 text-white',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200 font-bold',
  },
  {
    id: 'Thấp',
    label: 'Mức thấp',
    sublabel: 'Theo dõi & bảo dưỡng định kỳ',
    chipClass: 'border-slate-300 bg-slate-500 text-white',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200 font-medium',
  },
];

export const LOCATION_SUGGESTIONS = [
  '⚡ Trạm biến áp trung tâm',
  '💧 Trạm bơm cấp nước số 1',
  '💧 Trạm bơm cấp nước số 2',
  '📦 Kho thức ăn & vật tư A',
  '📦 Kho hóa chất & vôi',
  '⚙️ Dàn quạt nước bờ tây',
  '⚙️ Dàn quạt nước bờ đông',
  '🏞️ Cống xả đáy ao',
  '🏞️ Bờ bao thoát lũ',
  '🌾 Khu vực xử lý nước lắng',
  '🚪 Cổng rào & chòi bảo vệ',
  '🚜 Đường nội bộ trang trại',
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

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('ERR_CONNECTION')
    ) {
      return 'Không thể kết nối đến máy chủ backend (http://localhost:3000). Vui lòng đảm bảo server backend đang chạy (npm run start:dev).';
    }
    return error.message;
  }
  return 'Đã xảy ra lỗi không xác định';
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

