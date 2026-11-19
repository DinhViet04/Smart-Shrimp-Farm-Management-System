/**
 * CropCreateCard (mobile)
 *
 * Thẻ nhập liệu tạo VỤ NUÔI ngay trong khung chat AI (chỉ dành cho Quản lý trang trại).
 * - AI điền sẵn những gì người dùng đã nói; người dùng điền / sửa phần còn lại trên thẻ.
 * - Quy tắc khớp form tạo vụ trên web và backend (crops.service): chỉ chọn ao đang trống,
 *   mật độ > 250 con/m² bị chặn, trang trại Công nghệ cao bắt buộc bắt đầu Ương dưỡng,
 *   Truyền thống chỉ Thương phẩm, mốc tách ao / thu hoạch phải sau ngày thả.
 * Chỉ dùng thành phần lõi React Native (ngày nhập dạng DD/MM/YYYY + nút chọn nhanh).
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, CheckCircle2, ExternalLink, RotateCcw, Sprout, Tag } from 'lucide-react-native';
import type { AgentActionDraft, CropPondOption } from '../services/chatbotService';

type Stage = 'NURSERY' | 'COMMERCIAL';

const DEFAULTS = {
  seedType: 'Tôm thẻ chân trắng Post 10',
  targetSurvivalRate: '85',
  targetHarvestSize: '30',
  transferDays: 25,
  harvestDays: 95,
};
const MAX_DENSITY = 250;
/** Giá giống mặc định khi chưa lấy được giá Tép Bạc (khớp backend) */
const DEFAULT_SEED_PRICE = 70;
/** Trang giá giống Tép Bạc (dự phòng khi backend không gửi kèm giá) — giống form tạo vụ trên web */
const SEED_PRICE_URL = 'https://tepbac.com/gia-thuy-san/giong-tom-the-chan-trang-p10';

const pad = (n: number) => String(n).padStart(2, '0');

/** Date (giờ máy) -> YYYY-MM-DD */
function toIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD -> DD/MM/YYYY */
function isoToVn(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** DD/MM/YYYY (hoặc D/M/YYYY) -> YYYY-MM-DD, null nếu sai */
function vnToIso(text: string): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
  return toIso(d);
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / 86_400_000);
}

function forcedStage(model: string | null | undefined): Stage | null {
  if (model === 'HIGH_TECH') return 'NURSERY';
  if (model === 'TRADITIONAL') return 'COMMERCIAL';
  return null;
}

/** Số nguyên dương, chấp nhận "200.000", "200,000", "200 000" */
function parseCount(raw: string): number | null {
  const s = raw.replace(/[\s.,]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n > 0 ? n : null;
}

function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
}

