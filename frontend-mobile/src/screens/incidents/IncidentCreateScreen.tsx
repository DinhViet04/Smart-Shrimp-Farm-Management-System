import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Waves,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { incidentService, type ActiveCrop } from '../../services/incidentService';

interface FormErrors {
  cropId?: string;
  title?: string;
  description?: string;
}

export default function IncidentCreateScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { userToken } = useContext(AuthContext);
  const [crops, setCrops] = useState<ActiveCrop[]>([]);
  const [cropId, setCropId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    incidentService.getActiveCrops()
      .then((items) => {
        setCrops(items);
        if (items.length > 0) {
          setCropId(items[0].id);
        }
      })
      .catch((error) => {
        Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể tải danh sách vụ nuôi');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleTitleChange = (text: string) => {
    setTitle(text);
    if (errors.title) {
      setErrors((prev) => ({ ...prev, title: undefined }));
    }
  };

  const handleDescChange = (text: string) => {
    setDescription(text);
    if (errors.description) {
      setErrors((prev) => ({ ...prev, description: undefined }));
    }
  };

  const validate = (): { isValid: boolean; firstError?: string } => {
    const errs: FormErrors = {};

    if (!cropId) {
      errs.cropId = 'Vui lòng chọn một vụ nuôi đang hoạt động.';
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errs.title = 'Vui lòng nhập tiêu đề sự cố.';
    } else if (trimmedTitle.length < 3) {
      errs.title = 'Tiêu đề sự cố phải có ít nhất 3 ký tự.';
    } else if (trimmedTitle.length > 200) {
      errs.title = 'Tiêu đề sự cố không được vượt quá 200 ký tự.';
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      errs.description = 'Vui lòng nhập mô tả chi tiết dấu hiệu và triệu chứng sự cố.';
    } else if (trimmedDesc.length < 10) {
      errs.description = 'Mô tả chi tiết phải có ít nhất 10 ký tự để hỗ trợ chẩn đoán chính xác.';
    } else if (trimmedDesc.length > 2000) {
      errs.description = 'Mô tả không được vượt quá 2000 ký tự.';
    }

    setErrors(errs);
    const errValues = Object.values(errs);
    return { isValid: errValues.length === 0, firstError: errValues[0] };
  };

  const submit = async () => {
    const { isValid, firstError } = validate();
    if (!isValid) {
      if (firstError) Alert.alert('Thông tin chưa hợp lệ', firstError);
      return;
    }

    setSaving(true);
    try {
      await incidentService.create({
        cropId,
        title: title.trim(),
        description: description.trim(),
      });
      Alert.alert(
        'Thành công',
        'Đã gửi báo cáo sự cố thành công! Hệ thống đã ghi nhận và tự động phân công theo dõi.',
        [{ text: 'Đóng', onPress: navigation.goBack }]
      );
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể gửi báo cáo sự cố');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Đang tải danh sách vụ nuôi thực địa...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Banner Header ── */}
      <View style={styles.banner}>
        <View style={styles.bannerIconBox}>
          <AlertTriangle size={24} color="#ea580c" />
        </View>
        <View style={styles.bannerTextBox}>
          <Text style={styles.bannerTitle}>Báo cáo sự cố ao nuôi</Text>
          <Text style={styles.bannerSubtitle}>
            Ghi nhận triệu chứng bất thường để kích hoạt quy trình chẩn đoán AI và phác đồ điều trị.
          </Text>
        </View>
      </View>

      {/* ── Chọn Vụ nuôi ── */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>
          VỤ NUÔI ĐANG HOẠT ĐỘNG <Text style={styles.required}>*</Text>
        </Text>
        <Text style={styles.hint}>Chọn ao/vụ nuôi đang phát sinh hiện tượng bất thường:</Text>

        {crops.length === 0 ? (
          <View style={styles.emptyBox}>
            <AlertCircle size={18} color="#b45309" />
            <Text style={styles.emptyText}>
              Hiện không có vụ nuôi nào đang hoạt động (ACTIVE) trong trang trại.
            </Text>
          </View>
        ) : (
          <View style={styles.cropsList}>
            {crops.map((crop) => {
              const isSelected = cropId === crop.id;
              return (
                <TouchableOpacity
                  key={crop.id}
                  onPress={() => {
                    setCropId(crop.id);
                    if (errors.cropId) setErrors((prev) => ({ ...prev, cropId: undefined }));
                  }}
                  activeOpacity={0.8}
                  style={[styles.cropCard, isSelected && styles.cropCardSelected]}
                >
                  <View style={styles.cropCardHeader}>
                    <View style={styles.cropCardLeft}>
                      <Waves size={16} color={isSelected ? '#4f46e5' : '#0284c7'} />
                      <Text style={[styles.cropName, isSelected && styles.cropNameSelected]}>
                        {crop.pond.name}
                      </Text>
                    </View>
                    {isSelected && <CheckCircle2 size={18} color="#4f46e5" />}
                  </View>

                  <View style={styles.cropCardMeta}>
                    <View style={styles.metaRow}>
                      <Building2 size={12} color="#64748b" />
                      <Text style={styles.metaText}>{crop.pond.farm?.name || 'Trang trại'}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Calendar size={12} color="#64748b" />
                      <Text style={styles.metaText}>
                        Thả giống: {new Date(crop.startDate).toLocaleDateString('vi-VN')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {errors.cropId ? <Text style={styles.errorText}>{errors.cropId}</Text> : null}
      </View>

      {/* ── Tiêu đề sự cố ── */}
      <View style={styles.formGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            TIÊU ĐỀ SỰ CỐ <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.charCount}>{title.length}/200</Text>
        </View>
        <TextInput
          value={title}
          onChangeText={handleTitleChange}
          maxLength={200}
          placeholder="Ví dụ: Tôm nổi đầu buổi sáng, nghi thiếu oxy hoặc khí độc NO2"
          placeholderTextColor="#94a3b8"
          style={[styles.input, errors.title && styles.inputError]}
        />
        {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
      </View>

      {/* ── Mô tả chi tiết ── */}
      <View style={styles.formGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            MÔ TẢ TRIỆU CHỨNG & THỰC TRẠNG <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.charCount}>{description.length}/2000</Text>
        </View>
        <TextInput
          value={description}
          onChangeText={handleDescChange}
          maxLength={2000}
          multiline
          placeholder="Mô tả kỹ các biểu hiện: thời điểm bắt đầu, tỷ lệ tôm dính nhá, màu sắc gan tụy/ruột, chỉ số pH/Oxy đo được gần nhất..."
          placeholderTextColor="#94a3b8"
          style={[styles.input, styles.descriptionInput, errors.description && styles.inputError]}
        />
        {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
      </View>

      {/* ── Submit Button ── */}
      <TouchableOpacity
        disabled={saving || crops.length === 0}
        onPress={submit}
        activeOpacity={0.8}
        style={[styles.submitBtn, (saving || crops.length === 0) && styles.submitBtnDisabled]}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <FileText size={18} color="#ffffff" />
            <Text style={styles.submitBtnText}>Gửi báo cáo sự cố & Nhận phác đồ</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffedd5',
    alignItems: 'flex-start',
    gap: 12,
  },
  bannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextBox: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9a3412',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#c2410c',
    marginTop: 2,
    lineHeight: 17,
  },

  // Form groups
  formGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.3,
  },
  required: {
    color: '#ef4444',
  },
  charCount: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  emptyText: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '500',
    flex: 1,
  },

  // Crops list
  cropsList: {
    gap: 8,
  },
  cropCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  cropCardSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#f5f3ff',
  },
  cropCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cropCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cropName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  cropNameSelected: {
    color: '#312e81',
  },
  cropCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },

  // Inputs
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  descriptionInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
    marginTop: 2,
  },

  // Submit button
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
