import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  FlatList,
  Platform,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import {
  TrendingUp,
  Waves,
  PlusCircle,
  Scale,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Info,
  Trash2,
} from 'lucide-react-native';
import {
  growthService,
  ShrimpSizeSample,
  FcrAnalysisResponse,
  CreateShrimpSizeSamplePayload,
} from '../../services/growthService';
import { pondService, OverviewPond, OverviewCrop } from '../../services/pondService';
import BusinessHeader from '../../components/BusinessHeader';
import { useAuth } from '../../context/AuthContext';

interface GrowthTrackingScreenProps {
  embedded?: boolean;
}

export default function GrowthTrackingScreen({ embedded = false }: GrowthTrackingScreenProps = {}) {
  const { userRole } = useAuth();
  const canAddSample = userRole === 'TECHNICIAN';

  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<OverviewCrop[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<string>('');
  const [samples, setSamples] = useState<ShrimpSizeSample[]>([]);
  const [latestSample, setLatestSample] = useState<ShrimpSizeSample | null>(null);
  const [fcrData, setFcrData] = useState<FcrAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [samplePage, setSamplePage] = useState<number>(0);
  const SAMPLE_PAGE_SIZE = 10;

  // Modal State for New 5-Cast Sampling
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [netAreaSqM, setNetAreaSqM] = useState('6.5');
  const [sampleLengthCm, setSampleLengthCm] = useState('');
  const [notes, setNotes] = useState('');
  const [casts, setCasts] = useState([
    { count: '', weight: '' },
    { count: '', weight: '' },
    { count: '', weight: '' },
    { count: '', weight: '' },
    { count: '', weight: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadPonds();
  }, []);

  const loadPonds = async () => {
    try {
      const overview = await pondService.getOverview();
      const pondList = overview.ponds || [];
      setPonds(pondList);
      setCrops(overview.crops || []);
      if (pondList.length > 0 && !selectedPondId) {
        setSelectedPondId(pondList[0].id);
      }
    } catch (e) {
      console.warn('Error loading ponds:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const activeCrop = useMemo(
    () => crops.find((c) => c.pondId === selectedPondId && c.status === 'ACTIVE') || null,
    [crops, selectedPondId]
  );

  const loadPondGrowthData = useCallback(async (pondId: string, currentActiveCrop?: OverviewCrop | null) => {
    if (!pondId) return;
    try {
      setIsLoading(true);
      const [sampleList, fcr] = await Promise.all([
        growthService.getSamplesByPond(pondId),
        growthService.getFcrAnalysis(pondId),
      ]);

      const cropToUse = currentActiveCrop !== undefined ? currentActiveCrop : activeCrop;
      if (!cropToUse) {
        setSamples([]);
        setLatestSample(null);
      } else {
        const activeStartDate = cropToUse.startDate ? new Date(cropToUse.startDate).getTime() : 0;
        const validSamples = (Array.isArray(sampleList) ? sampleList : []).filter(
          (s) => new Date(s.samplingDate).getTime() >= activeStartDate
        );
        setSamples(validSamples);
        setLatestSample(validSamples[0] || null);
      }
      setSamplePage(0);
      setFcrData(fcr);
    } catch (e) {
      console.warn('Error loading growth data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeCrop]);

  const totalSamplePages = Math.max(1, Math.ceil(samples.length / SAMPLE_PAGE_SIZE));
  const paginatedSamples = useMemo(() => {
    const start = samplePage * SAMPLE_PAGE_SIZE;
    return samples.slice(start, start + SAMPLE_PAGE_SIZE);
  }, [samples, samplePage]);

  useEffect(() => {
    if (selectedPondId) {
      loadPondGrowthData(selectedPondId);
    }
  }, [selectedPondId, loadPondGrowthData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    if (selectedPondId) {
      loadPondGrowthData(selectedPondId);
    } else {
      loadPonds();
    }
  };

  const handleCastChange = (index: number, field: 'count' | 'weight', val: string) => {
    const updated = [...casts];
    updated[index][field] = val;
    setCasts(updated);
  };

  const handleSubmitSample = async () => {
    if (!selectedPondId) {
      Alert.alert('Lỗi', 'Vui lòng chọn ao nuôi trước khi nhập mẫu.');
      return;
    }

    const netArea = parseFloat(netAreaSqM);
    if (isNaN(netArea) || netArea <= 0) {
      Alert.alert('Lỗi', 'Diện tích chài phải là số dương hợp lệ.');
      return;
    }

    // Validate 5 casts
    for (let i = 0; i < 5; i++) {
      const c = parseInt(casts[i].count, 10);
      const w = parseFloat(casts[i].weight);
      if (isNaN(c) || c < 0 || isNaN(w) || w < 0) {
        Alert.alert(
          'Thiếu dữ liệu',
          `Vui lòng nhập đầy đủ số lượng và khối lượng cho Mẻ chài số ${i + 1}.`
        );
        return;
      }
    }

    const formattedCasts = casts.map((c, i) => ({
      count: parseInt(c.count, 10),
      weightGram: parseFloat(c.weight),
      note: `Mẻ ${i + 1}`,
    }));

    const totalCount = formattedCasts.reduce((acc, cur) => acc + cur.count, 0);
    const totalWeight = formattedCasts.reduce((acc, cur) => acc + cur.weightGram, 0);

    if (totalCount <= 0 || totalWeight <= 0) {
      Alert.alert('Lỗi', 'Tổng số lượng tôm và trọng lượng từ 5 mẻ chài phải lớn hơn 0.');
      return;
    }

    const payload: CreateShrimpSizeSamplePayload = {
      casts: formattedCasts,
      netAreaSqM: netArea,
      sampleLengthCm: sampleLengthCm ? parseFloat(sampleLengthCm) : undefined,
      notes: notes.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      await growthService.createSample(selectedPondId, payload);
      Alert.alert('Thành công', 'Đã ghi nhận mẫu 5 mẻ chài thành công!');
      setIsModalVisible(false);
      // Reset form
      setCasts([
        { count: '', weight: '' },
        { count: '', weight: '' },
        { count: '', weight: '' },
        { count: '', weight: '' },
        { count: '', weight: '' },
      ]);
      setNotes('');
      // Reload
      loadPondGrowthData(selectedPondId);
    } catch (err: any) {
      Alert.alert('Thất bại', err.message || 'Không thể lưu mẫu tôm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPondObj = ponds.find((p) => p.id === selectedPondId);

  // Live calculation preview for 5 casts (synced with Web PondSizeDetail.tsx)
  const liveTotals = useMemo(() => {
    let totalCount = 0;
    let totalWeight = 0;
    casts.forEach((c) => {
      totalCount += parseInt(c.count, 10) || 0;
      totalWeight += parseFloat(c.weight) || 0;
    });
    const abw = totalCount > 0 ? totalWeight / totalCount : 0;
    const size = abw > 0 ? 1000 / abw : 0;
    let estimatedBiomass = 0;
    const netArea = parseFloat(netAreaSqM) || 0;
    const pondArea = selectedPondObj?.areaSize || 0;
    if (netArea > 0 && totalCount > 0 && pondArea > 0) {
      const density = totalCount / (5 * netArea);
      const totalShrimp = Math.round(density * pondArea);
      estimatedBiomass = (totalShrimp * abw) / 1000;
    }
    return { totalCount, totalWeight, abw, size, estimatedBiomass };
  }, [casts, netAreaSqM, selectedPondObj?.areaSize]);

  const handleDeleteSample = (sample: ShrimpSizeSample) => {
    Alert.alert(
      'Xác nhận xóa mẫu đo',
      `Bạn có chắc chắn muốn xóa mẫu đo ngày ${new Date(sample.samplingDate).toLocaleDateString('vi-VN')} (Size ${Number(sample.sizePerKg).toFixed(0)} con/kg)?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa mẫu',
          style: 'destructive',
          onPress: async () => {
            try {
              await growthService.deleteSample(selectedPondId, sample.id);
              Alert.alert('Thành công', 'Đã xóa mẫu đo đạc thành công.');
              loadPondGrowthData(selectedPondId);
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể xóa mẫu đo.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      {!embedded && <BusinessHeader title="Theo dõi tăng trưởng" />}

      {/* Pond Selector */}
      <View style={styles.pondSelectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pondScrollContent}
        >
          {ponds.map((pond) => {
            const active = selectedPondId === pond.id;
            return (
              <TouchableOpacity
                key={pond.id}
                style={[styles.pondChip, active && styles.pondChipActive]}
                onPress={() => setSelectedPondId(pond.id)}
              >
                <Waves size={13} color={active ? '#ffffff' : '#4f46e5'} />
                <Text
                  style={[
                    styles.pondChipText,
                    active && styles.pondChipTextActive,
                  ]}
                >
                  {pond.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={isLoading ? [] : paginatedSamples}
        keyExtractor={(sample) => sample.id}
        contentContainerStyle={styles.scrollContent}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View>
            {/* Action Button: Ghi nhận 5 mẻ chài */}
            {canAddSample && (
              <TouchableOpacity
                style={[styles.newSampleButton, !activeCrop && { backgroundColor: '#94a3b8' }]}
                onPress={() => {
                  if (!activeCrop) {
                    Alert.alert(
                      'Chưa có vụ nuôi',
                      `Ao ${selectedPondObj?.name || 'này'} hiện chưa có vụ nuôi ĐANG HOẠT ĐỘNG (ACTIVE). Vui lòng mở vụ nuôi trước khi lấy mẫu tăng trưởng.`
                    );
                    return;
                  }
                  setIsModalVisible(true);
                }}
                activeOpacity={0.85}
              >
                <PlusCircle size={20} color="#ffffff" />
                <Text style={styles.newSampleButtonText}>
                  Lấy mẫu 5 mẻ chài mới ({selectedPondObj ? selectedPondObj.name : 'Chọn ao'})
                </Text>
              </TouchableOpacity>
            )}

            {/* Latest Metrics Summary Cards */}
            <Text style={styles.sectionLabel}>Chỉ số tăng trưởng gần nhất</Text>

            <View style={styles.metricsGrid}>
              {/* Card 1: Size & ABW */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricTitle}>Kích cỡ (Size)</Text>
                  <Scale size={16} color="#4f46e5" />
                </View>
                <View style={styles.metricValueRow}>
                  <Text style={styles.metricValue}>
                    {latestSample ? Number(latestSample.sizePerKg).toFixed(1) : '--'}
                  </Text>
                  <Text style={styles.metricUnit}> con/kg</Text>
                </View>
                <Text style={styles.metricSubtext}>
                  ABW:{' '}
                  {latestSample
                    ? `${Number(latestSample.abwGram).toFixed(2)} g/con`
                    : '--'}
                </Text>
              </View>

              {/* Card 2: ADG (Tốc độ lớn) */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricTitle}>Tăng trọng (ADG)</Text>
                  <TrendingUp size={16} color="#059669" />
                </View>
                <View style={styles.metricValueRow}>
                  <Text style={[styles.metricValue, { color: '#059669' }]}>
                    {latestSample?.adgGramPerDay
                      ? `+${Number(latestSample.adgGramPerDay).toFixed(2)}`
                      : '--'}
                  </Text>
                  <Text style={styles.metricUnit}> g/ngày</Text>
                </View>
                <Text style={styles.metricSubtext}>So với chu kỳ trước</Text>
              </View>

              {/* Card 3: Sinh khối ước tính */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricTitle}>Sinh khối (Biomass)</Text>
                  <Waves size={16} color="#0284c7" />
                </View>
                <View style={styles.metricValueRow}>
                  <Text style={[styles.metricValue, { color: '#0284c7' }]}>
                    {latestSample?.estimatedBiomassKg
                      ? Number(latestSample.estimatedBiomassKg).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })
                      : '--'}
                  </Text>
                  <Text style={styles.metricUnit}> kg</Text>
                </View>
                <Text style={styles.metricSubtext}>
                  Ước tính:{' '}
                  {latestSample?.estimatedTotalShrimp
                    ? `${latestSample.estimatedTotalShrimp.toLocaleString()} con`
                    : '--'}
                </Text>
              </View>

              {/* Card 4: Hệ số FCR */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricTitle}>Hệ số FCR</Text>
                  <AlertCircle size={16} color="#d97706" />
                </View>
                <View style={styles.metricValueRow}>
                  <Text style={[styles.metricValue, { color: '#d97706' }]}>
                    {fcrData?.currentFcr ? Number(fcrData.currentFcr).toFixed(2) : '--'}
                  </Text>
                  <Text style={styles.metricUnit}>
                    {fcrData?.targetFcr ? ` (Mục tiêu ${fcrData.targetFcr})` : ''}
                  </Text>
                </View>
                <Text style={styles.metricSubtext}>
                  {fcrData?.status === 'OPTIMAL' ? '✅ Tối ưu chuẩn' : 'Theo dõi thức ăn'}
                </Text>
              </View>
            </View>

            {/* History of Size Samples */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
              Lịch sử các lần lấy mẫu tôm ({samples.length} lần)
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="small" color="#6366f1" style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.emptyCard}>
              <Info size={32} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Chưa có mẫu nào cho ao này</Text>
              <Text style={styles.emptySubtitle}>
                {canAddSample
                  ? 'Bấm nút "Lấy mẫu 5 mẻ chài mới" ở trên để ghi nhận trọng lượng và kích cỡ tôm.'
                  : 'Kỹ thuật viên chưa ghi nhận mẫu chài nào cho ao này.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item: sample }) => (
          <View style={styles.historyCard}>
            <View style={styles.historyCardHeader}>
              <View style={styles.dateBlock}>
                <Calendar size={14} color="#6366f1" />
                <Text style={styles.historyDate}>
                  {new Date(sample.samplingDate).toLocaleDateString('vi-VN')}
                </Text>
                {sample.doc ? (
                  <View style={styles.docBadge}>
                    <Text style={styles.docBadgeText}>DOC {sample.doc}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.historySize}>
                  Size {Number(sample.sizePerKg).toFixed(0)} con/kg
                </Text>
                {canAddSample && (
                  <TouchableOpacity
                    onPress={() => handleDeleteSample(sample)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.historyDetails}>
              <Text style={styles.historyDetailText}>
                ABW: <Text style={styles.bold}>{Number(sample.abwGram).toFixed(2)} g</Text>
              </Text>
              <Text style={styles.historyDetailText}>
                Tổng mẫu: <Text style={styles.bold}>{sample.sampleCount} con</Text> (
                {Number(sample.sampleWeightGram).toFixed(0)} g)
              </Text>
            </View>

            {sample.estimatedBiomassKg && (
              <View style={styles.historyBiomassRow}>
                <Text style={styles.historyBiomassLabel}>Sinh khối tính từ chài:</Text>
                <Text style={styles.historyBiomassValue}>
                  {Number(sample.estimatedBiomassKg).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{' '}
                  kg
                </Text>
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          !isLoading && totalSamplePages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageButton, samplePage === 0 && styles.pageButtonDisabled]}
                onPress={() => setSamplePage((p) => Math.max(0, p - 1))}
                disabled={samplePage === 0}
              >
                <Text style={styles.pageButtonText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.pageIndicator}>
                Trang {samplePage + 1} / {totalSamplePages}
              </Text>
              <TouchableOpacity
                style={[
                  styles.pageButton,
                  samplePage === totalSamplePages - 1 && styles.pageButtonDisabled,
                ]}
                onPress={() => setSamplePage((p) => Math.min(totalSamplePages - 1, p + 1))}
                disabled={samplePage === totalSamplePages - 1}
              >
                <Text style={styles.pageButtonText}>▶</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* Modal: Nhập Form 5 Mẻ Chài */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Ghi Nhận Mẫu Tôm</Text>
                <Text style={styles.modalSubtitle}>
                  Số liệu mẻ chài tại {selectedPondObj?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Net Area */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Diện tích miệng chài (m²):</Text>
                <TextInput
                  style={styles.inputField}
                  keyboardType="numeric"
                  value={netAreaSqM}
                  onChangeText={setNetAreaSqM}
                  placeholder="6.5"
                />
              </View>

              {/* 5 Casts Inputs */}
              <Text style={styles.castsSectionTitle}>
                Nhập số liệu 5 mẻ chài (Bắt buộc đủ 5 mẻ):
              </Text>

              {casts.map((cast, index) => (
                <View key={index} style={styles.castRow}>
                  <Text style={styles.castRowLabel}>Mẻ {index + 1}:</Text>
                  <TextInput
                    style={[styles.castInput, { marginRight: 8 }]}
                    keyboardType="numeric"
                    placeholder="Số con"
                    value={cast.count}
                    onChangeText={(val) => handleCastChange(index, 'count', val)}
                  />
                  <TextInput
                    style={styles.castInput}
                    keyboardType="numeric"
                    placeholder="Khối lượng (g)"
                    value={cast.weight}
                    onChangeText={(val) => handleCastChange(index, 'weight', val)}
                  />
                </View>
              ))}

              {/* Live Calculation Preview (Synced with Web PondSizeDetail.tsx) */}
              <View
                style={{
                  backgroundColor: '#eef2ff',
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: '#c7d2fe',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#4338ca', marginBottom: 6 }}>
                  📊 Tính nhẩm trực tiếp từ 5 mẻ chài:
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: '#334155' }}>
                    Tổng mẫu: <Text style={{ fontWeight: '700' }}>{liveTotals.totalCount} con ({liveTotals.totalWeight.toFixed(0)} g)</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: '#334155' }}>
                    ABW: <Text style={{ fontWeight: '700', color: '#4f46e5' }}>{liveTotals.abw > 0 ? `${liveTotals.abw.toFixed(2)} g/con` : '--'}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: '#334155' }}>
                    Size: <Text style={{ fontWeight: '700', color: '#059669' }}>{liveTotals.size > 0 ? `${liveTotals.size.toFixed(1)} con/kg` : '--'}</Text>
                  </Text>
                  {liveTotals.estimatedBiomass > 0 && (
                    <Text style={{ fontSize: 12, color: '#334155' }}>
                      Sinh khối ước tính: <Text style={{ fontWeight: '700', color: '#0284c7' }}>{liveTotals.estimatedBiomass.toFixed(1)} kg</Text>
                    </Text>
                  )}
                </View>
              </View>

              {/* Notes */}
              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text style={styles.inputLabel}>Ghi chú:</Text>
                <TextInput
                  style={[styles.inputField, { height: 60 }]}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ghi chú về vỏ tôm, độ đồng đều..."
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  isSubmitting && styles.modalSubmitBtnDisabled,
                ]}
                onPress={handleSubmitSample}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Lưu 5 Mẻ Chài</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  pondSelectorWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  pondScrollContent: {
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
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  pondChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  pondChipTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
  },
  newSampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  newSampleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricUnit: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  metricSubtext: {
    fontSize: 10,
    color: '#94a3b8',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
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
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  docBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  docBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338ca',
  },
  historySize: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4f46e5',
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  historyDetailText: {
    fontSize: 12,
    color: '#64748b',
  },
  bold: {
    fontWeight: '700',
    color: '#1e293b',
  },
  historyBiomassRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  historyBiomassLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  historyBiomassValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  castsSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8,
    marginBottom: 6,
  },
  castRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  castRowLabel: {
    width: 50,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  castInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0f172a',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#a5b4fc',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
  },
  pageButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: 12,
    color: '#4f46e5',
    fontWeight: '700',
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});

