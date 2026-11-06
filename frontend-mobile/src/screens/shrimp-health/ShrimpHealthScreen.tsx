import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import {
  HeartPulse,
  Waves,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  ArrowLeft,
  User,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { pondService, OverviewPond, OverviewCrop } from '../../services/pondService';
import NotificationButton from '../../components/NotificationButton';
import HeaderLogo from '../../components/HeaderLogo';
import {
  shrimpHealthService,
  ShrimpHealthStatusType,
  ShrimpSeverityType,
  ShrimpHealthRecord,
  MortalityRecord,
} from '../../services/shrimpHealthService';

interface ShrimpHealthScreenProps {
  navigation?: any;
  route?: any;
}

export default function ShrimpHealthScreen({ navigation, route }: ShrimpHealthScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'RECORD' | 'HISTORY'>('RECORD');
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<OverviewCrop[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<string>(() => {
    return route?.params?.pondId || '';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form State
  const [healthStatus, setHealthStatus] = useState<ShrimpHealthStatusType>('NORMAL');
  const [healthSeverity, setHealthSeverity] = useState<ShrimpSeverityType>('NORMAL');
  const [affectedPct, setAffectedPct] = useState('0');
  const [healthNote, setHealthNote] = useState('');
  const [deadQuantity, setDeadQuantity] = useState('');
  const [mortalityCause, setMortalityCause] = useState('');

  // History State
  const [healthRecords, setHealthRecords] = useState<ShrimpHealthRecord[]>([]);
  const [mortalityLogs, setMortalityLogs] = useState<MortalityRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const overview = await pondService.getOverview();
      setPonds(overview.ponds || []);
      setCrops(overview.crops || []);

      if (overview.ponds?.length > 0) {
        const paramPond = overview.ponds.find((p) => p.id === route?.params?.pondId);
        const targetId = paramPond ? paramPond.id : overview.ponds[0].id;
        setSelectedPondId(targetId);
      }
    } catch (e) {
      console.warn('Error loading shrimp health initial data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [route?.params?.pondId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (route?.params?.pondId) {
      setSelectedPondId(route.params.pondId);
    }
  }, [route?.params?.pondId]);

  const activePond = ponds.find((p) => p.id === selectedPondId);
  const activeCrop = crops.find(
    (c) => c.pondId === selectedPondId && c.status === 'ACTIVE'
  );

  const loadHistory = useCallback(async () => {
    if (!selectedPondId) return;
    try {
      setLoadingHistory(true);
      const records = await shrimpHealthService.getHistory(selectedPondId);
      setHealthRecords(records || []);

      if (activeCrop) {
        const morts = await shrimpHealthService.getMortalityLogs(activeCrop.id).catch(() => []);
        setMortalityLogs(morts || []);
      }
    } catch (e) {
      console.warn('Error loading health history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedPondId, activeCrop]);

  useEffect(() => {
    if (activeSubTab === 'HISTORY') {
      loadHistory();
    }
  }, [activeSubTab, loadHistory]);

  const handleSubmitHealth = async () => {
    if (!selectedPondId || !activePond) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ao nuôi trước khi lưu.');
      return;
    }

    if (!activeCrop) {
      Alert.alert('Không thể lưu', 'Ao được chọn hiện không có vụ nuôi nào đang hoạt động (ACTIVE).');
      return;
    }

    // 1. Validate tỷ lệ ảnh hưởng (0% - 100%)
    const pct = parseFloat(affectedPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      Alert.alert('Tỷ lệ không hợp lệ', 'Tỷ lệ đàn tôm bị ảnh hưởng phải nằm trong khoảng từ 0% đến 100%.');
      return;
    }

    // 2. Validate bắt buộc mô tả khi tôm bất thường
    if (healthStatus !== 'NORMAL' && !healthNote.trim()) {
      Alert.alert('Thiếu thông tin', 'Khi phát hiện tôm có triệu chứng bất thường, vui lòng nhập mô tả chi tiết biểu hiện lâm sàng.');
      return;
    }

    // 3. Validate số lượng tôm hao hụt / chết
    let parsedDeadQty = 0;
    if (deadQuantity && deadQuantity.trim() !== '') {
      parsedDeadQty = parseInt(deadQuantity.trim(), 10);
      if (isNaN(parsedDeadQty) || parsedDeadQty < 0) {
        Alert.alert('Số lượng không hợp lệ', 'Số lượng tôm chết hao hụt phải là số nguyên không âm (≥ 0 con).');
        return;
      }
      if (activeCrop.initialShrimpCount && parsedDeadQty > activeCrop.initialShrimpCount) {
        Alert.alert(
          'Số lượng vượt mức',
          `Số lượng tôm chết (${parsedDeadQty.toLocaleString()} con) không thể vượt quá tổng số tôm thả ban đầu (${activeCrop.initialShrimpCount.toLocaleString()} con).`
        );
        return;
      }
      if (parsedDeadQty > 0 && !mortalityCause.trim()) {
        Alert.alert('Thiếu nguyên nhân', 'Vui lòng nhập nguyên nhân hoặc nghi vấn gây hao hụt/chết tôm.');
        return;
      }
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
        affectedPercentage: pct || 0,
        note: healthNote.trim() || undefined,
      });

      if (parsedDeadQty > 0) {
        await shrimpHealthService.createMortality({
          cropId: activeCrop.id,
          deadQuantityPcs: parsedDeadQty,
          cause: mortalityCause.trim() || undefined,
        });
      }

      Alert.alert('Thành công', 'Đã lưu ghi nhận sức khỏe tôm và số liệu hao hụt.');
      setHealthNote('');
      setDeadQuantity('');
      setMortalityCause('');
      if (activeSubTab === 'HISTORY') {
        loadHistory();
      }
    } catch (e: any) {
      Alert.alert('Thất bại', e.message || 'Lỗi khi lưu quan sát sức khỏe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation?.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else if (navigation?.navigate) {
                navigation.navigate('MainTabs');
              }
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Sức Khỏe Tôm</Text>
            <Text style={styles.headerSubtitle}>
              Ghi nhận dấu hiệu lâm sàng • Theo dõi tỷ lệ hao hụt đàn tôm
            </Text>
          </View>
        </View>
      </View>

      {/* Pond Selector Bar */}
      <View style={styles.pondSelectorBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pondChips}
        >
          {ponds.map((pond) => {
            const active = selectedPondId === pond.id;
            return (
              <TouchableOpacity
                key={pond.id}
                style={[styles.pondChip, active && styles.pondChipActive]}
                onPress={() => setSelectedPondId(pond.id)}
              >
                <Waves size={13} color={active ? '#ffffff' : '#ef4444'} />
                <Text style={[styles.pondChipText, active && styles.pondChipTextActive]}>
                  {pond.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2 Sub Tabs: Ghi nhận kiểm tra vs Lịch sử sức khỏe */}
      <View style={styles.subTabsRow}>
        <TouchableOpacity
          style={[styles.subTabItem, activeSubTab === 'RECORD' && styles.subTabItemActive]}
          onPress={() => setActiveSubTab('RECORD')}
        >
          <HeartPulse size={15} color={activeSubTab === 'RECORD' ? '#ef4444' : '#64748b'} />
          <Text style={[styles.subTabText, activeSubTab === 'RECORD' && styles.subTabTextActive]}>
            Ghi nhận kiểm tra
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabItem, activeSubTab === 'HISTORY' && styles.subTabItemActive]}
          onPress={() => setActiveSubTab('HISTORY')}
        >
          <History size={15} color={activeSubTab === 'HISTORY' ? '#ef4444' : '#64748b'} />
          <Text style={[styles.subTabText, activeSubTab === 'HISTORY' && styles.subTabTextActive]}>
            Lịch sử sức khỏe
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>Đang tải dữ liệu sức khỏe tôm...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadInitialData();
              }}
              colors={['#ef4444']}
            />
          }
        >
          {/* Active Pond Status Banner */}
          <View style={styles.pondStatusBanner}>
            <View style={{ flex: 1 }}>
              <View style={styles.bannerHeaderRow}>
                <Text style={styles.statusBannerTitle}>
                  {activePond ? activePond.name : 'Chưa chọn ao'}
                </Text>
                {activeCrop && (
                  <View style={styles.activeCropPill}>
                    <Text style={styles.activeCropPillText}>ĐANG NUÔI</Text>
                  </View>
                )}
              </View>
              <Text style={styles.statusBannerDesc}>
                {activeCrop
                  ? `Thả: ${activeCrop.initialShrimpCount?.toLocaleString()} con • Ao: ${activePond?.areaSize} m²`
                  : 'Ao hiện chưa có vụ nuôi ACTIVE.'}
              </Text>
            </View>
          </View>

          {/* ════════════ SUB-TAB 1: GHI NHẬN KIỂM TRA ════════════ */}
          {activeSubTab === 'RECORD' ? (
            <View>
              <Text style={styles.fieldLabel}>Tình trạng sức khỏe tôm quan sát được:</Text>
              <View style={styles.healthOptionsRow}>
                {[
                  { value: 'NORMAL', label: 'Bình thường' },
                  { value: 'LETHARGIC', label: 'Lờ đờ, bơi yếu' },
                  { value: 'EDGE_GATHERING', label: 'Tấp mé bờ' },
                  { value: 'LOSS_OF_APPETITE', label: 'Bỏ ăn / Ăn kém' },
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
                  { value: 'MILD', label: 'Nhẹ (<15%)' },
                  { value: 'MODERATE', label: 'Trung bình (15-40%)' },
                  { value: 'SEVERE', label: 'Nặng (>40%)' },
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
                <Text style={styles.fieldLabel}>Tỷ lệ tôm bị ảnh hưởng (%):</Text>
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
                  placeholder="Ví dụ: 15"
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text style={styles.fieldLabel}>Nguyên nhân nghi ngờ (nếu có tôm chết):</Text>
                <TextInput
                  style={styles.standardInput}
                  value={mortalityCause}
                  onChangeText={setMortalityCause}
                  placeholder="Ví dụ: Sốc nhiệt sau mưa, khí độc tầng đáy..."
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text style={styles.fieldLabel}>Ghi chú triệu chứng lâm sàng:</Text>
                <TextInput
                  style={[styles.standardInput, { height: 70 }]}
                  multiline
                  value={healthNote}
                  onChangeText={setHealthNote}
                  placeholder="Mô tả màu sắc gan tụy, đường ruột, đục cơ, mềm vỏ..."
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
                  <Text style={styles.submitButtonText}>Lưu Bản Ghi Sức Khỏe</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ════════════ SUB-TAB 2: LỊCH SỬ SỨC KHỎE ════════════ */
            <View>
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyListTitle}>
                  Lịch sử quan sát ao: {activePond?.name}
                </Text>
                <TouchableOpacity onPress={loadHistory} style={styles.historyRefreshBtn}>
                  <Text style={styles.historyRefreshText}>Làm mới</Text>
                </TouchableOpacity>
              </View>

              {loadingHistory ? (
                <ActivityIndicator size="large" color="#ef4444" style={{ marginTop: 24 }} />
              ) : healthRecords.length === 0 ? (
                <View style={styles.emptyCard}>
                  <HeartPulse size={36} color="#cbd5e1" />
                  <Text style={styles.emptyCardTitle}>Chưa có bản ghi sức khỏe</Text>
                  <Text style={styles.emptyCardDesc}>
                    Hãy ghi nhận kiểm tra sức khỏe đàn tôm định kỳ để kịp thời phát hiện bệnh.
                  </Text>
                </View>
              ) : (
                healthRecords.map((item) => {
                  const dateStr = new Date(item.recordTime || item.createdAt).toLocaleDateString(
                    'vi-VN',
                    {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );

                  return (
                    <View key={item.id} style={styles.historyCard}>
                      <View style={styles.historyCardHeader}>
                        <View style={styles.historyDateRow}>
                          <Clock size={13} color="#64748b" />
                          <Text style={styles.historyDateText}>{dateStr}</Text>
                        </View>
                        <View
                          style={[
                            styles.severityPill,
                            item.severity === 'SEVERE'
                              ? styles.severityPillDanger
                              : item.severity === 'MODERATE'
                              ? styles.severityPillWarning
                              : styles.severityPillGood,
                          ]}
                        >
                          <Text style={styles.severityPillText}>
                            {item.severity === 'NORMAL'
                              ? 'Bình thường'
                              : item.severity === 'MILD'
                              ? 'Nhẹ'
                              : item.severity === 'MODERATE'
                              ? 'Trung bình'
                              : 'Nặng'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.historyStatusText}>
                        Tình trạng:{' '}
                        {item.healthStatus === 'NORMAL'
                          ? 'Đàn tôm bình thường'
                          : item.healthStatus === 'LETHARGIC'
                          ? 'Lờ đờ, bơi yếu'
                          : item.healthStatus === 'EDGE_GATHERING'
                          ? 'Tấp mé bờ'
                          : 'Bỏ ăn / Kém ăn'}
                        {item.affectedPercentage > 0 ? ` (${item.affectedPercentage}%)` : ''}
                      </Text>

                      {item.note ? (
                        <Text style={styles.historyNoteText}>Ghi chú: {item.note}</Text>
                      ) : null}
                    </View>
                  );
                })
              )}

              {/* Mortality Summary Section */}
              {mortalityLogs.length > 0 && (
                <View style={styles.mortalitySection}>
                  <Text style={[styles.historyListTitle, { marginTop: 14, marginBottom: 8 }]}>
                    Số liệu tôm chết thu gom ({mortalityLogs.length} lần ghi)
                  </Text>
                  {mortalityLogs.slice(0, 5).map((m) => (
                    <View key={m.id} style={styles.mortalityCard}>
                      <View style={styles.mortalityRow}>
                        <Text style={styles.mortalityDate}>
                          {new Date(m.recordedDate || m.createdAt).toLocaleDateString('vi-VN')}
                        </Text>
                        <Text style={styles.mortalityQty}>-{m.deadQuantityPcs} con</Text>
                      </View>
                      {m.cause ? <Text style={styles.mortalityCause}>Nguyên nhân: {m.cause}</Text> : null}
                    </View>
                  ))}
                </View>
              )}
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
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
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pondChipActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  pondChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  pondChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
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
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabItemActive: {
    borderBottomColor: '#ef4444',
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  subTabTextActive: {
    color: '#ef4444',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  pondStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991b1b',
  },
  activeCropPill: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeCropPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  statusBannerDesc: {
    fontSize: 11,
    color: '#b91c1c',
    marginTop: 3,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
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
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  optionChipText: {
    fontSize: 12,
    color: '#475569',
  },
  optionChipTextSelected: {
    color: '#dc2626',
    fontWeight: '700',
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
  submitButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 30,
  },
  submitButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyListTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyRefreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
  },
  historyRefreshText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  severityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  severityPillGood: {
    backgroundColor: '#ecfdf5',
  },
  severityPillWarning: {
    backgroundColor: '#fef3c7',
  },
  severityPillDanger: {
    backgroundColor: '#fee2e2',
  },
  severityPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e293b',
  },
  historyStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  historyNoteText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 12,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptyCardDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  mortalitySection: {
    marginTop: 10,
  },
  mortalityCard: {
    backgroundColor: '#fff1f2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ffe4e6',
  },
  mortalityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mortalityDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#881337',
  },
  mortalityQty: {
    fontSize: 13,
    fontWeight: '800',
    color: '#e11d48',
  },
  mortalityCause: {
    fontSize: 11,
    color: '#9f1239',
    marginTop: 2,
  },
});



