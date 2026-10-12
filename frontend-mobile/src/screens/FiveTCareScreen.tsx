import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import {
  Utensils,
  Scale,
  HeartPulse,
  Waves,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
  ChevronDown,
} from 'lucide-react-native';
import { pondService, OverviewPond, OverviewCrop } from '../services/pondService';
import {
  feedingLogService,
  DEFAULT_FEEDING_PRESETS,
  SingleSessionPayload,
} from '../services/feedingLogService';
import { growthService, CreateShrimpSizeSamplePayload } from '../services/growthService';
import {
  shrimpHealthService,
  ShrimpHealthStatusType,
  ShrimpSeverityType,
} from '../services/shrimpHealthService';
import { inventoryService, InventoryItem } from '../services/inventoryService';

type MainTab = 'FEEDING' | 'SIZE_SAMPLING' | 'HEALTH';

export default function FiveTCareScreen() {
  const [activeTab, setActiveTab] = useState<MainTab>('FEEDING');
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<OverviewCrop[]>([]);
  const [feedProducts, setFeedProducts] = useState<InventoryItem[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Tab 1: Feeding Log State ──
  const [feedingDate, setFeedingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedFeedProductId, setSelectedFeedProductId] = useState<string>('');
  const [sessions, setSessions] = useState<SingleSessionPayload[]>(() =>
    DEFAULT_FEEDING_PRESETS.map((preset) => ({
      feedingSession: preset.session,
      feedingTime: preset.defaultTime,
      feedProductId: '',
      feedAmount: 0,
      feedingMethod: 'MANUAL',
      feedingStatus: 'COMPLETED',
      note: '',
    }))
  );

  // ── Tab 2: 5-Cast Sampling State ──
  const [netAreaSqM, setNetAreaSqM] = useState('6.5');
  const [sampleLengthCm, setSampleLengthCm] = useState('');
  const [sampleNotes, setSampleNotes] = useState('');
  const [casts, setCasts] = useState([
    { count: '', weight: '' },
    { count: '', weight: '' },
    { count: '', weight: '' },
    { count: '', weight: '' },
    { count: '', weight: '' },
  ]);

  // ── Tab 3: Shrimp Health & Mortality State ──
  const [healthStatus, setHealthStatus] = useState<ShrimpHealthStatusType>('NORMAL');
  const [healthSeverity, setHealthSeverity] = useState<ShrimpSeverityType>('NORMAL');
  const [affectedPct, setAffectedPct] = useState('0');
  const [healthNote, setHealthNote] = useState('');
  const [deadQuantity, setDeadQuantity] = useState('');
  const [mortalityCause, setMortalityCause] = useState('');

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [overview, feeds] = await Promise.all([
        pondService.getOverview(),
        inventoryService.getInventory('FEED'),
      ]);
      setPonds(overview.ponds || []);
      setCrops(overview.crops || []);
      setFeedProducts(feeds || []);

      if (overview.ponds?.length > 0) {
        setSelectedPondId(overview.ponds[0].id);
      }
      if (feeds?.length > 0) {
        setSelectedFeedProductId(feeds[0].id);
        setSessions((prev) =>
          prev.map((s) => ({ ...s, feedProductId: feeds[0].id }))
        );
      }
    } catch (e) {
      console.warn('Error loading 5T initial data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const activePond = ponds.find((p) => p.id === selectedPondId);
  const activeCrop = crops.find(
    (c) => c.pondId === selectedPondId && c.status === 'ACTIVE'
  );

  // ── Feeding Actions ──
  const handleSessionChange = (index: number, field: keyof SingleSessionPayload, value: any) => {
    const updated = [...sessions];
    updated[index] = { ...updated[index], [field]: value };
    setSessions(updated);
  };

  const totalDailyFeedKg = useMemo(() => {
    return sessions.reduce((sum, s) => sum + (Number(s.feedAmount) || 0), 0);
  }, [sessions]);

  const handleSubmitFeeding = async () => {
    if (!activePond || !activeCrop) {
      Alert.alert('Không thể lưu', 'Ao được chọn hiện không có vụ nuôi nào đang hoạt động (ACTIVE).');
      return;
    }
    if (!selectedFeedProductId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn loại thức ăn trong kho.');
      return;
    }

    const payloadSessions = sessions.map((s) => ({
      ...s,
      feedProductId: s.feedProductId || selectedFeedProductId,
      feedAmount: Number(s.feedAmount) || 0,
    }));

    setIsSubmitting(true);
    try {
      await feedingLogService.createOrUpdateDailyLog({
        farmId: activePond.farmId,
        pondId: activePond.id,
        cropId: activeCrop.id,
        feedingDate,
        sessions: payloadSessions,
      });
      Alert.alert('Thành công', `Đã lưu nhật ký cho ăn ngày ${feedingDate} (Tổng: ${totalDailyFeedKg.toFixed(1)} kg).`);
    } catch (e: any) {
      Alert.alert('Thất bại', e.message || 'Lỗi khi lưu nhật ký cho ăn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 5-Cast Calculations ──
  const liveStats = useMemo(() => {
    let totalCount = 0;
    let totalWeight = 0;
    casts.forEach((c) => {
      const cnt = parseInt(c.count, 10);
      const wt = parseFloat(c.weight);
      if (!isNaN(cnt) && cnt > 0) totalCount += cnt;
      if (!isNaN(wt) && wt > 0) totalWeight += wt;
    });

    const abw = totalCount > 0 ? totalWeight / totalCount : 0;
    const size = abw > 0 ? 1000 / abw : 0;

    let biomass = 0;
    const area = parseFloat(netAreaSqM);
    if (activePond && area > 0 && totalCount > 0) {
      const density = totalCount / (5 * area);
      const totalShrimp = density * activePond.areaSize;
      biomass = (totalShrimp * abw) / 1000;
    }

    return { totalCount, totalWeight, abw, size, biomass };
  }, [casts, netAreaSqM, activePond]);

  const handleSubmitSampling = async () => {
    if (!selectedPondId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ao nuôi.');
      return;
    }

    for (let i = 0; i < 5; i++) {
      const c = parseInt(casts[i].count, 10);
      const w = parseFloat(casts[i].weight);
      if (isNaN(c) || c < 0 || isNaN(w) || w < 0) {
        Alert.alert('Thiếu dữ liệu', `Vui lòng nhập đủ số con và khối lượng cho Mẻ ${i + 1}.`);
        return;
      }
    }

    if (liveStats.totalCount <= 0 || liveStats.totalWeight <= 0) {
      Alert.alert('Lỗi', 'Tổng số lượng và khối lượng 5 mẻ chài phải lớn hơn 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateShrimpSizeSamplePayload = {
        casts: casts.map((c, i) => ({
          count: parseInt(c.count, 10),
          weightGram: parseFloat(c.weight),
          note: `Mẻ ${i + 1}`,
        })),
        netAreaSqM: parseFloat(netAreaSqM) || 6.5,
        sampleLengthCm: sampleLengthCm ? parseFloat(sampleLengthCm) : undefined,
        notes: sampleNotes.trim() || undefined,
      };

      await growthService.createSample(selectedPondId, payload);
      Alert.alert('Thành công', `Đã lưu 5 mẻ chài: Size ${liveStats.size.toFixed(0)} con/kg, Sinh khối ~${liveStats.biomass.toFixed(0)} kg.`);
      setCasts([
        { count: '', weight: '' },
        { count: '', weight: '' },
        { count: '', weight: '' },
        { count: '', weight: '' },
        { count: '', weight: '' },
      ]);
    } catch (e: any) {
      Alert.alert('Thất bại', e.message || 'Lỗi khi lưu mẫu tôm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Health & Mortality Actions ──
  const handleSubmitHealth = async () => {
    if (!activePond || !activeCrop) {
      Alert.alert('Không thể lưu', 'Ao được chọn hiện không có vụ nuôi nào đang hoạt động.');
      return;
    }

    setIsSubmitting(true);
    try {
      await shrimpHealthService.createHealthRecord({
        farmId: activePond.farmId,
        pondId: activePond.id,
        cropId: activeCrop.id,
        recordTime: new Date().toISOString(),
        healthStatus,
        severity: healthSeverity,
        affectedPercentage: parseFloat(affectedPct) || 0,
        note: healthNote.trim() || undefined,
      });

      // If dead quantity is filled, also log mortality
      if (deadQuantity && parseInt(deadQuantity, 10) > 0) {
        await shrimpHealthService.createMortality({
          cropId: activeCrop.id,
          deadQuantityPcs: parseInt(deadQuantity, 10),
          cause: mortalityCause.trim() || undefined,
        });
      }

      Alert.alert('Thành công', 'Đã lưu ghi nhận sức khỏe tôm và số liệu hao hụt.');
      setHealthNote('');
      setDeadQuantity('');
    } catch (e: any) {
      Alert.alert('Thất bại', e.message || 'Lỗi khi lưu quan sát sức khỏe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Vòng Lặp 5T Care</Text>
          <Text style={styles.headerSubtitle}>
            Kiểm soát cho ăn (1-4) • Chuẩn hóa 5 mẻ chài (5) • Sức khỏe
          </Text>
        </View>
      </View>

      {/* ── Pond Selector Horizontal Bar ── */}
      <View style={styles.pondSelectorBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pondChips}>
          {ponds.map((pond) => {
            const active = selectedPondId === pond.id;
            return (
              <TouchableOpacity
                key={pond.id}
                style={[styles.pondChip, active && styles.pondChipActive]}
                onPress={() => setSelectedPondId(pond.id)}
              >
                <Waves size={12} color={active ? '#ffffff' : '#2563eb'} />
                <Text style={[styles.pondChipText, active && styles.pondChipTextActive]}>
                  {pond.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Sub Navigation Tabs ── */}
      <View style={styles.subTabsRow}>
        <TouchableOpacity
          style={[styles.subTabItem, activeTab === 'FEEDING' && styles.subTabItemActive]}
          onPress={() => setActiveTab('FEEDING')}
        >
          <Utensils size={14} color={activeTab === 'FEEDING' ? '#2563eb' : '#64748b'} />
          <Text style={[styles.subTabText, activeTab === 'FEEDING' && styles.subTabTextActive]}>
            Cho ăn (7 cữ)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabItem, activeTab === 'SIZE_SAMPLING' && styles.subTabItemActive]}
          onPress={() => setActiveTab('SIZE_SAMPLING')}
        >
          <Scale size={14} color={activeTab === 'SIZE_SAMPLING' ? '#2563eb' : '#64748b'} />
          <Text style={[styles.subTabText, activeTab === 'SIZE_SAMPLING' && styles.subTabTextActive]}>
            Bắt mẫu 5T
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabItem, activeTab === 'HEALTH' && styles.subTabItemActive]}
          onPress={() => setActiveTab('HEALTH')}
        >
          <HeartPulse size={14} color={activeTab === 'HEALTH' ? '#2563eb' : '#64748b'} />
          <Text style={[styles.subTabText, activeTab === 'HEALTH' && styles.subTabTextActive]}>
            Sức khỏe tôm
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Main Content Area ── */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tải dữ liệu 5T Care...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Active Pond Status Banner */}
          <View style={styles.pondStatusBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusBannerTitle}>
                {activePond ? activePond.name : 'Chưa chọn ao'}
              </Text>
              <Text style={styles.statusBannerDesc}>
                {activeCrop
                  ? `Vụ đang nuôi • Thả: ${activeCrop.initialShrimpCount?.toLocaleString()} con`
                  : 'Ao hiện chưa có vụ nuôi ACTIVE.'}
              </Text>
            </View>
          </View>

          {/* ════════════ TAB 1: FEEDING LOG ════════════ */}
          {activeTab === 'FEEDING' && (
            <View style={styles.tabContentBlock}>
              {/* Feeding Date & Total Summary */}
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Ngày cho ăn:</Text>
                  <Text style={styles.summaryValue}>{feedingDate}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tổng lượng thức ăn ngày:</Text>
                  <Text style={styles.summaryValueHighlight}>
                    {totalDailyFeedKg.toFixed(1)} kg
                  </Text>
                </View>
              </View>

              {/* Feed Product Selector */}
              <Text style={styles.fieldLabel}>Loại thức ăn từ kho:</Text>
              <View style={styles.feedSelectorChips}>
                {feedProducts.map((p) => {
                  const selected = selectedFeedProductId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.feedChip, selected && styles.feedChipSelected]}
                      onPress={() => {
                        setSelectedFeedProductId(p.id);
                        setSessions((prev) =>
                          prev.map((s) => ({ ...s, feedProductId: p.id }))
                        );
                      }}
                    >
                      <Text style={[styles.feedChipText, selected && styles.feedChipTextSelected]}>
                        {p.itemName} ({p.quantity} {p.unit})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 7 Feeding Sessions List */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                Chi tiết 7 cữ ăn trong ngày (5T Care):
              </Text>

              {sessions.map((sess, idx) => (
                <View key={sess.feedingSession} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionTitle}>
                      Cữ {idx + 1} ({sess.feedingTime})
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>
                        {sess.feedingStatus === 'COMPLETED' ? 'Đã cho ăn' : 'Bỏ cữ'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sessionInputsRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.inputSubLabel}>Lượng ăn (kg):</Text>
                      <TextInput
                        style={styles.sessionInput}
                        keyboardType="numeric"
                        placeholder="0.0"
                        value={sess.feedAmount > 0 ? String(sess.feedAmount) : ''}
                        onChangeText={(v) =>
                          handleSessionChange(idx, 'feedAmount', parseFloat(v) || 0)
                        }
                      />
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.inputSubLabel}>Kiểm tra nhá/vó ăn:</Text>
                      <TextInput
                        style={styles.sessionInput}
                        placeholder="Hết sạch / Thừa 5%..."
                        value={sess.note || ''}
                        onChangeText={(v) => handleSessionChange(idx, 'note', v)}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmitFeeding}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Lưu Nhật Ký Cho Ăn Hôm Nay</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ════════════ TAB 2: SIZE SAMPLING (5 CASTS) ════════════ */}
          {activeTab === 'SIZE_SAMPLING' && (
            <View style={styles.tabContentBlock}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Quy Chuẩn Ngày 5: Lấy Mẫu 5 Mẻ Chài</Text>
                <View style={styles.samplingStatsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxLabel}>Kích cỡ (Size):</Text>
                    <Text style={styles.statBoxValue}>
                      {liveStats.size > 0 ? `${liveStats.size.toFixed(1)} con/kg` : '--'}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxLabel}>Trọng lượng (ABW):</Text>
                    <Text style={styles.statBoxValue}>
                      {liveStats.abw > 0 ? `${liveStats.abw.toFixed(2)} g/con` : '--'}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxLabel}>Sinh khối ước tính:</Text>
                    <Text style={styles.statBoxValueHighlight}>
                      {liveStats.biomass > 0 ? `${liveStats.biomass.toFixed(0)} kg` : '--'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Diện tích miệng chài (m²):</Text>
                <TextInput
                  style={styles.standardInput}
                  keyboardType="numeric"
                  value={netAreaSqM}
                  onChangeText={setNetAreaSqM}
                  placeholder="6.5"
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                Dữ liệu 5 mẻ chài (Số con & Khối lượng g):
              </Text>

              {casts.map((c, i) => (
                <View key={i} style={styles.castCard}>
                  <Text style={styles.castIndexText}>Mẻ {i + 1}:</Text>
                  <TextInput
                    style={[styles.castField, { marginRight: 8 }]}
                    keyboardType="numeric"
                    placeholder="Số con"
                    value={c.count}
                    onChangeText={(v) => {
                      const updated = [...casts];
                      updated[i].count = v;
                      setCasts(updated);
                    }}
                  />
                  <TextInput
                    style={styles.castField}
                    keyboardType="numeric"
                    placeholder="Trọng lượng (g)"
                    value={c.weight}
                    onChangeText={(v) => {
                      const updated = [...casts];
                      updated[i].weight = v;
                      setCasts(updated);
                    }}
                  />
                </View>
              ))}

              <View style={[styles.inputGroup, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>Ghi chú thêm:</Text>
                <TextInput
                  style={[styles.standardInput, { height: 60 }]}
                  multiline
                  placeholder="Độ đồng đều của tôm, màu sắc vỏ, gan ruột..."
                  value={sampleNotes}
                  onChangeText={setSampleNotes}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmitSampling}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Lưu Kết Quả 5 Mẻ Chài</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ════════════ TAB 3: SHRIMP HEALTH & MORTALITY ════════════ */}
          {activeTab === 'HEALTH' && (
            <View style={styles.tabContentBlock}>
              <Text style={styles.fieldLabel}>Tình trạng sức khỏe tôm:</Text>
              <View style={styles.healthOptionsRow}>
                {[
                  { value: 'NORMAL', label: 'Bình thường' },
                  { value: 'LETHARGIC', label: 'Lờ đờ' },
                  { value: 'EDGE_GATHERING', label: 'Tấp mé bờ' },
                  { value: 'LOSS_OF_APPETITE', label: 'Bỏ ăn' },
                ].map((opt) => {
                  const sel = healthStatus === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionChip, sel && styles.optionChipSelected]}
                      onPress={() => setHealthStatus(opt.value as any)}
                    >
                      <Text style={[styles.optionChipText, sel && styles.optionChipTextSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Mức độ nghiêm trọng:</Text>
              <View style={styles.healthOptionsRow}>
                {[
                  { value: 'NORMAL', label: 'Bình thường' },
                  { value: 'MILD', label: 'Nhẹ' },
                  { value: 'MODERATE', label: 'Trung bình' },
                  { value: 'SEVERE', label: 'Nặng' },
                ].map((opt) => {
                  const sel = healthSeverity === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionChip, sel && styles.optionChipSelected]}
                      onPress={() => setHealthSeverity(opt.value as any)}
                    >
                      <Text style={[styles.optionChipText, sel && styles.optionChipTextSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text style={styles.fieldLabel}>Tỷ lệ ảnh hưởng (%):</Text>
                <TextInput
                  style={styles.standardInput}
                  keyboardType="numeric"
                  value={affectedPct}
                  onChangeText={setAffectedPct}
                  placeholder="0"
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text style={styles.fieldLabel}>Số tôm chết vớt được hôm nay (con):</Text>
                <TextInput
                  style={styles.standardInput}
                  keyboardType="numeric"
                  value={deadQuantity}
                  onChangeText={setDeadQuantity}
                  placeholder="Ví dụ: 50"
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text style={styles.fieldLabel}>Ghi chú triệu chứng:</Text>
                <TextInput
                  style={[styles.standardInput, { height: 70 }]}
                  multiline
                  value={healthNote}
                  onChangeText={setHealthNote}
                  placeholder="Mô tả màu sắc gan tụy, đường ruột, đục cơ..."
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmitHealth}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Lưu Tình Trạng Sức Khỏe</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleBlock: {},
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  pondSelectorBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  pondChips: {
    paddingHorizontal: 14,
    gap: 8,
    flexDirection: 'row',
  },
  pondChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pondChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  pondChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  pondChipTextActive: {
    color: '#ffffff',
  },
  subTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  subTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabItemActive: {
    borderBottomColor: '#2563eb',
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  subTabTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  pondStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  statusBannerDesc: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 2,
  },
  tabContentBlock: {},
  summaryBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  summaryValueHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  feedSelectorChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  feedChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  feedChipSelected: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  feedChipText: {
    fontSize: 12,
    color: '#475569',
  },
  feedChipTextSelected: {
    color: '#059669',
    fontWeight: '700',
  },
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#16a34a',
    fontWeight: '600',
  },
  sessionInputsRow: {
    flexDirection: 'row',
  },
  inputSubLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  sessionInput: {
    height: 38,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 30,
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  samplingStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 2,
  },
  statBoxValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  statBoxValueHighlight: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
  },
  inputGroup: {},
  standardInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  castCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  castIndexText: {
    width: 50,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  castField: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#0f172a',
  },
  healthOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  optionChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  optionChipText: {
    fontSize: 12,
    color: '#475569',
  },
  optionChipTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
});
