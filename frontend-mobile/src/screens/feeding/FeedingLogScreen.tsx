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
  RefreshControl,
} from 'react-native';
import {
  Utensils,
  Waves,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  History,
  Trash2,
  Edit3,
  Divide,
  Package,
  ArrowLeft,
} from 'lucide-react-native';
import { pondService, OverviewPond, OverviewCrop } from '../../services/pondService';
import {
  feedingLogService,
  DEFAULT_FEEDING_PRESETS,
  PRESET_OPTIONS,
  SingleSessionPayload,
  DailyFeedingGroup,
} from '../../services/feedingLogService';
import { inventoryService, InventoryItem } from '../../services/inventoryService';
import HeaderLogo from '../../components/HeaderLogo';
import NotificationButton from '../../components/NotificationButton';

interface FeedingLogScreenProps {
  navigation?: any;
  route?: any;
}

export default function FeedingLogScreen({ navigation, route }: FeedingLogScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'RECORD' | 'HISTORY'>('RECORD');
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<OverviewCrop[]>([]);
  const [feedProducts, setFeedProducts] = useState<InventoryItem[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<string>(() => {
    return route?.params?.pondId || '';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Feeding Form State
  const [feedingDate, setFeedingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedFeedProductId, setSelectedFeedProductId] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('7_SESSIONS');
  const [batchFeedAmount, setBatchFeedAmount] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [loadingDailyDetails, setLoadingDailyDetails] = useState<boolean>(false);

  // Active status map of 7 sessions
  const [activeSessionsMap, setActiveSessionsMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    DEFAULT_FEEDING_PRESETS.forEach((p) => {
      map[p.session] = true;
    });
    return map;
  });

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

  // Feeding History State
  const [historyGroups, setHistoryGroups] = useState<DailyFeedingGroup[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Initialize data on mount
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
        const paramPond = overview.ponds.find((p) => p.id === route?.params?.pondId);
        const targetId = paramPond ? paramPond.id : overview.ponds[0].id;
        setSelectedPondId(targetId);
      }
      if (feeds?.length > 0) {
        setSelectedFeedProductId(feeds[0].id);
        setSessions((prev) =>
          prev.map((s) => ({ ...s, feedProductId: feeds[0].id }))
        );
      }
    } catch (e) {
      console.warn('Error loading feeding initial data:', e);
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

  // Auto Load Existing Daily Feeding Details When Date or Pond Changes
  const loadDailyDetails = useCallback(async () => {
    if (!selectedPondId || !feedingDate) return;
    try {
      setLoadingDailyDetails(true);
      const existingLogs = await feedingLogService.getDailyDetails(selectedPondId, feedingDate);
      if (Array.isArray(existingLogs) && existingLogs.length > 0) {
        setIsEditMode(true);
        const logMap = new Map<string, any>();
        existingLogs.forEach((l) => logMap.set(l.feedingSession, l));

        setSessions((prev) =>
          prev.map((sess) => {
            const matched = logMap.get(sess.feedingSession);
            if (matched) {
              return {
                ...sess,
                feedAmount: Number(matched.feedAmount) || 0,
                feedingTime: matched.feedingTime || sess.feedingTime,
                feedProductId: matched.feedProductId || selectedFeedProductId,
                feedingMethod: matched.feedingMethod || 'MANUAL',
                feedingStatus: matched.feedingStatus || 'COMPLETED',
                note: matched.note || '',
              };
            }
            return sess;
          })
        );
      } else {
        setIsEditMode(false);
        setSessions((prev) =>
          prev.map((sess) => ({
            ...sess,
            feedAmount: 0,
            feedingStatus: 'COMPLETED',
            note: '',
          }))
        );
      }
    } catch (e) {
      console.warn('Error fetching daily feeding details:', e);
    } finally {
      setLoadingDailyDetails(false);
    }
  }, [selectedPondId, feedingDate, selectedFeedProductId]);

  useEffect(() => {
    if (activeSubTab === 'RECORD') {
      loadDailyDetails();
    }
  }, [activeSubTab, loadDailyDetails]);

  // Load Feeding History Groups
  const loadFeedingHistory = useCallback(async () => {
    if (!selectedPondId) return;
    try {
      setLoadingHistory(true);
      const res = await feedingLogService.getAllGrouped({
        pondId: selectedPondId,
        size: 30,
      });
      setHistoryGroups(res.data || []);
    } catch (e) {
      console.warn('Error fetching feeding history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedPondId]);

  useEffect(() => {
    if (activeSubTab === 'HISTORY') {
      loadFeedingHistory();
    }
  }, [activeSubTab, loadFeedingHistory]);

  const adjustDate = (daysDelta: number) => {
    const current = new Date(feedingDate);
    current.setDate(current.getDate() + daysDelta);
    setFeedingDate(current.toISOString().slice(0, 10));
  };

  const isToday = useMemo(() => {
    return feedingDate === new Date().toISOString().slice(0, 10);
  }, [feedingDate]);

  const handleSessionChange = (index: number, field: keyof SingleSessionPayload, value: any) => {
    const updated = [...sessions];
    updated[index] = { ...updated[index], [field]: value };
    setSessions(updated);
  };

  const totalDailyFeedKg = useMemo(() => {
    return sessions.reduce((sum, s) => {
      const isActive = activeSessionsMap[s.feedingSession] ?? true;
      if (!isActive || s.feedingStatus === 'SKIPPED') return sum;
      return sum + (Number(s.feedAmount) || 0);
    }, 0);
  }, [sessions, activeSessionsMap]);

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PRESET_OPTIONS.find((p) => p.id === presetId);
    if (!preset) return;

    const newMap: Record<string, boolean> = {};
    DEFAULT_FEEDING_PRESETS.forEach((p, idx) => {
      newMap[p.session] = idx < preset.count;
    });
    setActiveSessionsMap(newMap);

    setSessions((prev) =>
      prev.map((sess, idx) => {
        if (idx < preset.times.length) {
          return { ...sess, feedingTime: preset.times[idx] };
        }
        return sess;
      })
    );
  };

  const handleDistributeFeed = () => {
    const totalKg = parseFloat(batchFeedAmount);
    if (isNaN(totalKg) || totalKg <= 0) {
      Alert.alert('Chưa hợp lệ', 'Vui lòng nhập tổng lượng thức ăn cả ngày (kg) là số dương.');
      return;
    }
    if (isNaN(totalKg) || totalKg <= 0) {
      Alert.alert('Số lượng không hợp lệ', 'Tổng lượng thức ăn cần chia phải là số dương (> 0 kg).');
      return;
    }
    const activeIndices: number[] = [];
    sessions.forEach((s, idx) => {
      if ((activeSessionsMap[s.feedingSession] ?? true) && s.feedingStatus !== 'SKIPPED') {
        activeIndices.push(idx);
      }
    });

    if (activeIndices.length === 0) {
      Alert.alert('Không có cữ ăn', 'Vui lòng bật ít nhất 1 cữ ăn hoạt động.');
      return;
    }

    const perSession = parseFloat((totalKg / activeIndices.length).toFixed(1));
    setSessions((prev) =>
      prev.map((s, idx) => {
        if (activeIndices.includes(idx)) {
          return { ...s, feedAmount: perSession };
        }
        return s;
      })
    );
    Alert.alert('Đã chia đều', `Đã chia ${totalKg} kg đều cho ${activeIndices.length} cữ ăn (~${perSession} kg/cữ).`);
  };

  const handleSubmitFeeding = async () => {
    // 1. Kiểm tra ao nuôi
    if (!selectedPondId || !activePond) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ao nuôi trước khi lưu.');
      return;
    }

    // 2. Kiểm tra vụ nuôi hoạt động
    if (!activeCrop) {
      Alert.alert('Không thể lưu', 'Không tìm thấy vụ nuôi ĐANG HOẠT ĐỘNG (ACTIVE) cho ao này. Hãy mở/tạo vụ nuôi mới trước!');
      return;
    }

    // 3. Kiểm tra ngày cho ăn
    if (!feedingDate) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ngày cho ăn.');
      return;
    }

    // 4. Kiểm tra danh sách sản phẩm thức ăn trong kho
    if (feedProducts.length === 0) {
      Alert.alert('Kho trống', 'Kho trang trại chưa có sản phẩm thức ăn nào. Vui lòng thêm thức ăn trong Kho vật tư trước!');
      return;
    }

    if (!selectedFeedProductId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn loại thức ăn cho các cữ ăn.');
      return;
    }

    // 5. Chuẩn bị payload và validate số liệu từng cữ
    const activePayload: SingleSessionPayload[] = [];
    for (const s of sessions) {
      const isActive = activeSessionsMap[s.feedingSession] ?? true;
      if (!isActive) continue;

      const amt = Number(s.feedAmount);
      if (s.feedingStatus !== 'SKIPPED' && (isNaN(amt) || amt < 0)) {
        Alert.alert('Số liệu không hợp lệ', `Lượng thức ăn cữ ${s.feedingSession.replace('SESSION_', '')} không được là số âm.`);
        return;
      }

      activePayload.push({
        ...s,
        feedProductId: s.feedProductId || selectedFeedProductId,
        feedAmount: s.feedingStatus === 'SKIPPED' ? 0 : Math.max(0, amt || 0),
      });
    }

    if (activePayload.length === 0) {
      Alert.alert('Chưa có cữ ăn', 'Vui lòng bật ít nhất một cữ ăn hoạt động.');
      return;
    }

    // 6. Kiểm tra tồn kho thức ăn (Stock Deficit Check y như Web)
    const neededMap: Record<string, number> = {};
    activePayload.forEach((s) => {
      if (s.feedingStatus !== 'SKIPPED' && s.feedAmount > 0) {
        const pid = s.feedProductId || selectedFeedProductId;
        neededMap[pid] = (neededMap[pid] || 0) + s.feedAmount;
      }
    });

    for (const [pid, needed] of Object.entries(neededMap)) {
      const prod = feedProducts.find((p) => p.id === pid);
      if (prod && typeof prod.quantity === 'number' && needed > prod.quantity) {
        Alert.alert(
          'Kho không đủ thức ăn',
          `Thức ăn "${prod.itemName || (prod as any).name || 'Đã chọn'}" chỉ còn ${prod.quantity.toLocaleString()} ${prod.unit}, nhưng các cữ hôm nay cần ${needed.toFixed(1)} ${prod.unit} (thiếu ${(needed - prod.quantity).toFixed(1)} ${prod.unit}).\n\nVui lòng điều chỉnh giảm lượng ăn hoặc chọn "Bỏ cữ"!`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await feedingLogService.createOrUpdateDailyLog({
        farmId: activePond.farmId,
        pondId: activePond.id,
        cropId: activeCrop.id,
        feedingDate,
        sessions: activePayload,
      });
      setIsEditMode(true);
      Alert.alert(
        'Thành công',
        `Đã lưu nhật ký cho ăn ngày ${feedingDate} (${activePayload.length} cữ • Tổng: ${totalDailyFeedKg.toFixed(1)} kg). Lượng thức ăn đã được ghi nhận trừ kho!`
      );
    } catch (e: any) {
      Alert.alert('Thất bại', e.message || 'Lỗi khi lưu nhật ký cho ăn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDailyFeeding = (group: DailyFeedingGroup) => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa toàn bộ nhật ký cho ăn ngày ${group.feedingDate} của ao ${group.pondName || activePond?.name}? Lượng thức ăn sẽ được hoàn trả lại kho.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            try {
              await feedingLogService.deleteDailyLog(
                group.farmId,
                group.pondId,
                group.cropId,
                group.feedingDate
              );
              Alert.alert('Thành công', 'Đã xóa nhật ký cho ăn.');
              loadFeedingHistory();
              if (feedingDate === group.feedingDate) {
                loadDailyDetails();
              }
            } catch (err: any) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa nhật ký cho ăn.');
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
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <HeaderLogo size={36} showText={false} />
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Nhật Ký Cho Ăn</Text>
            <Text style={styles.headerSubtitle}>
              Ghi nhận cữ ăn hàng ngày • Quản lý lượng thức ăn ao nuôi
            </Text>
          </View>
        </View>
      </View>

      {/* Pond Selector Horizontal Bar */}
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
                <Waves size={13} color={active ? '#ffffff' : '#0d9488'} />
                <Text style={[styles.pondChipText, active && styles.pondChipTextActive]}>
                  {pond.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2 Sub Tabs: Ghi nhận cho ăn vs Lịch sử cho ăn */}
      <View style={styles.subTabsRow}>
        <TouchableOpacity
          style={[styles.subTabItem, activeSubTab === 'RECORD' && styles.subTabItemActive]}
          onPress={() => setActiveSubTab('RECORD')}
        >
          <Utensils size={15} color={activeSubTab === 'RECORD' ? '#0d9488' : '#64748b'} />
          <Text style={[styles.subTabText, activeSubTab === 'RECORD' && styles.subTabTextActive]}>
            Ghi nhận cho ăn
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabItem, activeSubTab === 'HISTORY' && styles.subTabItemActive]}
          onPress={() => setActiveSubTab('HISTORY')}
        >
          <History size={15} color={activeSubTab === 'HISTORY' ? '#0d9488' : '#64748b'} />
          <Text style={[styles.subTabText, activeSubTab === 'HISTORY' && styles.subTabTextActive]}>
            Lịch sử cho ăn
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Đang tải dữ liệu nhật ký cho ăn...</Text>
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
              colors={['#0d9488']}
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
                  ? `Thả: ${activeCrop.initialShrimpCount?.toLocaleString()} con • Diện tích: ${activePond?.areaSize} m²`
                  : 'Ao hiện chưa có vụ nuôi ACTIVE.'}
              </Text>
            </View>
          </View>

          {/* ════════════ SUB-TAB 1: RECORD FEEDING ════════════ */}
          {activeSubTab === 'RECORD' ? (
            <View>
              {/* Date Navigator Bar */}
              <View style={styles.dateNavigator}>
                <TouchableOpacity
                  style={styles.dateNavArrow}
                  onPress={() => adjustDate(-1)}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={18} color="#0f766e" />
                </TouchableOpacity>

                <View style={styles.dateDisplayBox}>
                  <Calendar size={14} color="#0f766e" />
                  <Text style={styles.dateDisplayText}>
                    {isToday ? `Hôm nay (${feedingDate})` : feedingDate}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.dateNavArrow}
                  onPress={() => adjustDate(1)}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={18} color="#0f766e" />
                </TouchableOpacity>

                {!isToday && (
                  <TouchableOpacity
                    style={styles.todayPill}
                    onPress={() => setFeedingDate(new Date().toISOString().slice(0, 10))}
                  >
                    <Text style={styles.todayPillText}>Về hôm nay</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Edit Mode Alert */}
              {isEditMode && (
                <View style={styles.editModeBanner}>
                  <CheckCircle2 size={14} color="#059669" />
                  <Text style={styles.editModeBannerText}>
                    Đã có nhật ký cho ngày này. Bạn có thể xem và chỉnh sửa cữ ăn.
                  </Text>
                </View>
              )}

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
                      <Package size={12} color={selected ? '#0d9488' : '#64748b'} />
                      <Text style={[styles.feedChipText, selected && styles.feedChipTextSelected]}>
                        {p.itemName} ({p.quantity} {p.unit})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Preset Section (4, 5, 6, 7 cữ) */}
              <View style={styles.presetSection}>
                <Text style={styles.fieldLabel}>Chọn số cữ ăn / ngày:</Text>
                <View style={styles.presetRow}>
                  {PRESET_OPTIONS.map((opt) => {
                    const active = selectedPresetId === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.presetChip, active && styles.presetChipActive]}
                        onPress={() => applyPreset(opt.id)}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            active && styles.presetChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Auto-distribute Tool (Chia đều thức ăn) */}
              <View style={styles.batchDistributeBox}>
                <View style={styles.batchTitleRow}>
                  <Divide size={15} color="#0f766e" />
                  <Text style={styles.batchTitle}>Chia đều lượng ăn trong ngày</Text>
                </View>
                <View style={styles.batchInputRow}>
                  <TextInput
                    style={styles.batchInput}
                    keyboardType="numeric"
                    placeholder="Tổng kg (ví dụ: 80)"
                    value={batchFeedAmount}
                    onChangeText={setBatchFeedAmount}
                  />
                  <TouchableOpacity
                    style={styles.batchButton}
                    onPress={handleDistributeFeed}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.batchButtonText}>Chia đều</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Summary Box */}
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Ngày ghi nhận:</Text>
                  <Text style={styles.summaryValue}>{feedingDate}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tổng lượng ăn hôm nay:</Text>
                  <Text style={styles.summaryValueHighlight}>
                    {totalDailyFeedKg.toFixed(1)} kg
                  </Text>
                </View>
              </View>

              {/* Feeding Sessions List */}
              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
                Chi tiết các cữ ăn trong ngày:
              </Text>

              {loadingDailyDetails ? (
                <ActivityIndicator size="small" color="#0d9488" style={{ marginVertical: 16 }} />
              ) : (
                sessions.map((sess, idx) => {
                  const isActive = activeSessionsMap[sess.feedingSession] ?? true;
                  if (!isActive) return null;

                  const isSkipped = sess.feedingStatus === 'SKIPPED';

                  return (
                    <View key={sess.feedingSession} style={styles.sessionCard}>
                      <View style={styles.sessionHeader}>
                        <View style={styles.sessionTitleGroup}>
                          <Clock size={14} color="#0f766e" />
                          <Text style={styles.sessionTitle}>
                            Cữ {idx + 1} ({sess.feedingTime})
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.sessionStatusPill,
                            isSkipped
                              ? styles.sessionStatusSkipped
                              : styles.sessionStatusCompleted,
                          ]}
                          onPress={() => {
                            handleSessionChange(
                              idx,
                              'feedingStatus',
                              isSkipped ? 'COMPLETED' : 'SKIPPED'
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.sessionStatusPillText,
                              isSkipped
                                ? styles.sessionStatusSkippedText
                                : styles.sessionStatusCompletedText,
                            ]}
                          >
                            {isSkipped ? 'Bỏ cữ' : 'Đã cho ăn'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {!isSkipped && (
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

                          <View style={{ flex: 1.4 }}>
                            <Text style={styles.inputSubLabel}>Kiểm tra nhá/vó ăn:</Text>
                            <TextInput
                              style={styles.sessionInput}
                              placeholder="Hết sạch / Thừa 5%..."
                              value={sess.note || ''}
                              onChangeText={(v) => handleSessionChange(idx, 'note', v)}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmitFeeding}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isEditMode ? 'Cập Nhật Nhật Ký Cho Ăn' : 'Lưu Nhật Ký Cho Ăn Ngày'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ════════════ SUB-TAB 2: FEEDING HISTORY ════════════ */
            <View>
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyListTitle}>
                  Lịch sử cho ăn ao: {activePond?.name}
                </Text>
                <TouchableOpacity
                  onPress={loadFeedingHistory}
                  style={styles.historyRefreshBtn}
                >
                  <Text style={styles.historyRefreshText}>Làm mới</Text>
                </TouchableOpacity>
              </View>

              {loadingHistory ? (
                <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 24 }} />
              ) : historyGroups.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Utensils size={36} color="#cbd5e1" />
                  <Text style={styles.emptyCardTitle}>Chưa có nhật ký cho ăn</Text>
                  <Text style={styles.emptyCardDesc}>
                    Hãy ghi nhật ký cữ ăn hôm nay để theo dõi FCR và chi phí thức ăn.
                  </Text>
                </View>
              ) : (
                historyGroups.map((item) => (
                  <View key={item.feedingDate} style={styles.historyItemCard}>
                    <View style={styles.historyCardHeader}>
                      <View style={styles.historyDateRow}>
                        <Calendar size={14} color="#0f766e" />
                        <Text style={styles.historyDateText}>{item.feedingDate}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteDailyFeeding(item)}
                        style={styles.historyDeleteButton}
                      >
                        <Trash2 size={15} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.historyMetricsRow}>
                      <View style={styles.historyMetricBox}>
                        <Text style={styles.historyMetricLabel}>Tổng lượng ăn</Text>
                        <Text style={styles.historyMetricVal}>
                          {Number(item.totalFeedAmount).toFixed(1)} kg
                        </Text>
                      </View>

                      <View style={styles.historyMetricBox}>
                        <Text style={styles.historyMetricLabel}>Số cữ hoàn thành</Text>
                        <Text style={styles.historyMetricVal}>
                          {item.completedCount}/{item.sessionCount} cữ
                        </Text>
                      </View>
                    </View>

                    {item.feedProductNames && item.feedProductNames.length > 0 && (
                      <Text style={styles.historyFeedText}>
                        Thức ăn: {item.feedProductNames.join(', ')}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={styles.historyEditBtn}
                      onPress={() => {
                        setFeedingDate(item.feedingDate);
                        setActiveSubTab('RECORD');
                      }}
                    >
                      <Edit3 size={13} color="#0f766e" />
                      <Text style={styles.historyEditText}>Xem & Chỉnh sửa ngày này</Text>
                    </TouchableOpacity>
                  </View>
                ))
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
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
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
    borderBottomColor: '#0d9488',
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  subTabTextActive: {
    color: '#0d9488',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  pondStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#134e4a',
  },
  activeCropPill: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeCropPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f766e',
  },
  statusBannerDesc: {
    fontSize: 11,
    color: '#0f766e',
    marginTop: 3,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  dateNavArrow: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f0fdfa',
  },
  dateDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateDisplayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  todayPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  editModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 10,
  },
  editModeBannerText: {
    fontSize: 11,
    color: '#065f46',
    flex: 1,
  },
  summaryBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
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
    color: '#0d9488',
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
    marginBottom: 12,
  },
  feedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  feedChipSelected: {
    backgroundColor: '#f0fdfa',
    borderColor: '#0d9488',
  },
  feedChipText: {
    fontSize: 12,
    color: '#475569',
  },
  feedChipTextSelected: {
    color: '#0d9488',
    fontWeight: '700',
  },
  presetSection: {
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  batchDistributeBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  batchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  batchTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
  },
  batchInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  batchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  batchButton: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batchButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sessionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  sessionStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sessionStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sessionStatusCompleted: {
    backgroundColor: '#f0fdf4',
  },
  sessionStatusCompletedText: {
    fontSize: 10,
    color: '#16a34a',
    fontWeight: '700',
  },
  sessionStatusSkipped: {
    backgroundColor: '#fef2f2',
  },
  sessionStatusSkippedText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '700',
  },
  sessionInputsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  inputSubLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 3,
  },
  sessionInput: {
    height: 36,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0f172a',
  },
  submitButton: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 30,
  },
  submitButtonDisabled: {
    backgroundColor: '#99f6e4',
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
    backgroundColor: '#f0fdfa',
    borderRadius: 6,
  },
  historyRefreshText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f766e',
  },
  historyItemCard: {
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
    marginBottom: 8,
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyDeleteButton: {
    padding: 4,
  },
  historyMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  historyMetricBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
  },
  historyMetricLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  historyMetricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
    marginTop: 2,
  },
  historyFeedText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  historyEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginTop: 8,
    backgroundColor: '#f0fdfa',
    borderRadius: 8,
  },
  historyEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
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
});


