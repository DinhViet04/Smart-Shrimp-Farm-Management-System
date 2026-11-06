import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Waves,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Tag,
  Flame,
  Plus,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { incidentService, type ActiveCrop } from '../../services/incidentService';
import { pondService, OverviewPond } from '../../services/pondService';
import {
  FARM_INCIDENT_CATEGORIES,
  FARM_INCIDENT_SEVERITIES,
  COMMON_INCIDENT_TITLE_SUGGESTIONS,
  LOCATION_SUGGESTIONS,
} from '../../constants/farmIncidentConstants';

export default function IncidentCreateScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { userRole } = useContext(AuthContext);
  const isManager = userRole === 'FARM_MANAGER' || userRole === 'ADMIN';

  // State
  const [locationType, setLocationType] = useState<'pond' | 'facility'>('pond');
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<ActiveCrop[]>([]);
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedCropId, setSelectedCropId] = useState('');
  const [facilityArea, setFacilityArea] = useState('⚡ Trạm biến áp trung tâm');
  const [locationDetail, setLocationDetail] = useState('');

  const [category, setCategory] = useState(FARM_INCIDENT_CATEGORIES[0].id);
  const [severity, setSeverity] = useState('Trung bình');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selfAssign, setSelfAssign] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      pondService.getOverview().catch(() => ({ ponds: [], farms: [], crops: [] })),
      incidentService.getActiveCrops().catch(() => []),
    ])
      .then(([overview, activeCrops]) => {
        const pondList = overview?.ponds || [];
        setPonds(pondList);
        setCrops(activeCrops || []);
        if (pondList.length > 0) {
          setSelectedPondId(pondList[0].id);
          const matchedCrop = activeCrops.find((c) => c.pond?.id === pondList[0].id);
          if (matchedCrop) setSelectedCropId(matchedCrop.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePondChange = (pondId: string) => {
    setSelectedPondId(pondId);
    const matchedCrop = crops.find((c) => c.pond?.id === pondId);
    if (matchedCrop) {
      setSelectedCropId(matchedCrop.id);
    } else {
      setSelectedCropId('');
    }
  };

  const handleCategoryChange = (catId: string) => {
    setCategory(catId);
    setTitle('');
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (locationType === 'pond' && !selectedPondId) {
      errs.location = 'Vui lòng chọn ao nuôi xảy ra sự cố';
    }
    if (!title.trim()) {
      errs.title = 'Vui lòng nhập hoặc chọn tiêu đề sự cố';
    } else if (title.trim().length < 5) {
      errs.title = 'Tiêu đề nên chi tiết hơn (tối thiểu 5 ký tự)';
    }

    if (!description.trim()) {
      errs.description = 'Vui lòng mô tả tình trạng hiện trường';
    } else if (description.trim().length < 6) {
      errs.description = 'Nội dung mô tả tối thiểu 6 ký tự';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const selectedPond = ponds.find((p) => p.id === selectedPondId);
      const computedLocation =
        locationType === 'pond'
          ? `Ao: ${selectedPond?.name || selectedPondId}${locationDetail ? ` (${locationDetail.trim()})` : ''}`
          : `${facilityArea}${locationDetail ? ` - ${locationDetail.trim()}` : ''}`;

      const payload: any = {
        title: `[${category}] ${title.trim()}`,
        description: `[Mức độ: ${severity}]\n[Vị trí: ${computedLocation}]\n${description.trim()}`,
        category,
        severity,
        location: computedLocation,
        selfAssign: isManager ? selfAssign : false,
      };

      if (locationType === 'pond') {
        if (selectedCropId) payload.cropId = selectedCropId;
        if (selectedPondId) payload.pondId = selectedPondId;
      }
      if (selectedPond?.farmId) {
        payload.farmId = selectedPond.farmId;
      }

      await incidentService.create(payload);
      Alert.alert('Thành công', 'Đã gửi báo cáo sự cố trang trại thành công!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể tạo báo cáo sự cố');
    } finally {
      setSaving(false);
    }
  };

  const suggestions = COMMON_INCIDENT_TITLE_SUGGESTIONS[category] || [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Đang tải danh mục sự cố...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── 1. Chọn Phân loại sự cố khách quan ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Tag size={18} color="#dc2626" />
          <Text style={styles.cardTitle}>1. Phân loại sự cố khách quan</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Sự cố kỹ thuật, máy móc, điện lưới, thời tiết hoặc cơ sở vật chất trang trại
        </Text>

        <View style={styles.categoryGrid}>
          {FARM_INCIDENT_CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected && {
                    backgroundColor: cat.badgeBg,
                    borderColor: cat.badgeText,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => handleCategoryChange(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && { color: cat.badgeText, fontWeight: '800' },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── 2. Mức độ nghiêm trọng ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Flame size={18} color="#ea580c" />
          <Text style={styles.cardTitle}>2. Mức độ ưu tiên xử lý</Text>
        </View>

        <View style={styles.severityRow}>
          {FARM_INCIDENT_SEVERITIES.map((sev) => {
            const isSelected = severity === sev.id;
            return (
              <TouchableOpacity
                key={sev.id}
                style={[
                  styles.severityChip,
                  isSelected && {
                    backgroundColor: sev.bg,
                    borderColor: sev.color,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => setSeverity(sev.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.severityLabel,
                    isSelected && { color: sev.color, fontWeight: '900' },
                  ]}
                >
                  {sev.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── 3. Vị trí xảy ra sự cố ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MapPin size={18} color="#2563eb" />
          <Text style={styles.cardTitle}>3. Vị trí xảy ra sự cố</Text>
        </View>

        <View style={styles.locationTypeRow}>
          <TouchableOpacity
            style={[styles.locTypeBtn, locationType === 'pond' && styles.locTypeBtnActive]}
            onPress={() => setLocationType('pond')}
          >
            <Waves size={16} color={locationType === 'pond' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.locTypeBtnText, locationType === 'pond' && styles.locTypeBtnTextActive]}>
              Khu vực Ao nuôi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.locTypeBtn, locationType === 'facility' && styles.locTypeBtnActive]}
            onPress={() => setLocationType('facility')}
          >
            <Building2 size={16} color={locationType === 'facility' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.locTypeBtnText, locationType === 'facility' && styles.locTypeBtnTextActive]}>
              Hạ tầng / Kho / Trạm điện
            </Text>
          </TouchableOpacity>
        </View>

        {locationType === 'pond' ? (
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>CHỌN AO NUÔI BỊ ẢNH HƯỞNG *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {ponds.map((p) => {
                const isSelected = selectedPondId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pondChip, isSelected && styles.pondChipActive]}
                    onPress={() => handlePondChange(p.id)}
                  >
                    <Waves size={14} color={isSelected ? '#ffffff' : '#2563eb'} />
                    <Text style={[styles.pondChipText, isSelected && styles.pondChipTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>KHU VỰC HẠ TẦNG TRANG TRẠI *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {LOCATION_SUGGESTIONS.map((loc) => {
                const isSelected = facilityArea === loc;
                return (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.pondChip, isSelected && styles.pondChipActive]}
                    onPress={() => setFacilityArea(loc)}
                  >
                    <Text style={[styles.pondChipText, isSelected && styles.pondChipTextActive]}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>CHI TIẾT VỊ TRÍ CỤ THỂ (KHÔNG BẮT BUỘC)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: Bờ đông, giàn quạt số 2, hộp điện tổng..."
            placeholderTextColor="#94a3b8"
            value={locationDetail}
            onChangeText={setLocationDetail}
          />
        </View>
      </View>

      {/* ── 4. Tiêu đề và Mô tả ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <AlertCircle size={18} color="#dc2626" />
          <Text style={styles.cardTitle}>4. Chi tiết sự cố</Text>
        </View>

        {/* Gợi ý tiêu đề nhanh */}
        {suggestions.length > 0 && (
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>GỢI Ý TIÊU ĐỀ PHỔ BIẾN</Text>
            <View style={styles.suggestionBox}>
              {suggestions.map((sug: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionChip}
                  onPress={() => setTitle(sug)}
                >
                  <Plus size={12} color="#dc2626" />
                  <Text style={styles.suggestionText}>{sug}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>TIÊU ĐỀ SỰ CỐ *</Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            placeholder="Tóm tắt ngắn gọn hiện tượng sự cố..."
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              setErrors((prev) => ({ ...prev, title: '' }));
            }}
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>MÔ TẢ CHI TIẾT HIỆN TRẠNG *</Text>
          <TextInput
            style={[styles.input, styles.textArea, errors.description && styles.inputError]}
            placeholder="Mô tả cụ thể biểu hiện hư hỏng, thời gian phát hiện, mức độ ảnh hưởng..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={(d) => {
              setDescription(d);
              setErrors((prev) => ({ ...prev, description: '' }));
            }}
          />
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, saving && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>Gửi Báo Cáo Sự Cố Ngay</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748b', fontSize: 13 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  cardSubtitle: { fontSize: 12, color: '#64748b', marginBottom: 12 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  categoryIcon: { fontSize: 16 },
  categoryLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },

  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  severityLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },

  locationTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  locTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  locTypeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  locTypeBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  locTypeBtnTextActive: { color: '#2563eb', fontWeight: '800' },

  formGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.5, marginBottom: 6 },
  chipsScroll: { flexDirection: 'row', marginBottom: 4 },
  pondChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    marginRight: 8,
    gap: 6,
  },
  pondChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pondChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  pondChipTextActive: { color: '#ffffff' },

  suggestionBox: { gap: 6, marginBottom: 8 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    gap: 6,
  },
  suggestionText: { fontSize: 11, color: '#991b1b', fontWeight: '600', flex: 1 },

  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, fontWeight: '600' },

  submitButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});

