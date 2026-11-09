import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  SafeAreaView,
} from 'react-native';
import {
  Users,
  Search,
  UserCheck,
  Wrench,
  Sprout,
  Shield,
  RefreshCw,
  AlertCircle,
} from 'lucide-react-native';
import { apiClient } from '../../services/apiClient';
import { UserProfile } from '../../services/userService';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  FARM_MANAGER: { label: 'Quản lý trang trại', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', Icon: UserCheck },
  TECHNICIAN: { label: 'Kỹ thuật viên', color: '#4f46e5', bg: '#e0e7ff', border: '#c7d2fe', Icon: Wrench },
  FARMER: { label: 'Nông dân thực địa', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', Icon: Sprout },
  ADMIN: { label: 'Quản trị viên', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', Icon: Shield },
};

const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

interface WorkspaceSummary {
  id: string;
  name: string;
}

interface WorkspaceMemberResponse {
  id: string;
  isActive: boolean;
  joinedAt: string;
  user: UserProfile & { isActive?: boolean };
}

export default function WorkspaceScreen() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [filtered, setFiltered] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      setLoadError(null);
      const workspaces = await apiClient.get<WorkspaceSummary[]>('/workspaces');
      const memberGroups = await Promise.all(
        workspaces.map(async (workspace) => {
          const workspaceMembers = await apiClient.get<WorkspaceMemberResponse[]>(
            `/workspaces/${workspace.id}/members`,
          );
          return workspaceMembers.map((member) => ({
            ...member.user,
            status: member.isActive && member.user.isActive !== false ? 'ACTIVE' : 'INACTIVE',
            createdAt: member.joinedAt,
          }));
        }),
      );
      const uniqueMembers = Array.from(
        new Map(memberGroups.flat().map((member) => [member.id, member])).values(),
      );
      setMembers(uniqueMembers);
    } catch (err: any) {
      setLoadError(err?.message || 'Không thể tải danh sách nhân sự.');
      setMembers([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  useEffect(() => {
    let list = members;
    if (selectedRole) list = list.filter(m => m.role === selectedRole);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [members, search, selectedRole]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadMembers();
  }, [loadMembers]);

  const roleCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    members.forEach(m => { counts[m.role] = (counts[m.role] || 0) + 1; });
    return counts;
  }, [members]);

  const counts = roleCounts();

  const renderMember = ({ item }: { item: UserProfile }) => {
    const cfg = ROLE_CONFIG[item.role] || ROLE_CONFIG.FARMER;
    const Icon = cfg.Icon;
    const initials = item.fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <View style={styles.memberCard}>
        <View style={[styles.avatar, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Text style={[styles.avatarText, { color: cfg.color }]}>{initials}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.fullName}</Text>
          <Text style={styles.memberEmail}>{item.email}</Text>
          {item.phone ? <Text style={styles.memberPhone}>📞 {item.phone}</Text> : null}
          <Text style={styles.memberJoined}>Tham gia: {fmtDate(item.createdAt)}</Text>
        </View>
        <View>
          <View style={[styles.roleBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Icon size={11} color={cfg.color} />
            <Text style={[styles.roleBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <View style={[
            styles.statusDot,
            { backgroundColor: item.status === 'ACTIVE' ? '#059669' : '#94a3b8' }
          ]}>
            <Text style={styles.statusText}>
              {item.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Đang tải nhân sự...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.loadingContainer}>
        <AlertCircle size={36} color="#dc2626" />
        <Text style={styles.errorTitle}>Không tải được danh sách nhân sự</Text>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadMembers}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Summary */}
      <View style={styles.summaryRow}>
        {Object.entries(ROLE_CONFIG)
          .filter(([role]) => role !== 'ADMIN')
          .map(([role, cfg]) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.summaryCard,
                selectedRole === role && { borderColor: cfg.color, backgroundColor: cfg.bg },
              ]}
              onPress={() => setSelectedRole(selectedRole === role ? '' : role)}
            >
              <cfg.Icon size={16} color={cfg.color} />
              <Text style={[styles.summaryCount, { color: cfg.color }]}>{counts[role] || 0}</Text>
              <Text style={styles.summaryLabel} numberOfLines={1}>
                {cfg.label.split(' ').pop()}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên hoặc email..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <RefreshCw size={14} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Total count */}
      <View style={styles.resultHeader}>
        <Users size={14} color="#64748b" />
        <Text style={styles.resultText}>
          {filtered.length} / {members.length} thành viên
          {selectedRole ? ` (${ROLE_CONFIG[selectedRole]?.label})` : ''}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Users size={44} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Không tìm thấy thành viên</Text>
            <Text style={styles.emptySub}>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: '#64748b', fontSize: 14 },
  errorTitle: { marginTop: 12, color: '#991b1b', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  errorText: { marginTop: 6, color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  retryButton: {
    marginTop: 14, minHeight: 44, paddingHorizontal: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb',
  },
  retryButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },

  summaryRow: {
    flexDirection: 'row', backgroundColor: '#ffffff',
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  summaryCard: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', gap: 2,
  },
  summaryCount: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 9, color: '#64748b', fontWeight: '600' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },

  resultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  resultText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 10, paddingTop: 4 },

  memberCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: { fontSize: 16, fontWeight: '900' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  memberEmail: { fontSize: 12, color: '#64748b', marginTop: 1 },
  memberPhone: { fontSize: 11, color: '#64748b', marginTop: 2 },
  memberJoined: { fontSize: 10, color: '#94a3b8', marginTop: 3 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1,
    marginBottom: 4, alignSelf: 'flex-end',
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  statusDot: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, alignSelf: 'flex-end',
  },
  statusText: { fontSize: 9, fontWeight: '700', color: '#ffffff' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 14 },
  emptySub: { fontSize: 12, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
});

