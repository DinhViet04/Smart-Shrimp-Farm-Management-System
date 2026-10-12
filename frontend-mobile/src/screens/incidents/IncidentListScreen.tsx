import React, { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  AlertTriangle,
  Stethoscope,
  CheckCircle2,
  Search,
  Plus,
  Waves,
  Building2,
  User,
  Clock,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { incidentService, type Incident, type IncidentStatus } from '../../services/incidentService';

const STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; color: string; bg: string; border: string; icon: any }
> = {
  OPEN: {
    label: 'Chờ xử lý',
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fde68a',
    icon: AlertTriangle,
  },
  TREATING: {
    label: 'Đang điều trị',
    color: '#4f46e5',
    bg: '#e0e7ff',
    border: '#c7d2fe',
    icon: Stethoscope,
  },
  RESOLVED: {
    label: 'Đã xử lý',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    icon: CheckCircle2,
  },
};

export default function IncidentListScreen({ navigation }: { navigation: any }) {
  const { userToken, userRole, userId } = useContext(AuthContext);
  const [items, setItems] = useState<Incident[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  // Default to assignedToMe if user is TECHNICIAN
  const [assignedToMe, setAssignedToMe] = useState<boolean>(userRole === 'TECHNICIAN');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch all items for the chosen assignment mode so counts are accurate across all status tabs
      const res = await incidentService.getAll(
        userToken || undefined,
        undefined,
        userRole === 'ADMIN' ? false : assignedToMe
      );
      setItems(res.content || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải sự cố');
    } finally {
      setLoading(false);
    }
  }, [assignedToMe, userRole, userToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Filter by status and search text
  const filteredItems = items.filter((item) => {
    if (selectedStatus && item.status !== selectedStatus) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = item.title?.toLowerCase() || '';
    const desc = item.description?.toLowerCase() || '';
    const pond = item.crop?.pond?.name?.toLowerCase() || '';
    const farm = item.crop?.pond?.farm?.name?.toLowerCase() || '';
    return title.includes(q) || desc.includes(q) || pond.includes(q) || farm.includes(q);
  });

  const counts = {
    all: items.length,
    open: items.filter((i) => i.status === 'OPEN').length,
    treating: items.filter((i) => i.status === 'TREATING').length,
    resolved: items.filter((i) => i.status === 'RESOLVED').length,
  };

  return (
    <View style={styles.container}>
      {/* ── Top Bar & Search ── */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên sự cố, ao, trại..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {userRole !== 'ADMIN' && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('IncidentCreate')}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.createBtnText}>Báo sự cố</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Assigned To Me Toggle (For Technicians) ── */}
      {userRole === 'TECHNICIAN' && (
        <View style={styles.toggleContainer}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, assignedToMe && styles.toggleBtnActive]}
              onPress={() => setAssignedToMe(true)}
              activeOpacity={0.8}
            >
              <User size={14} color={assignedToMe ? '#ffffff' : '#64748b'} />
              <Text style={[styles.toggleBtnText, assignedToMe && styles.toggleBtnTextActive]}>
                Phân công cho tôi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, !assignedToMe && styles.toggleBtnActive]}
              onPress={() => setAssignedToMe(false)}
              activeOpacity={0.8}
            >
              <Building2 size={14} color={!assignedToMe ? '#ffffff' : '#64748b'} />
              <Text style={[styles.toggleBtnText, !assignedToMe && styles.toggleBtnTextActive]}>
                Tất cả sự cố trang trại
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.toggleDesc}>
            {assignedToMe
              ? '🎯 Đang lọc các sự cố được giao trực tiếp cho bạn điều trị.'
              : '🌐 Đang xem toàn bộ sự cố trên các ao thuộc trang trại.'}
          </Text>
        </View>
      )}

      {/* ── Status Tabs ── */}
      <View style={styles.statusTabs}>
        {[
          ['', `Tất cả (${counts.all})`],
          ['OPEN', `Chờ (${counts.open})`],
          ['TREATING', `Điều trị (${counts.treating})`],
          ['RESOLVED', `Đã xử lý (${counts.resolved})`],
        ].map(([val, label]) => (
          <TouchableOpacity
            key={val}
            onPress={() => setSelectedStatus(val)}
            style={[styles.statusTab, selectedStatus === val && styles.statusTabActive]}
          >
            <Text
              style={[
                styles.statusTabText,
                selectedStatus === val && styles.statusTabTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* ── Incident List ── */}
      {loading && items.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Đang nạp danh sách sự cố & điều trị...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#4f46e5']} />}
          contentContainerStyle={filteredItems.length ? styles.listContent : styles.emptyContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <CheckCircle2 size={44} color="#10b981" />
              <Text style={styles.emptyTitle}>
                {assignedToMe
                  ? 'Bạn không có sự cố nào cần xử lý lúc này'
                  : 'Không có sự cố nào trong danh sách'}
              </Text>
              <Text style={styles.emptyDesc}>
                Các ao nuôi đang trong tầm kiểm soát an toàn.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.OPEN;
            const Icon = cfg.icon;
            const isAssignedToMe = item.assignedToId === userId;

            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  isAssignedToMe && item.status !== 'RESOLVED' && styles.cardAssignedToMe,
                ]}
                onPress={() => navigation.navigate('IncidentDetail', { incidentId: item.id })}
                activeOpacity={0.85}
              >
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardPondTag}>
                    <Waves size={13} color="#0284c7" />
                    <Text style={styles.cardPondName}>
                      {item.crop?.pond?.name || 'Ao nuôi'}
                    </Text>
                    {item.crop?.pond?.farm?.name && (
                      <Text style={styles.cardFarmName}>
                        • {item.crop.pond.farm.name}
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: cfg.bg, borderColor: cfg.border },
                    ]}
                  >
                    <Icon size={12} color={cfg.color} />
                    <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                </View>

                {/* Title & Description */}
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                {/* Footer Info */}
                <View style={styles.cardFooter}>
                  <View style={styles.footerLeft}>
                    {isAssignedToMe ? (
                      <View style={styles.myDutyBadge}>
                        <User size={11} color="#4f46e5" />
                        <Text style={styles.myDutyText}>Bạn phụ trách điều trị</Text>
                      </View>
                    ) : item.assignedTo?.fullName ? (
                      <View style={styles.assignedBadge}>
                        <User size={11} color="#475569" />
                        <Text style={styles.assignedText} numberOfLines={1}>
                          {item.assignedTo.fullName}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.unassignedBadge}>
                        <ShieldAlert size={11} color="#d97706" />
                        <Text style={styles.unassignedText}>Chưa phân công</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.footerRight}>
                    <Stethoscope size={12} color="#4f46e5" />
                    <Text style={styles.updatesCountText}>
                      {item._count?.updates ?? item.updates?.length ?? 0} lần điều trị
                    </Text>
                    <ChevronRight size={14} color="#94a3b8" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  toggleContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toggleBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  toggleBtnTextActive: {
    color: '#ffffff',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontStyle: 'italic',
  },
  statusTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  statusTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  statusTabActive: {
    backgroundColor: '#1e1b4b',
  },
  statusTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  statusTabTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 280,
  },
  errorText: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardAssignedToMe: {
    borderColor: '#c7d2fe',
    backgroundColor: '#fafbff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPondTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardPondName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
  },
  cardFarmName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  myDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  myDutyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338ca',
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  assignedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  unassignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unassignedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  updatesCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
});
