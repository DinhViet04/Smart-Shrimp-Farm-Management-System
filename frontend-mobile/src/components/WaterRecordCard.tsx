/**
 * WaterRecordCard (mobile)
 *
 * Thẻ nhập thông số môi trường nước ngay trong khung chat AI (dành cho Kỹ thuật viên).
 * - Tự chọn ao đã được nhắc trong cuộc trò chuyện; hiển thị bảng dữ liệu ao
 *   (diện tích, độ sâu, thể tích, DOC, lần đo trước) để đối chiếu.
 * - Validation đầy đủ khớp backend: bắt buộc, định dạng số, giới hạn, số chữ số thập phân,
 *   giờ đo hợp lệ & không ở tương lai, độ dài ghi chú.
 * Chỉ dùng thành phần lõi React Native.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Droplets, RotateCcw, Save } from 'lucide-react-native';
import type { AgentActionDraft } from '../services/chatbotService';

type Status = 'Optimal' | 'Warning' | 'Danger';

interface FieldDef {
  key: string;
  label: string;
  unit: string;
  required: boolean;
  min: number;
  max: number;
  decimals: number;
  optimal?: string;
  status?: (v: number) => Status;
}

const between = (v: number, a: number, b: number) => v >= a && v <= b;

/** Ngưỡng & giới hạn khớp backend */
const FIELDS: FieldDef[] = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', required: true, min: 15, max: 40, decimals: 2, optimal: '25-30',
    status: (v) => (between(v, 25, 30) ? 'Optimal' : between(v, 20, 33) ? 'Warning' : 'Danger') },
  { key: 'ph', label: 'pH', unit: '', required: true, min: 5, max: 10, decimals: 2, optimal: '8.2-8.5',
    status: (v) => (between(v, 8.2, 8.5) ? 'Optimal' : between(v, 7.5, 9) ? 'Warning' : 'Danger') },
  { key: 'dissolvedOxygen', label: 'Oxy DO', unit: 'mg/L', required: true, min: 0, max: 20, decimals: 2, optimal: '> 4',
    status: (v) => (v > 4 ? 'Optimal' : v >= 3 ? 'Warning' : 'Danger') },
  { key: 'salinity', label: 'Độ mặn', unit: '‰', required: true, min: 0, max: 50, decimals: 2, optimal: '10-25',
    status: (v) => (between(v, 10, 25) ? 'Optimal' : between(v, 5, 30) ? 'Warning' : 'Danger') },
  { key: 'alkalinity', label: 'Độ kiềm', unit: 'mg/L', required: true, min: 0, max: 300, decimals: 2, optimal: '100-160',
    status: (v) => (between(v, 100, 160) ? 'Optimal' : between(v, 80, 200) ? 'Warning' : 'Danger') },
  { key: 'nh3', label: 'NH3', unit: 'mg/L', required: true, min: 0, max: 100, decimals: 3, optimal: '≤ 0.3',
    status: (v) => (v <= 0.3 ? 'Optimal' : v <= 0.5 ? 'Warning' : 'Danger') },
  { key: 'transparency', label: 'Độ trong', unit: 'cm', required: true, min: 0, max: 500, decimals: 2, optimal: '25-40',
    status: (v) => (between(v, 25, 40) ? 'Optimal' : between(v, 20, 50) ? 'Warning' : 'Danger') },
  { key: 'no2', label: 'NO2', unit: 'mg/L', required: false, min: 0, max: 100, decimals: 3 },
  { key: 'h2s', label: 'H2S', unit: 'mg/L', required: false, min: 0, max: 100, decimals: 3, optimal: '≤ 0.03',
    status: (v) => (v <= 0.03 ? 'Optimal' : v <= 0.05 ? 'Warning' : 'Danger') },
];

const WATER_COLORS = ['Xanh lục', 'Xanh vỏ đậu', 'Nâu nhạt', 'Vàng', 'Trong', 'Đục', 'Đỏ', 'Đen'];
const MAX_NOTE = 500;

