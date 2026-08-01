import React, { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AlertTriangle } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { incidentService, type Incident, type IncidentStatus } from '../../services/incidentService';

const labels: Record<IncidentStatus, string> = { OPEN: 'Chờ xử lý', TREATING: 'Đang điều trị', RESOLVED: 'Đã xử lý' };
const colors: Record<IncidentStatus, string> = { OPEN: '#d97706', TREATING: '#4f46e5', RESOLVED: '#059669' };

export default function IncidentListScreen({ navigation }: { navigation: any }) {
  const { userToken, userRole } = useContext(AuthContext);
  const [items, setItems] = useState<Incident[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userToken) return;
    setLoading(true);
    setError('');
    try {
      setItems((await incidentService.getAll(userToken, status || undefined, userRole === 'TECHNICIAN')).content);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải sự cố');
    } finally {
      setLoading(false);
    }
  }, [status, userRole, userToken]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      {userRole !== 'ADMIN' ? (
        <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('IncidentCreate')}>
          <Text style={styles.createButtonText}>＋ Báo cáo sự cố mới</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.filters}>
        {[['', 'Tất cả'], ['OPEN', 'Chờ xử lý'], ['TREATING', 'Điều trị'], ['RESOLVED', 'Đã xử lý']].map(([value, label]) => (
          <TouchableOpacity key={value} onPress={() => setStatus(value)} style={[styles.filter, status === value && styles.filterActive]}>
            <Text style={[styles.filterText, status === value && styles.filterTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && items.length === 0 ? <ActivityIndicator style={styles.loader} color="#4f46e5" /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={items.length ? styles.list : styles.empty}
          ListEmptyComponent={<Text style={styles.emptyText}>Không có sự cố được phân công.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('IncidentDetail', { incidentId: item.id })}>
              <View style={styles.cardHeader}><AlertTriangle color={colors[item.status]} size={22} /><Text style={[styles.badge, { color: colors[item.status] }]}>{labels[item.status]}</Text></View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
              <Text style={styles.meta}>{item.crop.pond.farm.name} · {item.crop.pond.name}</Text>
              <Text style={styles.meta}>Phụ trách: {item.assignedTo?.fullName || 'Chưa phân công'} · {item._count?.updates ?? 0} cập nhật</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  createButton: { margin: 12, marginBottom: 0, padding: 13, borderRadius: 14, backgroundColor: '#4f46e5', alignItems: 'center' },
  createButtonText: { color: '#fff', fontWeight: '800' },
  filters: { flexDirection: 'row', gap: 6, padding: 12, backgroundColor: '#fff' },
  filter: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  filterActive: { backgroundColor: '#4f46e5' },
  filterText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  filterTextActive: { color: '#fff' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: 12, fontWeight: '800' },
  title: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#1e293b' },
  description: { marginTop: 5, color: '#64748b', lineHeight: 19 },
  meta: { marginTop: 8, fontSize: 12, color: '#64748b' },
  loader: { marginTop: 80 },
  error: { margin: 12, padding: 12, borderRadius: 12, backgroundColor: '#fef2f2', color: '#b91c1c' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#94a3b8' },
});
