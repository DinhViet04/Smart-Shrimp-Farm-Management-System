import React, { useCallback, useContext, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Wrench,
  RotateCcw,
  History,
  Send,
  X,
  UserCheck,
  ShieldAlert,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import {
  incidentService,
  type Incident,
  type IncidentStaff,
} from '../../services/incidentService';
import {
  FARM_INCIDENT_CATEGORIES,
  FARM_INCIDENT_SEVERITIES,
  parseIncidentMetadata,
  formatDate,
} from '../../constants/farmIncidentConstants';

type StaffRoleFilter = 'ALL' | 'TECHNICIAN' | 'FARMER';

export default function IncidentDetailScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const { incidentId } = route.params;
  const { userRole, userId } = useContext(AuthContext);

  const isManager = userRole === 'FARM_MANAGER' || userRole === 'ADMIN';

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Assigned Staff progress update form
  const [updateNote, setUpdateNote] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);

  // Manager Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [staffList, setStaffList] = useState<IncidentStaff[]>([]);
  const [staffRoleFilter, setStaffRoleFilter] = useState<StaffRoleFilter>('ALL');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Manager Reopen
  const [showReopenBox, setShowReopenBox] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await incidentService.getById(incidentId);
      setIncident(data);
    } catch (err: any) {
      console.warn('Lỗi tải chi tiết sự cố:', err);
      setError(err?.message || 'Không thể tải chi tiết sự cố.');
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Load staff (both TECHNICIAN and FARMER) when manager opens assign modal
  const handleOpenAssignModal = async () => {
    if (!incident) return;
    setShowAssignModal(true);
    setSelectedStaffId(incident.assignedToId || '');
    setAssignNote('');
    setStaffRoleFilter('ALL');
    setLoadingStaff(true);

    try {
      const farmId =
        incident.crop?.pond?.farm?.id || (incident.crop?.pond as any)?.farmId || '';
      if (farmId) {
        const list = await incidentService.getStaff(farmId);
        setStaffList(list);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách nhân sự trang trại:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Filtered staff list in modal
  const filteredStaffList = useMemo(() => {
    if (staffRoleFilter === 'TECHNICIAN') {
      return staffList.filter((s) => s.role === 'TECHNICIAN');
    }
    if (staffRoleFilter === 'FARMER') {
      return staffList.filter((s) => s.role === 'FARMER');
    }
    return staffList;
  }, [staffList, staffRoleFilter]);

  const handleAssignSubmit = async () => {
    if (!incident || !selectedStaffId) {
      Alert.alert('Thông báo', 'Vui lòng chọn nhân sự (Kỹ thuật viên hoặc Công nhân) phụ trách.');
      return;
    }
    setSaving(true);
    try {
      await incidentService.assign(incident.id, selectedStaffId);
      if (assignNote.trim()) {
        await incidentService.addUpdate(incident.id, {
          treatment: `Chỉ đạo của Quản lý: ${assignNote.trim()}`,
        });
      }
      setShowAssignModal(false);
      setAssignNote('');
      await loadDetail();
      Alert.alert('Thành công', 'Đã phân công nhiệm vụ xử lý sự cố thành công!');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể phân công nhiệm vụ.');
    } finally {
      setSaving(false);
    }
  };

  // Assigned Staff begins repair
  const handleStartRepair = async () => {
    if (!incident) return;
    setSaving(true);
    try {
      await incidentService.startTreatment(incident.id);
      await loadDetail();
      Alert.alert('Thành công', 'Đã xác nhận bắt đầu tiến hành khắc phục sự cố tại hiện trường.');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật trạng thái.');
    } finally {
      setSaving(false);
    }
  };

  // Assigned Staff saves progress or completes
  const handleSaveProgress = async () => {
    if (!incident) return;
    if (!updateNote.trim() && !resolveNote.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung công việc đã xử lý.');
      return;
    }

    setSaving(true);
    try {
      if (isFinishing) {
        await incidentService.resolve(incident.id, {
          treatment: updateNote.trim() || 'Đã khắc phục hoàn tất sự cố.',
          result:
            resolveNote.trim() ||
            'Nghiệm thu hoàn tất, thiết bị/cơ sở hạ tầng đã vận hành ổn định trở lại.',
        });
        Alert.alert('Thành công', 'Đã hoàn tất nghiệm thu và đóng sự cố!');
      } else {
        await incidentService.addUpdate(incident.id, {
          treatment: updateNote.trim(),
        });
        Alert.alert('Thành công', 'Đã lưu cập nhật tiến trình khắc phục.');
      }
      setUpdateNote('');
      setResolveNote('');
      setIsFinishing(false);
      await loadDetail();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể lưu cập nhật.');
    } finally {
      setSaving(false);
    }
  };

  // Manager reopens
  const handleReopen = async () => {
    if (!incident) return;
    if (!reopenReason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do mở lại sự cố.');
      return;
    }
    setSaving(true);
    try {
      await incidentService.reopen(incident.id, { reason: reopenReason.trim() });
      setShowReopenBox(false);
      setReopenReason('');
      await loadDetail();
      Alert.alert('Thành công', 'Đã mở lại sự cố.');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể mở lại sự cố.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Đang tải chi tiết sự cố...</Text>
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={styles.centerBox}>
        <AlertTriangle size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Không tìm thấy sự cố</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { category, severity, location, cleanTitle, cleanDescription } = parseIncidentMetadata(
    incident.title,
    incident.description
  );
  const isAssigned = Boolean(incident.assignedToId || incident.assignedTo);
  const isResolved = incident.status === 'RESOLVED';
  const isAssignedToMe = incident.assignedToId === userId || incident.assignedTo?.id === userId;
  const pondName = incident.crop?.pond?.name;
  const displayLoc = location || (pondName ? `Ao nuôi ${pondName}` : 'Toàn trang trại');
  const assignedRole = (incident.assignedTo as any)?.role || '';
  const assignedRoleLabel =
    assignedRole === 'TECHNICIAN'
      ? 'Kỹ thuật viên'
      : assignedRole === 'FARMER'
      ? 'Công nhân'
      : '';

  const matchedCat = FARM_INCIDENT_CATEGORIES.find((c) =>
    category.toLowerCase().includes(c.id.toLowerCase())
  );
  const matchedSev = FARM_INCIDENT_SEVERITIES.find(
    (s) => s.id.toLowerCase() === severity.toLowerCase()
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header Summary Card */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: matchedCat ? matchedCat.badgeBg : '#f1f5f9' },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: matchedCat ? matchedCat.badgeText : '#475569' },
                ]}
              >
                {matchedCat ? `${matchedCat.icon} ${matchedCat.label}` : category || 'Khác'}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                { backgroundColor: matchedSev ? matchedSev.badgeBg : '#f1f5f9' },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: matchedSev ? matchedSev.badgeText : '#475569' },
                ]}
              >
                {matchedSev ? matchedSev.label : severity}
              </Text>
            </View>

            {isResolved ? (
              <View style={[styles.badge, { backgroundColor: '#ecfdf5' }]}>
                <Text style={[styles.badgeText, { color: '#059669' }]}>✓ Đã hoàn thành</Text>
              </View>
            ) : isAssigned ? (
              <View style={[styles.badge, { backgroundColor: '#eff6ff' }]}>
                <Text style={[styles.badgeText, { color: '#2563eb' }]}>Đang xử lý</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: '#fffbeb' }]}>
                <Text style={[styles.badgeText, { color: '#d97706' }]}>
                  {isManager ? 'Chờ phân công' : 'Chờ tiếp nhận'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.incidentTitle}>{cleanTitle}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MapPin size={14} color="#64748b" />
              <Text style={styles.metaText}>{displayLoc}</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={14} color="#94a3b8" />
              <Text style={styles.metaTextTime}>Báo cáo: {formatDate(incident.createdAt)}</Text>
            </View>
          </View>

          {/* Assigned Staff Banner */}
          <View style={styles.assignSection}>
            <View style={styles.assignInfo}>
              <Text style={styles.assignLabel}>Nhân sự phụ trách:</Text>
              {isAssigned ? (
                <View style={styles.assignedNameRow}>
                  <Text style={styles.assignVal}>
                    👤 {incident.assignedTo?.fullName || 'Đã phân công'}
                  </Text>
                  {assignedRoleLabel ? (
                    <View
                      style={[
                        styles.roleBadge,
                        assignedRole === 'TECHNICIAN'
                          ? styles.roleBadgeTech
                          : styles.roleBadgeFarmer,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          assignedRole === 'TECHNICIAN'
                            ? styles.roleBadgeTextTech
                            : styles.roleBadgeTextFarmer,
                        ]}
                      >
                        {assignedRoleLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.assignValUnassigned}>Chưa phân công nhân sự</Text>
              )}
            </View>

            {/* Manager Assign Button */}
            {isManager && (
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={handleOpenAssignModal}
                activeOpacity={0.8}
              >
                <UserCheck size={14} color="#ffffff" />
                <Text style={styles.assignBtnText}>
                  {isAssigned ? 'Đổi phân công' : 'Phân công ngay'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Mô tả hiện trạng hiện trường</Text>
          <Text style={styles.descriptionText}>
            {cleanDescription || 'Không có mô tả chi tiết từ người báo cáo.'}
          </Text>
          <View style={styles.reporterInfo}>
            <Text style={styles.reporterText}>
              Người báo: {incident.reporter?.fullName || 'Nhân sự trang trại'} ({incident.reporter?.role || 'FARMER'})
            </Text>
          </View>
        </View>

        {/* Assigned Staff Quick Start Button (Only for assigned staff when OPEN) */}
        {!isManager && isAssignedToMe && incident.status === 'OPEN' && (
          <View style={styles.quickStartCard}>
            <Text style={styles.quickStartTitle}>Bạn được Quản lý phân công xử lý sự cố này</Text>
            <Text style={styles.quickStartDesc}>
              Bấm xác nhận bắt đầu khi bạn đã có mặt tại hiện trường để tiếp nhận công việc.
            </Text>
            <TouchableOpacity
              style={styles.quickStartBtn}
              onPress={handleStartRepair}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Wrench size={16} color="#ffffff" />
              <Text style={styles.quickStartBtnText}>
                {saving ? 'Đang cập nhật...' : 'Bắt đầu xử lý tại hiện trường'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress Timeline (Viewable by everyone) */}
        <View style={styles.sectionCard}>
          <View style={styles.timelineHeader}>
            <History size={16} color="#2563eb" />
            <Text style={styles.sectionTitle}>
              Nhật ký tiến trình xử lý ({incident.updates?.length || 0})
            </Text>
          </View>

          {incident.updates && incident.updates.length > 0 ? (
            <View style={styles.timelineList}>
              {incident.updates.map((up, idx) => (
                <View key={up.id || idx} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineMeta}>
                      <Text style={styles.timelineAuthor}>
                        {up.author?.fullName || 'Hệ thống'} ({up.author?.role || 'Nhân sự'})
                      </Text>
                      <Text style={styles.timelineTime}>{formatDate(up.createdAt)}</Text>
                    </View>
                    <Text style={styles.timelineTreatment}>{up.treatment}</Text>
                    {up.result ? (
                      <View style={styles.resultBox}>
                        <Text style={styles.resultLabel}>Kết quả nghiệm thu:</Text>
                        <Text style={styles.resultText}>{up.result}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyTimeline}>
              <Text style={styles.emptyTimelineText}>Chưa có cập nhật tiến trình nào.</Text>
            </View>
          )}
        </View>

        {/* Assigned Staff Progress Update Form: ONLY for the assigned staff when not resolved */}
        {!isManager && isAssignedToMe && !isResolved && (
          <View style={styles.updateFormCard}>
            <Text style={styles.formTitle}>Cập nhật tiến trình khắc phục</Text>

            <TextInput
              style={styles.textArea}
              placeholder="Ghi chú công việc đã làm (VD: Đã kiểm tra mô tơ, thay dây curoa...)"
              placeholderTextColor="#94a3b8"
              value={updateNote}
              onChangeText={setUpdateNote}
              multiline
              numberOfLines={3}
            />

            {/* Checkbox Complete */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsFinishing(!isFinishing)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, isFinishing && styles.checkboxActive]}>
                {isFinishing && <CheckCircle2 size={16} color="#ffffff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                Nghiệm thu hoàn tất & đóng sự cố này
              </Text>
            </TouchableOpacity>

            {isFinishing && (
              <TextInput
                style={[styles.textArea, { marginTop: 8 }]}
                placeholder="Kết quả nghiệm thu (VD: Quạt đã chạy êm, thiết bị đã ổn định)"
                placeholderTextColor="#94a3b8"
                value={resolveNote}
                onChangeText={setResolveNote}
                multiline
                numberOfLines={2}
              />
            )}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSaveProgress}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Send size={16} color="#ffffff" />
              <Text style={styles.submitBtnText}>
                {saving
                  ? 'Đang lưu...'
                  : isFinishing
                  ? 'Hoàn thành & Nghiệm thu sự cố'
                  : 'Lưu cập nhật tiến độ'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manager Reopen Box */}
        {isManager && isResolved && (
          <View style={styles.reopenCard}>
            {!showReopenBox ? (
              <TouchableOpacity
                style={styles.reopenTriggerBtn}
                onPress={() => setShowReopenBox(true)}
              >
                <RotateCcw size={16} color="#dc2626" />
                <Text style={styles.reopenTriggerText}>
                  Mở lại sự cố nếu sự cố tái phát
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.reopenForm}>
                <Text style={styles.reopenTitle}>Mở lại sự cố</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Nhập lý do mở lại sự cố (VD: Thiết bị vừa bật lại thì bị rung lắc)"
                  placeholderTextColor="#94a3b8"
                  value={reopenReason}
                  onChangeText={setReopenReason}
                  multiline
                  numberOfLines={2}
                />
                <View style={styles.reopenBtnRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowReopenBox(false)}
                  >
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmReopenBtn}
                    onPress={handleReopen}
                    disabled={saving}
                  >
                    <Text style={styles.confirmReopenText}>Xác nhận mở lại</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Assign Modal for Manager: Supports assigning to BOTH TECHNICIAN and FARMER */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Phân công xử lý sự cố</Text>
                <Text style={styles.modalSubtitle}>
                  Chọn Kỹ thuật viên (Tech) hoặc Công nhân (Farmer) phụ trách
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Role Filter Tabs inside Modal */}
            <View style={styles.modalRoleTabs}>
              {[
                ['ALL', `Tất cả (${staffList.length})`],
                ['TECHNICIAN', `Kỹ thuật (${staffList.filter((s) => s.role === 'TECHNICIAN').length})`],
                ['FARMER', `Công nhân (${staffList.filter((s) => s.role === 'FARMER').length})`],
              ].map(([key, label]) => {
                const isActive = staffRoleFilter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.modalRoleTab, isActive && styles.modalRoleTabActive]}
                    onPress={() => setStaffRoleFilter(key as StaffRoleFilter)}
                  >
                    <Text
                      style={[
                        styles.modalRoleTabText,
                        isActive && styles.modalRoleTabTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {loadingStaff ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color="#dc2626" />
                <Text style={styles.loadingText}>Đang tải danh sách nhân sự...</Text>
              </View>
            ) : filteredStaffList.length === 0 ? (
              <View style={styles.emptyStaffBox}>
                <Text style={styles.emptyStaffText}>Không có nhân sự nào trong mục này</Text>
              </View>
            ) : (
              <ScrollView style={styles.techList}>
                {filteredStaffList.map((staff) => {
                  const isSelected = selectedStaffId === staff.id;
                  const isTech = staff.role === 'TECHNICIAN';

                  return (
                    <TouchableOpacity
                      key={staff.id}
                      style={[styles.techItem, isSelected && styles.techItemActive]}
                      onPress={() => setSelectedStaffId(staff.id)}
                    >
                      <User size={16} color={isSelected ? '#dc2626' : '#64748b'} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.staffNameRow}>
                          <Text
                            style={[styles.techName, isSelected && styles.techNameActive]}
                          >
                            {staff.fullName}
                          </Text>
                          <View
                            style={[
                              styles.miniRoleBadge,
                              isTech ? styles.miniRoleBadgeTech : styles.miniRoleBadgeFarmer,
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniRoleBadgeText,
                                isTech
                                  ? styles.miniRoleBadgeTextTech
                                  : styles.miniRoleBadgeTextFarmer,
                              ]}
                            >
                              {isTech ? 'Kỹ thuật' : 'Công nhân'}
                            </Text>
                          </View>
                        </View>
                        {staff.email ? (
                          <Text style={styles.techEmail}>{staff.email}</Text>
                        ) : null}
                      </View>
                      {isSelected && <CheckCircle2 size={18} color="#dc2626" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.inputLabel}>Chỉ đạo / Hướng dẫn của Quản lý:</Text>
            <TextInput
              style={styles.textArea}
              placeholder="VD: Kiểm tra gấp dàn quạt số 2 hoặc thay van cống xả..."
              placeholderTextColor="#94a3b8"
              value={assignNote}
              onChangeText={setAssignNote}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAssignModal(false)}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAssignSubmit}
                disabled={saving}
              >
                <Text style={styles.modalSaveText}>
                  {saving ? 'Đang lưu...' : 'Xác nhận phân công'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
    marginTop: 8,
  },
  backBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  /* Header Card */
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  incidentTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  metaTextTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  assignSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  assignInfo: {
    flex: 1,
  },
  assignLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  assignedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  assignVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4f46e5',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeTech: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  roleBadgeFarmer: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleBadgeTextTech: {
    color: '#2563eb',
  },
  roleBadgeTextFarmer: {
    color: '#16a34a',
  },
  assignValUnassigned: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d97706',
    marginTop: 2,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  assignBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Description Section */
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  descriptionText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  reporterInfo: {
    marginTop: 4,
  },
  reporterText: {
    fontSize: 11,
    color: '#94a3b8',
  },

  /* Quick Start Card */
  quickStartCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    gap: 8,
  },
  quickStartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#312e81',
  },
  quickStartDesc: {
    fontSize: 12,
    color: '#4338ca',
    lineHeight: 18,
  },
  quickStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 6,
    gap: 8,
  },
  quickStartBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Timeline */
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineList: {
    marginTop: 6,
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginTop: 6,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  timelineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  timelineTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  timelineTreatment: {
    fontSize: 12,
    color: '#0f172a',
    lineHeight: 17,
  },
  resultBox: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  resultText: {
    fontSize: 12,
    color: '#065f46',
    marginTop: 2,
  },
  emptyTimeline: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyTimelineText: {
    fontSize: 12,
    color: '#94a3b8',
  },

  /* Update Form */
  updateFormCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 11,
    gap: 8,
    marginTop: 6,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Reopen */
  reopenCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  reopenTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  reopenTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  reopenForm: {
    gap: 8,
  },
  reopenTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
  reopenBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  confirmReopenBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  confirmReopenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalRoleTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  modalRoleTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalRoleTabActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  modalRoleTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  modalRoleTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  techList: {
    maxHeight: 200,
  },
  emptyStaffBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyStaffText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  techItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
    gap: 8,
  },
  techItemActive: {
    borderColor: '#dc2626',
    backgroundColor: '#fff1f2',
  },
  staffNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  techName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  techNameActive: {
    color: '#dc2626',
  },
  miniRoleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  miniRoleBadgeTech: {
    backgroundColor: '#eff6ff',
  },
  miniRoleBadgeFarmer: {
    backgroundColor: '#ecfdf5',
  },
  miniRoleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  miniRoleBadgeTextTech: {
    color: '#2563eb',
  },
  miniRoleBadgeTextFarmer: {
    color: '#16a34a',
  },
  techEmail: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  modalSaveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
