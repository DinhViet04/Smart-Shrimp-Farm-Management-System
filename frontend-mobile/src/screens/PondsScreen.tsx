import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  ScrollView,
} from 'react-native';
import {
  Waves,
  Search,
  Plus,
  Calendar,
  Scale,
  Maximize2,
  Droplets,
  Utensils,
  X,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  AlertTriangle,
  Sparkles,
} from 'lucide-react-native';
import {
  pondService,
  OverviewPond,
  OverviewFarm,
  OverviewCrop,
} from '../services/pondService';
import { farmService } from '../services/farmService';
import { cropService } from '../services/cropService';
import { useAuth } from '../context/AuthContext';

export default function PondsScreen({ navigation, route }: any) {
  const { userRole } = useAuth();
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<OverviewCrop[]>([]);
  const [farms, setFarms] = useState<OverviewFarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'IDLE'>('ALL');
  const [selectedFarmId, setSelectedFarmId] = useState<string>('ALL');

  // Modal create pond (For FARM_MANAGER)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pondName, setPondName] = useState('');
  const [areaSize, setAreaSize] = useState('');
  const [depth, setDepth] = useState('1.5');
  const [targetFarmId, setTargetFarmId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal create farm (For FARM_MANAGER)
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [farmAddress, setFarmAddress] = useState('');
  const [farmArea, setFarmArea] = useState('');
  const [farmModel, setFarmModel] = useState<'HIGH_TECH' | 'TRADITIONAL'>('HIGH_TECH');
  const [farmDescription, setFarmDescription] = useState('');
  const [isSubmittingFarm, setIsSubmittingFarm] = useState(false);

  // Modal create crop / Thả giống (For FARM_MANAGER)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [selectedCropPond, setSelectedCropPond] = useState<OverviewPond | null>(null);
  const [cropStartDate, setCropStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [cropShrimpCount, setCropShrimpCount] = useState('');
  const [cropTargetSize, setCropTargetSize] = useState('30');
  const [cropSurvivalRate, setCropSurvivalRate] = useState('85');
  const [isSubmittingCrop, setIsSubmittingCrop] = useState(false);

  // Tự động mở modal tạo trang trại nếu điều hướng từ Dashboard
  useEffect(() => {
    if (route?.params?.openCreateFarm) {
      setIsFarmModalOpen(true);
      if (navigation?.setParams) {
        navigation.setParams({ openCreateFarm: undefined });
      }
    }
  }, [route?.params?.openCreateFarm, navigation]);

  const loadData = useCallback(async () => {
    try {
      const data = await pondService.getOverview();
      setPonds(data.ponds || []);
      setCrops(data.crops || []);
      setFarms(data.farms || []);
      if (data.farms?.length > 0 && !targetFarmId) {
        setTargetFarmId(data.farms[0].id);
      }
    } catch (error) {
      console.warn('Error loading ponds overview:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [targetFarmId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Helper calculating DOC (Days of culture)
  const getDOC = (startDate?: string) => {
    if (!startDate) return 0;
    const diff = Date.now() - new Date(startDate).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  // Filtered ponds
  const filteredPonds = useMemo(() => {
    return ponds.filter((p) => {
      // Farm filter
      if (selectedFarmId !== 'ALL' && p.farmId !== selectedFarmId) {
        return false;
      }
      // Search filter
      if (
        searchQuery.trim() !== '' &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      ) {
        return false;
      }
      // Status filter
      const activeCrop = crops.find(
        (c) => c.pondId === p.id && c.status === 'ACTIVE'
      );
      if (statusFilter === 'ACTIVE' && !activeCrop) return false;
      if (statusFilter === 'IDLE' && activeCrop) return false;

      return true;
    });
  }, [ponds, crops, selectedFarmId, searchQuery, statusFilter]);

  const handleCreateFarm = async () => {
    if (!farmName.trim() || !farmAddress.trim() || !farmArea.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên trang trại, địa chỉ và diện tích.');
      return;
    }

    const area = parseFloat(farmArea);
    if (isNaN(area) || area <= 0) {
      Alert.alert('Sai số liệu', 'Diện tích trang trại phải là số dương (m²).');
      return;
    }

    setIsSubmittingFarm(true);
    try {
      const createdFarm = await farmService.create({
        name: farmName.trim(),
        address: farmAddress.trim(),
        area: area,
        farmingModel: farmModel,
        description: farmDescription.trim() || undefined,
      });
      Alert.alert('Thành công', `Đã tạo trang trại "${farmName.trim()}" thành công!`);
      setIsFarmModalOpen(false);
      setFarmName('');
      setFarmAddress('');
      setFarmArea('');
      setFarmDescription('');
      setFarmModel('HIGH_TECH');

      if (!targetFarmId && createdFarm?.id) {
        setTargetFarmId(createdFarm.id);
      }
      await loadData();
    } catch (e: any) {
      Alert.alert('Thất bại', e.message || 'Không thể tạo trang trại.');
    } finally {
      setIsSubmittingFarm(false);
    }
  };

  const handleCreatePond = async () => {
    if (farms.length === 0) {
      Alert.alert(
        'Chưa có trang trại',
        'Vui lòng tạo ít nhất 1 trang trại trước khi thêm ao nuôi.',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Tạo trang trại ngay',
            onPress: () => {
              setIsModalOpen(false);
              setIsFarmModalOpen(true);
            },
          },
        ]
      );
      return;
    }

    const effectiveFarmId = targetFarmId || farms[0]?.id;
    if (!pondName.trim() || !areaSize.trim() || !effectiveFarmId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên ao, diện tích và chọn trang trại.');
      return;
    }

    const area = parseFloat(areaSize);
    const d = parseFloat(depth);
    if (isNaN(area) || area <= 0 || isNaN(d) || d <= 0) {
      Alert.alert('Sai số liệu', 'Diện tích và độ sâu phải là số dương.');
      return;
    }

    setIsSubmitting(true);
    try {
      await pondService.createPond({
        name: pondName.trim(),
        areaSize: area,
        depth: d,
        farmId: effectiveFarmId,
      });
      Alert.alert('Thành công', `Đã tạo ao nuôi "${pondName.trim()}" thành công.`);
      setIsModalOpen(false);
      setPondName('');
      setAreaSize('');
      setDepth('1.5');
      loadData();
    } catch (e: any) {
      Alert.alert('Thất bại', e.message || 'Không thể tạo ao nuôi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCrop = async () => {
    if (!selectedCropPond) return;

    if (!cropStartDate.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập ngày thả giống (YYYY-MM-DD).');
      return;
    }

    const count = parseInt(cropShrimpCount, 10);
    if (isNaN(count) || count <= 0) {
      Alert.alert('Sai số liệu', 'Số lượng giống thả phải là số nguyên dương (> 0 con).');
      return;
    }

    // Validation mật độ thả giống y như web CropManagement.tsx
    if (selectedCropPond.areaSize && selectedCropPond.areaSize > 0) {
      const density = count / selectedCropPond.areaSize;
      if (density > 250) {
        Alert.alert(
          'Vượt ngưỡng mật độ tối đa',
          `Mật độ thả (${density.toFixed(1)} con/m²) vượt quá ngưỡng báo động tối đa cho phép (> 250 con/m²). Tuyệt đối không thể thả vượt ngưỡng này!`
        );
        return;
      }
    }

    const targetSize = cropTargetSize ? parseFloat(cropTargetSize) : undefined;
    if (targetSize !== undefined && (isNaN(targetSize) || targetSize <= 0)) {
      Alert.alert('Sai số liệu', 'Kích cỡ thu hoạch dự kiến phải là số dương (> 0 con/kg).');
      return;
    }

    const survivalRate = cropSurvivalRate ? parseFloat(cropSurvivalRate) : undefined;
    if (survivalRate !== undefined && (isNaN(survivalRate) || survivalRate < 0 || survivalRate > 100)) {
      Alert.alert('Sai số liệu', 'Tỷ lệ sống dự kiến phải từ 0% đến 100%.');
      return;
    }

    setIsSubmittingCrop(true);
    try {
      await cropService.create({
        pondId: selectedCropPond.id,
        startDate: new Date(cropStartDate).toISOString(),
        initialShrimpCount: count,
        targetHarvestSize: targetSize,
        targetSurvivalRate: survivalRate,
        status: 'ACTIVE',
      });

      Alert.alert('Thành công', `Đã thả giống và kích hoạt vụ nuôi mới cho ${selectedCropPond.name}!`);
      setIsCropModalOpen(false);
      setCropShrimpCount('');
      await loadData();
    } catch (err: any) {
      Alert.alert('Thất bại', err.message || 'Không thể tạo vụ nuôi mới.');
    } finally {
      setIsSubmittingCrop(false);
    }
  };

  const renderPondCard = ({ item }: { item: OverviewPond }) => {
    const activeCrop = crops.find(
      (c) => c.pondId === item.id && c.status === 'ACTIVE'
    );
    const doc = activeCrop ? getDOC(activeCrop.startDate) : 0;
    const sample = item.latestSizeSample;

    return (
      <View style={styles.pondCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.pondTitleBlock}>
            <View style={styles.pondIconWrapper}>
              <Waves size={20} color="#2563eb" />
            </View>
            <View>
              <Text style={styles.pondName}>{item.name}</Text>
              <Text style={styles.farmName}>
                {item.farm?.name || 'Trang trại'} • {item.areaSize} m²
              </Text>
            </View>
          </View>

          {activeCrop ? (
            <View style={styles.activeCropBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeCropText}>Đang nuôi (DOC {doc})</Text>
            </View>
          ) : (
            <View style={styles.idleBadge}>
              <Text style={styles.idleBadgeText}>Ao trống</Text>
            </View>
          )}
        </View>

        {/* Card Metrics */}
        {activeCrop ? (
          <View style={styles.cropDetailsBox}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Số tôm thả:</Text>
                <Text style={styles.detailValue}>
                  {activeCrop.initialShrimpCount?.toLocaleString() || '--'} con
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Size tôm gần nhất:</Text>
                <Text style={styles.detailValueHighlight}>
                  {sample?.sizePerKg ? `${Number(sample.sizePerKg).toFixed(0)} con/kg` : 'Chưa lấy mẫu'}
                </Text>
              </View>
            </View>

            <View style={[styles.detailRow, { marginTop: 6 }]}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Trọng lượng (ABW):</Text>
                <Text style={styles.detailValue}>
                  {sample?.abwGram ? `${Number(sample.abwGram).toFixed(2)} g/con` : '--'}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Sinh khối ước tính:</Text>
                <Text style={styles.detailValue}>
                  {sample?.estimatedBiomassKg
                    ? `${Number(sample.estimatedBiomassKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`
                    : '--'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCropBox}>
            <Text style={styles.emptyCropText}>
              Ao đang chuẩn bị nguồn nước hoặc chưa vào vụ nuôi mới.
            </Text>
            {userRole === 'FARM_MANAGER' && (
              <TouchableOpacity
                style={styles.startCropQuickBtn}
                onPress={() => {
                  setSelectedCropPond(item);
                  setCropStartDate(new Date().toISOString().slice(0, 10));
                  setCropShrimpCount('');
                  setIsCropModalOpen(true);
                }}
              >
                <Plus size={13} color="#ffffff" />
                <Text style={styles.startCropQuickBtnText}>+ Thả giống vụ mới</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quick Actions for this Pond */}
        <View style={styles.cardActionsRow}>
          {!activeCrop && userRole === 'FARM_MANAGER' && (
            <TouchableOpacity
              style={[
                styles.cardActionBtn,
                { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
              ]}
              onPress={() => {
                setSelectedCropPond(item);
                setCropStartDate(new Date().toISOString().slice(0, 10));
                setCropShrimpCount('');
                setIsCropModalOpen(true);
              }}
            >
              <Plus size={14} color="#059669" />
              <Text style={[styles.cardActionText, { color: '#059669', fontWeight: '700' }]}>
                Thả giống
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => navigation.navigate('Môi trường', { screen: 'RecordWaterQuality' })}
          >
            <Droplets size={14} color="#0284c7" />
            <Text style={[styles.cardActionText, { color: '#0284c7' }]}>Đo nước</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => navigation.navigate('Sự cố', { screen: 'IncidentCreate' })}
          >
            <AlertTriangle size={14} color="#ef4444" />
            <Text style={[styles.cardActionText, { color: '#ef4444' }]}>Báo sự cố</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Quản Lý Ao & Vụ Nuôi</Text>
          <Text style={styles.headerSubtitle}>
            Theo dõi diện tích, ngày nuôi DOC & sinh khối ao
          </Text>
        </View>

        {userRole === 'FARM_MANAGER' && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.addFarmHeaderBtn}
              onPress={() => setIsFarmModalOpen(true)}
            >
              <Building2 size={15} color="#ffffff" />
              <Text style={styles.addFarmHeaderBtnText}>+ Trại</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addPondBtn}
              onPress={() => setIsModalOpen(true)}
            >
              <Plus size={15} color="#ffffff" />
              <Text style={styles.addPondBtnText}>Thêm ao</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Farm Selector Chips */}
      <View style={styles.farmFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.farmFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.farmChip,
              selectedFarmId === 'ALL' && styles.farmChipActive,
            ]}
            onPress={() => setSelectedFarmId('ALL')}
          >
            <Building2
              size={13}
              color={selectedFarmId === 'ALL' ? '#ffffff' : '#475569'}
            />
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
              style={[
                styles.farmChip,
                selectedFarmId === f.id && styles.farmChipActive,
              ]}
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

          {userRole === 'FARM_MANAGER' && (
            <TouchableOpacity
              style={styles.farmChipAdd}
              onPress={() => setIsFarmModalOpen(true)}
            >
              <Plus size={13} color="#059669" />
              <Text style={styles.farmChipAddText}>+ Thêm trang trại</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm tên ao nuôi..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Filter Chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'ALL' && styles.filterChipActive,
          ]}
          onPress={() => setStatusFilter('ALL')}
        >
          <Text
            style={[
              styles.filterChipText,
              statusFilter === 'ALL' && styles.filterChipTextActive,
            ]}
          >
            Tất cả ({ponds.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'ACTIVE' && styles.filterChipActive,
          ]}
          onPress={() => setStatusFilter('ACTIVE')}
        >
          <Text
            style={[
              styles.filterChipText,
              statusFilter === 'ACTIVE' && styles.filterChipTextActive,
            ]}
          >
            🦐 Đang nuôi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'IDLE' && styles.filterChipActive,
          ]}
          onPress={() => setStatusFilter('IDLE')}
        >
          <Text
            style={[
              styles.filterChipText,
              statusFilter === 'IDLE' && styles.filterChipTextActive,
            ]}
          >
            Ao trống
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pond List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tải danh sách ao nuôi...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPonds}
          keyExtractor={(item) => item.id}
          renderItem={renderPondCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Waves size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Không có ao nuôi nào</Text>
              <Text style={styles.emptyDesc}>
                Không tìm thấy ao nuôi phù hợp với bộ lọc hiện tại.
              </Text>
            </View>
          }
        />
      )}

      {/* Modal Thêm Ao Nuôi */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm Ao Nuôi Mới</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Trang trại trực thuộc (*):</Text>
              {farms.length === 0 ? (
                <View style={styles.noFarmWarning}>
                  <AlertTriangle size={16} color="#d97706" />
                  <Text style={styles.noFarmWarningText}>
                    Chưa có trang trại nào trong hệ thống!
                  </Text>
                  <TouchableOpacity
                    style={styles.quickCreateFarmBtn}
                    onPress={() => {
                      setIsModalOpen(false);
                      setIsFarmModalOpen(true);
                    }}
                  >
                    <Text style={styles.quickCreateFarmBtnText}>+ Tạo trang trại ngay</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.modalFarmPicker}
                >
                  {farms.map((farm) => {
                    const isSelected = (targetFarmId || farms[0]?.id) === farm.id;
                    return (
                      <TouchableOpacity
                        key={farm.id}
                        style={[
                          styles.modalFarmChip,
                          isSelected && styles.modalFarmChipActive,
                        ]}
                        onPress={() => setTargetFarmId(farm.id)}
                      >
                        <Building2
                          size={13}
                          color={isSelected ? '#ffffff' : '#475569'}
                        />
                        <Text
                          style={[
                            styles.modalFarmChipText,
                            isSelected && styles.modalFarmChipTextActive,
                          ]}
                        >
                          {farm.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Text style={styles.inputLabel}>Tên ao nuôi (*):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: Ao Số 1, Ao Ương 2..."
                value={pondName}
                onChangeText={setPondName}
              />

              <Text style={styles.inputLabel}>Diện tích (m² *):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: 1200"
                keyboardType="numeric"
                value={areaSize}
                onChangeText={setAreaSize}
              />

              <Text style={styles.inputLabel}>Độ sâu nước (mét):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="1.5"
                keyboardType="numeric"
                value={depth}
                onChangeText={setDepth}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  isSubmitting && styles.modalSubmitBtnDisabled,
                ]}
                onPress={handleCreatePond}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Lưu Ao Nuôi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal Tạo Trang Trại Mới */}
      <Modal
        visible={isFarmModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFarmModalOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.farmModalIcon}>
                  <Building2 size={18} color="#059669" />
                </View>
                <Text style={styles.modalTitle}>Tạo Trang Trại Nuôi Mới</Text>
              </View>
              <TouchableOpacity onPress={() => setIsFarmModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Tên trang trại (*):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: Trang Trại Hải Đăng 1..."
                value={farmName}
                onChangeText={setFarmName}
              />

              <Text style={styles.inputLabel}>Địa chỉ / Vị trí (*):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: Đầm Dơi, Cà Mau"
                value={farmAddress}
                onChangeText={setFarmAddress}
              />

              <Text style={styles.inputLabel}>Tổng diện tích mặt nước (m² *):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: 10000"
                keyboardType="numeric"
                value={farmArea}
                onChangeText={setFarmArea}
              />

              <Text style={styles.inputLabel}>Mô hình nuôi tôm:</Text>
              <View style={styles.modelSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.modelOptionBtn,
                    farmModel === 'HIGH_TECH' && styles.modelOptionBtnActive,
                  ]}
                  onPress={() => setFarmModel('HIGH_TECH')}
                >
                  <Sparkles
                    size={16}
                    color={farmModel === 'HIGH_TECH' ? '#ffffff' : '#059669'}
                  />
                  <Text
                    style={[
                      styles.modelOptionText,
                      farmModel === 'HIGH_TECH' && styles.modelOptionTextActive,
                    ]}
                  >
                    Công Nghệ Cao
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modelOptionBtn,
                    farmModel === 'TRADITIONAL' && styles.modelOptionBtnActive,
                  ]}
                  onPress={() => setFarmModel('TRADITIONAL')}
                >
                  <Waves
                    size={16}
                    color={farmModel === 'TRADITIONAL' ? '#ffffff' : '#64748b'}
                  />
                  <Text
                    style={[
                      styles.modelOptionText,
                      farmModel === 'TRADITIONAL' && styles.modelOptionTextActive,
                    ]}
                  >
                    Truyền Thống
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Mô tả / Ghi chú (tùy chọn):</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Ví dụ: Nuôi tôm thẻ chân trắng thâm canh..."
                value={farmDescription}
                onChangeText={setFarmDescription}
                multiline
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsFarmModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitFarmBtn,
                  isSubmittingFarm && styles.modalSubmitBtnDisabled,
                ]}
                onPress={handleCreateFarm}
                disabled={isSubmittingFarm}
              >
                {isSubmittingFarm ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Lưu Trang Trại</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal Thả Giống / Vào Vụ Nuôi Mới (FARM_MANAGER) */}
      <Modal
        visible={isCropModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCropModalOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.cropModalIcon}>
                  <Waves size={18} color="#059669" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Thả Giống & Vào Vụ Nuôi Mới</Text>
                  {selectedCropPond && (
                    <Text style={styles.modalSubtitle}>
                      {selectedCropPond.name} ({selectedCropPond.areaSize} m²)
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsCropModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Ngày bắt đầu thả giống (*):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD (Ví dụ: 2026-10-12)"
                value={cropStartDate}
                onChangeText={setCropStartDate}
              />

              <Text style={styles.inputLabel}>Số lượng tôm giống thả (con *):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: 100000"
                keyboardType="numeric"
                value={cropShrimpCount}
                onChangeText={setCropShrimpCount}
              />

              {/* Live density calculation & safe limit reminder */}
              {selectedCropPond && cropShrimpCount ? (
                <View
                  style={[
                    styles.densityInfoBox,
                    parseInt(cropShrimpCount, 10) / selectedCropPond.areaSize > 250
                      ? styles.densityDangerBox
                      : styles.densitySafeBox,
                  ]}
                >
                  <Text
                    style={[
                      styles.densityInfoText,
                      parseInt(cropShrimpCount, 10) / selectedCropPond.areaSize > 250
                        ? { color: '#dc2626' }
                        : { color: '#059669' },
                    ]}
                  >
                    Mật độ nuôi tính toán:{' '}
                    {(parseInt(cropShrimpCount, 10) / selectedCropPond.areaSize).toFixed(1)} con/m²{' '}
                    {parseInt(cropShrimpCount, 10) / selectedCropPond.areaSize > 250
                      ? '⚠️ (VƯỢT NGƯỠNG TỐI ĐA 250 con/m²)'
                      : '✅ (Đạt ngưỡng an toàn)'}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Kích thước thu hoạch mục tiêu (con/kg):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: 30 con/kg"
                keyboardType="numeric"
                value={cropTargetSize}
                onChangeText={setCropTargetSize}
              />

              <Text style={styles.inputLabel}>Tỷ lệ sống mục tiêu (%):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: 85 (%)"
                keyboardType="numeric"
                value={cropSurvivalRate}
                onChangeText={setCropSurvivalRate}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsCropModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitFarmBtn,
                  isSubmittingCrop && styles.modalSubmitBtnDisabled,
                ]}
                onPress={handleCreateCrop}
                disabled={isSubmittingCrop}
              >
                {isSubmittingCrop ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Kích Hoạt Vụ Nuôi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addFarmHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  addFarmHeaderBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  addPondBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  addPondBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  farmFilterContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
  },
  farmFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  farmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  farmChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  farmChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  farmChipTextActive: {
    color: '#ffffff',
  },
  farmChipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#10b981',
  },
  farmChipAddText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: '#0f172a',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
    paddingTop: 6,
  },
  pondCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pondTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pondIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pondName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  farmName: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  activeCropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  activeCropText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  idleBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  idleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  cropDetailsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  detailValueHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb',
  },
  emptyCropBox: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    marginBottom: 10,
  },
  emptyCropText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  cardActionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    gap: 8,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalBody: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalSubmitFarmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  modalFarmPicker: {
    marginBottom: 12,
  },
  modalFarmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  modalFarmChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  modalFarmChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalFarmChipTextActive: {
    color: '#ffffff',
  },
  noFarmWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noFarmWarningText: {
    fontSize: 12,
    color: '#b45309',
    marginBottom: 6,
  },
  quickCreateFarmBtn: {
    backgroundColor: '#059669',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  quickCreateFarmBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  farmModalIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modelOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  modelOptionBtnActive: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  modelOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modelOptionTextActive: {
    color: '#ffffff',
  },
  startCropQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  startCropQuickBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cropModalIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  densityInfoBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  densitySafeBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  densityDangerBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  densityInfoText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