const STATUS_STYLE: Record<Status, { border: string; bg: string; text: string; label: string }> = {
  Optimal: { border: '#6ee7b7', bg: '#ecfdf5', text: '#059669', label: 'Tối ưu' },
  Warning: { border: '#fcd34d', bg: '#fffbeb', text: '#d97706', label: 'Cần chú ý' },
  Danger: { border: '#fda4af', bg: '#fff1f2', text: '#e11d48', label: 'Nguy hiểm' },
};

const pad = (n: number) => String(n).padStart(2, '0');

function checkField(f: FieldDef, raw: string): { value?: number; error?: string } {
  const s = raw.trim();
  if (!s) return f.required ? { error: 'Chưa nhập' } : {};
  if (!/^-?\d+(?:[.,]\d+)?$/.test(s)) return { error: 'Không phải số hợp lệ' };
  const v = Number(s.replace(',', '.'));
  if (v < f.min || v > f.max) return { error: `Hợp lệ ${f.min}-${f.max}` };
  const dot = s.replace(',', '.').indexOf('.');
  if (dot !== -1 && s.length - dot - 1 > f.decimals) return { error: `Tối đa ${f.decimals} số thập phân` };
  return { value: v };
}

function initialTime(iso?: string) {
  const parsed = iso ? new Date(iso) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const today = new Date();
  const dayDiff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000,
  );
  return { dayOffset: dayDiff === 1 ? 1 : 0, text: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function initialValues(data: Record<string, unknown>) {
  const values: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = data[f.key];
    values[f.key] = v === undefined || v === null ? '' : String(v);
  }
  return values;
}

interface Props {
  draft: AgentActionDraft;
  executed: boolean;
  executing: boolean;
  readOnlyReason?: string;
  onSubmit: (data: Record<string, unknown>) => void;
}

