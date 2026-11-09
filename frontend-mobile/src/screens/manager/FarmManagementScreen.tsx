import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  Building2,
  Waves,
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  Fish,
  CheckCircle2,
  AlertCircle,
  X,
  Leaf,
} from 'lucide-react-native';
import { farmService, Farm } from '../../services/farmService';
import { pondService, OverviewPond, OverviewCrop } from '../../services/pondService';
import { cropService, CreateCropPayload } from '../../services/cropService';
import { toLocalDateString } from '../../utils/date';

const DOC = (startDate: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000));

const fmtDate = (d?: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('vi-VN');
  } catch {
    return d;
  }
};

const STAGE_LABEL: Record<string, string> = {
  NURSERY: 'Ương giống',
  GROW_OUT: 'Nuôi thương phẩm',
};
const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Đang nuôi', color: '#059669', bg: '#ecfdf5' },
  HARVESTED: { label: 'Đã thu hoạch', color: '#2563eb', bg: '#eff6ff' },
  FAILED: { label: 'Thất bại', color: '#dc2626', bg: '#fef2f2' },
};

export default function FarmManagementScreen({ navigation }: any) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<OverviewCrop[]>([]);
  const [expandedFarms, setExpandedFarms] = useState<Record<string, boolean>>({});
  const [expandedPonds, setExpandedPonds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal tạo vụ nuôi
  const [isCreateCropModal, setIsCreateCropModal] = useState(false);
  const [selectedPondForCrop, setSelectedPondForCrop] = useState<OverviewPond | null>(null);
  const [cropStartDate, setCropStartDate] = useState(toLocalDateString());
  const [cropShrimpCount, setCropShrimpCount] = useState('');
  const [cropStage, setCropStage] = useState<'NURSERY' | 'GROW_OUT'>('GROW_OUT');
  const [cropTargetSize, setCropTargetSize] = useState('');
  const [cropTargetSurvival, setCropTargetSurvival] = useState('');
  const [cropExpectedDays, setCropExpectedDays] = useState('90');
  const [isSubmittingCrop, setIsSubmittingCrop] = useState(false);
  const [cropErrors, setCropErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      const [farmList, overview] = await Promise.all([
        farmService.getMyFarms().catch(() => farmService.getAll()),
        pondService.getOverview(),
      ]);
      setFarms(farmList);
      setPonds(overview.ponds || []);
      setCrops(overview.crops || []);
    } catch (err: any) {
      Alert.alert('Lỗi tải dữ liệu', err?.message || 'Không thể tải danh sách trang trại.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  const toggleFarm = (farmId: string) => {
    setExpandedFarms(prev => ({ ...prev, [farmId]: !prev[farmId] }));
  };

  const togglePond = (pondId: string) => {
    setExpandedPonds(prev => ({ ...prev, [pondId]: !prev[pondId] }));
  };

  const getPondsForFarm = (farmId: string) =>
    ponds.filter(p => p.farmId === farmId);

  const getActiveCropForPond = (pondId: string) =>
    crops.find(c => c.pondId === pondId && c.status === 'ACTIVE') || null;

  const getAllCropsForPond = (pondId: string) =>
    crops.filter(c => c.pondId === pondId);

  const openCreateCropModal = (pond: OverviewPond) => {
    const activeCrop = getActiveCropForPond(pond.id);
    if (activeCrop) {
      Alert.alert(
        'Ao đang có vụ nuôi',
        `Ao "${pond.name}" hiện đang có vụ nuôi ĐANG HOẠT ĐỘNG. Vui lòng thu hoạch hoặc kết thúc vụ hiện tại trước khi tạo vụ mới.`
      );
      return;
    }
    setSelectedPondForCrop(pond);
    setCropStartDate(toLocalDateString());
    setCropShrimpCount('');
    setCropStage('GROW_OUT');
    setCropTargetSize('');
    setCropTargetSurvival('');
    setCropExpectedDays('90');
    setCropErrors({});
    setIsCreateCropModal(true);
  };

  const validateCrop = (): boolean => {
    const errs: Record<string, string> = {};
    if (!cropStartDate) errs.startDate = 'Vui lòng nhập ngày bắt đầu';
    if (!cropShrimpCount || isNaN(Number(cropShrimpCount)) || Number(cropShrimpCount) <= 0)
      errs.shrimpCount = 'Số lượng tôm phải là số dương';
    if (cropTargetSize && (isNaN(Number(cropTargetSize)) || Number(cropTargetSize) <= 0))
      errs.targetSize = 'Kích thước mục tiêu phải là số dương';
    if (cropTargetSurvival) {
      const val = Number(cropTargetSurvival);
      if (isNaN(val) || val < 0 || val > 100)
        errs.targetSurvival = 'Tỷ lệ sống phải từ 0–100%';
    }
    if (cropExpectedDays && (isNaN(Number(cropExpectedDays)) || Number(cropExpectedDays) <= 0))
      errs.expectedDays = 'Số ngày phải là số dương';
    setCropErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateCrop = async () => {
    if (!selectedPondForCrop || !validateCrop()) return;
    setIsSubmittingCrop(true);
    try {
      const payload: CreateCropPayload = {
        pondId: selectedPondForCrop.id,
        startDate: cropStartDate,
        initialShrimpCount: Number(cropShrimpCount),
        stage: cropStage,
        targetHarvestSize: cropTargetSize ? Number(cropTargetSize) : undefined,
        targetSurvivalRate: cropTargetSurvival ? Number(cropTargetSurvival) : undefined,
        expectedDurationDays: cropExpectedDays ? Number(cropExpectedDays) : undefined,
      };
      await cropService.create(payload);
      setIsCreateCropModal(false);
      Alert.alert('Thành công', `Đã tạo vụ nuôi mới cho ao "${selectedPondForCrop.name}".`);
      setIsLoading(true);
      loadData();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể tạo vụ nuôi. Vui lòng thử lại.');
    } finally {
      setIsSubmittingCrop(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Đang tải trang trại...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{farms.length}</Text>
            <Text style={styles.summaryLabel}>Trang trại</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{ponds.length}</Text>
            <Text style={styles.summaryLabel}>Ao nuôi</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#059669' }]}>
              {crops.filter(c => c.status === 'ACTIVE').length}
            </Text>
            <Text style={styles.summaryLabel}>Vụ đang nuôi</Text>
          </View>
        </View>

        {farms.length === 0 ? (
          <View style={styles.emptyState}>
            <Building2 size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Chưa có trang trại</Text>
            <Text style={styles.emptySub}>Vui lòng thiết lập trang trại và ao nuôi trên hệ thống Web Dashboard.</Text>
          </View>
        ) : (
          farms.map(farm => {
            const farmPonds = getPondsForFarm(farm.id);
            const isExpanded = !!expandedFarms[farm.id];
            return (
              <View key={farm.id} style={styles.farmCard}>
                {/* Farm Header */}
                <TouchableOpacity style={styles.farmHeader} onPress={() => toggleFarm(farm.id)} activeOpacity={0.8}>
                  <View style={styles.farmIconBox}>
                    <Building2 size={22} color="#2563eb" />
                  </View>
                  <View style={styles.farmInfo}>
                    <Text style={styles.farmName} numberOfLines={2}>{farm.name}</Text>
                    <Text style={styles.farmMeta} numberOfLines={2}>
                      {farm.address || 'Chưa cập nhật địa chỉ'} • {farm.area} ha
                    </Text>
                  </View>
                  <View style={styles.farmBadge}>
                    <Text style={styles.farmBadgeText}>{farmPonds.length} ao</Text>
                  </View>
                  {isExpanded ? <ChevronDown size={18} color="#64748b" /> : <ChevronRight size={18} color="#64748b" />}
                </TouchableOpacity>

                {/* Pond List */}
                {isExpanded && (
                  <View style={styles.pondList}>
                    {farmPonds.length === 0 ? (
                      <Text style={styles.noPondText}>Chưa có ao nào trong trang trại này.</Text>
                    ) : (
                      farmPonds.map(pond => {
                        const activeCrop = getActiveCropForPond(pond.id);
                        const allCrops = getAllCropsForPond(pond.id);
                        const isPondExpanded = !!expandedPonds[pond.id];
                        return (
                          <View key={pond.id} style={styles.pondCard}>
                            {/* Pond Row */}
                            <TouchableOpacity
                              style={styles.pondRow}
                              onPress={() => togglePond(pond.id)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.pondIconBox}>
                                <Waves size={18} color={activeCrop ? '#059669' : '#94a3b8'} />
                              </View>
                              <View style={styles.pondInfo}>
                                <Text style={styles.pondName}>{pond.name}</Text>
                                <Text style={styles.pondMeta}>
                                  {pond.areaSize.toLocaleString('vi-VN')} m² • Sâu {pond.depth}m
                                </Text>
                              </View>
                              {activeCrop ? (
                                <View style={styles.cropActiveBadge}>
                                  <Text style={styles.cropActiveBadgeText}>DOC {DOC(activeCrop.startDate)}</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={styles.addCropBtn}
                                  onPress={() => openCreateCropModal(pond)}
                                >
                                  <Plus size={14} color="#2563eb" />
                                  <Text style={styles.addCropBtnText}>Tạo vụ</Text>
                                </TouchableOpacity>
                              )}
                              {isPondExpanded ? (
                                <ChevronDown size={16} color="#94a3b8" />
                              ) : (
                                <ChevronRight size={16} color="#94a3b8" />
                              )}
                            </TouchableOpacity>

                            {/* Crop Detail */}
                            {isPondExpanded && (
                              <View style={styles.cropDetail}>
                                {allCrops.length === 0 ? (
                                  <Text style={styles.noCropText}>Chưa có vụ nuôi nào.</Text>
                                ) : (
                                  allCrops.map(crop => {
                                    const st = STATUS_LABEL[crop.status] || STATUS_LABEL.ACTIVE;
                                    return (
                                      <View key={crop.id} style={[styles.cropItem, { backgroundColor: st.bg }]}>
                                        <View style={styles.cropItemHeader}>
                                          <View style={[styles.cropStatusDot, { backgroundColor: st.color }]} />
                                          <Text style={[styles.cropStatusText, { color: st.color }]}>{st.label}</Text>
                                          <Text style={styles.cropStageText}>
                                            {STAGE_LABEL[crop.stage || ''] || crop.stage || ''}
                                          </Text>
                                        </View>
                                        <View style={styles.cropMeta}>
                                          <View style={styles.cropMetaItem}>
                                            <Calendar size={12} color="#64748b" />
                                            <Text style={styles.cropMetaText}>
                                              Bắt đầu: {fmtDate(crop.startDate)}
                                            </Text>
                                          </View>
                                          <View style={styles.cropMetaItem}>
                                            <Fish size={12} color="#64748b" />
                                            <Text style={styles.cropMetaText}>
                                              {crop.initialShrimpCount.toLocaleString('vi-VN')} con
                                            </Text>
                                          </View>
                                          {crop.status === 'ACTIVE' && (
                                            <View style={styles.cropMetaItem}>
                                              <Leaf size={12} color="#059669" />
                                              <Text style={[styles.cropMetaText, { color: '#059669' }]}>
                                                Ngày {DOC(crop.startDate)} / {crop.targetSurvivalRate ? `Mục tiêu ${crop.targetSurvivalRate}% sống` : '—'}
                                              </Text>
                                            </View>
                                          )}
                                        </View>
                                      </View>
                                    );
                                  })
                                )}
                                {/* Button to create crop if no active crop */}
                                {!activeCrop && (
                                  <TouchableOpacity
                                    style={styles.createCropBtn}
                                    onPress={() => openCreateCropModal(pond)}
                                  >
                                    <Plus size={16} color="#ffffff" />
                                    <Text style={styles.createCropBtnText}>Tạo vụ nuôi mới</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Tạo Vụ Nuôi */}
      <Modal visible={isCreateCropModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Leaf size={20} color="#059669" />
                <Text style={styles.modalTitle}>Tạo vụ nuôi mới</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateCropModal(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedPondForCrop && (
              <View style={styles.pondInfoBox}>
                <Waves size={14} color="#2563eb" />
                <Text style={styles.pondInfoText}>
                  Ao: <Text style={{ fontWeight: '700' }}>{selectedPondForCrop.name}</Text>
                  {' '}({selectedPondForCrop.areaSize.toLocaleString('vi-VN')} m²)
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {/* Ngày bắt đầu */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>NGÀY BẮT ĐẦU (YYYY-MM-DD) *</Text>
                <TextInput
                  style={[styles.modalInput, cropErrors.startDate && styles.inputError]}
                  value={cropStartDate}
                  onChangeText={text => { setCropStartDate(text); setCropErrors(p => ({ ...p, startDate: '' })); }}
                  placeholder="2026-01-15"
                  placeholderTextColor="#94a3b8"
                />
                {cropErrors.startDate ? <Text style={styles.errText}>{cropErrors.startDate}</Text> : null}
              </View>

              {/* Số lượng tôm */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>SỐ LƯỢNG TÔM (CON) *</Text>
                <TextInput
                  style={[styles.modalInput, cropErrors.shrimpCount && styles.inputError]}
                  value={cropShrimpCount}
                  onChangeText={text => { setCropShrimpCount(text); setCropErrors(p => ({ ...p, shrimpCount: '' })); }}
                  keyboardType="numeric"
                  placeholder="Ví dụ: 500000"
                  placeholderTextColor="#94a3b8"
                />
                {cropErrors.shrimpCount ? <Text style={styles.errText}>{cropErrors.shrimpCount}</Text> : null}
              </View>

              {/* Giai đoạn */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>GIAI ĐOẠN NUÔI</Text>
                <View style={styles.stageRow}>
                  {(['GROW_OUT', 'NURSERY'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stageBtn, cropStage === s && styles.stageBtnActive]}
                      onPress={() => setCropStage(s)}
                    >
                      <Text style={[styles.stageBtnText, cropStage === s && styles.stageBtnTextActive]}>
                        {STAGE_LABEL[s]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Kích thước mục tiêu */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>KÍCH THƯỚC MỤC TIÊU (g/con)</Text>
                <TextInput
                  style={[styles.modalInput, cropErrors.targetSize && styles.inputError]}
                  value={cropTargetSize}
                  onChangeText={text => { setCropTargetSize(text); setCropErrors(p => ({ ...p, targetSize: '' })); }}
                  keyboardType="numeric"
                  placeholder="Ví dụ: 20"
                  placeholderTextColor="#94a3b8"
                />
                {cropErrors.targetSize ? <Text style={styles.errText}>{cropErrors.targetSize}</Text> : null}
              </View>

              {/* Tỷ lệ sống mục tiêu */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>TỶ LỆ SỐNG MỤC TIÊU (%)</Text>
                <TextInput
                  style={[styles.modalInput, cropErrors.targetSurvival && styles.inputError]}
                  value={cropTargetSurvival}
                  onChangeText={text => { setCropTargetSurvival(text); setCropErrors(p => ({ ...p, targetSurvival: '' })); }}
                  keyboardType="numeric"
                  placeholder="Ví dụ: 85"
                  placeholderTextColor="#94a3b8"
                />
                {cropErrors.targetSurvival ? <Text style={styles.errText}>{cropErrors.targetSurvival}</Text> : null}
              </View>

              {/* Số ngày dự kiến */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>SỐ NGÀY NUÔI DỰ KIẾN</Text>
                <TextInput
                  style={[styles.modalInput, cropErrors.expectedDays && styles.inputError]}
                  value={cropExpectedDays}
                  onChangeText={text => { setCropExpectedDays(text); setCropErrors(p => ({ ...p, expectedDays: '' })); }}
                  keyboardType="numeric"
                  placeholder="Ví dụ: 90"
                  placeholderTextColor="#94a3b8"
                />
                {cropErrors.expectedDays ? <Text style={styles.errText}>{cropErrors.expectedDays}</Text> : null}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreateCropModal(false)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, isSubmittingCrop && styles.submitBtnDisabled]}
                onPress={handleCreateCrop}
                disabled={isSubmittingCrop}
              >
                {isSubmittingCrop ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Tạo vụ nuôi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 32, width: '100%' },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16, width: '100%' },
  summaryCard: {
    flex: 1, minWidth: 0, backgroundColor: '#ffffff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  summaryValue: { fontSize: 24, fontWeight: '900', color: '#2563eb' },
  summaryLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 16 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },

  farmCard: {
    backgroundColor: '#ffffff', borderRadius: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  farmHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, width: '100%' },
  farmIconBox: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  farmInfo: { flex: 1, minWidth: 0 },
  farmName: { fontSize: 16, fontWeight: '800', color: '#0f172a', flexShrink: 1 },
  farmMeta: { fontSize: 12, color: '#64748b', marginTop: 2, flexShrink: 1 },
  farmBadge: {
    backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, marginRight: 2, flexShrink: 0,
  },
  farmBadgeText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },

  pondList: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  noPondText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingVertical: 16 },

  pondCard: {
    backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden',
  },
  pondRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  pondIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0',
  },
  pondInfo: { flex: 1 },
  pondName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  pondMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  cropActiveBadge: {
    backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: '#a7f3d0',
  },
  cropActiveBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  addCropBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe',
  },
  addCropBtnText: { fontSize: 10, fontWeight: '700', color: '#2563eb' },

  cropDetail: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  noCropText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 12 },
  cropItem: { borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cropItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cropStatusDot: { width: 8, height: 8, borderRadius: 4 },
  cropStatusText: { fontSize: 12, fontWeight: '700' },
  cropStageText: { fontSize: 11, color: '#64748b', marginLeft: 4 },
  cropMeta: { gap: 4 },
  cropMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cropMetaText: { fontSize: 12, color: '#64748b' },
  createCropBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 10, gap: 6, marginTop: 4,
  },
  createCropBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  pondInfoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eff6ff', padding: 10, borderRadius: 10, marginBottom: 14,
  },
  pondInfoText: { fontSize: 13, color: '#334155' },
  formGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.5, marginBottom: 5 },
  modalInput: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc',
  },
  inputError: { borderColor: '#fca5a5' },
  errText: { fontSize: 11, color: '#dc2626', marginTop: 3 },
  stageRow: { flexDirection: 'row', gap: 8 },
  stageBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
  },
  stageBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  stageBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  stageBtnTextActive: { color: '#2563eb', fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: '#f1f5f9' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  submitBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10, backgroundColor: '#059669', minWidth: 110, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#6ee7b7' },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
});

