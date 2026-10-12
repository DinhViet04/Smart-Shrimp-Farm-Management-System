import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
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

export default function EnvironmentScreen({ navigation }: any) {
  const { userToken } = useAuth();

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate latest record per pond
  const latestByPond = useMemo(() => {
    const map = new Map<string, WaterQualityHistoryRecord>();
    historyRecords.forEach((record) => {
      if (!map.has(record.pondName)) {
        map.set(record.pondName, record);
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
      {/* ── 1. Hero Card ───────────────────────────────────────────────── */}
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

      {/* ── 2. Primary Action Buttons ──────────────────────────────────── */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.primaryActionCard}
          onPress={() => navigation.navigate('RecordWaterQuality')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBox, { backgroundColor: '#e0f2fe' }]}>
            <PlusCircle size={22} color="#0284c7" />
          </View>
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>Ghi nhận thông số mới</Text>
            <Text style={styles.actionDesc}>
              Nhập pH, DO, Nhiệt độ, Độ mặn, Độ kiềm, NH3, H2S
            </Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryActionCard}
          onPress={() => navigation.navigate('RecordHistory')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBox, { backgroundColor: '#f0fdf4' }]}>
            <History size={22} color="#16a34a" />
          </View>
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>Lịch sử đo lường</Text>
            <Text style={styles.actionDesc}>
              Xem bảng dữ liệu, lọc theo ao và mốc thời gian
            </Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* ── 3. Latest Pond Water Strip Cards ───────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TÌNH TRẠNG NƯỚC CÁC AO GẦN NHẤT</Text>

        {isLoading && !isRefreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={styles.loadingText}>Đang nạp dữ liệu môi trường...</Text>
          </View>
        ) : historyRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Droplets size={32} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Chưa có thông số đo lường nào</Text>
            <Text style={styles.emptyDesc}>
              Nhấn "+ Ghi nhận thông số mới" ở trên để bắt đầu theo dõi
            </Text>
          </View>
        ) : (
          <View style={styles.pondStripList}>
            {Array.from(latestByPond.entries()).map(([pondName, record]) => {
              const isDanger = record.overallStatus === 'Danger';
              const isWarning = record.overallStatus === 'Warning';

              return (
                <View
                  key={record.id || pondName}
                  style={[
                    styles.pondStripCard,
                    isDanger
                      ? styles.stripCardDanger
                      : isWarning
                      ? styles.stripCardWarning
                      : styles.stripCardOptimal,
                  ]}
                >
                  <View style={styles.stripHeader}>
                    <View style={styles.stripHeaderLeft}>
                      <Text style={styles.stripPondName}>{pondName}</Text>
                      <Text style={styles.stripTime}>
                        {record.recordTime
                          ? new Date(record.recordTime).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) +
                            ' - ' +
                            new Date(record.recordTime).toLocaleDateString('vi-VN')
                          : ''}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isDanger
                          ? styles.badgeDanger
                          : isWarning
                          ? styles.badgeWarning
                          : styles.badgeOptimal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isDanger
                            ? { color: '#dc2626' }
                            : isWarning
                            ? { color: '#b45309' }
                            : { color: '#16a34a' },
                        ]}
                      >
                        {isDanger ? 'Nguy hiểm' : isWarning ? 'Cảnh báo' : 'Tối ưu'}
                      </Text>
                    </View>
                  </View>

                  {/* Param grid */}
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

      {/* ── 4. 5T Emergency Water Treatment Guide (Collapsible) ────────── */}
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
              <Text style={styles.guideItemTitle}>🚨 Oxy hòa tan (DO) &lt; 4.0 mg/L:</Text>
              <Text style={styles.guideItemText}>
                • Bật 100% dàn quạt nước và sục khí đáy ngay lập tức.{'\n'}
                • Tạt Oxy viên khẩn cấp (1 - 2 kg/1.000m³), giảm 50% lượng thức ăn cữ kế tiếp.
              </Text>
            </View>

            <View style={styles.guideItem}>
              <Text style={styles.guideItemTitle}>⚠️ pH cao (&gt; 8.5) vào buổi chiều:</Text>
              <Text style={styles.guideItemText}>
                • Cắt giảm thức ăn, đánh mật rỉ đường 2 - 3 kg/1.000m³ vào buổi sáng.{'\n'}
                • Cấp thêm nước sạch hoặc bổ sung vi sinh khống chế tảo.
              </Text>
            </View>

            <View style={styles.guideItem}>
              <Text style={styles.guideItemTitle}>⚠️ Độ kiềm thấp (&lt; 100 mg/L):</Text>
              <Text style={styles.guideItemText}>
                • Tạt vôi nông nghiệp CaCO3 kết hợp Dolomite (10 - 15 kg/1.000m³) vào ban đêm (21:00 - 23:00) để tôm cứng vỏ.
              </Text>
            </View>

            <View style={styles.guideItem}>
              <Text style={styles.guideItemTitle}>⚠️ Khí độc NH3 / H2S tăng cao:</Text>
              <Text style={styles.guideItemText}>
                • Chạy quạt hết công suất, đánh chế phẩm men vi sinh xử lý đáy liều gấp đôi và giảm 30 - 50% thức ăn.
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 10,
    fontWeight: '700',
    color: '#e0f2fe',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  /* 2. Actions */
  actionsContainer: {
    gap: 10,
  },
  primaryActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11,
    color: '#64748b',
  },

  /* 3. Section */
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  pondStripList: {
    gap: 10,
  },
  pondStripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  stripCardOptimal: {
    borderColor: '#bbf7d0',
  },
  stripCardWarning: {
    borderColor: '#fde68a',
    backgroundColor: '#fffdfa',
  },
  stripCardDanger: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafa',
  },
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stripHeaderLeft: {
    flex: 1,
  },
  stripPondName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  stripTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeOptimal: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  badgeDanger: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paramItem: {
    width: '31.5%',
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 8,
  },
  paramLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  paramVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },

  /* 4. Guide Card */
  guideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
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
    fontWeight: '800',
    color: '#0f172a',
  },
  guideBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  guideItem: {
    gap: 2,
  },
  guideItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  guideItemText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
});
