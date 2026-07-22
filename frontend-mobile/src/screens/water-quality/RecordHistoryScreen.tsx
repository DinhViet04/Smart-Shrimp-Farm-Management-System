import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import {
  getFarms,
  getPonds,
  getWaterQualityHistory,
  Farm,
  Pond,
  WaterQualityHistoryRecord,
} from '../../services/waterQualityService';

// ─── Status colors config ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  Optimal: { bg: '#dcfce7', text: '#15803d', label: 'Tối ưu' },
  Warning: { bg: '#fef9c3', text: '#854d0e', label: 'Cảnh báo' },
  Danger:  { bg: '#fee2e2', text: '#b91c1c', label: 'Nguy hiểm' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: 'Optimal' | 'Warning' | 'Danger';
}
const StatusBadge = ({ status }: StatusBadgeProps) => {
  const cfg = STATUS_COLORS[status];
  if (!cfg) return null;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

interface DropdownProps {
  label: string;
  value: string | null;
  placeholder: string;
  items: { id: string; name: string }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}
const Dropdown = ({
  label,
  value,
  placeholder,
  items,
  onSelect,
  disabled,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdownButton, disabled && styles.disabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={selected ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {selected ? selected.name : placeholder}
        </Text>
        <Text style={styles.dropdownChevron}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setOpen(false)}
          activeOpacity={1}
        >
          <View style={styles.dropdownList}>
            <Text style={styles.dropdownListTitle}>{label}</Text>
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    item.id === value && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      item.id === value && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── Main Screen Component ───────────────────────────────────────────────────

export default function RecordHistoryScreen() {
  const { userToken } = useContext(AuthContext);

  // ─── Filter Master Data ────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [selectedPondId, setSelectedPondId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ─── Records & Pagination / Sorting ────────────────────────────────────────
  const [records, setRecords] = useState<WaterQualityHistoryRecord[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ─── UI Loading states ─────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<WaterQualityHistoryRecord | null>(null);

  const filteredPonds = selectedFarmId
    ? ponds.filter((p) => p.farmId === selectedFarmId)
    : ponds;

  // Load farms & ponds
  useEffect(() => {
    if (!userToken) return;
    (async () => {
      try {
        const [farmsData, pondsData] = await Promise.all([
          getFarms(userToken),
          getPonds(userToken),
        ]);
        setFarms(farmsData);
        setPonds(pondsData);
      } catch (e) {
        console.error('Failed to load farms/ponds', e);
      }
    })();
  }, [userToken]);

  // Fetch paginated history from API
  const fetchHistory = useCallback(
    async (isRefresh = false) => {
      if (!userToken) return;
      if (!isRefresh) setLoading(true);
      try {
        const queryPage = isRefresh ? 0 : page;
        const res = await getWaterQualityHistory(userToken, {
          farmId: selectedFarmId || undefined,
          pondId: selectedPondId || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          page: queryPage,
          size,
          sort: sortOrder,
        });
        setRecords(res.content);
        setTotalElements(res.totalElements);
        if (isRefresh) setPage(0);
      } catch (e) {
        console.error('Failed to load water quality history', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userToken, selectedFarmId, selectedPondId, fromDate, toDate, page, size, sortOrder],
  );

  useEffect(() => {
    fetchHistory();
  }, [page, sortOrder]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory(true);
  };

  const handleSearch = () => {
    setPage(0);
    setShowFilters(false);
    fetchHistory();
  };

  const handleReset = () => {
    setSelectedFarmId(null);
    setSelectedPondId(null);
    setFromDate('');
    setToDate('');
    setPage(0);
    setSortOrder('desc');
    setShowFilters(false);
  };

  const totalPages = Math.ceil(totalElements / size);

  // Format date helper
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.root}>
      {/* ─── Collapsible Filter Panel ────────────────────────────────────────── */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterBarButton}
          onPress={() => setShowFilters((prev) => !prev)}
        >
          <Text style={styles.filterBarText}>
            🔍 {showFilters ? 'Ẩn bộ lọc tìm kiếm' : 'Hiện bộ lọc tìm kiếm'}
          </Text>
        </TouchableOpacity>

        {showFilters && (
          <View style={styles.filtersWrapper}>
            <Dropdown
              label="Trang trại"
              value={selectedFarmId}
              placeholder="Chọn trang trại..."
              items={farms}
              onSelect={(id) => {
                setSelectedFarmId(id);
                setSelectedPondId(null);
              }}
            />

            <Dropdown
              label="Ao nuôi"
              value={selectedPondId}
              placeholder={selectedFarmId ? 'Chọn ao nuôi...' : 'Chọn trang trại trước'}
              items={filteredPonds}
              onSelect={setSelectedPondId}
              disabled={!selectedFarmId}
            />

            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <Text style={styles.dateLabel}>Từ ngày</Text>
                <TextInput
                  style={styles.dateInput}
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.dateCol}>
                <Text style={styles.dateLabel}>Đến ngày</Text>
                <TextInput
                  style={styles.dateInput}
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Đặt lại</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                <Text style={styles.searchButtonText}>Tìm kiếm</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ─── Sorting Bar ────────────────────────────────────────────────────── */}
      <View style={styles.sortingBar}>
        <Text style={styles.resultsCount}>Tìm thấy: {totalElements} bản ghi</Text>
        <TouchableOpacity
          style={styles.sortToggle}
          onPress={() => setSortOrder((p) => (p === 'desc' ? 'asc' : 'desc'))}
        >
          <Text style={styles.sortToggleText}>
            ⇅ Sắp xếp: {sortOrder === 'desc' ? 'Mới nhất' : 'Cũ nhất'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── List of Records ────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Đang tải lịch sử môi trường...</Text>
        </View>
      ) : records.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>Không tìm thấy bản ghi</Text>
          <Text style={styles.emptyText}>Thử thay đổi bộ lọc hoặc kéo xuống để làm mới dữ liệu.</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelectedRecord(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTime}>{formatDate(item.recordTime)}</Text>
                <StatusBadge status={item.overallStatus} />
              </View>

              <Text style={styles.cardPondName}>{item.pondName}</Text>
              <Text style={styles.cardFarmName}>{item.farmName}</Text>

              {/* Short stats summary */}
              <View style={styles.cardSummaryRow}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Nhiệt độ</Text>
                  <Text style={styles.summaryVal}>{item.temperature}°C</Text>
                </View>
                <View style={[styles.summaryBox, styles.summaryBorder]}>
                  <Text style={styles.summaryLabel}>pH</Text>
                  <Text style={styles.summaryVal}>{item.ph}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>DO</Text>
                  <Text style={styles.summaryVal}>{item.dissolvedOxygen}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageButton, page === 0 && styles.pageButtonDisabled]}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <Text style={styles.pageButtonText}>◀</Text>
                </TouchableOpacity>
                <Text style={styles.pageIndicator}>
                  Trang {page + 1} / {totalPages}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    page === totalPages - 1 && styles.pageButtonDisabled,
                  ]}
                  onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                >
                  <Text style={styles.pageButtonText}>▶</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* ─── Detail Dialog/Modal overlay ────────────────────────────────────── */}
      <Modal visible={selectedRecord !== null} animationType="slide" transparent>
        <View style={styles.dialogOverlay}>
          {selectedRecord && (
            <View style={styles.dialogContent}>
              <View style={styles.dialogHeader}>
                <View>
                  <Text style={styles.dialogHeaderSubtitle}>Chi tiết bản ghi môi trường</Text>
                  <Text style={styles.dialogHeaderTitle}>{selectedRecord.pondName}</Text>
                  <Text style={styles.dialogHeaderFarm}>{selectedRecord.farmName}</Text>
                </View>
                <StatusBadge status={selectedRecord.overallStatus} />
              </View>

              <ScrollView style={styles.dialogScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.timeInfoBox}>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeItemLabel}>Thời gian đo</Text>
                    <Text style={styles.timeItemValue}>{formatDate(selectedRecord.recordTime)}</Text>
                  </View>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeItemLabel}>Thời gian tạo</Text>
                    <Text style={styles.timeItemValue}>{formatDate(selectedRecord.createdAt)}</Text>
                  </View>
                </View>

                {/* Parameters list */}
                <View style={styles.paramsGrid}>
                  <View style={styles.paramItem}>
                    <Text style={styles.paramLabel}>Nhiệt độ</Text>
                    <Text style={styles.paramValue}>{selectedRecord.temperature}°C</Text>
                  </View>
                  <View style={styles.paramItem}>
                    <Text style={styles.paramLabel}>pH</Text>
                    <Text style={styles.paramValue}>{selectedRecord.ph}</Text>
                  </View>
                  <View style={styles.paramItem}>
                    <Text style={styles.paramLabel}>DO (Oxy)</Text>
                    <Text style={styles.paramValue}>{selectedRecord.dissolvedOxygen} mg/L</Text>
                  </View>
                  <View style={styles.paramItem}>
                    <Text style={styles.paramLabel}>Độ mặn</Text>
                    <Text style={styles.paramValue}>{selectedRecord.salinity} ppt</Text>
                  </View>
                  <View style={[styles.paramItem, { width: '100%' }]}>
                    <Text style={styles.paramLabel}>Độ kiềm</Text>
                    <Text style={styles.paramValue}>{selectedRecord.alkalinity} mg/L</Text>
                  </View>
                  <View style={styles.paramItem}>
                    <Text style={styles.paramLabel}>NH3</Text>
                    <Text style={styles.paramValue}>{selectedRecord.nh3} mg/L</Text>
                  </View>
                  <View style={styles.paramItem}>
                    <Text style={styles.paramLabel}>H2S</Text>
                    <Text style={styles.paramValue}>{selectedRecord.h2s ?? selectedRecord.no2 ?? 0} mg/L</Text>
                  </View>
                  {selectedRecord.waterColor ? (
                    <View style={[styles.paramItem, { width: '100%' }]}>
                      <Text style={styles.paramLabel}>Màu nước</Text>
                      <Text style={styles.paramValue}>{selectedRecord.waterColor}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.dialogNoteBox}>
                  <Text style={styles.dialogNoteLabel}>Ghi chú</Text>
                  <Text style={styles.dialogNoteText}>
                    {selectedRecord.note || 'Không có ghi chú.'}
                  </Text>
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.closeDialogButton} onPress={() => setSelectedRecord(null)}>
                <Text style={styles.closeDialogButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Stylesheet ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },

  // ── Filters ────────────────────────────────────────────────────────────────
  filterBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  filterBarButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  filterBarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  filtersWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dropdownContainer: {
    marginTop: 12,
  },
  dropdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dropdownButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValue: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },
  dropdownChevron: {
    fontSize: 10,
    color: '#94a3b8',
  },
  disabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    padding: 20,
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: 340,
  },
  dropdownListTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  dropdownItemSelected: {
    backgroundColor: '#eff6ff',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#374151',
  },
  dropdownItemTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },

  // Dates
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  dateCol: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dateInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },

  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  searchButton: {
    flex: 1,
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Sorting Bar ───────────────────────────────────────────────────────────
  sortingBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  sortToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },

  // ── List & Cards ──────────────────────────────────────────────────────────
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  cardPondName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardFarmName: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 12,
  },
  cardSummaryRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginTop: 2,
  },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Pagination ────────────────────────────────────────────────────────────
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: 12,
    color: '#475569',
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    paddingTop: 120,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 240,
  },

  // ── Detail Dialog ──────────────────────────────────────────────────────────
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  dialogContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  dialogHeaderSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dialogHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  dialogHeaderFarm: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  dialogScroll: {
    marginVertical: 10,
  },
  timeInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 16,
  },
  timeItem: {
    flex: 1,
  },
  timeItemLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  timeItemValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginTop: 3,
  },

  paramsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paramItem: {
    width: '48.5%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  paramLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  paramValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 2,
  },

  dialogNoteBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dialogNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  dialogNoteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18,
    marginTop: 4,
  },
  closeDialogButton: {
    backgroundColor: '#0284c7',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  closeDialogButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
