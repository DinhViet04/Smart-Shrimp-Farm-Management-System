import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Waves,
  Droplets,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
  Building2,
  Clock,
  ArrowRight,
  TrendingUp,
  HeartPulse,
  Sparkles,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Bot,
  Plus,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { pondService, OverviewFarm, OverviewPond, OverviewCrop } from '../services/pondService';
import { getWaterQualityHistory, WaterQualityHistoryRecord } from '../services/waterQualityService';
import { feedingLogService } from '../services/feedingLogService';
import { incidentService, Incident } from '../services/incidentService';
import { shrimpHealthService, ShrimpHealthRecord } from '../services/shrimpHealthService';

interface DashboardScreenProps {
  navigation: any;
}

const getDOC = (startDate: string) => {
  return Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000));
};

const fmtTimeAgo = (iso: string) => {
  try {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'Vừa đo';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} giờ trước`;
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
};

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { userToken, currentUser, userRole } = useAuth();

  const [farms, setFarms] = useState<OverviewFarm[]>([]);
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<OverviewCrop[]>([]);
  const [waterQualities, setWaterQualities] = useState<WaterQualityHistoryRecord[]>([]);
  const [todayFeedingGroups, setTodayFeedingGroups] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [healthRecords, setHealthRecords] = useState<ShrimpHealthRecord[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Format today's date in Vietnamese: "Thứ Hai, 12/10/2026"
  const todayStrVN = useMemo(() => {
    try {
      const now = new Date();
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = days[now.getDay()];
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      return `${dayName}, ${d}/${m}/${y}`;
    } catch {
      return '';
    }
  }, []);

  const todayIsoDateOnly = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Fetch all live data for Farmer / Manager Dashboard
  const fetchAllData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // 1. Master data: Ponds, Farms, Crops
      const overview = await pondService.getOverview().catch(() => ({ farms: [], ponds: [], crops: [] }));
      setFarms(overview.farms || []);
      setPonds(overview.ponds || []);
      setCrops(overview.crops || []);

      // 2. Water Quality History (latest 100)
      if (userToken) {
        const wqRes = await getWaterQualityHistory(userToken, {
          farmId: selectedFarmId !== 'ALL' ? selectedFarmId : undefined,
          size: 100,
        }).catch(() => ({ content: [] }));
        setWaterQualities(wqRes.content || []);
      }

      // 3. Feeding Logs for today
      const feedingRes = await feedingLogService
        .getAllGrouped({
          farmId: selectedFarmId !== 'ALL' ? selectedFarmId : undefined,
          size: 50,
        })
        .catch(() => ({ data: [] }));

      const allFeeding: any[] = (feedingRes as any).data || (feedingRes as any).content || [];
      const todayLogs = allFeeding.filter((g: any) => {
        const gDate = String(g.feedingDate || '').split('T')[0];
        return gDate === todayIsoDateOnly;
      });
      setTodayFeedingGroups(todayLogs);

      // 4. Incidents (Open or Treating)
      const incRes = await incidentService.getAll(userToken || undefined).catch(() => ({ content: [] }));
      const allIncidents = incRes.content || [];
      const filteredIncidents =
        selectedFarmId !== 'ALL'
          ? allIncidents.filter((i) => i.crop?.pond?.farm?.id === selectedFarmId)
          : allIncidents;
      setIncidents(filteredIncidents);

      // 5. Shrimp Health Records
      const healthList = await shrimpHealthService
        .getHistory(undefined, selectedFarmId !== 'ALL' ? selectedFarmId : undefined)
        .catch(() => []);
      setHealthRecords(healthList);
    } catch (err) {
      console.warn('Lỗi khi tải dữ liệu Dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userToken, selectedFarmId, todayIsoDateOnly]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Ponds filtered by selected farm
  const visiblePonds = useMemo(() => {
    if (!selectedFarmId || selectedFarmId === 'ALL') return ponds;
    return ponds.filter((p) => p.farmId === selectedFarmId);
  }, [ponds, selectedFarmId]);

  // Aggregate pond cards with live metrics
  const pondCards = useMemo(() => {
    return visiblePonds.map((pond) => {
      // Find active crop for this pond
      const pondCrops = crops.filter((c) => String(c.pondId) === String(pond.id));
      const activeCrop =
        pondCrops.find((c) => (c.status || '').toUpperCase() === 'ACTIVE') ||
        pondCrops.find((c) => {
          const s = (c.status || '').toUpperCase();
          return s !== 'HARVESTED' && s !== 'FAILED';
        }) ||
        null;

      const doc = activeCrop ? getDOC(activeCrop.startDate) : null;

      // Latest water quality for this pond
      const latestWq = waterQualities.find((wq) => wq.pondName === pond.name) || null;

      // Today's feeding progress for this pond
      const feedingGroup = todayFeedingGroups.find((g) => String(g.pondId) === String(pond.id));
      const completedSessions = feedingGroup?.completedSessions || 0;
      const totalFeedTodayKg = feedingGroup?.totalFeedKg || 0;

      // Open incidents for this pond
      const pondIncidents = incidents.filter((i) => {
        const pondMatches = i.crop?.pond?.name === pond.name || (activeCrop && i.crop?.id === activeCrop.id);
        return pondMatches && (i.status === 'OPEN' || i.status === 'TREATING');
      });

      // Latest health observation
      const latestHealth = healthRecords.find(
        (h) => h.pond?.name === pond.name || h.pondId === pond.id || (activeCrop && h.cropId === activeCrop.id)
      );

      // Water condition check
      const doVal = latestWq ? Number(latestWq.dissolvedOxygen) : null;
      const phVal = latestWq ? Number(latestWq.ph) : null;
      const isDoLow = doVal !== null && doVal > 0 && doVal < 4.0;
      const isDoWarning = doVal !== null && doVal >= 4.0 && doVal < 5.0;
      const isPhAlert = phVal !== null && phVal > 0 && (phVal < 7.5 || phVal > 8.5);

      return {
        pond,
        crop: activeCrop,
        doc,
        latestWq,
        isDoLow,
        isDoWarning,
        isPhAlert,
        completedSessions,
        totalFeedTodayKg,
        pondIncidents,
        latestHealth,
      };
    });
  }, [visiblePonds, crops, waterQualities, todayFeedingGroups, incidents, healthRecords]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalPonds = pondCards.length;
    const activePonds = pondCards.filter((p) => p.crop !== null).length;
    const idlePonds = totalPonds - activePonds;
    const pondsWithAlert = pondCards.filter((p) => p.isDoLow || p.isPhAlert || p.pondIncidents.length > 0).length;
    const totalFeedKg = pondCards.reduce((acc, p) => acc + p.totalFeedTodayKg, 0);
    const totalCompletedSessions = pondCards.reduce((acc, p) => acc + p.completedSessions, 0);
    const openIncidentsCount = pondCards.reduce((acc, p) => acc + p.pondIncidents.length, 0);

    return {
      totalPonds,
      activePonds,
      idlePonds,
      pondsWithAlert,
      totalFeedKg: Math.round(totalFeedKg * 10) / 10,
      totalCompletedSessions,
      openIncidentsCount,
    };
  }, [pondCards]);

  // Ponds needing immediate attention
  const urgentAlerts = useMemo(() => {
    return pondCards.filter((p) => p.isDoLow || p.pondIncidents.length > 0);
  }, [pondCards]);

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={styles.loadingText}>Đang đồng bộ dữ liệu thực địa ao nuôi...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchAllData(true)}
          colors={['#0d9488']}
          tintColor="#0d9488"
        />
      }
    >
      {/* ── 1. HEADER CARD ── */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.badgeRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveBadgeText}>NHẬT TRÌNH THỰC ĐỊA • {todayStrVN}</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => fetchAllData(true)}
            activeOpacity={0.7}
          >
            <RefreshCw size={16} color="#0d9488" />
          </TouchableOpacity>
        </View>

        <Text style={styles.greetingTitle}>
          Chào {currentUser?.fullName || (userRole === 'FARM_MANAGER' ? 'Quản Lý' : 'Nông Dân')}!
        </Text>
        <Text style={styles.greetingSubtitle}>
          Theo dõi cữ ăn, môi trường nước và sức khỏe tôm thực tế theo từng ao phụ trách
        </Text>

        {/* Farm Selector Chips */}
        {(farms.length > 0 || userRole === 'FARM_MANAGER') && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.farmChipsContainer}
            contentContainerStyle={styles.farmChipsContent}
          >
            {farms.length > 0 && (
              <TouchableOpacity
                style={[styles.farmChip, selectedFarmId === 'ALL' && styles.farmChipActive]}
                onPress={() => setSelectedFarmId('ALL')}
              >
                <Building2 size={13} color={selectedFarmId === 'ALL' ? '#ffffff' : '#475569'} />
                <Text
                  style={[
                    styles.farmChipText,
                    selectedFarmId === 'ALL' && styles.farmChipTextActive,
                  ]}
                >
                  Tất cả trang trại ({farms.length})
                </Text>
              </TouchableOpacity>
            )}

            {farms.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.farmChip, selectedFarmId === f.id && styles.farmChipActive]}
                onPress={() => setSelectedFarmId(f.id)}
              >
                <Text
                  style={[
                    styles.farmChipText,
                    selectedFarmId === f.id && styles.farmChipTextActive,
                  ]}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}

            {userRole === 'FARM_MANAGER' && (
              <TouchableOpacity
                style={[
                  styles.farmChip,
                  {
                    backgroundColor: '#ecfdf5',
                    borderColor: '#10b981',
                    borderStyle: 'dashed',
                  },
                ]}
                onPress={() => navigation.navigate('Ao/Vụ', { openCreateFarm: true })}
              >
                <Plus size={13} color="#059669" />
                <Text
                  style={[
                    styles.farmChipText,
                    { color: '#059669', fontWeight: '700' },
                  ]}
                >
                  + Thêm trang trại
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── 2. URGENT EMERGENCY BANNER ── */}
      {urgentAlerts.length > 0 && (
        <View style={styles.urgentBanner}>
          <View style={styles.urgentHeader}>
            <View style={styles.urgentIconWrapper}>
              <AlertTriangle size={20} color="#ffffff" />
            </View>
            <View style={styles.urgentTextContainer}>
              <Text style={styles.urgentTitle}>
                Cảnh báo cần kiểm tra gấp ({urgentAlerts.length} ao)!
              </Text>
              <Text style={styles.urgentDesc}>
                {urgentAlerts
                  .map(
                    (a) =>
                      `${a.pond.name}${
                        a.isDoLow
                          ? ` (Oxy rất thấp: ${a.latestWq?.dissolvedOxygen} mg/L)`
                          : ''
                      }${
                        a.pondIncidents.length > 0
                          ? ` (${a.pondIncidents.length} sự cố)`
                          : ''
                      }`
                  )
                  .join(' • ')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.urgentActionButton}
            onPress={() => navigation.navigate('Môi trường')}
          >
            <Text style={styles.urgentActionText}>Kiểm tra ngay →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── 3. 4 MACRO KPI CARDS ── */}
      <View style={styles.kpiGrid}>
        {/* KPI 1: Ao đang nuôi */}
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconBox, { backgroundColor: '#f0fdfa' }]}>
            <Waves size={20} color="#0d9488" />
          </View>
          <Text style={styles.kpiLabel}>AO ĐANG NUÔI</Text>
          <View style={styles.kpiValueRow}>
            <Text style={styles.kpiMainValue}>{kpis.activePonds}</Text>
            <Text style={styles.kpiSubValue}>/{kpis.totalPonds} ao</Text>
          </View>
          <Text style={styles.kpiHintText}>
            {kpis.idlePonds > 0 ? `${kpis.idlePonds} ao đang trống` : '100% ao có vụ'}
          </Text>
        </View>

        {/* KPI 2: Đã cho ăn hôm nay */}
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconBox, { backgroundColor: '#ecfdf5' }]}>
            <ClipboardList size={20} color="#059669" />
          </View>
          <Text style={styles.kpiLabel}>ĐÃ CHO ĂN HÔM NAY</Text>
          <View style={styles.kpiValueRow}>
            <Text style={styles.kpiMainValue}>
              {kpis.totalFeedKg > 0 ? `${kpis.totalFeedKg}` : '--'}
            </Text>
            <Text style={styles.kpiSubValue}>kg</Text>
          </View>
          <Text style={[styles.kpiHintText, { color: '#059669' }]}>
            {kpis.totalCompletedSessions > 0
              ? `${kpis.totalCompletedSessions} cữ hoàn thành`
              : 'Chưa có cữ ăn'}
          </Text>
        </View>

        {/* KPI 3: Trạng thái nước */}
        <View
          style={[
            styles.kpiCard,
            kpis.pondsWithAlert > 0 && { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
          ]}
        >
          <View
            style={[
              styles.kpiIconBox,
              kpis.pondsWithAlert > 0
                ? { backgroundColor: '#fef3c7' }
                : { backgroundColor: '#ecfeff' },
            ]}
          >
            <Droplets
              size={20}
              color={kpis.pondsWithAlert > 0 ? '#b45309' : '#0891b2'}
            />
          </View>
          <Text style={styles.kpiLabel}>TRẠNG THÁI NƯỚC</Text>
          <View style={styles.kpiValueRow}>
            <Text style={styles.kpiMainValue}>
              {kpis.totalPonds - kpis.pondsWithAlert}
            </Text>
            <Text style={styles.kpiSubValue}>/{kpis.totalPonds} ổn định</Text>
          </View>
          <Text
            style={[
              styles.kpiHintText,
              { color: kpis.pondsWithAlert > 0 ? '#b45309' : '#059669' },
            ]}
          >
            {kpis.pondsWithAlert > 0
              ? `${kpis.pondsWithAlert} ao cần lưu ý`
              : 'Thông số đều đạt'}
          </Text>
        </View>

        {/* KPI 4: Sự cố hiện trường */}
        <View
          style={[
            styles.kpiCard,
            kpis.openIncidentsCount > 0 && { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
          ]}
        >
          <View
            style={[
              styles.kpiIconBox,
              kpis.openIncidentsCount > 0
                ? { backgroundColor: '#fee2e2' }
                : { backgroundColor: '#f5f3ff' },
            ]}
          >
            <AlertTriangle
              size={20}
              color={kpis.openIncidentsCount > 0 ? '#dc2626' : '#7c3aed'}
            />
          </View>
          <Text style={styles.kpiLabel}>SỰ CỐ HIỆN TRƯỜNG</Text>
          <View style={styles.kpiValueRow}>
            <Text
              style={[
                styles.kpiMainValue,
                kpis.openIncidentsCount > 0 && { color: '#dc2626' },
              ]}
            >
              {kpis.openIncidentsCount}
            </Text>
            <Text style={styles.kpiSubValue}>vấn đề</Text>
          </View>
          <Text
            style={[
              styles.kpiHintText,
              { color: kpis.openIncidentsCount > 0 ? '#dc2626' : '#64748b' },
            ]}
          >
            {kpis.openIncidentsCount > 0 ? 'Cần xử lý & theo dõi' : 'Không có sự cố'}
          </Text>
        </View>
      </View>

      {/* ── 4. QUICK ACTIONS ROW ── */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionHeaderTitle}>TÁC NGHIỆP NHANH HÀNG NGÀY</Text>
        <View style={styles.quickActionsGrid}>
          {/* Action 1: Quản lý ao nuôi */}
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
            onPress={() => navigation.navigate('Ao/Vụ')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIconBox, { backgroundColor: '#10b981' }]}>
              <Waves size={18} color="#ffffff" />
            </View>
            <View style={styles.quickActionTextBox}>
              <Text style={[styles.quickActionTitle, { color: '#065f46' }]}>Quản lý ao nuôi</Text>
              <Text style={[styles.quickActionDesc, { color: '#047857' }]}>Danh sách ao & vụ</Text>
            </View>
          </TouchableOpacity>

          {/* Action 2: Ghi nhận nước */}
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' }]}
            onPress={() => navigation.navigate('Môi trường', { screen: 'RecordWaterQuality' })}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIconBox, { backgroundColor: '#06b6d4' }]}>
              <Droplets size={18} color="#ffffff" />
            </View>
            <View style={styles.quickActionTextBox}>
              <Text style={[styles.quickActionTitle, { color: '#164e63' }]}>Ghi nhận nước</Text>
              <Text style={[styles.quickActionDesc, { color: '#0e7490' }]}>Oxy, pH, kiềm</Text>
            </View>
          </TouchableOpacity>

          {/* Action 3: Báo cáo sự cố */}
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
            onPress={() => navigation.navigate('Sự cố', { screen: 'IncidentCreate' })}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIconBox, { backgroundColor: '#ef4444' }]}>
              <AlertTriangle size={18} color="#ffffff" />
            </View>
            <View style={styles.quickActionTextBox}>
              <Text style={[styles.quickActionTitle, { color: '#991b1b' }]}>Báo cáo sự cố</Text>
              <Text style={[styles.quickActionDesc, { color: '#b91c1c' }]}>Tôm nổi đầu, hỏng máy</Text>
            </View>
          </TouchableOpacity>

          {/* Action 4: Theo dõi tăng trưởng */}
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}
            onPress={() => navigation.navigate('Theo dõi tăng trưởng')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIconBox, { backgroundColor: '#4f46e5' }]}>
              <TrendingUp size={18} color="#ffffff" />
            </View>
            <View style={styles.quickActionTextBox}>
              <Text style={[styles.quickActionTitle, { color: '#312e81' }]}>Tăng trưởng tôm</Text>
              <Text style={[styles.quickActionDesc, { color: '#4338ca' }]}>Kích cỡ & FCR</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 5. LIVE POND COMMAND CARDS ── */}
      <View style={styles.pondsSection}>
        <View style={styles.pondsSectionHeader}>
          <View style={styles.pondsHeaderTitleRow}>
            <Waves size={18} color="#0d9488" />
            <Text style={styles.pondsSectionTitle}>
              Danh sách Ao phụ trách ({pondCards.length} ao)
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Ao/Vụ')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllPondsText}>Xem tất cả →</Text>
          </TouchableOpacity>
        </View>

        {pondCards.length === 0 ? (
          <View style={styles.emptyPondsCard}>
            <Waves size={36} color="#cbd5e1" />
            <Text style={styles.emptyPondsTitle}>Chưa có ao nuôi nào được phân công</Text>
            <Text style={styles.emptyPondsDesc}>
              Liên hệ Quản lý trang trại để được phân công ao phụ trách
            </Text>
          </View>
        ) : (
          <View style={styles.pondCardList}>
            {pondCards.map((item) => {
              const {
                pond,
                crop,
                doc,
                latestWq,
                isDoLow,
                isDoWarning,
                isPhAlert,
                completedSessions,
                totalFeedTodayKg,
                pondIncidents,
                latestHealth,
              } = item;

              const isIdle = crop === null;
              const hasAlert = isDoLow || isPhAlert || pondIncidents.length > 0;

              return (
                <View
                  key={pond.id}
                  style={[
                    styles.pondCard,
                    isDoLow || pondIncidents.length > 0
                      ? styles.pondCardDanger
                      : hasAlert
                      ? styles.pondCardWarning
                      : isIdle
                      ? styles.pondCardIdle
                      : styles.pondCardNormal,
                  ]}
                >
                  {/* Top Color Strip */}
                  <View
                    style={[
                      styles.pondTopBar,
                      {
                        backgroundColor:
                          isDoLow || pondIncidents.length > 0
                            ? '#ef4444'
                            : hasAlert
                            ? '#f59e0b'
                            : isIdle
                            ? '#cbd5e1'
                            : '#0d9488',
                      },
                    ]}
                  />

                  {/* Pond Card Header */}
                  <View style={styles.pondCardHeader}>
                    <View style={styles.pondInfoLeft}>
                      <View style={styles.pondNameRow}>
                        <Text style={styles.pondNameText}>{pond.name}</Text>
                        {pond.areaSize && (
                          <Text style={styles.pondAreaText}>({pond.areaSize} m²)</Text>
                        )}
                      </View>
                      <Text style={styles.pondCropSubtitle}>
                        {isIdle
                          ? 'Ao hiện chưa thả giống'
                          : crop?.stage === 'NURSERY'
                          ? 'Vụ Ương Dưỡng'
                          : 'Vụ Thương Phẩm'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.pondStatusBadge,
                        isDoLow || pondIncidents.length > 0
                          ? styles.statusBadgeDanger
                          : hasAlert
                          ? styles.statusBadgeWarning
                          : isIdle
                          ? styles.statusBadgeIdle
                          : styles.statusBadgeSuccess,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pondStatusText,
                          isDoLow || pondIncidents.length > 0
                            ? { color: '#b91c1c' }
                            : hasAlert
                            ? { color: '#92400e' }
                            : isIdle
                            ? { color: '#64748b' }
                            : { color: '#065f46' },
                        ]}
                      >
                        {isIdle
                          ? 'Ao trống'
                          : isDoLow || pondIncidents.length > 0
                          ? 'Nguy hiểm'
                          : hasAlert
                          ? 'Cần chú ý'
                          : 'Bình thường'}
                      </Text>
                    </View>
                  </View>

                  {/* Body: Active Crop Metrics */}
                  {!isIdle ? (
                    <View style={styles.pondCardBody}>
                      {/* DOC & Stocking badge */}
                      <View style={styles.docRow}>
                        <View style={styles.docLeft}>
                          <Calendar size={13} color="#0d9488" />
                          <Text style={styles.docText}>DOC {doc} ngày</Text>
                        </View>
                        <Text style={styles.stockingText}>
                          Thả: {(crop?.initialShrimpCount || 0).toLocaleString('vi-VN')} con
                        </Text>
                      </View>

                      {/* Water Quality Strip */}
                      <View style={styles.waterQualityStrip}>
                        <View style={styles.waterHeaderRow}>
                          <View style={styles.waterHeaderLeft}>
                            <Droplets size={12} color="#0284c7" />
                            <Text style={styles.waterHeaderTitle}>Môi trường nước</Text>
                          </View>
                          <Text style={styles.waterTimeAgo}>
                            {latestWq ? fmtTimeAgo(latestWq.recordTime) : 'Chưa đo'}
                          </Text>
                        </View>

                        {latestWq ? (
                          <View style={styles.waterParamsGrid}>
                            {/* DO */}
                            <View style={styles.paramBox}>
                              <Text style={styles.paramLabel}>Oxy (DO)</Text>
                              <Text
                                style={[
                                  styles.paramValue,
                                  isDoLow
                                    ? { color: '#dc2626' }
                                    : isDoWarning
                                    ? { color: '#d97706' }
                                    : { color: '#0f172a' },
                                ]}
                              >
                                {latestWq.dissolvedOxygen}
                              </Text>
                              <Text style={styles.paramUnit}>mg/L</Text>
                            </View>

                            {/* pH */}
                            <View style={styles.paramBox}>
                              <Text style={styles.paramLabel}>pH</Text>
                              <Text
                                style={[
                                  styles.paramValue,
                                  isPhAlert ? { color: '#d97706' } : { color: '#0f172a' },
                                ]}
                              >
                                {latestWq.ph}
                              </Text>
                              <Text style={styles.paramUnit}>độ pH</Text>
                            </View>

                            {/* Temp */}
                            <View style={styles.paramBox}>
                              <Text style={styles.paramLabel}>Nhiệt độ</Text>
                              <Text style={styles.paramValue}>{latestWq.temperature}°C</Text>
                              <Text style={styles.paramUnit}>nước</Text>
                            </View>

                            {/* Salinity */}
                            <View style={styles.paramBox}>
                              <Text style={styles.paramLabel}>Độ mặn</Text>
                              <Text style={styles.paramValue}>{latestWq.salinity}</Text>
                              <Text style={styles.paramUnit}>‰</Text>
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.noWaterText}>Chưa có dữ liệu đo nước hôm nay</Text>
                        )}
                      </View>

                      {/* Feeding Progress Today */}
                      <View style={styles.feedingProgressBox}>
                        <View style={styles.feedingLeft}>
                          <ClipboardList size={13} color="#059669" />
                          <Text style={styles.feedingLabel}>Hôm nay:</Text>
                          <Text style={styles.feedingValue}>
                            {completedSessions > 0
                              ? `${completedSessions} cữ ăn (${totalFeedTodayKg} kg)`
                              : 'Chưa có cữ ăn'}
                          </Text>
                        </View>
                        {completedSessions > 0 && <CheckCircle2 size={14} color="#059669" />}
                      </View>

                      {/* Shrimp Health Observation */}
                      {latestHealth && (
                        <View style={styles.healthRow}>
                          <HeartPulse size={12} color="#f43f5e" />
                          <Text style={styles.healthText}>
                            Sức khỏe:{' '}
                            <Text style={styles.healthBold}>
                              {latestHealth.healthStatus === 'NORMAL'
                                ? 'Tôm bơi khỏe'
                                : latestHealth.healthStatus}
                            </Text>
                          </Text>
                        </View>
                      )}

                      {/* Incidents Warning */}
                      {pondIncidents.length > 0 && (
                        <View style={styles.incidentRow}>
                          <AlertTriangle size={12} color="#dc2626" />
                          <Text style={styles.incidentText} numberOfLines={1}>
                            {pondIncidents[0].title}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.idlePondBody}>
                      <Waves size={24} color="#cbd5e1" />
                      <Text style={styles.idlePondTitle}>Ao hiện đang trống</Text>
                      <Text style={styles.idlePondDesc}>
                        Sẵn sàng để chuẩn bị nước và thả giống vụ mới
                      </Text>
                    </View>
                  )}

                  {/* Pond Card Action Buttons */}
                  <View style={styles.pondCardFooter}>
                    {!isIdle ? (
                      <View style={styles.activeActionsRow}>
                        <TouchableOpacity
                          style={styles.cardFeedingButton}
                          onPress={() => navigation.navigate('Ao/Vụ')}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.cardFeedingButtonText}>Chi tiết ao</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cardSquareButton}
                          onPress={() =>
                            navigation.navigate('Môi trường', { screen: 'RecordWaterQuality' })
                          }
                          activeOpacity={0.8}
                        >
                          <Droplets size={16} color="#0284c7" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.cardSquareButton, { backgroundColor: '#fef2f2' }]}
                          onPress={() =>
                            navigation.navigate('Sự cố', { screen: 'IncidentCreate' })
                          }
                          activeOpacity={0.8}
                        >
                          <AlertTriangle size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.idlePondButton}
                        onPress={() => navigation.navigate('Ao/Vụ')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.idlePondButtonText}>Xem thông tin ao →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
  },

  /* ── 1. Header Card ── */
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refreshButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#f0fdfa',
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  greetingSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },
  farmChipsContainer: {
    marginTop: 12,
  },
  farmChipsContent: {
    gap: 8,
  },
  farmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  farmChipActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  farmChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  farmChipTextActive: {
    color: '#ffffff',
  },

  /* ── 2. Urgent Banner ── */
  urgentBanner: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  urgentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  urgentIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgentTextContainer: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  urgentDesc: {
    fontSize: 12,
    color: '#fee2e2',
    marginTop: 2,
    lineHeight: 16,
  },
  urgentActionButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  urgentActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b91c1c',
  },

  /* ── 3. 4 Macro KPI Cards ── */
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  kpiMainValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  kpiSubValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  kpiHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d9488',
    marginTop: 3,
  },

  /* ── 4. Quick Actions ── */
  quickActionsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionButton: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickActionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionTextBox: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  quickActionDesc: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },

  /* ── 5. Ponds Section ── */
  pondsSection: {
    gap: 12,
  },
  pondsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pondsHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pondsSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  viewAllPondsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0d9488',
  },
  emptyPondsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyPondsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  emptyPondsDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  pondCardList: {
    gap: 12,
  },
  pondCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  pondCardNormal: {
    borderColor: '#ccfbf1',
  },
  pondCardWarning: {
    borderColor: '#fde68a',
  },
  pondCardDanger: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffdfd',
  },
  pondCardIdle: {
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  pondTopBar: {
    height: 4,
    width: '100%',
  },
  pondCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pondInfoLeft: {
    flex: 1,
  },
  pondNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  pondNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  pondAreaText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  pondCropSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  pondStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statusBadgeWarning: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  statusBadgeDanger: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  statusBadgeIdle: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  pondStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  pondCardBody: {
    paddingHorizontal: 14,
    gap: 8,
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  docText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  stockingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  waterQualityStrip: {
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    gap: 6,
  },
  waterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  waterHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0e7490',
  },
  waterTimeAgo: {
    fontSize: 10,
    color: '#64748b',
  },
  waterParamsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paramBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paramLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  paramValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  paramUnit: {
    fontSize: 8,
    color: '#94a3b8',
  },
  noWaterText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  feedingProgressBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  feedingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  feedingLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  feedingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 2,
  },
  healthText: {
    fontSize: 11,
    color: '#64748b',
  },
  healthBold: {
    fontWeight: '800',
    color: '#334155',
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  incidentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b91c1c',
    flex: 1,
  },
  idlePondBody: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  idlePondTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  idlePondDesc: {
    fontSize: 11,
    color: '#94a3b8',
  },
  pondCardFooter: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 4,
  },
  activeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardFeedingButton: {
    flex: 1,
    backgroundColor: '#0d9488',
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  cardFeedingButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  cardSquareButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  idlePondButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  idlePondButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
});