export default function WaterRecordCard({ draft, executed, executing, readOnlyReason, onSubmit }: Props) {
  const initial: Record<string, any> = draft.collectedData || {};
  const ponds = useMemo(() => draft.pondOptions || [], [draft.pondOptions]);
  // Khóa trang trại: ưu tiên farmId, dự phòng tên trại (dữ liệu cũ chưa có farmId)
  const farmKey = (p: { farmId?: string; farmName: string }) => p.farmId || p.farmName;
  const farms = useMemo(() => {
    const map = new Map<string, string>();
    ponds.forEach((p) => map.set(p.farmId || p.farmName, p.farmName));
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [ponds]);

  const initialPond = ponds.find((p) => p.id === initial.pondId);
  const initialFarmKey =
    (initialPond && farmKey(initialPond)) ||
    farms.find((f) => f.key === initial.farmId || f.name === initial.farmName)?.key ||
    (farms.length === 1 ? farms[0].key : '');
  const farmPondsInit = ponds.filter((p) => farmKey(p) === initialFarmKey);
  const defaultPondId =
    initialPond?.id || (initialFarmKey && farmPondsInit.length === 1 ? farmPondsInit[0].id : '');
  const t0 = initialTime(initial.recordTime);

  const [farmSel, setFarmSel] = useState<string>(initialFarmKey);
  const [pondId, setPondId] = useState<string>(defaultPondId);
  const [dayOffset, setDayOffset] = useState<number>(t0.dayOffset);
  const [timeText, setTimeText] = useState<string>(t0.text);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(initial));
  const [waterColor, setWaterColor] = useState<string>(initial.waterColor || '');
  const [note, setNote] = useState<string>(initial.note || '');
  const [touched, setTouched] = useState(false);
  const [timeError, setTimeError] = useState('');

  const locked = executed || executing || Boolean(readOnlyReason);
  const pond = ponds.find((p) => p.id === pondId);
  const last = pond?.lastRecord || null;

  const pondsInFarm = farmSel ? ponds.filter((p) => farmKey(p) === farmSel) : ponds;
  const pondLabel = (p: { name: string; farmName: string }) =>
    !farmSel && ponds.filter((o) => o.name === p.name).length > 1 ? `${p.name} · ${p.farmName}` : p.name;

  const handleFarmChange = (key: string) => {
    setFarmSel(key);
    const list = ponds.filter((p) => farmKey(p) === key);
    // Ao đang chọn không thuộc trại mới -> bỏ; trại chỉ có 1 ao -> chọn luôn
    if (!list.some((p) => p.id === pondId)) setPondId(list.length === 1 ? list[0].id : '');
  };

  const handlePondChange = (id: string) => {
    setPondId(id);
    const p = ponds.find((o) => o.id === id);
    if (p) setFarmSel(farmKey(p));
  };

  const evaluation = useMemo(() => {
    const perField: Record<string, { value?: number; error?: string; status?: Status }> = {};
    const statuses: Status[] = [];
    for (const f of FIELDS) {
      const res = checkField(f, values[f.key] || '');
      const status = res.value !== undefined ? f.status?.(res.value) : undefined;
      perField[f.key] = { ...res, status };
      if (status) statuses.push(status);
    }
    const errors: string[] = [];
    if (!farmSel && farms.length > 1) errors.push('Chưa chọn trang trại');
    if (!pondId) errors.push('Chưa chọn ao nuôi');
    else if (farmSel && !ponds.some((p) => p.id === pondId && (p.farmId || p.farmName) === farmSel)) {
      errors.push('Ao nuôi không thuộc trang trại đã chọn');
    }
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(timeText.trim())) errors.push('Giờ đo phải dạng HH:mm (00:00 - 23:59)');
    FIELDS.forEach((f) => {
      const e = perField[f.key].error;
      if (e) errors.push(`${f.label}: ${e.toLowerCase()}`);
    });
    if (note.length > MAX_NOTE) errors.push(`Ghi chú tối đa ${MAX_NOTE} ký tự`);
    const overall: Status | null = statuses.length
      ? statuses.includes('Danger')
        ? 'Danger'
        : statuses.includes('Warning')
          ? 'Warning'
          : 'Optimal'
      : null;
    const filled = FIELDS.filter((f) => f.required && perField[f.key].value !== undefined).length;
    return { perField, errors, overall, filled };
  }, [values, pondId, timeText, note, farmSel, farms.length, ponds]);

  const requiredCount = FIELDS.filter((f) => f.required).length;

  const handleSubmit = () => {
    setTouched(true);
    if (locked || evaluation.errors.length > 0) return;
    const [hh, mm] = timeText.trim().split(':').map(Number);
    const now = new Date();
    const recordTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset, hh, mm);
    if (recordTime.getTime() > Date.now() + 10 * 60 * 1000) {
      setTimeError('Thời điểm đo không được ở tương lai');
      return;
    }
    setTimeError('');
    const data: Record<string, unknown> = {
      pondId,
      recordTime: recordTime.toISOString(),
      waterColor: waterColor || undefined,
      note: note.trim() || undefined,
    };
    for (const f of FIELDS) {
      const v = evaluation.perField[f.key].value;
      if (v !== undefined) data[f.key] = v;
    }
    onSubmit(data);
  };

  const handleReset = () => {
    const t = initialTime(initial.recordTime);
    setValues(initialValues(initial));
    setFarmSel(initialFarmKey);
    setPondId(defaultPondId);
    setDayOffset(t.dayOffset);
    setTimeText(t.text);
    setWaterColor(initial.waterColor || '');
    setNote(initial.note || '');
    setTouched(false);
    setTimeError('');
  };

  const chip = (active: boolean) => ({
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: active ? '#0284c7' : '#e2e8f0',
    backgroundColor: active ? '#e0f2fe' : '#ffffff',
  });
  const chipText = (active: boolean) => ({
    fontSize: 11,
    fontWeight: '700' as const,
    color: active ? '#0369a1' : '#475569',
  });
  const sectionLabel = { fontSize: 11, fontWeight: '700' as const, color: '#475569', marginBottom: 4 };
  const allErrors = [...evaluation.errors, ...(timeError ? [timeError] : [])];

  return (
    <View style={{ marginTop: 10, backgroundColor: '#f0f9ff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#bae6fd', gap: 10 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e0f2fe' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center' }}>
            <Droplets size={15} color="#ffffff" />
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>Thẻ thông số nước</Text>
            <Text style={{ fontSize: 10, color: '#64748b' }}>
              Đã nhập hợp lệ {evaluation.filled}/{requiredCount} chỉ số bắt buộc
            </Text>
          </View>
        </View>
        {evaluation.overall && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: STATUS_STYLE[evaluation.overall].border, backgroundColor: STATUS_STYLE[evaluation.overall].bg }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: STATUS_STYLE[evaluation.overall].text }}>
              {STATUS_STYLE[evaluation.overall].label}
            </Text>
          </View>
        )}
      </View>

      {/* Trang trại */}
      {farms.length > 0 && (
        <View>
          <Text style={sectionLabel}>
            Trang trại <Text style={{ color: '#e11d48' }}>*</Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {farms.map((f) => (
              <TouchableOpacity
                key={f.key}
                disabled={locked || farms.length <= 1}
                onPress={() => handleFarmChange(f.key)}
                style={chip(farmSel === f.key)}
                activeOpacity={0.7}
              >
                <Text style={chipText(farmSel === f.key)}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Ao nuôi (lọc theo trang trại đã chọn) */}
      <View>
        <Text style={sectionLabel}>
          Ao nuôi <Text style={{ color: '#e11d48' }}>*</Text>
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {pondsInFarm.map((p) => (
            <TouchableOpacity key={p.id} disabled={locked} onPress={() => handlePondChange(p.id)} style={chip(pondId === p.id)} activeOpacity={0.7}>
              <Text style={chipText(pondId === p.id)}>{pondLabel(p)}</Text>
            </TouchableOpacity>
          ))}
          {ponds.length === 0 && <Text style={{ fontSize: 11, color: '#94a3b8' }}>Chưa có ao được phân công</Text>}
        </View>
      </View>

      {/* Bảng dữ liệu ao */}
      {pond && (
        <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#ffffff', overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row' }}>
            {[
              ['Diện tích', pond.areaSize ? `${pond.areaSize.toLocaleString('vi-VN')} m²` : '—'],
              ['Độ sâu', pond.depth ? `${pond.depth} m` : '—'],
              ['Thể tích', pond.waterVolume ? `${pond.waterVolume.toLocaleString('vi-VN')} m³` : '—'],
              ['Ngày nuôi', pond.doc ? `DOC ${pond.doc}` : 'Chưa thả'],
            ].map(([k, v], idx) => (
              <View key={k} style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderLeftWidth: idx ? 1 : 0, borderLeftColor: '#f1f5f9' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#94a3b8' }}>{k.toUpperCase()}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 10, color: '#64748b' }}>
              {last
                ? `Lần đo trước: ${formatTime(last.recordTime)}${last.waterColor ? ` • Màu nước: ${last.waterColor}` : ''}`
                : 'Ao này chưa có lần đo nào trước đó'}
            </Text>
          </View>
        </View>
      )}

      {/* Thời điểm đo */}
      <View>
        <Text style={sectionLabel}>
          Thời điểm đo <Text style={{ color: '#e11d48' }}>*</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {['Hôm nay', 'Hôm qua'].map((label, idx) => (
            <TouchableOpacity key={label} disabled={locked} onPress={() => setDayOffset(idx)} style={chip(dayOffset === idx)} activeOpacity={0.7}>
              <Text style={chipText(dayOffset === idx)}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            value={timeText}
            onChangeText={(t) => {
              setTimeText(t);
              setTimeError('');
            }}
            editable={!locked}
            placeholder="HH:mm"
            placeholderTextColor="#cbd5e1"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={{ width: 70, borderWidth: 1, borderColor: timeError ? '#fda4af' : '#e2e8f0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, fontWeight: '700', color: '#0f172a', backgroundColor: '#ffffff', textAlign: 'center' }}
          />
        </View>
      </View>

      {/* Chỉ số */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
        {FIELDS.map((f) => {
          const ev = evaluation.perField[f.key];
          const st = ev.status ? STATUS_STYLE[ev.status] : null;
          const showError = Boolean(ev.error) && (touched || (values[f.key]?.trim() ?? '') !== '');
          const prev = last?.[f.key];
          return (
            <View key={f.key} style={{ width: '48.5%' }}>
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#475569', marginBottom: 3 }}>
                {f.label}
                {f.unit ? <Text style={{ color: '#94a3b8', fontWeight: '500' }}> ({f.unit})</Text> : null}
                {f.required ? <Text style={{ color: '#e11d48' }}> *</Text> : null}
              </Text>
              <TextInput
                value={values[f.key]}
                onChangeText={(t) => setValues((p) => ({ ...p, [f.key]: t }))}
                editable={!locked}
                keyboardType="decimal-pad"
                placeholder={f.optimal ? `TƯ: ${f.optimal}` : 'Không bắt buộc'}
                placeholderTextColor="#cbd5e1"
                style={{
                  borderWidth: 1,
                  borderColor: showError ? '#fda4af' : st ? st.border : '#e2e8f0',
                  backgroundColor: showError ? '#fff1f2' : st ? st.bg : '#ffffff',
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#0f172a',
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, minHeight: 12 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: showError ? '#e11d48' : st ? st.text : '#94a3b8' }}>
                  {showError ? ev.error : st ? st.label : ''}
                </Text>
                {prev !== undefined && prev !== null ? (
                  <Text style={{ fontSize: 9.5, color: '#94a3b8' }}>Trước: {String(prev)}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Màu nước */}
      <View>
        <Text style={sectionLabel}>Màu nước</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[...WATER_COLORS, ...(waterColor && !WATER_COLORS.includes(waterColor) ? [waterColor] : [])].map((c) => (
            <TouchableOpacity key={c} disabled={locked} onPress={() => setWaterColor(waterColor === c ? '' : c)} style={chip(waterColor === c)} activeOpacity={0.7}>
              <Text style={chipText(waterColor === c)}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Ghi chú */}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={sectionLabel}>Ghi chú quan sát</Text>
          <Text style={{ fontSize: 10, color: note.length > MAX_NOTE ? '#e11d48' : '#94a3b8' }}>
            {note.length}/{MAX_NOTE}
          </Text>
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          editable={!locked}
          placeholder="Vd: tôm nổi đầu, nước có bọt..."
          placeholderTextColor="#cbd5e1"
          style={{ borderWidth: 1, borderColor: note.length > MAX_NOTE ? '#fda4af' : '#e2e8f0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: '#0f172a', backgroundColor: '#ffffff' }}
        />
      </View>

      {touched && allErrors.length > 0 && !locked && (
        <View style={{ padding: 8, borderRadius: 10, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} color="#be123c" />
            <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#be123c' }}>
              Vui lòng sửa {allErrors.length} lỗi trước khi lưu:
            </Text>
          </View>
          {allErrors.map((e) => (
            <Text key={e} style={{ fontSize: 10.5, color: '#be123c' }}>• {e}</Text>
          ))}
        </View>
      )}

      {/* Hành động */}
      {executed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, borderRadius: 10, backgroundColor: '#ecfdf5' }}>
          <CheckCircle2 size={15} color="#059669" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>Đã lưu số đo vào hệ thống!</Text>
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
            style={{ flex: 1, backgroundColor: '#0284c7', paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {executing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Save size={14} color="#ffffff" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>Lưu số đo</Text>
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
