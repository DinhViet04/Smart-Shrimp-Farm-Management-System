/**
 * RecordWaterQualityScreen.tsx
 *
 * Allows a Farmer to record water quality parameters for a selected pond.
 * Feature: FE-23 — Record Water Quality Parameters
 *
 * Behaviour:
 *  - Loads the farmer's farms and ponds on mount.
 *  - Validates each numeric field inline (below the input).
 *  - Shows real-time coloured status badges (Optimal/Warning/Danger).
 *  - Displays an activity indicator while saving.
 *  - Shows a Snackbar on success and navigates back.
 */

import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import {
  getFarms,
  getPonds,
  createWaterQualityRecord,
  Farm,
  Pond,
} from '../../services/waterQualityService';

// ─── Water quality status helpers ─────────────────────────────────────────────

type WQStatus = 'optimal' | 'warning' | 'danger' | null;

function getTemperatureStatus(v: number | null): WQStatus {
  if (v === null || v < 15 || v > 40) return null;
  if (v >= 28 && v <= 32) return 'optimal';
  if ((v >= 25 && v < 28) || (v > 32 && v <= 34)) return 'warning';
  return 'danger';
}

function getPhStatus(v: number | null): WQStatus {
  if (v === null || v < 5 || v > 10) return null;
  if (v >= 7.5 && v <= 8.5) return 'optimal';
  if ((v >= 7.0 && v < 7.5) || (v > 8.5 && v <= 9.0)) return 'warning';
  return 'danger';
}

function getDoStatus(v: number | null): WQStatus {
  if (v === null || v < 0 || v > 20) return null;
  if (v > 5) return 'optimal';
  if (v >= 4) return 'warning';
  return 'danger';
}

function getSalinityStatus(v: number | null): WQStatus {
  if (v === null || v < 0 || v > 50) return null;
  if (v >= 10 && v <= 25) return 'optimal';
  if ((v >= 5 && v < 10) || (v > 25 && v <= 30)) return 'warning';
  return 'danger';
}

