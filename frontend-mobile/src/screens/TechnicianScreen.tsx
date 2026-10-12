import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Wrench,
  Droplets,
  TrendingUp,
  AlertTriangle,
  Package,
  Settings,
  User,
  Activity,
  ArrowRight,
  ShieldCheck,
  Scale,
  RefreshCw,
  Building2,
} from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { growthService, TrajectoryPoint } from '../services/growthService';
import { pondService, OverviewFarm, OverviewPond } from '../services/pondService';
import { getWaterQualityHistory } from '../services/waterQualityService';

interface TechnicianScreenProps {
  navigation: any;
}

export default function TechnicianScreen({ navigation }: TechnicianScreenProps) {
  const { userToken, currentUser } = useContext(AuthContext);

  const [farms, setFarms] = useState<OverviewFarm[]>([]);
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('ALL');

  const [trajectoryData, setTrajectoryData] = useState<TrajectoryPoint[]>([]);
  const [latestPoint, setLatestPoint] = useState<TrajectoryPoint | null>(null);
  const [waterAlertCount, setWaterAlertCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // 1. Load Ponds and Farms
      const overview = await pondService.getOverview().catch(() => ({ farms: [], ponds: [], crops: [] }));
      setFarms(overview.farms || []);
      setPonds(overview.ponds || []);

      // 2. Load Standardized 90-Day Trajectory
      const growthResult = await growthService
        .getGrowthTrajectory({
          farmId: selectedFarmId !== 'ALL' ? selectedFarmId : undefined,
        })
        .catch(() => ({ trajectory: [] }));

      const traj = growthResult.trajectory || [];
      setTrajectoryData(traj);
      if (traj.length > 0) {
        setLatestPoint(traj[traj.length - 1]);
      } else {
        setLatestPoint(null);
      }

      // 3. Load Water Quality for alert check
      if (userToken) {
        const wqRes = await getWaterQualityHistory(userToken, {
          farmId: selectedFarmId !== 'ALL' ? selectedFarmId : undefined,
          size: 50,
        }).catch(() => ({ content: [] }));

        const alerts = (wqRes.content || []).filter(
          (r) => Number(r.dissolvedOxygen) < 4.0 || Number(r.ph) < 7.5 || Number(r.ph) > 8.5
        ).length;
        setWaterAlertCount(alerts);
      }
    } catch (err) {
      console.warn('Lỗi khi tải dữ liệu Technician Dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userToken, selectedFarmId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activePondCount = useMemo(() => {
    const list = selectedFarmId === 'ALL' ? ponds : ponds.filter((p) => p.farmId === selectedFarmId);
    return list.filter((p) => p.latestSizeSample != null).length || list.length;
  }, [ponds, selectedFarmId]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            colors={['#4f46e5']}
            tintColor="#4f46e5"
          />
        }
      >
        {/* ── Welcome Header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User color="#4f46e5" size={24} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Xin chào,</Text>
            <Text style={styles.userName}>
              {currentUser?.fullName || 'Kỹ thuật viên'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={() => loadData(true)}
            activeOpacity={0.7}
          >
            <RefreshCw size={16} color="#4f46e5" />
          </TouchableOpacity>
        </View>

        {/* ── Welcome Info Card ─────────────────────────────────────────── */}
        <View style={styles.welcomeCard}>
          <View style={styles.iconContainer}>
            <Wrench color="#ffffff" size={26} />
          </View>
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeTitle}>Cổng Kỹ Thuật Viên</Text>
            <Text style={styles.welcomeSubtitle}>
              Giám sát chất lượng nước, kích cỡ tăng trưởng tôm, xử lý sự cố & quản lý kho.
            </Text>
          </View>
        </View>

        {/* Farm Filter Chips */}
        {farms.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.farmChipsRow}
          >
            <TouchableOpacity
              style={[styles.farmChip, selectedFarmId === 'ALL' && styles.farmChipActive]}
              onPress={() => setSelectedFarmId('ALL')}
            >
              <Building2 size={12} color={selectedFarmId === 'ALL' ? '#ffffff' : '#64748b'} />
              <Text
                style={[
                  styles.farmChipText,
                  selectedFarmId === 'ALL' && styles.farmChipTextActive,
                ]}
              >
                Tất cả trại ({farms.length})
              </Text>
            </TouchableOpacity>

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
          </ScrollView>
        )}

        {/* ── Live KPI Metric Cards (Matching Web Technician Dashboard) ──── */}
        <View style={styles.kpiContainer}>
          <Text style={styles.sectionTitle}>CHỈ SỐ TĂNG TRƯỞNG & VẬN HÀNH CHUẨN HOÁ</Text>

          {isLoading && !isRefreshing ? (
            <View style={styles.kpiLoadingBox}>
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text style={styles.kpiLoadingText}>Đang nạp dữ liệu tăng trưởng...</Text>
            </View>
          ) : (
            <View style={styles.kpiGrid}>
              {/* Tỉ lệ sống SR */}
              <View style={[styles.kpiCard, { borderColor: '#bbf7d0' }]}>
                <View style={[styles.kpiIcon, { backgroundColor: '#f0fdf4' }]}>
                  <ShieldCheck size={18} color="#16a34a" />
                </View>
                <Text style={styles.kpiLabel}>TỈ LỆ SỐNG (SR)</Text>
                <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
                  {latestPoint && latestPoint.sr > 0 ? `${latestPoint.sr.toFixed(1)}%` : '--'}
                </Text>
                <Text style={styles.kpiSub}>
                  {latestPoint && latestPoint.sr >= 75 ? 'Đạt chuẩn (≥75%)' : 'Mục tiêu: ≥75%'}
                </Text>
              </View>

              {/* Trọng lượng ABW */}
              <View style={[styles.kpiCard, { borderColor: '#bfdbfe' }]}>
                <View style={[styles.kpiIcon, { backgroundColor: '#eff6ff' }]}>
                  <Scale size={18} color="#2563eb" />
                </View>
                <Text style={styles.kpiLabel}>TRỌNG LƯỢNG (ABW)</Text>
                <Text style={[styles.kpiValue, { color: '#2563eb' }]}>
                  {latestPoint && latestPoint.abw > 0 ? `${latestPoint.abw.toFixed(1)}g` : '--'}
                </Text>
                <Text style={styles.kpiSub}>
                  {latestPoint?.size ? `Size: ${latestPoint.size} c/kg` : 'Chưa có mẫu'}
                </Text>
              </View>

              {/* Hệ số FCR */}
              <View style={[styles.kpiCard, { borderColor: '#fecaca' }]}>
                <View style={[styles.kpiIcon, { backgroundColor: '#fef2f2' }]}>
                  <TrendingUp size={18} color="#dc2626" />
                </View>
                <Text style={styles.kpiLabel}>HỆ SỐ FCR</Text>
                <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
                  {latestPoint && latestPoint.fcr_raw ? Number(latestPoint.fcr_raw).toFixed(2) : '--'}
                </Text>
                <Text style={styles.kpiSub}>
                  {latestPoint?.fcr_raw ? 'FCR lũy kế' : 'DOC < 10 ngày'}
                </Text>
              </View>

              {/* Cảnh báo môi trường */}
              <View
                style={[
                  styles.kpiCard,
                  waterAlertCount > 0 ? { borderColor: '#fde68a', backgroundColor: '#fffbeb' } : { borderColor: '#e2e8f0' },
                ]}
              >
                <View
                  style={[
                    styles.kpiIcon,
                    waterAlertCount > 0 ? { backgroundColor: '#fef3c7' } : { backgroundColor: '#f1f5f9' },
                  ]}
                >
                  <Droplets size={18} color={waterAlertCount > 0 ? '#b45309' : '#0284c7'} />
                </View>
                <Text style={styles.kpiLabel}>CẢNH BÁO NƯỚC</Text>
                <Text
                  style={[
                    styles.kpiValue,
                    { color: waterAlertCount > 0 ? '#b45309' : '#0284c7' },
                  ]}
                >
                  {waterAlertCount > 0 ? `${waterAlertCount} cảnh báo` : 'Ổn định'}
                </Text>
                <Text style={styles.kpiSub}>
                  {waterAlertCount > 0 ? 'Cần kiểm tra Oxy/pH' : 'Thông số an toàn'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Core Technician Actions (Matching Bottom Tabs) ───────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NGHIỆP VỤ KỸ THUẬT CHUYÊN SÂU</Text>

          {/* 1. Môi trường nước */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Môi trường nước', { screen: 'RecordWaterQuality' })}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#e0f2fe' }]}>
              <Droplets color="#0284c7" size={20} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>1. Đo & ghi nhận chất lượng nước</Text>
              <Text style={styles.actionDesc}>pH, DO, Độ kiềm, NH3, NO2, H2S, Độ mặn</Text>
            </View>
            <ArrowRight size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* 2. Theo dõi tăng trưởng */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Theo dõi tăng trưởng')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#e0e7ff' }]}>
              <TrendingUp color="#4f46e5" size={20} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>2. Bắt mẫu 5 mẻ chài (Tăng trưởng)</Text>
              <Text style={styles.actionDesc}>Tính Size (con/kg), ABW, Sinh khối & FCR</Text>
            </View>
            <ArrowRight size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* 3. Sự cố & Điều trị */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Sự cố & Điều trị')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#fef2f2' }]}>
              <AlertTriangle color="#dc2626" size={20} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>3. Tiếp nhận & Xử lý sự cố</Text>
              <Text style={styles.actionDesc}>Cập nhật phác đồ điều trị ao tôm khẩn cấp</Text>
            </View>
            <ArrowRight size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* 4. Kho thức ăn */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Kho thức ăn')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#f0fdf4' }]}>
              <Package color="#16a34a" size={20} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>4. Kiểm tra tồn kho thức ăn & thuốc</Text>
              <Text style={styles.actionDesc}>Theo dõi tồn kho cám, men vi sinh, vôi, khoáng</Text>
            </View>
            <ArrowRight size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  avatarContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 12,
    color: '#64748b',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e1b4b',
  },
  refreshIconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#e0e7ff',
  },
  welcomeCard: {
    backgroundColor: '#4f46e5',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 3,
  },
  welcomeSubtitle: {
    fontSize: 11,
    color: '#e0e7ff',
    lineHeight: 16,
  },
  farmChipsRow: {
    gap: 8,
  },
  farmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  farmChipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  farmChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  farmChipTextActive: {
    color: '#ffffff',
  },

  /* KPI Section */
  kpiContainer: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  kpiLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiLoadingText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },

  /* Section */
  section: {
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11,
    color: '#64748b',
  },
  tipsBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 11,
    color: '#78350f',
    lineHeight: 17,
  },
});
