import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import {
  Package,
  Search,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Box,
  Pill,
  FlaskConical,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Building2,
} from 'lucide-react-native';
import { inventoryService, InventoryItem } from '../../services/inventoryService';
import { pondService, OverviewFarm } from '../../services/pondService';
import { useAuth } from '../../context/AuthContext';
import NotificationButton from '../../components/NotificationButton';

type CategoryFilter = 'ALL' | 'FEED' | 'MEDICINE' | 'CHEMICAL';

const USAGE_PURPOSES = [
  { id: 'FEEDING', label: 'Cho tôm ăn', icon: '🦐' },
  { id: 'WATER_TREATMENT', label: 'Xử lý nước ao', icon: '🧪' },
  { id: 'TREATMENT', label: 'Điều trị bệnh tôm', icon: '💊' },
  { id: 'EQUIPMENT', label: 'Bảo trì / Vệ sinh', icon: '⚙️' },
  { id: 'LOSS_EXPIRED', label: 'Hao hụt / Hết hạn', icon: '⚠️' },
  { id: 'OTHER', label: 'Mục đích khác', icon: '✏️' },
];

export default function InventoryScreen() {
  const { userRole } = useAuth();
  const canManageInventory = userRole === 'FARM_MANAGER';
  const canRecordUsage = ['FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN'].includes(userRole || '');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [farms, setFarms] = useState<OverviewFarm[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Modal Nhập / Xuất kho ──
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'IMPORT' | 'EXPORT'>('EXPORT');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [actionQuantity, setActionQuantity] = useState('');
  const [actionPurpose, setActionPurpose] = useState('FEEDING');
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // ── Modal Thêm vật tư mới (FARM_MANAGER) ──
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCategory, setCreateCategory] = useState<'FEED' | 'MEDICINE' | 'CHEMICAL'>('FEED');
  const [createFarmId, setCreateFarmId] = useState('');
  const [createUnit, setCreateUnit] = useState('kg');
  const [createPackageType, setCreatePackageType] = useState('Bao');
  const [createWeightPerPkg, setCreateWeightPerPkg] = useState('25');
  const [createPackageQty, setCreatePackageQty] = useState('0');
  const [createMinThreshold, setCreateMinThreshold] = useState('50');
  const [createPrice, setCreatePrice] = useState('0');
  const [createDescription, setCreateDescription] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const categoryParam = selectedCategory === 'ALL' ? undefined : selectedCategory;
      const [invData, overview] = await Promise.all([
        inventoryService.getInventory(categoryParam, searchQuery),
        pondService.getOverview().catch(() => ({ farms: [], ponds: [], crops: [] })),
      ]);
      setItems(invData);
      setFarms(overview.farms || []);
      if (overview.farms?.length > 0 && !createFarmId) {
        setCreateFarmId(overview.farms[0].id);
      }
    } catch (error) {
      console.warn('Error loading inventory:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCategory, searchQuery, createFarmId]);

  useEffect(() => {
    setIsLoading(true);
    const delayTimer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(delayTimer);
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'FEED':
        return {
          label: 'Thức ăn',
          bg: '#ecfdf5',
          text: '#059669',
          border: '#a7f3d0',
          icon: <Box size={12} color="#059669" />,
        };
      case 'MEDICINE':
        return {
          label: 'Thuốc',
          bg: '#f5f3ff',
          text: '#7c3aed',
          border: '#ddd6fe',
          icon: <Pill size={12} color="#7c3aed" />,
        };
      case 'CHEMICAL':
        return {
          label: 'Hóa chất',
          bg: '#fffbeb',
          text: '#d97706',
          border: '#fde68a',
          icon: <FlaskConical size={12} color="#d97706" />,
        };
      default:
        return {
          label: 'Khác',
          bg: '#f1f5f9',
          text: '#475569',
          border: '#cbd5e1',
          icon: <Package size={12} color="#475569" />,
        };
    }
  };

  const openActionModal = (item: InventoryItem, type: 'IMPORT' | 'EXPORT') => {
    setSelectedItem(item);
    setActionType(type);
    setActionQuantity('');
    setActionNotes('');
    if (item.category === 'FEED') setActionPurpose('FEEDING');
    else if (item.category === 'MEDICINE') setActionPurpose('TREATMENT');
    else if (item.category === 'CHEMICAL') setActionPurpose('WATER_TREATMENT');
    else setActionPurpose('OTHER');
    setIsActionModalOpen(true);
  };

  // ── Xử lý Nhập / Xuất kho với validation như web ──
  const handleSubmitAction = async () => {
    if (!selectedItem) return;

    const qty = parseFloat(actionQuantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Số liệu không hợp lệ', 'Số lượng thao tác phải là số dương lớn hơn 0.');
      return;
    }

    if (actionType === 'IMPORT') {
      setIsSubmittingAction(true);
      try {
        const weightPerPkg = Number(selectedItem.weightPerPkg) > 0 ? Number(selectedItem.weightPerPkg) : 1;
        const totalKgAdded = qty * weightPerPkg;

        await inventoryService.recordImport(selectedItem.id, {
          packagesAdded: qty,
          quantityAdded: totalKgAdded,
          notes: actionNotes.trim() || undefined,
        });

        Alert.alert(
          'Thành công',
          `Đã nhập kho thành công: +${qty} ${selectedItem.packageType || 'bao'} (+${totalKgAdded} ${selectedItem.unit})!`
        );
        setIsActionModalOpen(false);
        loadData();
      } catch (err: any) {
        Alert.alert('Thất bại', err.message || 'Không thể ghi nhận nhập kho.');
      } finally {
        setIsSubmittingAction(false);
      }
    } else {
      // EXPORT - Validation nghiêm ngặt kiểm tra tồn kho
      if (qty > selectedItem.quantity) {
        Alert.alert(
          'Vượt quá tồn kho',
          `Số lượng xuất (${qty} ${selectedItem.unit}) vượt quá tồn kho hiện tại (${selectedItem.quantity.toLocaleString()} ${selectedItem.unit})!`
        );
        return;
      }

      setIsSubmittingAction(true);
      try {
        const purposeObj = USAGE_PURPOSES.find((p) => p.id === actionPurpose);
        const purposeLabel = purposeObj ? `${purposeObj.icon} ${purposeObj.label}` : actionPurpose;
        const noteText = actionNotes.trim() ? ` — ${actionNotes.trim()}` : '';
        const formattedNotes = `[Mục đích: ${purposeLabel}]${noteText}`;

        await inventoryService.recordUsage(selectedItem.id, {
          quantityUsed: qty,
          notes: formattedNotes,
        });

        Alert.alert(
          'Thành công',
          `Đã xuất kho thành công: -${qty} ${selectedItem.unit}!`
        );
        setIsActionModalOpen(false);
        loadData();
      } catch (err: any) {
        Alert.alert('Thất bại', err.message || 'Không thể ghi nhận xuất kho.');
      } finally {
        setIsSubmittingAction(false);
      }
    }
  };

  // ── Xử lý Tạo vật tư mới (FARM_MANAGER) với validation như web ──
  const handleCreateItem = async () => {
    if (!createName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm / vật tư.');
      return;
    }

    if (!createUnit.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đơn vị tính cơ sở (ví dụ: kg, lít, chai...).');
      return;
    }

    const farmId = createFarmId || farms[0]?.id;
    if (!farmId) {
      Alert.alert('Thiếu trang trại', 'Vui lòng tạo hoặc chọn trang trại trực thuộc.');
      return;
    }

    const minThreshold = parseFloat(createMinThreshold);
    if (isNaN(minThreshold) || minThreshold < 0) {
      Alert.alert('Sai số liệu', 'Ngưỡng cảnh báo tối thiểu phải là số không âm (>= 0).');
      return;
    }

    const weightPerPkg = parseFloat(createWeightPerPkg) || 1;
    const packageQty = parseFloat(createPackageQty) || 0;
    const price = parseFloat(createPrice) || 0;
    const initialBaseQuantity = packageQty * weightPerPkg;

    setIsSubmittingCreate(true);
    try {
      await inventoryService.create({
        itemName: createName.trim(),
        category: createCategory,
        unit: createUnit.trim(),
        packageType: createPackageType.trim() || undefined,
        packageQty: packageQty,
        weightPerPkg: weightPerPkg,
        quantity: initialBaseQuantity,
        minThreshold: minThreshold,
        pricePerPackage: price >= 0 ? price : 0,
        farmId: farmId,
        description: createDescription.trim() || undefined,
      });

      Alert.alert('Thành công', `Đã thêm vật tư "${createName.trim()}" vào kho thành công!`);
      setIsCreateModalOpen(false);
      setCreateName('');
      setCreatePackageQty('0');
      setCreatePrice('0');
      setCreateDescription('');
      loadData();
    } catch (err: any) {
      Alert.alert('Thất bại', err.message || 'Không thể tạo vật tư mới.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const renderInventoryItem = ({ item }: { item: InventoryItem }) => {
    const badge = getCategoryBadge(item.category);
    const isLowStock = item.quantity <= (item.minThreshold || 0);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.nameBlock}>
            <Text style={styles.itemName}>{item.itemName}</Text>
            {item.supplierName && (
              <Text style={styles.supplierText}>NCC: {item.supplierName}</Text>
            )}
          </View>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            {badge.icon}
            <Text style={[styles.categoryBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Quantities & Status */}
        <View style={styles.cardBody}>
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Tồn kho hiện tại:</Text>
            <View style={styles.quantityValueRow}>
              <Text
                style={[
                  styles.quantityValue,
                  isLowStock && styles.quantityValueLow,
                ]}
              >
                {item.quantity.toLocaleString()}
              </Text>
              <Text style={styles.quantityUnit}> {item.unit}</Text>
            </View>
          </View>

          <View style={styles.thresholdContainer}>
            <Text style={styles.thresholdLabel}>Ngưỡng an toàn:</Text>
            <Text style={styles.thresholdValue}>
              {item.minThreshold ? `${item.minThreshold} ${item.unit}` : 'Chưa đặt'}
            </Text>
          </View>
        </View>

        {/* Stock Status Banner */}
        {isLowStock ? (
          <View style={styles.alertBanner}>
            <AlertTriangle size={14} color="#dc2626" />
            <Text style={styles.alertText}>
              Cảnh báo: Tồn kho chạm ngưỡng tối thiểu! Cần nhập thêm.
            </Text>
          </View>
        ) : (
          <View style={styles.safeBanner}>
            <CheckCircle2 size={13} color="#16a34a" />
            <Text style={styles.safeText}>Tồn kho an toàn đáp ứng cho ăn & xử lý</Text>
          </View>
        )}

        {/* Packaging detail */}
        {item.packageType && (
          <View style={styles.packageRow}>
            <Text style={styles.packageText}>
              Quy cách: {item.packageType}{' '}
              {item.weightPerPkg ? `(${item.weightPerPkg} kg/bao)` : ''}
              {item.packageQty ? ` • Tồn: ${item.packageQty} bao` : ''}
            </Text>
          </View>
        )}

        {/* Action Buttons for Card */}
        {canRecordUsage && (
          <View style={styles.cardActionRow}>
            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => openActionModal(item, 'IMPORT')}
            >
              <ArrowDownLeft size={14} color="#059669" />
              <Text style={styles.importBtnText}>Nhập kho</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => openActionModal(item, 'EXPORT')}
            >
              <ArrowUpRight size={14} color="#dc2626" />
              <Text style={styles.exportBtnText}>Xuất kho</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Package size={22} color="#4f46e5" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Kho Thức Ăn & Vật Tư</Text>
            <Text style={styles.headerSubtitle}>
              Quản lý tồn kho phục vụ cho ăn và xử lý ao nuôi
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {canManageInventory && (
            <TouchableOpacity
              style={styles.addMaterialBtn}
              onPress={() => setIsCreateModalOpen(true)}
            >
              <Plus size={15} color="#ffffff" />
              <Text style={styles.addMaterialBtnText}>+ Vật tư</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={17} color="#64748b" />
          </TouchableOpacity>
          <NotificationButton color="#64748b" />
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm tên thức ăn, thuốc, hóa chất..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter Chips */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedCategory === 'ALL' && styles.filterChipActive,
          ]}
          onPress={() => setSelectedCategory('ALL')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedCategory === 'ALL' && styles.filterChipTextActive,
            ]}
          >
            Tất cả
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedCategory === 'FEED' && styles.filterChipActive,
          ]}
          onPress={() => setSelectedCategory('FEED')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedCategory === 'FEED' && styles.filterChipTextActive,
            ]}
          >
            🌾 Thức ăn
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedCategory === 'MEDICINE' && styles.filterChipActive,
          ]}
          onPress={() => setSelectedCategory('MEDICINE')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedCategory === 'MEDICINE' && styles.filterChipTextActive,
            ]}
          >
            💊 Thuốc
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedCategory === 'CHEMICAL' && styles.filterChipActive,
          ]}
          onPress={() => setSelectedCategory('CHEMICAL')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedCategory === 'CHEMICAL' && styles.filterChipTextActive,
            ]}
          >
            🧪 Hóa chất
          </Text>
        </TouchableOpacity>
      </View>

      {/* Items List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Đang tải danh sách tồn kho...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderInventoryItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chưa có vật tư nào</Text>
              <Text style={styles.emptySubtitle}>
                Không tìm thấy vật tư phù hợp với bộ lọc danh mục đã chọn.
              </Text>
            </View>
          }
        />
      )}

      {/* ── Modal 1: Nhập / Xuất kho ── */}
      <Modal
        visible={isActionModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsActionModalOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {actionType === 'IMPORT' ? 'Nhập Kho Vật Tư' : 'Xuất Kho Vật Tư'}
                </Text>
                {selectedItem && (
                  <Text style={styles.modalSubtitle}>
                    {selectedItem.itemName} (Tồn: {selectedItem.quantity.toLocaleString()} {selectedItem.unit})
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setIsActionModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Switch Action Type Tabs */}
            <View style={styles.actionTabRow}>
              <TouchableOpacity
                style={[
                  styles.actionTabBtn,
                  actionType === 'EXPORT' && styles.actionTabBtnExportActive,
                ]}
                onPress={() => setActionType('EXPORT')}
              >
                <ArrowUpRight
                  size={15}
                  color={actionType === 'EXPORT' ? '#ffffff' : '#dc2626'}
                />
                <Text
                  style={[
                    styles.actionTabText,
                    actionType === 'EXPORT' && styles.actionTabTextActive,
                  ]}
                >
                  Xuất kho (Sử dụng)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionTabBtn,
                  actionType === 'IMPORT' && styles.actionTabBtnImportActive,
                ]}
                onPress={() => setActionType('IMPORT')}
              >
                <ArrowDownLeft
                  size={15}
                  color={actionType === 'IMPORT' ? '#ffffff' : '#059669'}
                />
                <Text
                  style={[
                    styles.actionTabText,
                    actionType === 'IMPORT' && styles.actionTabTextActive,
                  ]}
                >
                  Nhập kho (Bổ sung)
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {actionType === 'IMPORT' ? (
                <>
                  <Text style={styles.inputLabel}>
                    Số lượng nhập ({selectedItem?.packageType || 'bao'} *):
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ví dụ: 10"
                    keyboardType="numeric"
                    value={actionQuantity}
                    onChangeText={setActionQuantity}
                  />
                  {selectedItem?.weightPerPkg && Number(selectedItem.weightPerPkg) > 0 && actionQuantity ? (
                    <Text style={styles.hintCalc}>
                      Quy đổi dự kiến: +
                      {(parseFloat(actionQuantity) * Number(selectedItem.weightPerPkg)).toLocaleString()}{' '}
                      {selectedItem.unit}
                    </Text>
                  ) : null}

                  <Text style={styles.inputLabel}>Ghi chú nhập kho:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ví dụ: Nhập đợt 2 đại lý Việt Úc..."
                    value={actionNotes}
                    onChangeText={setActionNotes}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>
                    Số lượng xuất ({selectedItem?.unit} *):
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={`Tối đa: ${selectedItem?.quantity.toLocaleString()} ${selectedItem?.unit}`}
                    keyboardType="numeric"
                    value={actionQuantity}
                    onChangeText={setActionQuantity}
                  />

                  <Text style={styles.inputLabel}>Mục đích xuất kho:</Text>
                  <View style={styles.purposeGrid}>
                    {USAGE_PURPOSES.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.purposeChip,
                          actionPurpose === p.id && styles.purposeChipActive,
                        ]}
                        onPress={() => setActionPurpose(p.id)}
                      >
                        <Text style={styles.purposeIcon}>{p.icon}</Text>
                        <Text
                          style={[
                            styles.purposeText,
                            actionPurpose === p.id && styles.purposeTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Ghi chú / Ao áp dụng:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ví dụ: Cho ăn cữ sáng Ao 1..."
                    value={actionNotes}
                    onChangeText={setActionNotes}
                  />
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsActionModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  actionType === 'IMPORT' ? styles.modalSubmitImportBtn : styles.modalSubmitExportBtn,
                  isSubmittingAction && styles.btnDisabled,
                ]}
                onPress={handleSubmitAction}
                disabled={isSubmittingAction}
              >
                {isSubmittingAction ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {actionType === 'IMPORT' ? 'Xác nhận Nhập' : 'Xác nhận Xuất'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Modal 2: Thêm vật tư mới (FARM_MANAGER) ── */}
      <Modal
        visible={isCreateModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Thêm Vật Tư Mới Vào Kho</Text>
                <Text style={styles.modalSubtitle}>Khai báo thức ăn, thuốc hoặc hóa chất</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Tên vật tư / sản phẩm (*):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ví dụ: Thức ăn CP 01, Vi sinh EM..."
                value={createName}
                onChangeText={setCreateName}
              />

              <Text style={styles.inputLabel}>Phân loại (*):</Text>
              <View style={styles.categoryPickerRow}>
                <TouchableOpacity
                  style={[
                    styles.catBtn,
                    createCategory === 'FEED' && styles.catBtnFeedActive,
                  ]}
                  onPress={() => setCreateCategory('FEED')}
                >
                  <Text style={styles.catBtnText}>🌾 Thức ăn</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.catBtn,
                    createCategory === 'MEDICINE' && styles.catBtnMedActive,
                  ]}
                  onPress={() => setCreateCategory('MEDICINE')}
                >
                  <Text style={styles.catBtnText}>💊 Thuốc</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.catBtn,
                    createCategory === 'CHEMICAL' && styles.catBtnChemActive,
                  ]}
                  onPress={() => setCreateCategory('CHEMICAL')}
                >
                  <Text style={styles.catBtnText}>🧪 Hóa chất</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Trang trại trực thuộc (*):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {farms.map((f) => {
                  const isSel = (createFarmId || farms[0]?.id) === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.farmPickChip, isSel && styles.farmPickChipActive]}
                      onPress={() => setCreateFarmId(f.id)}
                    >
                      <Building2 size={13} color={isSel ? '#ffffff' : '#475569'} />
                      <Text style={[styles.farmPickText, isSel && styles.farmPickTextActive]}>
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Đơn vị tính cơ sở (*):</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="kg, lít, gói..."
                    value={createUnit}
                    onChangeText={setCreateUnit}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Quy cách:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Bao, Chai, Can..."
                    value={createPackageType}
                    onChangeText={setCreatePackageType}
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Khối lượng/quy cách:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ví dụ: 25 (kg/bao)"
                    keyboardType="numeric"
                    value={createWeightPerPkg}
                    onChangeText={setCreateWeightPerPkg}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Số bao ban đầu:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={createPackageQty}
                    onChangeText={setCreatePackageQty}
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Ngưỡng tối thiểu (*):</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="50"
                    keyboardType="numeric"
                    value={createMinThreshold}
                    onChangeText={setCreateMinThreshold}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Đơn giá (VNĐ/bao):</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ví dụ: 650000"
                    keyboardType="numeric"
                    value={createPrice}
                    onChangeText={setCreatePrice}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Mô tả / Nhà cung ứng:</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Ví dụ: Thức ăn đạm 40% cho tôm post..."
                value={createDescription}
                onChangeText={setCreateDescription}
                multiline
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsCreateModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitCreateBtn, isSubmittingCreate && styles.btnDisabled]}
                onPress={handleCreateItem}
                disabled={isSubmittingCreate}
              >
                {isSubmittingCreate ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Lưu Vật Tư Mới</Text>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addMaterialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  addMaterialBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: '#0f172a',
  },
  filterBar: {
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
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
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
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  supplierText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  quantityContainer: {
    flex: 1,
  },
  quantityLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  quantityValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  quantityValueLow: {
    color: '#dc2626',
  },
  quantityUnit: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  thresholdContainer: {
    alignItems: 'flex-end',
  },
  thresholdLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  thresholdValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  alertText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1,
  },
  safeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 8,
  },
  safeText: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '500',
  },
  packageRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  packageText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  importBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  loadingContainer: {
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
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  // Modal styles
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 12,
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
  actionTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionTabBtnImportActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  actionTabBtnExportActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  actionTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  actionTabTextActive: {
    color: '#ffffff',
  },
  modalBody: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  hintCalc: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: -6,
    marginBottom: 10,
  },
  purposeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  purposeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  purposeChipActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  purposeIcon: {
    fontSize: 12,
  },
  purposeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  purposeTextActive: {
    color: '#dc2626',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  catBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  catBtnFeedActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  catBtnMedActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  catBtnChemActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  catBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  farmPickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 6,
  },
  farmPickChipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  farmPickText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  farmPickTextActive: {
    color: '#ffffff',
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
  modalSubmitImportBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  modalSubmitExportBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  modalSubmitCreateBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