function getAlkalinityStatus(v: number | null): WQStatus {
  if (v === null || v < 0 || v > 300) return null;
  if (v >= 80 && v <= 200) return 'optimal';
  if ((v >= 60 && v < 80) || (v > 200 && v <= 250)) return 'warning';
  return 'danger';
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  optimal: { bg: '#dcfce7', text: '#15803d', label: 'Tối ưu' },
  warning: { bg: '#fef9c3', text: '#854d0e', label: 'Cảnh báo' },
  danger: { bg: '#fee2e2', text: '#b91c1c', label: 'Nguy hiểm' },
};

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateField(name: string, v: number | null): string | null {
  if (v === null || isNaN(v)) return 'Vui lòng nhập giá trị hợp lệ';
  switch (name) {
    case 'temperature':
      return v < 15 || v > 40 ? 'Nhiệt độ phải từ 15–40°C' : null;
    case 'ph':
      return v < 5 || v > 10 ? 'pH phải từ 5–10' : null;
    case 'dissolvedOxygen':
      return v < 0 || v > 20 ? 'DO phải từ 0–20 mg/L' : null;
    case 'salinity':
      return v < 0 || v > 50 ? 'Độ mặn phải từ 0–50 ppt' : null;
    case 'alkalinity':
      return v < 0 || v > 300 ? 'Độ kiềm phải từ 0–300 mg/L' : null;
    case 'nh3':
      return v < 0 ? 'NH3 không được âm' : null;
    case 'no2':
      return v < 0 ? 'NO2 không được âm' : null;
    default:
      return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: WQStatus;
}
const StatusBadge = ({ status }: StatusBadgeProps) => {
  if (!status) return null;
  const { bg, text, label } = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
};

interface DropdownProps {
  label: string;
  value: string | null;
  placeholder: string;
  items: { id: string; name: string }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}
const Dropdown = ({
  label,
  value,
  placeholder,
  items,
  onSelect,
  disabled,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdownButton, disabled && styles.disabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={selected ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {selected ? selected.name : placeholder}
        </Text>
        <Text style={styles.dropdownChevron}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setOpen(false)}
          activeOpacity={1}
        >
          <View style={styles.dropdownList}>
            <Text style={styles.dropdownListTitle}>{label}</Text>
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    item.id === value && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      item.id === value && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

interface NumericFieldProps {
  label: string;
  unit: string;
  fieldKey: string;
  value: string;
  onChange: (key: string, val: string) => void;
  error: string | null;
  status: WQStatus;
}
const NumericField = ({
  label,
  unit,
  fieldKey,
  value,
  onChange,
  error,
  status,
}: NumericFieldProps) => (
  <View style={styles.fieldBlock}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>
        {label} <Text style={styles.unit}>({unit})</Text>
      </Text>
      <StatusBadge status={status} />
    </View>
    <TextInput
      style={[styles.input, error ? styles.inputError : null]}
      keyboardType="decimal-pad"
      placeholder={`Nhập ${label.toLowerCase()}`}
      placeholderTextColor="#94a3b8"
      value={value}
      onChangeText={(t) => onChange(fieldKey, t)}
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

// ─── Snackbar ──────────────────────────────────────────────────────────────────

interface SnackbarProps {
  visible: boolean;
  message: string;
}
const Snackbar = ({ visible, message }: SnackbarProps) => {
  if (!visible) return null;
  return (
    <View style={styles.snackbar}>
      <Text style={styles.snackbarText}>{message}</Text>
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────

interface RecordWaterQualityScreenProps {
  navigation?: any;
}

interface FormValues {
  temperature: string;
  ph: string;
  dissolvedOxygen: string;
  salinity: string;
  alkalinity: string;
  nh3: string;
  no2: string;
  note: string;
}

const INITIAL_FORM: FormValues = {
  temperature: '',
  ph: '',
  dissolvedOxygen: '',
  salinity: '',
  alkalinity: '',
  nh3: '',
  no2: '',
  note: '',
};

export default function RecordWaterQualityScreen({
  navigation,
}: RecordWaterQualityScreenProps) {
  const { userToken } = useContext(AuthContext);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [selectedPondId, setSelectedPondId] = useState<string | null>(null);

  // recordTime — defaults to now, editable as ISO string
  const [recordTime, setRecordTime] = useState<string>(
    new Date().toISOString().slice(0, 16), // "YYYY-MM-DDTHH:mm"
  );

  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  // ── Derived: filtered ponds by selected farm ─────────────────────────────────
  const filteredPonds = selectedFarmId
    ? ponds.filter((p) => p.farmId === selectedFarmId)
    : ponds;

  // ── Load farms & ponds ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userToken) return;
    (async () => {
      try {
        const [farmsData, pondsData] = await Promise.all([
          getFarms(userToken),
          getPonds(userToken),
        ]);
        setFarms(farmsData);
        setPonds(pondsData);
      } catch (e) {
        console.error('Failed to load farms/ponds', e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [userToken]);

  // ── Field change handler ─────────────────────────────────────────────────────
  const handleChange = useCallback((key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    // Clear error on change
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  // ── Computed status for each field ───────────────────────────────────────────
  const numVal = (key: keyof FormValues) => {
    const n = parseFloat(form[key]);
    return isNaN(n) ? null : n;
  };

  const status = {
    temperature: getTemperatureStatus(numVal('temperature')),
    ph: getPhStatus(numVal('ph')),
    dissolvedOxygen: getDoStatus(numVal('dissolvedOxygen')),
    salinity: getSalinityStatus(numVal('salinity')),
    alkalinity: getAlkalinityStatus(numVal('alkalinity')),
    nh3: null as WQStatus,
    no2: null as WQStatus,
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormValues, string>> = {};
    const numericKeys: (keyof FormValues)[] = [
      'temperature', 'ph', 'dissolvedOxygen', 'salinity', 'alkalinity', 'nh3', 'no2',
    ];
    numericKeys.forEach((k) => {
      const err = validateField(k, numVal(k));
      if (err) newErrors[k] = err;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedPondId) {
      setSnackbar({ visible: true, message: 'Vui lòng chọn ao nuôi' });
      setTimeout(() => setSnackbar({ visible: false, message: '' }), 3000);
      return;
    }
    if (!validate()) return;
    if (!userToken) return;

    setSaving(true);
    try {
      await createWaterQualityRecord(userToken, {
        pondId: selectedPondId,
        recordTime: new Date(recordTime).toISOString(),
        temperature: parseFloat(form.temperature),
        ph: parseFloat(form.ph),
        dissolvedOxygen: parseFloat(form.dissolvedOxygen),
        salinity: parseFloat(form.salinity),
        alkalinity: parseFloat(form.alkalinity),
        nh3: parseFloat(form.nh3),
        no2: parseFloat(form.no2),
        note: form.note || undefined,
      });

      setSnackbar({ visible: true, message: '✓ Ghi nhận thông số thành công!' });
      setTimeout(() => {
        setSnackbar({ visible: false, message: '' });
        navigation?.goBack?.();
      }, 2000);
    } catch (err: any) {
      setSnackbar({
        visible: true,
        message: `Lỗi: ${err.message ?? 'Không thể lưu dữ liệu'}`,
      });
      setTimeout(() => setSnackbar({ visible: false, message: '' }), 3500);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>🌊</Text>
          </View>
          <View>
            <Text style={styles.pageTitle}>Ghi nhận môi trường nước</Text>
            <Text style={styles.pageSubtitle}>Nhập thông số chất lượng nước</Text>
          </View>
        </View>

        {/* ── Section: Location ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Vị trí</Text>

          <Dropdown
            label="Trang trại"
            value={selectedFarmId}
            placeholder="Chọn trang trại..."
            items={farms}
            onSelect={(id) => {
              setSelectedFarmId(id);
              setSelectedPondId(null);
            }}
          />

          <Dropdown
            label="Ao nuôi"
            value={selectedPondId}
            placeholder={selectedFarmId ? 'Chọn ao nuôi...' : 'Chọn trang trại trước'}
            items={filteredPonds}
            onSelect={setSelectedPondId}
            disabled={!selectedFarmId}
          />
        </View>

        {/* ── Section: Time ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🕐 Thời gian đo</Text>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Thời gian ghi nhận</Text>
            <TextInput
              style={styles.input}
              value={recordTime}
              onChangeText={setRecordTime}
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.hintText}>Định dạng: 2026-06-25T08:00</Text>
          </View>
        </View>

        {/* ── Section: Parameters ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Thông số đo lường</Text>

          <NumericField
            label="Nhiệt độ"
            unit="°C"
            fieldKey="temperature"
            value={form.temperature}
            onChange={handleChange}
            error={errors.temperature ?? null}
            status={status.temperature}
          />
          <NumericField
            label="pH"
            unit=""
            fieldKey="ph"
            value={form.ph}
            onChange={handleChange}
            error={errors.ph ?? null}
            status={status.ph}
          />
          <NumericField
            label="Oxy hòa tan (DO)"
            unit="mg/L"
            fieldKey="dissolvedOxygen"
            value={form.dissolvedOxygen}
            onChange={handleChange}
            error={errors.dissolvedOxygen ?? null}
            status={status.dissolvedOxygen}
          />
          <NumericField
            label="Độ mặn"
            unit="ppt"
            fieldKey="salinity"
            value={form.salinity}
            onChange={handleChange}
            error={errors.salinity ?? null}
            status={status.salinity}
          />
          <NumericField
            label="Độ kiềm"
            unit="mg/L"
            fieldKey="alkalinity"
            value={form.alkalinity}
            onChange={handleChange}
            error={errors.alkalinity ?? null}
            status={status.alkalinity}
          />
          <NumericField
            label="NH3"
            unit="mg/L"
            fieldKey="nh3"
            value={form.nh3}
            onChange={handleChange}
            error={errors.nh3 ?? null}
            status={status.nh3}
          />
          <NumericField
            label="NO2"
            unit="mg/L"
            fieldKey="no2"
            value={form.no2}
            onChange={handleChange}
            error={errors.no2 ?? null}
            status={status.no2}
          />
        </View>

        {/* ── Section: Note ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Ghi chú</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.note}
            onChangeText={(t) => handleChange('note', t)}
            placeholder="Nhập ghi chú (không bắt buộc)..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ── Legend ─────────────────────────────────────────────────── */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Chú thích màu sắc:</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>Tối ưu</Text>
            <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
            <Text style={styles.legendText}>Cảnh báo</Text>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Nguy hiểm</Text>
          </View>
        </View>

        {/* ── Submit ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.submitText}>Lưu thông số</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Snackbar (absolute overlay) ─────────────────────────────── */}
      <Snackbar visible={snackbar.visible} message={snackbar.message} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 28,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0c4a6e',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },

  // ── Sections ───────────────────────────────────────────────────────────────
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },

  // ── Fields ─────────────────────────────────────────────────────────────────
  fieldBlock: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  unit: {
    fontWeight: '400',
    color: '#94a3b8',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: '#0f172a',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  multiline: {
    minHeight: 100,
    paddingTop: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },

  // ── Dropdown ────────────────────────────────────────────────────────────────
  dropdownButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValue: {
    fontSize: 15,
    color: '#0f172a',
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
    flex: 1,
  },
  dropdownChevron: {
    fontSize: 10,
    color: '#94a3b8',
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: 380,
  },
  dropdownListTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  dropdownItemSelected: {
    backgroundColor: '#eff6ff',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#374151',
  },
  dropdownItemTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },

  // ── Status badge ─────────────────────────────────────────────────────────────
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Legend ──────────────────────────────────────────────────────────────────
  legend: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#374151',
    marginRight: 8,
  },

  // ── Submit ──────────────────────────────────────────────────────────────────
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Snackbar ────────────────────────────────────────────────────────────────
  snackbar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  snackbarText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
