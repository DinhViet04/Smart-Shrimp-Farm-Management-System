import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { incidentService, type ActiveCrop } from '../../services/incidentService';

export default function IncidentCreateScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { userToken } = useContext(AuthContext);
  const [crops, setCrops] = useState<ActiveCrop[]>([]);
  const [cropId, setCropId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userToken) return;
    incidentService.getActiveCrops(userToken)
      .then((items) => { setCrops(items); if (items.length) setCropId(items[0].id); })
      .catch((error) => Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể tải vụ nuôi'))
      .finally(() => setLoading(false));
  }, [userToken]);

  const submit = async () => {
    if (!userToken || !cropId || !title.trim() || !description.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn vụ nuôi và nhập đầy đủ nội dung sự cố.');
      return;
    }
    setSaving(true);
    try {
      await incidentService.create(userToken, { cropId, title: title.trim(), description: description.trim() });
      Alert.alert('Thành công', 'Đã báo cáo sự cố.', [{ text: 'Đóng', onPress: navigation.goBack }]);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể báo cáo sự cố');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#4f46e5" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Chọn vụ nuôi đang hoạt động</Text>
      {crops.length === 0 ? <Text style={styles.empty}>Không có vụ nuôi đang hoạt động.</Text> : crops.map((crop) => (
        <TouchableOpacity key={crop.id} onPress={() => setCropId(crop.id)} style={[styles.crop, cropId === crop.id && styles.cropSelected]}>
          <Text style={[styles.cropText, cropId === crop.id && styles.cropTextSelected]}>{crop.pond.farm?.name || 'Trang trại'} · {crop.pond.name}</Text>
          <Text style={styles.cropDate}>Bắt đầu: {new Date(crop.startDate).toLocaleDateString('vi-VN')}</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.label}>Tiêu đề sự cố</Text>
      <TextInput value={title} onChangeText={setTitle} maxLength={200} placeholder="Ví dụ: Tôm nổi đầu bất thường" style={styles.input} />
      <Text style={styles.label}>Mô tả chi tiết</Text>
      <TextInput value={description} onChangeText={setDescription} maxLength={2000} multiline placeholder="Dấu hiệu, thời gian phát hiện và tình trạng hiện tại..." style={[styles.input, styles.description]} />
      <TouchableOpacity disabled={saving || crops.length === 0} onPress={submit} style={[styles.submit, (saving || crops.length === 0) && styles.disabled]}>
        <Text style={styles.submitText}>{saving ? 'Đang gửi...' : 'Gửi báo cáo sự cố'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 16, gap: 10, paddingBottom: 40 }, loader: { flex: 1 },
  label: { marginTop: 8, fontWeight: '800', color: '#334155' }, empty: { padding: 16, color: '#b45309', backgroundColor: '#fffbeb', borderRadius: 12 },
  crop: { padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }, cropSelected: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  cropText: { fontWeight: '700', color: '#475569' }, cropTextSelected: { color: '#3730a3' }, cropDate: { marginTop: 4, fontSize: 11, color: '#94a3b8' },
  input: { padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' }, description: { minHeight: 130, textAlignVertical: 'top' },
  submit: { marginTop: 10, padding: 15, borderRadius: 14, backgroundColor: '#4f46e5', alignItems: 'center' }, disabled: { opacity: 0.5 }, submitText: { color: '#fff', fontWeight: '800' },
});
