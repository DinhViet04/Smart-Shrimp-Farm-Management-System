import React, { useCallback, useContext, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  Plus,
  MapPin,
  Clock,
  User,
  Building2,
  Wrench,
  ChevronRight,
  RotateCcw,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { incidentService, type Incident } from '../../services/incidentService';
import {
  FARM_INCIDENT_CATEGORIES,
  FARM_INCIDENT_SEVERITIES,
  parseIncidentMetadata,
  isFarmInfrastructureIncident,
  formatDate,
} from '../../constants/farmIncidentConstants';
import HeaderLogo from '../../components/HeaderLogo';
import NotificationButton from '../../components/NotificationButton';

type MainStatusTab = 'all' | 'open' | 'treating' | 'resolved';

export default function IncidentListScreen({ navigation }: { navigation: any }) {
  const { userRole, userId } = useContext(AuthContext);

  const isManager = userRole === 'FARM_MANAGER' || userRole === 'ADMIN';
  const isTechnician = userRole === 'TECHNICIAN';
  const isFarmer = userRole === 'FARMER';

  // Raw incidents from backend
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Main filters
  const [statusTab, setStatusTab] = useState<MainStatusTab>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Sub-View for Tech or Farmer: 'assigned_to_me' vs 'all_reports'
  const [staffViewMode, setStaffViewMode] = useState<'assigned_to_me' | 'all_reports'>(
    isTechnician ? 'assigned_to_me' : 'all_reports'
  );

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await incidentService.getAll({
        size: '150',
      });
      const list = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.content)
        ? (res as any).content
        : [];
      setItems(list);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách sự cố:', err);
      setError(err?.message || 'Không thể tải danh sách sự cố. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadIncidents();
    }, [loadIncidents])
  );

  // 1. STRICT WHITELIST FILTER: Only objective farm infrastructure incidents
  const farmOnlyIncidents = useMemo(() => {
    return items.filter((i) => isFarmInfrastructureIncident(i.title, i.description));
  }, [items]);

  // 2. ROLE SCOPING
  const roleScopedIncidents = useMemo(() => {
    // MANAGER: Sees ALL farm incidents across all ponds & facilities
    if (isManager) {
      return farmOnlyIncidents;
    }

    // TECHNICIAN: Can view assigned tasks or all reports
    if (isTechnician) {
      if (staffViewMode === 'assigned_to_me') {
        return farmOnlyIncidents.filter(
          (i) => i.assignedToId === userId || i.assignedTo?.id === userId
        );
      }
      return farmOnlyIncidents;
    }

    // FARMER: Sees reported by self OR assigned to self
    if (isFarmer) {
      if (staffViewMode === 'assigned_to_me') {
        return farmOnlyIncidents.filter(
          (i) => i.assignedToId === userId || i.assignedTo?.id === userId
        );
      }
      return farmOnlyIncidents.filter(
        (i) =>
          i.reporter?.id === userId ||
          (i as any).reporterId === userId ||
          i.assignedToId === userId ||
          i.assignedTo?.id === userId
      );
    }

    return farmOnlyIncidents;
  }, [farmOnlyIncidents, isManager, isTechnician, isFarmer, staffViewMode, userId]);

  // 3. Status Grouping
  const openIncidents = useMemo(() => {
    return roleScopedIncidents.filter((i) => i.status === 'OPEN' && !i.assignedToId);
  }, [roleScopedIncidents]);

  const treatingIncidents = useMemo(() => {
    return roleScopedIncidents.filter(
      (i) => i.status === 'TREATING' || (i.status === 'OPEN' && Boolean(i.assignedToId))
    );
  }, [roleScopedIncidents]);

  const resolvedIncidents = useMemo(() => {
    return roleScopedIncidents.filter((i) => i.status === 'RESOLVED');
  }, [roleScopedIncidents]);

  // 4. Tab selection
  const currentTabIncidents = useMemo(() => {
    if (statusTab === 'open') return openIncidents;
    if (statusTab === 'treating') return treatingIncidents;
    if (statusTab === 'resolved') return resolvedIncidents;
    return roleScopedIncidents;
  }, [statusTab, openIncidents, treatingIncidents, resolvedIncidents, roleScopedIncidents]);

  // 5. Category & Search filtering
  const filteredIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return currentTabIncidents.filter((item) => {
      const { category, location, cleanTitle, cleanDescription } = parseIncidentMetadata(
        item.title,
        item.description
      );

      // Category filter
      if (selectedCategory && !category.toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }

      // Search query
      if (q) {
        const pondName = item.crop?.pond?.name?.toLowerCase() || '';
        const farmName = item.crop?.pond?.farm?.name?.toLowerCase() || '';
        const matchTitle = cleanTitle.toLowerCase().includes(q);
        const matchDesc = cleanDescription.toLowerCase().includes(q);
        const matchLoc = location.toLowerCase().includes(q);
        const matchPond = pondName.includes(q);
        const matchFarm = farmName.includes(q);
        if (!matchTitle && !matchDesc && !matchLoc && !matchPond && !matchFarm) {
          return false;
        }
      }

      return true;
    });
  }, [currentTabIncidents, selectedCategory, search]);

  const counts = {
    all: roleScopedIncidents.length,
    open: openIncidents.length,
    treating: treatingIncidents.length,
    resolved: resolvedIncidents.length,
  };

  const renderCategoryBadge = (categoryStr: string) => {
    const matched = FARM_INCIDENT_CATEGORIES.find((c) =>
      categoryStr.toLowerCase().includes(c.id.toLowerCase())
    );
    const bg = matched ? matched.badgeBg : '#f1f5f9';
    const text = matched ? matched.badgeText : '#475569';
    const label = matched ? `${matched.icon} ${matched.label}` : categoryStr || 'Khác';

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  };

  const renderSeverityBadge = (severityStr: string) => {
    const matched = FARM_INCIDENT_SEVERITIES.find(
      (s) => s.id.toLowerCase() === (severityStr || '').toLowerCase()
    );
    const bg = matched ? matched.badgeBg : '#f1f5f9';
    const text = matched ? matched.badgeText : '#475569';
    const label = matched ? matched.label : severityStr || 'Trung bình';

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Incident }) => {
    const { category, severity, location, cleanTitle, cleanDescription } = parseIncidentMetadata(
      item.title,
      item.description
    );

    const isAssigned = Boolean(item.assignedToId || item.assignedTo);
    const isResolved = item.status === 'RESOLVED';
    const pondName = item.crop?.pond?.name;
    const displayLoc = location || (pondName ? `Ao nuôi ${pondName}` : 'Toàn trang trại');
    const assignedRole = (item.assignedTo as any)?.role || '';
    const roleBadge = assignedRole === 'TECHNICIAN' ? 'Kỹ thuật' : assignedRole === 'FARMER' ? 'Công nhân' : '';

    return (
      <TouchableOpacity
        style={[styles.card, isResolved && styles.cardResolved]}
        onPress={() => navigation.navigate('IncidentDetail', { incidentId: item.id })}
        activeOpacity={0.7}
      >
        {/* Top: Category & Severity Badges */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardBadges}>
            {renderCategoryBadge(category)}
            {renderSeverityBadge(severity)}
          </View>

          {/* Status Indicator */}
          {isResolved ? (
            <View style={[styles.statusPill, { backgroundColor: '#ecfdf5' }]}>
              <CheckCircle2 size={12} color="#059669" />
              <Text style={[styles.statusPillText, { color: '#059669' }]}>Đã giải quyết</Text>
            </View>
          ) : isAssigned ? (
            <View style={[styles.statusPill, { backgroundColor: '#eff6ff' }]}>
              <Wrench size={12} color="#2563eb" />
              <Text style={[styles.statusPillText, { color: '#2563eb' }]}>Đang xử lý</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, { backgroundColor: '#fffbeb' }]}>
              <AlertTriangle size={12} color="#d97706" />
              <Text style={[styles.statusPillText, { color: '#d97706' }]}>
                {isManager ? 'Chờ phân công' : 'Chờ tiếp nhận'}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.cardTitle} numberOfLines={2}>
          {cleanTitle}
        </Text>

        {/* Description snippet */}
        {cleanDescription ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {cleanDescription}
          </Text>
        ) : null}

        {/* Location & Time info */}
        <View style={styles.cardMetaRow}>
          <View style={styles.metaItem}>
            <MapPin size={13} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {displayLoc}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={13} color="#94a3b8" />
            <Text style={styles.metaTextTime}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        {/* Footer: Assignment / Reporter info */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {isAssigned ? (
              <View style={styles.assignedTag}>
                <User size={12} color="#4f46e5" />
                <Text style={styles.assignedTagText}>
                  Phụ trách: {item.assignedTo?.fullName || 'Đã phân công'}
                  {roleBadge ? ` (${roleBadge})` : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.unassignedTag}>
                <Text style={styles.unassignedTagText}>
                  {isManager ? '⚡ Nhấn để phân công nhiệm vụ' : 'Chưa phân công người phụ trách'}
                </Text>
              </View>
            )}
          </View>
          <ChevronRight size={16} color="#94a3b8" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <HeaderLogo size={32} showText={true} textColor="#dc2626" />
        <Text style={styles.topHeaderTitle}>
          {isManager ? 'Quản lý sự cố trang trại' : 'Sự cố cơ sở hạ tầng'}
        </Text>
        <NotificationButton color="#dc2626" size={22} />
      </View>

      <View style={styles.container}>
        {/* Search Bar (Manager only views; Farmer and Technician can report) */}
        <View style={styles.actionRow}>
          <View style={[styles.searchBox, isManager && { flex: 1 }]}>
            <Search size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo sự cố, thiết bị, vị trí..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* "+ Báo sự cố" Button: ONLY for Farmer and Technician */}
          {!isManager && (
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => navigation.navigate('IncidentCreate')}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.reportBtnText}>Báo sự cố</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Staff Sub-View Toggle (For Technician or Farmer) */}
        {(isTechnician || isFarmer) && (
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                staffViewMode === 'assigned_to_me' && styles.toggleBtnActive,
              ]}
              onPress={() => setStaffViewMode('assigned_to_me')}
              activeOpacity={0.8}
            >
              <User
                size={14}
                color={staffViewMode === 'assigned_to_me' ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.toggleBtnText,
                  staffViewMode === 'assigned_to_me' && styles.toggleBtnTextActive,
                ]}
              >
                Giao cho tôi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                staffViewMode === 'all_reports' && styles.toggleBtnActive,
              ]}
              onPress={() => setStaffViewMode('all_reports')}
              activeOpacity={0.8}
            >
              <Building2
                size={14}
                color={staffViewMode === 'all_reports' ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.toggleBtnText,
                  staffViewMode === 'all_reports' && styles.toggleBtnTextActive,
                ]}
              >
                {isFarmer ? 'Sự cố tôi gửi' : 'Tất cả sự cố'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Status Tabs */}
        <View style={styles.statusTabs}>
          {[
            ['all', `Tất cả (${counts.all})`],
            ['open', `Chờ (${counts.open})`],
            ['treating', `Đang xử lý (${counts.treating})`],
            ['resolved', `Đã xử lý (${counts.resolved})`],
          ].map(([val, label]) => {
            const isActive = statusTab === val;
            return (
              <TouchableOpacity
                key={val}
                onPress={() => setStatusTab(val as MainStatusTab)}
                style={[styles.statusTab, isActive && styles.statusTabActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.statusTabText, isActive && styles.statusTabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category Horizontal Pills */}
        <View style={styles.categoryScrollContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPills}>
            <TouchableOpacity
              style={[styles.catPill, !selectedCategory && styles.catPillActive]}
              onPress={() => setSelectedCategory('')}
            >
              <Text style={[styles.catPillText, !selectedCategory && styles.catPillTextActive]}>
                Tất cả loại
              </Text>
            </TouchableOpacity>
            {FARM_INCIDENT_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, isActive && styles.catPillActive]}
                  onPress={() => setSelectedCategory(isActive ? '' : cat.id)}
                >
                  <Text style={[styles.catPillText, isActive && styles.catPillTextActive]}>
                    {cat.icon} {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Error notice */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Incident List */}
        {loading && items.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#dc2626" />
            <Text style={styles.loadingText}>Đang tải danh sách sự cố cơ sở hạ tầng...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredIncidents}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadIncidents} colors={['#dc2626']} />
            }
            contentContainerStyle={
              filteredIncidents.length ? styles.listContent : styles.emptyContent
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <CheckCircle2 size={44} color="#10b981" />
                <Text style={styles.emptyTitle}>
                  {isFarmer && staffViewMode === 'assigned_to_me'
                    ? 'Bạn chưa có nhiệm vụ nào được giao'
                    : isTechnician && staffViewMode === 'assigned_to_me'
                    ? 'Hiện bạn chưa có sự cố nào được phân công'
                    : 'Không có sự cố nào trong danh mục này'}
                </Text>
                <Text style={styles.emptyDesc}>
                  Hệ thống thiết bị và cơ sở hạ tầng trang trại đang vận hành ổn định.
                </Text>
                {(search || selectedCategory) && (
                  <TouchableOpacity
                    style={styles.resetFilterBtn}
                    onPress={() => {
                      setSearch('');
                      setSelectedCategory('');
                    }}
                  >
                    <RotateCcw size={14} color="#dc2626" />
                    <Text style={styles.resetFilterText}>Xóa bộ lọc tìm kiếm</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#fee2e2',
  },
  topHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    backgroundColor: '#ffffff',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 6,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#4f46e5',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  statusTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 6,
  },
  statusTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusTabActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  statusTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  statusTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  categoryScrollContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  categoryPills: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catPillActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  catPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 30,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },

  /* Card */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  cardResolved: {
    backgroundColor: '#fafafa',
    borderColor: '#e2e8f0',
    opacity: 0.85,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  metaTextTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerLeft: {
    flex: 1,
  },
  assignedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4f46e5',
  },
  unassignedTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unassignedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
  },
});
