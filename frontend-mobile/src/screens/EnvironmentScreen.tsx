import React, { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import {
  Droplets,
  PlusCircle,
  History,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Waves,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { pondService, OverviewPond } from '../services/pondService';
import {
  getWaterQualityHistory,
  WaterQualityHistoryRecord,
} from '../services/waterQualityService';
import BusinessHeader from '../components/BusinessHeader';

export default function EnvironmentScreen({ navigation }: any) {
  const { userToken, userRole } = useAuth();

  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [historyRecords, setHistoryRecords] = useState<WaterQualityHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGuideExpanded, setIsGuideExpanded] = useState(false);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const overview = await pondService.getOverview().catch(() => ({ ponds: [], farms: [], crops: [] }));
      setPonds(overview.ponds || []);

      if (userToken) {
        const historyRes = await getWaterQualityHistory(userToken, { size: 50 }).catch(() => ({
          content: [],
        }));
        setHistoryRecords(historyRes.content || []);
      }
    } catch (err) {
      console.warn('Lỗi khi tải dữ liệu môi trường:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userToken]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Aggregate latest record per pond (keyed by farmName + pondName so same-named ponds across farms don't collide)
  const latestByPond = useMemo(() => {
    const map = new Map<string, WaterQualityHistoryRecord>();
    historyRecords.forEach((record) => {
      const key = `${record.farmName || ''}__${record.pondName}`;
      if (!map.has(key)) {
        map.set(key, record);
      }
    });
    return map;
  }, [historyRecords]);

  // Environmental summary counts
  const summary = useMemo(() => {
    const list = Array.from(latestByPond.values());
    const optimal = list.filter((r) => r.overallStatus === 'Optimal').length;
    const warning = list.filter((r) => r.overallStatus === 'Warning').length;
    const danger = list.filter((r) => r.overallStatus === 'Danger').length;
    return { total: list.length, optimal, warning, danger };
  }, [latestByPond]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BusinessHeader title="Môi trường nước" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            colors={['#0284c7']}
            tintColor="#0284c7"
          />
        }
      >
        {/* 1. Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconBox}>
              <Droplets size={26} color="#ffffff" />
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => loadData(true)}
              activeOpacity={0.7}
            >
              <RefreshCw size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>Môi trường nước ao nuôi</Text>
          <Text style={styles.heroSubtitle}>
            Theo dõi và kiểm soát chặt chẽ Oxy (DO), pH, Độ kiềm, Khí độc theo tiêu chuẩn kỹ thuật
          </Text>

          {/* Mini stats banner */}
          <View style={styles.miniStatsRow}>
            <View style={styles.miniStatItem}>
              <Text style={styles.miniStatVal}>{summary.optimal}</Text>
              <Text style={styles.miniStatLbl}>Ao tối ưu</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.miniStatItem}>
              <Text style={[styles.miniStatVal, { color: '#fef08a' }]}>{summary.warning}</Text>
              <Text style={styles.miniStatLbl}>Cảnh báo</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.miniStatItem}>
              <Text style={[styles.miniStatVal, { color: '#fca5a5' }]}>{summary.danger}</Text>
              <Text style={styles.miniStatLbl}>Nguy hiểm</Text>
            </View>
          </View>
        </View>

        {/* 2. Quick Action Buttons (Technician only for RecordWaterQuality) */}
        {userRole === 'TECHNICIAN' && (
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => navigation.navigate('RecordWaterQuality')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconPrimary}>
              <PlusCircle size={22} color="#0284c7" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitlePrimary}>Ghi nhận thông số mới</Text>
              <Text style={styles.actionDescPrimary}>
                Nhập pH, DO, Nhiệt độ, Độ mặn, Độ kiềm, NH3, H2S
              </Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionBtnSecondary}
          onPress={() => navigation.navigate('RecordHistory')}
          activeOpacity={0.8}
        >
          <View style={styles.actionIconSecondary}>
            <History size={22} color="#059669" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitleSecondary}>Lịch sử đo lường</Text>
            <Text style={styles.actionDescSecondary}>
              Xem bảng dữ liệu, lọc theo ao và mốc thời gian
            </Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* 3. Latest Readings Per Pond */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TÌNH TRẠNG NƯỚC CÁC AO GẦN NHẤT</Text>

          {isLoading && !isRefreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#0284c7" />
              <Text style={styles.loadingText}>Đang tải dữ liệu quan trắc...</Text>
            </View>
          ) : historyRecords.length === 0 ? (
            <View style={styles.emptyCard}>
              <Waves size={36} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Chưa có dữ liệu đo lường nào</Text>
              <Text style={styles.emptySubtitle}>
                {userRole === 'TECHNICIAN'
                  ? 'Bấm nút "Ghi nhận thông số mới" ở trên để lưu kết quả kiểm tra nước đầu tiên.'
                  : 'Kỹ thuật viên chưa ghi nhận kết quả đo nước nào.'}
              </Text>
            </View>
          ) : (
            <View style={styles.pondCardList}>
              {Array.from(latestByPond.values()).map((record) => {
                const isOptimal = record.overallStatus === 'Optimal';
                const isWarning = record.overallStatus === 'Warning';
                const isDanger = record.overallStatus === 'Danger';

                const badgeBg = isOptimal ? '#ecfdf5' : isWarning ? '#fffbeb' : '#fef2f2';
                const badgeText = isOptimal ? '#059669' : isWarning ? '#d97706' : '#dc2626';
                const badgeLabel = isOptimal ? 'TỐI ƯU' : isWarning ? 'CẢNH BÁO' : 'NGUY HIỂM';

                return (
                  <View
                    key={record.id}
                    style={[
                      styles.pondStatusCard,
                      isDanger && styles.pondStatusCardDanger,
                      isWarning && styles.pondStatusCardWarning,
                    ]}
                  >
                    {/* Header: Pond Name & Overall Status */}
                    <View style={styles.pondCardHeader}>
                      <View>
                        <Text style={styles.pondNameText}>
                          {record.pondName}
                          {record.farmName ? ` • ${record.farmName}` : ''}
                        </Text>
                        <Text style={styles.pondTimeText}>
                          {new Date(record.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          - {new Date(record.createdAt).toLocaleDateString('vi-VN')}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.statusBadgeText, { color: badgeText }]}>
                          {badgeLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Measured Values Grid */}
                    <View style={styles.paramGrid}>
                      <View style={styles.paramItem}>
                        <Text style={styles.paramLabel}>Oxy (DO)</Text>
                        <Text
                          style={[
                            styles.paramVal,
                            Number(record.dissolvedOxygen) < 4.0 && { color: '#dc2626' },
                          ]}
                        >
                          {record.dissolvedOxygen} mg/L
                        </Text>
                      </View>

                      <View style={styles.paramItem}>
                        <Text style={styles.paramLabel}>pH</Text>
                        <Text
                          style={[
                            styles.paramVal,
                            (Number(record.ph) < 7.5 || Number(record.ph) > 8.5) && {
                              color: '#d97706',
                            },
                          ]}
                        >
                          {record.ph}
                        </Text>
                      </View>

                      <View style={styles.paramItem}>
                        <Text style={styles.paramLabel}>Nhiệt độ</Text>
                        <Text style={styles.paramVal}>{record.temperature}°C</Text>
                      </View>

                      <View style={styles.paramItem}>
                        <Text style={styles.paramLabel}>Độ mặn</Text>
                        <Text style={styles.paramVal}>{record.salinity}‰</Text>
                      </View>

                      <View style={styles.paramItem}>
                        <Text style={styles.paramLabel}>Độ kiềm</Text>
                        <Text style={styles.paramVal}>{record.alkalinity} mg/L</Text>
                      </View>

                      <View style={styles.paramItem}>
                        <Text style={styles.paramLabel}>Khí độc NH3</Text>
                        <Text style={styles.paramVal}>{record.nh3} mg/L</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 4. Water Treatment Guide (Collapsible) */}
        <View style={styles.guideCard}>
          <TouchableOpacity
            style={styles.guideHeader}
            onPress={() => setIsGuideExpanded(!isGuideExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.guideHeaderLeft}>
              <BookOpen size={18} color="#0284c7" />
              <Text style={styles.guideTitle}>Phác đồ xử lý nước khẩn cấp</Text>
            </View>
            {isGuideExpanded ? (
              <ChevronUp size={18} color="#64748b" />
            ) : (
              <ChevronDown size={18} color="#64748b" />
            )}
          </TouchableOpacity>

          {isGuideExpanded && (
            <View style={styles.guideBody}>
              <View style={styles.guideItem}>
                <Text style={styles.guideItemTitle}>⚠️ Oxy hòa tan (DO) &lt; 4.0 mg/L:</Text>
                <Text style={styles.guideItemText}>
                  Bật 100% dàn quạt nước và sục khí đáy ngay lập tức.{'\n'}
                  Tạt Oxy viên khẩn cấp (1 - 2 kg/1.000m³), giảm 50% lượng thức ăn cữ kế tiếp.
                </Text>
              </View>

              <View style={styles.guideItem}>
                <Text style={styles.guideItemTitle}>⚠️ pH cao (&gt; 8.5) vào buổi chiều:</Text>
                <Text style={styles.guideItemText}>
                  Cắt giảm thức ăn, đánh mật rỉ đường 2 - 3 kg/1.000m³ vào buổi sáng.{'\n'}
                  Cấp thêm nước sạch hoặc bổ sung vi sinh khống chế tảo.
                </Text>
              </View>

              <View style={styles.guideItem}>
                <Text style={styles.guideItemTitle}>⚠️ Độ kiềm thấp (&lt; 100 mg/L):</Text>
                <Text style={styles.guideItemText}>
                  Tạt vôi nông nghiệp CaCO3 kết hợp Dolomite (10 - 15 kg/1.000m³) vào ban đêm (21:00 - 23:00) để tôm cứng vỏ.
                </Text>
              </View>

              <View style={styles.guideItem}>
                <Text style={styles.guideItemTitle}>⚠️ Khí độc NH3 / H2S tăng cao:</Text>
                <Text style={styles.guideItemText}>
                  Chạy quạt hết công suất, đánh chế phẩm men vi sinh xử lý đáy liều gấp đôi và giảm 30 - 50% thức ăn.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  /* 1. Hero Card */
  heroCard: {
    backgroundColor: '#0284c7',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#e0f2fe',
    lineHeight: 17,
    marginBottom: 14,
  },
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 14,
    paddingVertical: 10,
  },
  miniStatItem: {
    alignItems: 'center',
  },
  miniStatVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  miniStatLbl: {
    fontSize: 11,
    color: '#e0f2fe',
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  /* 2. Actions */
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  actionIconPrimary: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionInfo: {
    flex: 1,
  },
  actionTitlePrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  actionDescPrimary: {
    fontSize: 11,
    color: '#64748b',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  actionIconSecondary: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitleSecondary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  actionDescSecondary: {
    fontSize: 11,
    color: '#64748b',
  },

  /* 3. Latest Readings Per Pond */
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0f2fe',
    borderStyle: 'dashed',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  pondCardList: {
    gap: 12,
  },
  pondStatusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pondStatusCardDanger: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafb',
  },
  pondStatusCardWarning: {
    borderColor: '#fde68a',
    backgroundColor: '#fffdf5',
  },
  pondCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pondNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  pondTimeText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
  },
  paramItem: {
    width: '30%',
    flexGrow: 1,
  },
  paramLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  paramVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },

  /* 4. Guide */
  guideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  guideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
  },
  guideBody: {
    padding: 14,
    paddingTop: 0,
    gap: 12,
  },
  guideItem: {
    backgroundColor: '#f0f9ff',
    padding: 10,
    borderRadius: 10,
    gap: 4,
  },
  guideItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  guideItemText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
});