const DENSITY_LEVELS = [
  { max: 100, label: 'Mật độ thấp / quảng canh', color: '#0284c7', bg: '#f0f9ff', border: '#7dd3fc' },
  { max: 200, label: 'Mật độ an toàn, hiệu quả cao', color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  { max: 220, label: 'Mật độ cao — cần oxy đáy mạnh', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  { max: MAX_DENSITY, label: 'Mật độ báo động — cân nhắc giảm', color: '#e11d48', bg: '#fff1f2', border: '#fda4af' },
];

interface FormState {
  farmId: string;
  pondId: string;
  startDateText: string; // DD/MM/YYYY
  initialShrimpCount: string;
  stage: Stage;
  milestoneDays: string; // số ngày ương (tách ao) hoặc số ngày nuôi (thu hoạch)
  seedType: string;
  targetSurvivalRate: string;
  targetHarvestSize: string;
  targetTotalFeedKg: string;
}

function initialForm(draft: AgentActionDraft, ponds: CropPondOption[]): FormState {
  const d: Record<string, any> = draft.collectedData || {};
  const pond = ponds.find((p) => p.id === d.pondId);
  const farmIds = [...new Set(ponds.map((p) => p.farmId))];
  const farmId = pond?.farmId || (farmIds.length === 1 ? farmIds[0] : '');
  const inFarm = ponds.filter((p) => p.farmId === farmId);
  const pondId = pond?.id || (farmId && inFarm.length === 1 ? inFarm[0].id : '');
  const model = ponds.find((p) => p.id === pondId)?.farmingModel ?? inFarm[0]?.farmingModel;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(d.startDate || '')) ? String(d.startDate) : toIso(new Date());
  const stage: Stage = forcedStage(model) || (d.stage === 'NURSERY' ? 'NURSERY' : 'COMMERCIAL');
  const milestone = stage === 'NURSERY' ? d.expectedTransferDate : d.expectedHarvestDate;
  const days = milestone ? daysBetween(start, String(milestone)) : 0;
  const str = (v: unknown, fallback = '') => (v === undefined || v === null || v === '' ? fallback : String(v));

  return {
    farmId,
    pondId,
    startDateText: isoToVn(start),
    initialShrimpCount: str(d.initialShrimpCount),
    stage,
    milestoneDays: String(days > 0 ? days : stage === 'NURSERY' ? DEFAULTS.transferDays : DEFAULTS.harvestDays),
    seedType: str(d.seedType, DEFAULTS.seedType),
    targetSurvivalRate: str(d.targetSurvivalRate, DEFAULTS.targetSurvivalRate),
    targetHarvestSize: str(d.targetHarvestSize, DEFAULTS.targetHarvestSize),
    targetTotalFeedKg: str(d.targetTotalFeedKg),
  };
}

interface Props {
  draft: AgentActionDraft;
  executed: boolean;
  executing: boolean;
  /** Thẻ cũ (đã có thẻ mới hơn) hoặc người dùng không phải Quản lý trang trại */
  readOnlyReason?: string;
  onSubmit: (data: Record<string, unknown>) => void;
}

export default function CropCreateCard({ draft, executed, executing, readOnlyReason, onSubmit }: Props) {
  const ponds = useMemo(() => draft.cropPondOptions || [], [draft.cropPondOptions]);
  const market = draft.seedMarketPrice;
  /** Đơn giá giống chỉ lấy tự động theo Tép Bạc (backend gửi kèm), không có thì giá mặc định */
  const seedPrice = market?.price || DEFAULT_SEED_PRICE;
  const farms = useMemo(() => {
    const map = new Map<string, string>();
    ponds.forEach((p) => map.set(p.farmId, p.farmName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [ponds]);

  const [form, setForm] = useState<FormState>(() => initialForm(draft, ponds));
  const [touched, setTouched] = useState(false);

  const locked = executed || executing || Boolean(readOnlyReason);
  const pond = ponds.find((p) => p.id === form.pondId);
  const pondsInFarm = form.farmId ? ponds.filter((p) => p.farmId === form.farmId) : ponds;
  const stageLock = forcedStage(pond?.farmingModel ?? pondsInFarm[0]?.farmingModel);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const selectPond = (pondId: string) => {
    setForm((f) => {
      const p = ponds.find((o) => o.id === pondId);
      const lock = forcedStage(p?.farmingModel);
      const stage = lock || f.stage;
      return {
        ...f,
        pondId,
        farmId: p?.farmId || f.farmId,
        stage,
        milestoneDays:
          stage !== f.stage ? String(stage === 'NURSERY' ? DEFAULTS.transferDays : DEFAULTS.harvestDays) : f.milestoneDays,
      };
    });
  };

  const selectFarm = (farmId: string) => {
    const list = ponds.filter((p) => p.farmId === farmId);
    if (list.some((p) => p.id === form.pondId)) {
      set('farmId', farmId);
    } else if (list.length === 1) {
      selectPond(list[0].id);
    } else {
      setForm((f) => ({ ...f, farmId, pondId: '' }));
    }
  };

  const selectStage = (stage: Stage) => {
    if (stage === form.stage) return;
    setForm((f) => ({
      ...f,
      stage,
      milestoneDays: String(stage === 'NURSERY' ? DEFAULTS.transferDays : DEFAULTS.harvestDays),
    }));
  };

  const ev = useMemo(() => {
    const errors: string[] = [];
    if (!form.farmId && farms.length > 1) errors.push('Chưa chọn trang trại');
    if (!form.pondId) errors.push('Chưa chọn ao nuôi');

    const startIso = vnToIso(form.startDateText);
    if (!startIso) errors.push('Ngày thả giống phải dạng DD/MM/YYYY');

    const count = parseCount(form.initialShrimpCount);
    let density: number | null = null;
    if (!form.initialShrimpCount.trim()) errors.push('Chưa nhập số lượng giống');
    else if (count === null) errors.push('Số lượng giống phải là số nguyên dương');
    else if (pond?.areaSize) {
      density = count / pond.areaSize;
      if (density > MAX_DENSITY) {
        errors.push(`Mật độ ${density.toFixed(1)} con/m² vượt ngưỡng tối đa ${MAX_DENSITY} con/m²`);
      }
    }

    if (stageLock && form.stage !== stageLock) {
      errors.push(
        stageLock === 'NURSERY'
          ? 'Trang trại Công nghệ cao: vụ mới bắt buộc bắt đầu Ương dưỡng'
          : 'Trang trại Truyền thống chỉ nuôi Thương phẩm',
      );
    }

    const days = parseCount(form.milestoneDays);
    if (!days) errors.push(form.stage === 'NURSERY' ? 'Số ngày ương phải ≥ 1' : 'Số ngày nuôi phải ≥ 1');
    const milestoneIso = startIso && days ? addDays(startIso, days) : '';

    if (form.seedType.length > 100) errors.push('Loại giống tối đa 100 ký tự');
    const rate = form.targetSurvivalRate.trim() ? parseDecimal(form.targetSurvivalRate) : undefined;
    if (rate === null || (rate !== undefined && rate > 100)) errors.push('Tỷ lệ sống từ 0 đến 100%');
    const size = form.targetHarvestSize.trim() ? parseDecimal(form.targetHarvestSize) : undefined;
    if (size === null || size === 0) errors.push('Size thu phải là số dương (con/kg)');
    const feed = form.targetTotalFeedKg.trim() ? parseDecimal(form.targetTotalFeedKg) : undefined;
    if (feed === null) errors.push('Thức ăn dự kiến phải là số không âm');

    const harvestCount = count && rate ? Math.round((count * rate) / 100) : 0;
    const biomassKg = harvestCount && size ? Math.round((harvestCount / size) * 10) / 10 : 0;
    const fcr = feed && biomassKg ? feed / biomassKg : null;

    return { errors, count, density, startIso, milestoneIso, price: seedPrice, rate, size, feed, harvestCount, biomassKg, fcr };
  }, [form, pond, farms.length, stageLock, seedPrice]);

  const densityLevel = ev.density !== null ? DENSITY_LEVELS.find((l) => (ev.density as number) <= l.max) : undefined;

  const handleSubmit = () => {
    setTouched(true);
    if (locked || ev.errors.length > 0 || !ev.count || !ev.startIso) return;
    const nursery = form.stage === 'NURSERY';
    onSubmit({
      pondId: form.pondId,
      pondName: pond?.name,
      startDate: ev.startIso,
      initialShrimpCount: ev.count,
      stage: form.stage,
      expectedTransferDate: nursery ? ev.milestoneIso : undefined,
      expectedHarvestDate: nursery ? undefined : ev.milestoneIso,
      seedType: form.seedType.trim() || DEFAULTS.seedType,
      targetSurvivalRate: ev.rate,
      targetHarvestSize: ev.size,
      targetTotalFeedKg: ev.feed,
    });
  };

  const handleReset = () => {
    setForm(initialForm(draft, ponds));
    setTouched(false);
  };

  const fmt = (n: number) => n.toLocaleString('vi-VN');
  const chip = (active: boolean) => ({
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: active ? '#059669' : '#e2e8f0',
    backgroundColor: active ? '#d1fae5' : '#ffffff',
  });
  const chipText = (active: boolean) => ({ fontSize: 11, fontWeight: '700' as const, color: active ? '#047857' : '#475569' });
  const sectionLabel = { fontSize: 11, fontWeight: '700' as const, color: '#475569', marginBottom: 4 };
  const inputStyle = {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#0f172a',
  };
  const Req = () => <Text style={{ color: '#e11d48' }}> *</Text>;
  const Hint = ({ text, color = '#94a3b8' }: { text: string; color?: string }) => (
    <Text style={{ fontSize: 9.5, fontWeight: '600', color, marginTop: 2 }}>{text}</Text>
  );
  const todayIso = toIso(new Date());

  return (
    <View style={{ marginTop: 10, backgroundColor: '#f0fdf4', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#a7f3d0', gap: 10 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#d1fae5' }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' }}>
          <Sprout size={15} color="#ffffff" />
        </View>
        <View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>Thẻ tạo vụ nuôi</Text>
          <Text style={{ fontSize: 10, color: '#64748b' }}>{ponds.length} ao đang trống • mục có dấu * là bắt buộc</Text>
        </View>
      </View>

      {/* Trang trại */}
      {farms.length > 1 && (
        <View>
          <Text style={sectionLabel}>
            Trang trại
            <Req />
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {farms.map((f) => (
              <TouchableOpacity key={f.id} disabled={locked} onPress={() => selectFarm(f.id)} style={chip(form.farmId === f.id)} activeOpacity={0.7}>
                <Text style={chipText(form.farmId === f.id)}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Ao đang trống */}
      <View>
        <Text style={sectionLabel}>
          Ao thả giống (đang trống)
          <Req />
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {pondsInFarm.map((p) => (
            <TouchableOpacity key={p.id} disabled={locked} onPress={() => selectPond(p.id)} style={chip(form.pondId === p.id)} activeOpacity={0.7}>
              <Text style={chipText(form.pondId === p.id)}>
                {p.name} · {fmt(p.areaSize)} m²
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {pond && (
        <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#ffffff' }}>
          {[
            ['Diện tích', `${fmt(pond.areaSize)} m²`],
            ['Độ sâu', pond.depth ? `${pond.depth} m` : '—'],
            ['Mô hình', pond.farmingModel === 'HIGH_TECH' ? 'Công nghệ cao' : pond.farmingModel === 'TRADITIONAL' ? 'Truyền thống' : '—'],
          ].map(([k, v], idx) => (
            <View key={k} style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderLeftWidth: idx ? 1 : 0, borderLeftColor: '#f1f5f9' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#94a3b8' }}>{k.toUpperCase()}</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>{v}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ngày thả */}
      <View>
        <Text style={sectionLabel}>
          Ngày thả giống
          <Req />
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {[
            ['Hôm nay', todayIso],
            ['Ngày mai', addDays(todayIso, 1)],
          ].map(([text, iso]) => (
            <TouchableOpacity key={text} disabled={locked} onPress={() => set('startDateText', isoToVn(iso))} style={chip(ev.startIso === iso)} activeOpacity={0.7}>
              <Text style={chipText(ev.startIso === iso)}>{text}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            value={form.startDateText}
            onChangeText={(t) => set('startDateText', t)}
            editable={!locked}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#cbd5e1"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            style={{ ...inputStyle, flex: 1, textAlign: 'center', borderColor: touched && !ev.startIso ? '#fda4af' : '#e2e8f0' }}
          />
        </View>
      </View>

      {/* Số lượng giống */}
      <View>
        <Text style={sectionLabel}>
          Số lượng giống thả (con)
          <Req />
        </Text>
        <TextInput
          value={form.initialShrimpCount}
          onChangeText={(t) => set('initialShrimpCount', t)}
          editable={!locked}
          keyboardType="number-pad"
          placeholder="Vd: 200000"
          placeholderTextColor="#cbd5e1"
          style={{ ...inputStyle, borderColor: densityLevel?.border || '#e2e8f0', backgroundColor: densityLevel?.bg || '#ffffff' }}
        />
        {densityLevel && ev.density !== null ? (
          <Hint text={`${ev.density.toFixed(1)} con/m² — ${densityLevel.label}`} color={densityLevel.color} />
        ) : ev.density !== null && ev.density > MAX_DENSITY ? (
          <Hint text={`${ev.density.toFixed(1)} con/m² — vượt ngưỡng tối đa ${MAX_DENSITY}`} color="#e11d48" />
        ) : null}
      </View>

      {/* Giai đoạn + mốc */}
      <View>
        <Text style={sectionLabel}>
          Giai đoạn
          <Req />
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(
            [
              ['NURSERY', 'Ương dưỡng'],
              ['COMMERCIAL', 'Thương phẩm'],
            ] as const
          ).map(([value, text]) => {
            const disabled = locked || (stageLock !== null && stageLock !== value);
            return (
              <TouchableOpacity
                key={value}
                disabled={disabled}
                onPress={() => selectStage(value)}
                style={{ ...chip(form.stage === value), opacity: disabled && form.stage !== value ? 0.4 : 1 }}
                activeOpacity={0.7}
              >
                <Text style={chipText(form.stage === value)}>{text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {stageLock && (
          <Hint text={stageLock === 'NURSERY' ? 'Công nghệ cao: bắt buộc bắt đầu Ương dưỡng' : 'Truyền thống: chỉ nuôi Thương phẩm'} />
        )}
      </View>

      <View>
        <Text style={sectionLabel}>
          {form.stage === 'NURSERY' ? 'Số ngày ương đến khi tách ao' : 'Số ngày nuôi đến khi thu hoạch'}
          <Req />
        </Text>
        <TextInput
          value={form.milestoneDays}
          onChangeText={(t) => set('milestoneDays', t)}
          editable={!locked}
          keyboardType="number-pad"
          placeholderTextColor="#cbd5e1"
          style={inputStyle}
        />
        {ev.milestoneIso ? (
          <Hint text={`${form.stage === 'NURSERY' ? 'Dự tính tách ao' : 'Dự kiến thu hoạch'}: ${isoToVn(ev.milestoneIso)}`} />
        ) : null}
      </View>

      {/* Con giống */}
      <View>
        <Text style={sectionLabel}>Loại giống</Text>
        <TextInput value={form.seedType} onChangeText={(t) => set('seedType', t)} editable={!locked} style={{ ...inputStyle, fontSize: 12 }} />
      </View>

      {/* Giá giống — kết nối giá thị trường Tép Bạc (giống form tạo vụ thủ công) */}
      <View style={{ borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#eff6ff', borderRadius: 12, padding: 10, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Tag size={12} color="#2563eb" />
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e3a8a' }}>Giá giống thị trường</Text>
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL(market?.sourceUrl || SEED_PRICE_URL).catch(() => undefined)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563eb' }}>
              Tép Bạc: {fmt(seedPrice)} đ/con{!market || !market.isLive ? ' (mặc định)' : ''}
            </Text>
            <ExternalLink size={11} color="#3b82f6" />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={sectionLabel}>Đơn giá giống (đ/con)</Text>
            <View style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>{fmt(seedPrice)}</Text>
              <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#059669' }}>Tự động</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={sectionLabel}>Tổng tiền giống</Text>
            <View style={{ ...inputStyle, borderColor: '#bfdbfe', justifyContent: 'center' }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: '#1d4ed8' }}>
                {ev.count ? `${fmt(Math.round(ev.count * ev.price))} đ` : '—'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={{ fontSize: 9.5, color: '#64748b' }}>
          {market
            ? `Tự động theo giá ${market.source}${market.isLive ? '' : ' (mặc định)'}, cập nhật ${new Date(market.updatedAt).toLocaleDateString('vi-VN')} — áp giá Tép Bạc mới nhất khi lưu.`
            : 'Chưa lấy được giá Tép Bạc — đang hiển thị giá mặc định; áp giá Tép Bạc mới nhất khi lưu.'}
        </Text>
      </View>

      {/* Mục tiêu */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(
          [
            ['targetSurvivalRate', 'Tỷ lệ sống (%)', ''],
            ['targetHarvestSize', 'Size (con/kg)', ''],
            ['targetTotalFeedKg', 'Thức ăn (kg)', 'Tùy chọn'],
          ] as const
        ).map(([key, text, placeholder]) => (
          <View key={key} style={{ flex: 1 }}>
            <Text style={sectionLabel}>{text}</Text>
            <TextInput
              value={form[key]}
              onChangeText={(t) => set(key, t)}
              editable={!locked}
              keyboardType="decimal-pad"
              placeholder={placeholder}
              placeholderTextColor="#cbd5e1"
              style={inputStyle}
            />
          </View>
        ))}
      </View>
      {ev.biomassKg > 0 && (
        <Hint
          color="#475569"
          text={`Ước tính: thu ~${fmt(ev.harvestCount)} con ≈ ${fmt(ev.biomassKg)} kg${ev.fcr ? ` • FCR dự kiến ${ev.fcr.toFixed(2)}` : ''}`}
        />
      )}

      {touched && ev.errors.length > 0 && !locked && (
        <View style={{ padding: 8, borderRadius: 10, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} color="#be123c" />
            <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#be123c' }}>Vui lòng sửa {ev.errors.length} lỗi trước khi tạo vụ:</Text>
          </View>
          {ev.errors.map((e) => (
            <Text key={e} style={{ fontSize: 10.5, color: '#be123c' }}>
              • {e}
            </Text>
          ))}
        </View>
      )}

      {/* Hành động */}
      {executed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, borderRadius: 10, backgroundColor: '#ecfdf5' }}>
          <CheckCircle2 size={15} color="#059669" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>Đã tạo vụ nuôi vào hệ thống!</Text>
        </View>
      ) : readOnlyReason ? (
        <View style={{ padding: 8, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textAlign: 'center' }}>{readOnlyReason}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={executing}
            activeOpacity={0.8}
            style={{ flex: 1, backgroundColor: '#059669', paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {executing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Sprout size={14} color="#ffffff" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>Tạo vụ nuôi</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleReset}
            disabled={executing}
            activeOpacity={0.8}
            style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <RotateCcw size={13} color="#475569" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Điền lại</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
