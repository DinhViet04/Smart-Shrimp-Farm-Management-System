import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { incidentService, type Incident, type IncidentStatus } from '../../services/incidentService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const labels: Record<IncidentStatus, string> = { OPEN: 'Chờ xử lý', TREATING: 'Đang điều trị', RESOLVED: 'Đã xử lý' };

type IncidentStackParamList = {
  IncidentList: undefined;
  IncidentDetail: { incidentId: string };
};

export default function IncidentDetailScreen({ route }: NativeStackScreenProps<IncidentStackParamList, 'IncidentDetail'>) {
  const { userToken, userRole, userId } = useContext(AuthContext);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [treatment, setTreatment] = useState('');
  const [observation, setObservation] = useState('');
  const [result, setResult] = useState('');

  const load = useCallback(async () => {
    if (!userToken) return;
    setLoading(true);
    try {
      setIncident(await incidentService.getById(userToken, route.params.incidentId));
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể tải chi tiết sự cố');
    } finally {
      setLoading(false);
    }
  }, [route.params.incidentId, userToken]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    setSaving(true);
    try {
      await action();
      setTreatment(''); setObservation(''); setResult('');
      await load();
      Alert.alert('Thành công', message);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể xử lý yêu cầu');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !incident) return <ActivityIndicator style={styles.loader} color="#4f46e5" />;
  if (!incident || !userToken) return <View style={styles.loader}><Text>Không tìm thấy sự cố.</Text></View>;

  const requireTreatment = () => {
    if (!treatment.trim()) { Alert.alert('Thiếu thông tin', incident.status === 'RESOLVED' ? 'Vui lòng nhập lý do mở lại.' : 'Vui lòng nhập biện pháp điều trị.'); return false; }
    return true;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <View style={styles.row}><Text style={styles.title}>{incident.title}</Text><Text style={styles.status}>{labels[incident.status]}</Text></View>
        <Text style={styles.meta}>{incident.crop.pond.farm.name} · {incident.crop.pond.name}</Text>
        <Text style={styles.description}>{incident.description}</Text>
        <Text style={styles.meta}>Người báo cáo: {incident.reporter?.fullName || 'Dữ liệu cũ chưa ghi nhận'}</Text>
        <Text style={styles.meta}>Phụ trách: {incident.assignedTo?.fullName || 'Chưa phân công'}</Text>
      </View>

      <Text style={styles.sectionTitle}>Tiến trình điều trị</Text>
      {incident.updates?.length ? incident.updates.map((update) => (
        <View key={update.id} style={styles.updateCard}>
          <View style={styles.row}><Text style={styles.author}>{update.author.fullName}</Text><Text style={styles.time}>{new Date(update.createdAt).toLocaleString('vi-VN')}</Text></View>
          <Text style={styles.updateText}><Text style={styles.bold}>{update.eventType === 'TREATMENT' || update.eventType === 'RESOLVED' ? 'Điều trị: ' : 'Sự kiện: '}</Text>{update.treatment}</Text>
          {update.observation ? <Text style={styles.updateText}><Text style={styles.bold}>Quan sát: </Text>{update.observation}</Text> : null}
          {update.result ? <Text style={styles.updateText}><Text style={styles.bold}>Kết quả: </Text>{update.result}</Text> : null}
        </View>
      )) : <Text style={styles.empty}>Chưa có cập nhật điều trị.</Text>}

      {userRole === 'FARM_MANAGER' && incident.status === 'RESOLVED' ? (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Mở lại sự cố</Text>
          <TextInput multiline value={treatment} onChangeText={setTreatment} placeholder="Lý do mở lại..." style={styles.input} />
          <TouchableOpacity disabled={saving} style={[styles.primaryButton, styles.reopen]} onPress={() => requireTreatment() && runAction(() => incidentService.reopen(userToken, incident.id, treatment), 'Đã mở lại sự cố.')}><Text style={styles.buttonText}>Mở lại</Text></TouchableOpacity>
        </View>
      ) : userRole !== 'TECHNICIAN' ? (
        <View style={styles.readOnly}><Text style={styles.readOnlyText}>Bạn có thể theo dõi tiến trình; kỹ thuật viên được phân công sẽ thực hiện điều trị.</Text></View>
      ) : incident.assignedToId !== userId ? (
        <View style={styles.readOnly}><Text style={styles.readOnlyText}>Sự cố này chưa được giao cho bạn nên bạn không thể cập nhật điều trị.</Text></View>
      ) : incident.status === 'OPEN' ? (
        <TouchableOpacity disabled={saving} style={styles.primaryButton} onPress={() => runAction(() => incidentService.start(userToken, incident.id), 'Đã bắt đầu điều trị.') }><Text style={styles.buttonText}>Bắt đầu điều trị</Text></TouchableOpacity>
      ) : (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>{incident.status === 'RESOLVED' ? 'Mở lại sự cố' : 'Cập nhật điều trị'}</Text>
          <TextInput multiline value={treatment} onChangeText={setTreatment} placeholder={incident.status === 'RESOLVED' ? 'Lý do mở lại...' : 'Biện pháp điều trị...'} style={styles.input} />
          {incident.status === 'TREATING' ? <>
            <TextInput multiline value={observation} onChangeText={setObservation} placeholder="Quan sát sau điều trị..." style={styles.input} />
            <TextInput multiline value={result} onChangeText={setResult} placeholder="Kết quả..." style={styles.input} />
          </> : null}
          {incident.status === 'RESOLVED' ? (
            <TouchableOpacity disabled={saving} style={[styles.primaryButton, styles.reopen]} onPress={() => requireTreatment() && runAction(() => incidentService.reopen(userToken, incident.id, treatment), 'Đã mở lại sự cố.')}><Text style={styles.buttonText}>Mở lại</Text></TouchableOpacity>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity disabled={saving} style={styles.primaryButton} onPress={() => requireTreatment() && runAction(() => incidentService.addUpdate(userToken, incident.id, { treatment, observation: observation || undefined, result: result || undefined }), 'Đã lưu cập nhật điều trị.')}><Text style={styles.buttonText}>Lưu cập nhật</Text></TouchableOpacity>
              <TouchableOpacity disabled={saving} style={[styles.primaryButton, styles.resolve]} onPress={() => requireTreatment() && runAction(() => incidentService.resolve(userToken, incident.id, { treatment, result: result || undefined }), 'Đã hoàn tất điều trị.')}><Text style={styles.buttonText}>Đã xử lý</Text></TouchableOpacity>
            </View>
          )}
        </View>
      )}
      {saving ? <ActivityIndicator color="#4f46e5" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 16, gap: 14, paddingBottom: 40 }, loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summary: { padding: 18, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#1e293b' }, status: { color: '#4f46e5', fontWeight: '800', fontSize: 12 }, meta: { marginTop: 8, color: '#64748b', fontSize: 12 }, description: { marginTop: 14, color: '#334155', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#312e81' }, updateCard: { padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  author: { fontWeight: '800', color: '#334155' }, time: { fontSize: 10, color: '#94a3b8' }, updateText: { marginTop: 8, color: '#475569', lineHeight: 19 }, bold: { fontWeight: '800' }, empty: { color: '#94a3b8' },
  form: { gap: 10, padding: 16, borderRadius: 20, backgroundColor: '#eef2ff' }, input: { minHeight: 70, padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 }, primaryButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#4f46e5', alignItems: 'center' }, resolve: { backgroundColor: '#059669' }, reopen: { backgroundColor: '#d97706' }, buttonText: { color: '#fff', fontWeight: '800' },
  readOnly: { padding: 14, borderRadius: 14, backgroundColor: '#f1f5f9' }, readOnlyText: { textAlign: 'center', color: '#64748b', fontWeight: '600' },
});
