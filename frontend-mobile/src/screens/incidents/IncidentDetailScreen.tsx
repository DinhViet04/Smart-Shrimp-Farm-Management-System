import React, { useCallback, useContext, useEffect, useState } from 'react';
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
  Stethoscope,
  CheckCircle2,
  Clock,
  Package,
  Pill,
  FlaskConical,
  Send,
  Sparkles,
  User,
  Waves,
  Building2,
  RotateCcw,
  Copy,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  RefreshCw,
  Search,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import {
  incidentService,
  type Incident,
  type IncidentStatus,
  type IncidentTechnician,
} from '../../services/incidentService';
import { inventoryService, type InventoryItem } from '../../services/inventoryService';
import { chatbotService } from '../../services/chatbotService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type IncidentStackParamList = {
  IncidentList: undefined;
  IncidentDetail: { incidentId: string };
};

type WorkspaceTab = 'TREATMENT' | 'AI_ADVISOR' | 'TIMELINE';

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

export default function IncidentDetailScreen({
  route,
  navigation,
}: NativeStackScreenProps<IncidentStackParamList, 'IncidentDetail'>) {
  const { userToken, userRole, userId, currentUser } = useContext(AuthContext);
  const { incidentId } = route.params;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('TREATMENT');

  // ── Farm Manager Assignment State ──
  const [technicians, setTechnicians] = useState<IncidentTechnician[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);

  // ── Tab 1: Treatment Form & Inventory State ──
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [quantityUsed, setQuantityUsed] = useState<string>('');
  const [treatmentNote, setTreatmentNote] = useState<string>('');
  const [observationNote, setObservationNote] = useState<string>('');
  const [resultNote, setResultNote] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MEDICINE' | 'CHEMICAL'>('ALL');
  const [reopenReason, setReopenReason] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{
    quantityUsed?: string;
    treatmentNote?: string;
    reopenReason?: string;
  }>({});

  // ── Tab 2: AI Clinical Assistant State ──
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<
    { id: string; sender: 'user' | 'bot'; text: string; time: string }[]
  >([]);

  // 1. Fetch Incident Detail
  const loadIncident = useCallback(async () => {
    setLoading(true);
    try {
      const data = await incidentService.getById(incidentId);
      setIncident(data);

      const farmId = data.crop?.pond?.farm?.id;
      if (farmId) {
        // Load inventory for this farm
        loadInventory(farmId);
        // Load technicians if user can assign
        if (userRole === 'FARM_MANAGER') {
          loadTechnicians(farmId);
        }
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể tải chi tiết sự cố');
    } finally {
      setLoading(false);
    }
  }, [incidentId, userToken, userRole]);

  // 2. Fetch Medicines & Chemicals from Inventory
  const loadInventory = useCallback(async (farmId?: string) => {
    setLoadingInventory(true);
    try {
      const items = await inventoryService.getInventory(undefined, undefined, farmId);
      // Filter only Medicine and Chemical
      const medChem = items.filter(
        (i) => i.category === 'MEDICINE' || i.category === 'CHEMICAL'
      );
      setInventories(medChem);
    } catch {
      // Ignore inventory error
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  // Load Technicians for Farm Manager
  const loadTechnicians = useCallback(async (farmId: string) => {
    setLoadingTechnicians(true);
    try {
      const list = await incidentService.getTechnicians(farmId);
      setTechnicians(list);
    } catch {
      // Ignore
    } finally {
      setLoadingTechnicians(false);
    }
  }, []);

  // 3. Initial AI Diagnostic Analysis
  const runAIAnalysis = useCallback(async (inc: Incident) => {
    setAiLoading(true);
    const pondName = inc.crop?.pond?.name || 'ao nuôi';
    const farmName = inc.crop?.pond?.farm?.name || 'trang trại';
    const pondId = (inc.crop?.pond as any)?.id;
    const prompt = `Phân tích sự cố thủy sản: "${inc.title}". Mô tả triệu chứng: "${inc.description}" tại ao ${pondName} - ${farmName}. 
Hãy thực hiện 3 công việc:
1. Chẩn đoán các nguyên nhân có thể gây ra sự cố này.
2. Đưa ra danh sách thuốc hoặc hóa chất khuyên dùng cụ thể và liều lượng xử lý khuyến nghị.
3. Hướng dẫn các bước điều trị và theo dõi môi trường nước.`;

    try {
      const res = await chatbotService.ask(prompt, pondId);
      setAiAnalysis(res.answer);
      setChatHistory([
        {
          id: 'initial',
          sender: 'bot',
          text: res.answer,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setAiAnalysis('Chưa thể lấy phân tích tự động từ AI. Bạn có thể đặt câu hỏi bên dưới.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  useEffect(() => {
    if (incident && !aiAnalysis && !aiLoading) {
      runAIAnalysis(incident);
    }
  }, [incident, aiAnalysis, aiLoading, runAIAnalysis]);

  // ── Permissions ──
  const currentUserId = userId || (currentUser?.id ?? currentUser?.userId);
  const isAssignedToMe = Boolean(
    incident?.assignedToId && currentUserId && incident.assignedToId === currentUserId
  );
  const canTreat =
    userRole === 'TECHNICIAN'
      ? isAssignedToMe
      : userRole === 'FARM_MANAGER' || userRole === 'ADMIN';

  // ── Actions ──

  // Assign Technician (FARM_MANAGER only)
  const handleAssignTechnician = async (techId: string) => {
    if (!incident) return;
    setSaving(true);
    try {
      await incidentService.assign(incident.id, techId);
      setShowAssignPicker(false);
      await loadIncident();
      Alert.alert('Thành công', 'Đã phân công kỹ thuật viên phụ trách sự cố.');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể phân công kỹ thuật viên');
    } finally {
      setSaving(false);
    }
  };

  // Start Treatment (OPEN -> TREATING)
  const handleStartTreatment = async () => {
    if (!incident) return;
    setSaving(true);
    try {
      await incidentService.start(incident.id);
      await loadIncident();
      Alert.alert('Thành công', 'Đã chuyển sự cố sang trạng thái đang điều trị.');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể bắt đầu điều trị');
    } finally {
      setSaving(false);
    }
  };

  // Record Treatment Update & Deduct Inventory
  const handleSaveTreatment = async (shouldResolve = false) => {
    if (!incident) return;

    const errs: typeof formErrors = {};
    const selectedItem = inventories.find((i) => i.id === selectedInventoryId);

    if (selectedInventoryId && selectedItem) {
      const qtyNum = Number(quantityUsed);
      if (!quantityUsed || isNaN(qtyNum) || qtyNum <= 0) {
        errs.quantityUsed = 'Vui lòng nhập số lượng/liều lượng xuất lớn hơn 0.';
      } else if (qtyNum > selectedItem.quantity) {
        errs.quantityUsed = `Vượt quá tồn kho hiện có (${selectedItem.quantity} ${selectedItem.unit}).`;
      }
    } else if (!treatmentNote.trim()) {
      errs.treatmentNote = 'Vui lòng chọn thuốc/hóa chất từ kho hoặc nhập phác đồ điều trị.';
    }

    if (treatmentNote.trim().length > 2000) {
      errs.treatmentNote = 'Nội dung phác đồ không được vượt quá 2000 ký tự.';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      Alert.alert('Kiểm tra dữ liệu', Object.values(errs)[0]);
      return;
    }
    setFormErrors({});

    setSaving(true);
    try {
      // Step 0: If OPEN, start treatment automatically
      if (incident.status === 'OPEN') {
        try {
          await incidentService.start(incident.id);
        } catch {
          // ignore if already started
        }
      }

      let finalNote = treatmentNote.trim();
      if (!finalNote && selectedItem) {
        finalNote = `Sử dụng ${selectedItem.itemName} (${quantityUsed} ${selectedItem.unit}) để điều trị sự cố.`;
      }
      let fullTreatmentText = finalNote;

      // Step 1: Deduct inventory if selected
      if (selectedInventoryId && selectedItem) {
        const qtyNum = Number(quantityUsed);
        if (qtyNum > 0) {
          const pondId = (incident.crop?.pond as any)?.id;
          try {
            await inventoryService.recordUsage(selectedItem.id, {
              quantityUsed: qtyNum,
              notes: `[Điều trị sự cố: ${incident.title}] ${finalNote}`,
              pondId,
            });
            const invPrefix = `[Xuất kho: ${selectedItem.itemName} — ${qtyNum} ${selectedItem.unit}]`;
            fullTreatmentText = `${invPrefix} ${finalNote}`;
          } catch (e: any) {
            console.warn('Deduct inventory error:', e);
            Alert.alert('Lưu ý kho', `Không thể trừ kho vật tư: ${e.message || 'Lỗi không xác định'}`);
          }
        }
      }

      // Step 2: Add Treatment Update or Resolve
      if (!shouldResolve) {
        await incidentService.addUpdate(incident.id, {
          treatment: fullTreatmentText,
          observation: observationNote.trim() || undefined,
          result: resultNote.trim() || undefined,
        });
        Alert.alert('Thành công', 'Đã ghi nhận phương án điều trị & khấu trừ tồn kho thành công!');
      } else {
        await incidentService.resolve(incident.id, {
          treatment: fullTreatmentText || 'Đã hoàn tất điều trị sự cố.',
          result: resultNote.trim() || observationNote.trim() || undefined,
        });
        Alert.alert('Thành công', 'Đã hoàn tất điều trị và đóng sự cố thành công!');
      }

      // Reset form fields
      setSelectedInventoryId('');
      setQuantityUsed('');
      setTreatmentNote('');
      setObservationNote('');
      setResultNote('');

      await loadIncident();
      const farmId = incident.crop?.pond?.farm?.id;
      if (farmId) loadInventory(farmId);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu tiến trình điều trị.');
    } finally {
      setSaving(false);
    }
  };

  // Reopen Incident
  const handleReopen = async () => {
    if (!incident) return;
    if (!reopenReason.trim()) {
      setFormErrors((prev) => ({ ...prev, reopenReason: 'Vui lòng nhập lý do mở lại sự cố.' }));
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do mở lại sự cố.');
      return;
    }
    if (reopenReason.trim().length > 1000) {
      setFormErrors((prev) => ({ ...prev, reopenReason: 'Lý do mở lại không được vượt quá 1000 ký tự.' }));
      Alert.alert('Quá dài', 'Lý do mở lại không được vượt quá 1000 ký tự.');
      return;
    }
    setFormErrors((prev) => ({ ...prev, reopenReason: undefined }));
    setSaving(true);
    try {
      await incidentService.reopen(incident.id, reopenReason.trim());
      setReopenReason('');
      await loadIncident();
      Alert.alert('Thành công', 'Đã mở lại sự cố để tiếp tục theo dõi điều trị.');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể mở lại sự cố');
    } finally {
      setSaving(false);
    }
  };

  // Quick apply AI recommendation medicine into notes & form
  const handleQuickApplyMedicine = (medName: string) => {
    // Check if item exists in inventory
    const match = inventories.find(
      (inv) =>
        inv.itemName.toLowerCase().includes(medName.toLowerCase()) ||
        medName.toLowerCase().includes(inv.itemName.toLowerCase())
    );
    if (match) {
      setSelectedInventoryId(match.id);
      Alert.alert(
        'Đã chọn vật tư',
        `Đã chọn "${match.itemName}" từ kho (Tồn kho: ${match.quantity} ${match.unit})`
      );
    }
    setTreatmentNote((prev) =>
      prev ? `${prev}\n- Áp dụng: ${medName}` : `- Áp dụng phác đồ AI: ${medName}`
    );
    setActiveTab('TREATMENT');
  };

  // Follow-up question to AI
  const handleAskAI = async () => {
    if (!aiChatInput.trim() || aiLoading) return;
    const userText = aiChatInput.trim();
    setAiChatInput('');

    const newMsg = {
      id: Date.now().toString(),
      sender: 'user' as const,
      text: userText,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => [...prev, newMsg]);
    setAiLoading(true);

    try {
      const pondId = (incident?.crop?.pond as any)?.id;
      const prompt = `Đối với sự cố "${incident?.title}": ${userText}`;
      const res = await chatbotService.ask(prompt, pondId);

      setChatHistory((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot' as const,
          text: res.answer,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      Alert.alert('Lỗi', 'Không thể gửi câu hỏi đến trợ lý AI lúc này.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading && !incident) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Đang tải chi tiết sự cố & kho thuốc...</Text>
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.emptyTitle}>Không tìm thấy thông tin sự cố</Text>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[incident.status] || STATUS_CONFIG.OPEN;
  const StatusIcon = cfg.icon;

  const filteredInventory = inventories.filter((i) => {
    if (categoryFilter === 'MEDICINE' && i.category !== 'MEDICINE') return false;
    if (categoryFilter === 'CHEMICAL' && i.category !== 'CHEMICAL') return false;
    if (inventorySearch.trim()) {
      return i.itemName.toLowerCase().includes(inventorySearch.toLowerCase());
    }
    return true;
  });

  const selectedItem = inventories.find((i) => i.id === selectedInventoryId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── 1. Incident Master Summary Card ── */}
      <View style={styles.masterCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.pondTag}>
            <Waves size={14} color="#0284c7" />
            <Text style={styles.pondTagText}>{incident.crop?.pond?.name || 'Ao nuôi'}</Text>
            {incident.crop?.pond?.farm?.name && (
              <Text style={styles.farmTagText}>• {incident.crop.pond.farm.name}</Text>
            )}
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: cfg.bg, borderColor: cfg.border },
            ]}
          >
            <StatusIcon size={12} color={cfg.color} />
            <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
        </View>

        <Text style={styles.incidentTitle}>{incident.title}</Text>
        <Text style={styles.incidentDesc}>{incident.description}</Text>

        <View style={styles.metaDivider} />

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Người báo cáo:</Text>
            <Text style={styles.metaValue}>
              {incident.reporter?.fullName || 'Nông dân thực địa'}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Kỹ thuật phụ trách:</Text>
            <Text
              style={[
                styles.metaValue,
                isAssignedToMe ? { color: '#4f46e5', fontWeight: '800' } : {},
              ]}
            >
              {isAssignedToMe
                ? 'Bạn phụ trách (Chính)'
                : incident.assignedTo?.fullName || 'Chưa phân công'}
            </Text>
          </View>
        </View>

        {/* ── Farm Manager Technician Assignment Section ── */}
        {userRole === 'FARM_MANAGER' && incident.status !== 'RESOLVED' && (
          <View style={styles.managerAssignBox}>
            <View style={styles.managerAssignHeader}>
              <Text style={styles.managerAssignTitle}>Phân công Kỹ thuật viên:</Text>
              <TouchableOpacity
                onPress={() => setShowAssignPicker(!showAssignPicker)}
                style={styles.changeAssignBtn}
              >
                <Text style={styles.changeAssignBtnText}>
                  {showAssignPicker ? 'Đóng chọn' : 'Thay đổi phân công'}
                </Text>
                <ChevronDown size={14} color="#4f46e5" />
              </TouchableOpacity>
            </View>

            {showAssignPicker && (
              <View style={styles.assignPickerContainer}>
                {loadingTechnicians ? (
                  <ActivityIndicator size="small" color="#4f46e5" />
                ) : technicians.length === 0 ? (
                  <Text style={styles.noTechText}>
                    Trang trại chưa có kỹ thuật viên nào khác.
                  </Text>
                ) : (
                  technicians.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.techPickItem,
                        incident.assignedToId === t.id && styles.techPickItemActive,
                      ]}
                      onPress={() => handleAssignTechnician(t.id)}
                      disabled={saving}
                    >
                      <User size={14} color={incident.assignedToId === t.id ? '#ffffff' : '#475569'} />
                      <Text
                        style={[
                          styles.techPickItemText,
                          incident.assignedToId === t.id && styles.techPickItemTextActive,
                        ]}
                      >
                        {t.fullName} ({t.email})
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Permission Alert for Technicians ── */}
        {userRole === 'TECHNICIAN' && !isAssignedToMe && (
          <View style={styles.notAssignedWarningBox}>
            <ShieldAlert size={18} color="#b45309" />
            <View style={styles.warningTextWrap}>
              <Text style={styles.warningTitle}>Sự cố chưa được phân công cho bạn</Text>
              <Text style={styles.warningDesc}>
                Phụ trách: {incident.assignedTo?.fullName || 'Chưa phân công'}. Bạn có thể xem
                tiến trình và đối chiếu phác đồ AI.
              </Text>
            </View>
          </View>
        )}

        {/* ── Start Treatment Button (if OPEN and permitted) ── */}
        {incident.status === 'OPEN' && canTreat && (
          <TouchableOpacity
            style={styles.startTreatmentBtn}
            onPress={handleStartTreatment}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Stethoscope size={18} color="#ffffff" />
                <Text style={styles.startTreatmentBtnText}>
                  Bắt đầu điều trị sự cố ngay (Chuyển sang TREATING)
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── 2. Workspace Navigation Tabs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'TREATMENT' && styles.tabBtnActive]}
          onPress={() => setActiveTab('TREATMENT')}
        >
          <Stethoscope
            size={16}
            color={activeTab === 'TREATMENT' ? '#4f46e5' : '#64748b'}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'TREATMENT' && styles.tabBtnTextActive,
            ]}
          >
            Phác đồ & Kho thuốc
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'AI_ADVISOR' && styles.tabBtnActive]}
          onPress={() => setActiveTab('AI_ADVISOR')}
        >
          <Sparkles
            size={16}
            color={activeTab === 'AI_ADVISOR' ? '#4f46e5' : '#64748b'}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'AI_ADVISOR' && styles.tabBtnTextActive,
            ]}
          >
            Trợ lý AI
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'TIMELINE' && styles.tabBtnActive]}
          onPress={() => setActiveTab('TIMELINE')}
        >
          <Clock
            size={16}
            color={activeTab === 'TIMELINE' ? '#4f46e5' : '#64748b'}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'TIMELINE' && styles.tabBtnTextActive,
            ]}
          >
            Lịch sử ({incident.updates?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1: TREATMENT & INVENTORY WORKSPACE ── */}
      {activeTab === 'TREATMENT' && (
        <View style={styles.tabContent}>
          {incident.status === 'RESOLVED' ? (
            <View style={styles.resolvedBox}>
              <CheckCircle2 size={36} color="#059669" />
              <Text style={styles.resolvedTitle}>Sự cố này đã được điều trị thành công!</Text>
              <Text style={styles.resolvedDesc}>
                Các chỉ số ao và sức khỏe tôm đã ổn định trở lại.
              </Text>

              {/* Reopen form if symptoms return */}
              <View style={styles.reopenSection}>
                <Text style={styles.reopenLabel}>NẾU TRIỆU CHỨNG TÁI PHÁT (MỞ LẠI SỰ CỐ):</Text>
                <TextInput
                  style={[styles.textArea, formErrors.reopenReason && styles.inputError]}
                  multiline
                  placeholder="Nhập lý do mở lại sự cố (ví dụ: Tôm nổi đầu lại sau 2 ngày)..."
                  placeholderTextColor="#94a3b8"
                  value={reopenReason}
                  onChangeText={(val) => {
                    setReopenReason(val);
                    if (formErrors.reopenReason) {
                      setFormErrors((prev) => ({ ...prev, reopenReason: undefined }));
                    }
                  }}
                />
                {formErrors.reopenReason ? (
                  <Text style={styles.errorText}>{formErrors.reopenReason}</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.reopenBtn}
                  onPress={handleReopen}
                  disabled={saving}
                >
                  <RotateCcw size={16} color="#ffffff" />
                  <Text style={styles.reopenBtnText}>Xác nhận mở lại sự cố</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : !canTreat ? (
            <View style={styles.readOnlyBox}>
              <Text style={styles.readOnlyTitle}>Chế độ xem tiến trình</Text>
              <Text style={styles.readOnlyText}>
                Bạn không được phân công điều trị sự cố này nên không thể thực hiện xuất kho hay cập
                nhật phác đồ. Bạn vẫn có thể xem các cập nhật trước đó và tham khảo trợ lý AI ở tab bên cạnh.
              </Text>
            </View>
          ) : (
            <View style={styles.workspaceForm}>
              <View style={styles.formHeaderRow}>
                <View style={styles.formHeaderLeft}>
                  <Package size={20} color="#4f46e5" />
                  <Text style={styles.formTitle}>XUẤT KHO THUỐC & GHI NHẬN ĐIỀU TRỊ</Text>
                </View>
                <TouchableOpacity onPress={() => loadInventory(incident.crop?.pond?.farm?.id)}>
                  <RefreshCw size={15} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.formSubtitle}>
                Hệ thống tự động trừ tồn kho vật tư và tạo nhật ký xuất kho ngay khi ghi nhận.
              </Text>

              {/* Category selector */}
              <View style={styles.catFilterRow}>
                {[
                  ['ALL', 'Tất cả'],
                  ['MEDICINE', 'Thuốc / Men'],
                  ['CHEMICAL', 'Hóa chất / Vôi'],
                ].map(([cat, label]) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catFilterChip,
                      categoryFilter === cat && styles.catFilterChipActive,
                    ]}
                    onPress={() => setCategoryFilter(cat as any)}
                  >
                    <Text
                      style={[
                        styles.catFilterText,
                        categoryFilter === cat && styles.catFilterTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Inventory search input */}
              <View style={styles.invSearchBox}>
                <Search size={14} color="#94a3b8" />
                <TextInput
                  style={styles.invSearchInput}
                  placeholder="Lọc nhanh thuốc/hóa chất..."
                  placeholderTextColor="#94a3b8"
                  value={inventorySearch}
                  onChangeText={setInventorySearch}
                />
              </View>

              {/* Medicine items picker */}
              <Text style={styles.fieldLabel}>CHỌN VẬT TƯ SỬ DỤNG TỪ KHO:</Text>
              {loadingInventory ? (
                <View style={styles.invLoadingBox}>
                  <ActivityIndicator size="small" color="#4f46e5" />
                  <Text style={styles.invLoadingText}>Đang tải kho vật tư trang trại...</Text>
                </View>
              ) : (
                <View style={styles.invListContainer}>
                  {/* Option: Không xuất kho */}
                  <TouchableOpacity
                    style={[
                      styles.invCardItem,
                      !selectedInventoryId && styles.invCardItemActive,
                    ]}
                    onPress={() => setSelectedInventoryId('')}
                  >
                    <View style={styles.invCardLeft}>
                      <Text
                        style={[
                          styles.invCardName,
                          !selectedInventoryId && styles.invCardNameActive,
                        ]}
                      >
                        Không xuất kho
                      </Text>
                      <Text style={styles.invCardSub}>Chỉ ghi nhận phác đồ hướng dẫn</Text>
                    </View>
                  </TouchableOpacity>

                  {/* List of Medicines & Chemicals */}
                  {filteredInventory.length === 0 ? (
                    <Text style={styles.noInvText}>
                      Không tìm thấy thuốc/hóa chất phù hợp trong kho.
                    </Text>
                  ) : (
                    filteredInventory.map((item) => {
                      const isSelected = selectedInventoryId === item.id;
                      const isLow = item.quantity <= item.minThreshold;

                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.invCardItem,
                            isSelected && styles.invCardItemActive,
                            isLow && !isSelected && styles.invCardItemLow,
                          ]}
                          onPress={() => setSelectedInventoryId(item.id)}
                        >
                          <View style={styles.invCardLeft}>
                            <View style={styles.invBadgeRow}>
                              <Text
                                style={[
                                  styles.invCatBadge,
                                  item.category === 'MEDICINE'
                                    ? styles.invCatMedicine
                                    : styles.invCatChemical,
                                ]}
                              >
                                {item.category === 'MEDICINE' ? 'Thuốc' : 'Hóa chất'}
                              </Text>
                              <Text
                                style={[
                                  styles.invCardName,
                                  isSelected && styles.invCardNameActive,
                                ]}
                              >
                                {item.itemName}
                              </Text>
                            </View>
                            <Text style={styles.invCardSub}>
                              Tồn kho:{' '}
                              <Text style={{ fontWeight: '800', color: isSelected ? '#312e81' : '#0f172a' }}>
                                {item.quantity} {item.unit}
                              </Text>
                              {isLow ? ' (Sắp hết)' : ''}
                            </Text>
                          </View>
                          {isSelected && (
                            <CheckCircle2 size={18} color="#4f46e5" />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {/* Quantity Used Input */}
              {selectedItem && (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>
                    LIỀU LƯỢNG / SỐ LƯỢNG XUẤT SỬ DỤNG ({selectedItem.unit.toUpperCase()}):{' '}
                    <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <View style={styles.qtyInputRow}>
                    <TextInput
                      style={[styles.qtyInput, formErrors.quantityUsed && styles.inputError]}
                      keyboardType="numeric"
                      placeholder={`Ví dụ: 2.5`}
                      placeholderTextColor="#94a3b8"
                      value={quantityUsed}
                      onChangeText={(val) => {
                        setQuantityUsed(val);
                        if (formErrors.quantityUsed) {
                          setFormErrors((prev) => ({ ...prev, quantityUsed: undefined }));
                        }
                      }}
                    />
                    <Text style={styles.unitBadge}>{selectedItem.unit}</Text>
                  </View>
                  {formErrors.quantityUsed ? (
                    <Text style={styles.errorText}>{formErrors.quantityUsed}</Text>
                  ) : null}
                  <Text style={styles.stockNotice}>
                    Tồn kho khả dụng: {selectedItem.quantity} {selectedItem.unit}
                  </Text>
                </View>
              )}

              {/* Treatment Instructions */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>
                  PHÁC ĐỒ / HƯỚNG DẪN ĐIỀU TRỊ:{' '}
                  {!selectedInventoryId && <Text style={{ color: '#ef4444' }}>*</Text>}
                </Text>
                <TextInput
                  style={[styles.textArea, formErrors.treatmentNote && styles.inputError]}
                  multiline
                  placeholder="Ghi rõ cách pha chế, thời điểm tạt thuốc, các chú ý an toàn..."
                  placeholderTextColor="#94a3b8"
                  value={treatmentNote}
                  onChangeText={(val) => {
                    setTreatmentNote(val);
                    if (formErrors.treatmentNote) {
                      setFormErrors((prev) => ({ ...prev, treatmentNote: undefined }));
                    }
                  }}
                />
                {formErrors.treatmentNote ? (
                  <Text style={styles.errorText}>{formErrors.treatmentNote}</Text>
                ) : null}
              </View>

              {/* Observation */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>QUAN SÁT TÌNH TRẠNG SAU KHI XỬ LÝ:</Text>
                <TextInput
                  style={styles.textAreaSmall}
                  multiline
                  placeholder="Ví dụ: Tôm đã bớt nổi đầu sau 2 tiếng sục khí, màu nước ổn định..."
                  placeholderTextColor="#94a3b8"
                  value={observationNote}
                  onChangeText={setObservationNote}
                />
              </View>

              {/* Result Note */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>ĐÁNH GIÁ KẾT QUẢ / TIẾN TRÌNH KHỎI BỆNH:</Text>
                <TextInput
                  style={styles.textAreaSmall}
                  multiline
                  placeholder="Ví dụ: Tôm bơi nhanh nhẹn, ăn nhá bình thường, đạt chỉ tiêu..."
                  placeholderTextColor="#94a3b8"
                  value={resultNote}
                  onChangeText={setResultNote}
                />
              </View>

              {/* Form Action Buttons */}
              <View style={styles.formActionButtons}>
                <TouchableOpacity
                  style={styles.saveUpdateBtn}
                  onPress={() => handleSaveTreatment(false)}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Stethoscope size={18} color="#ffffff" />
                      <Text style={styles.saveUpdateBtnText}>
                        Ghi nhận cập nhật & Trừ kho
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resolveBtn}
                  onPress={() => handleSaveTreatment(true)}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <CheckCircle2 size={18} color="#ffffff" />
                  <Text style={styles.resolveBtnText}>
                    Đã điều trị xong & Đóng sự cố
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── TAB 2: AI CLINICAL ADVISOR WORKSPACE ── */}
      {activeTab === 'AI_ADVISOR' && (
        <View style={styles.tabContent}>
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <View style={styles.aiHeaderLeft}>
                <Sparkles size={20} color="#4f46e5" />
                <Text style={styles.aiCardTitle}>Trợ lý AI Phác đồ điều trị</Text>
              </View>
              {aiLoading && <ActivityIndicator size="small" color="#4f46e5" />}
            </View>

            <Text style={styles.aiSubtitle}>
              Tự động phân tích triệu chứng dựa trên kho tri thức chuyên sâu và đối soát kho thuốc.
            </Text>

            {/* Matching Stock Medicines Suggestion */}
            {inventories.length > 0 && (
              <View style={styles.aiStockMatchBox}>
                <Text style={styles.aiStockMatchTitle}>
                  📦 Vật tư kho trang trại sẵn có khuyên dùng:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {inventories.slice(0, 5).map((inv) => (
                    <TouchableOpacity
                      key={inv.id}
                      style={styles.quickMedChip}
                      onPress={() => handleQuickApplyMedicine(inv.itemName)}
                    >
                      <Pill size={12} color="#4f46e5" />
                      <Text style={styles.quickMedText}>{inv.itemName}</Text>
                      <Text style={styles.quickMedStock}>
                        ({inv.quantity} {inv.unit})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Chat History Messages */}
            <View style={styles.chatList}>
              {chatHistory.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubble,
                    msg.sender === 'user' ? styles.userBubble : styles.botBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.chatText,
                      msg.sender === 'user' ? styles.userText : styles.botText,
                    ]}
                  >
                    {msg.text}
                  </Text>
                  <Text
                    style={[
                      styles.chatTime,
                      msg.sender === 'user' ? { color: '#c7d2fe' } : { color: '#94a3b8' },
                    ]}
                  >
                    {msg.time}
                  </Text>

                  {/* Quick Action: Apply to form */}
                  {msg.sender === 'bot' && (
                    <TouchableOpacity
                      style={styles.applyBtn}
                      onPress={() => {
                        setTreatmentNote(msg.text);
                        setActiveTab('TREATMENT');
                        Alert.alert(
                          'Đã áp dụng',
                          'Phác đồ từ trợ lý AI đã được điền vào biểu mẫu điều trị!'
                        );
                      }}
                    >
                      <Copy size={12} color="#4f46e5" />
                      <Text style={styles.applyBtnText}>
                        Sao chép phác đồ này vào biểu mẫu
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Follow-up question input */}
            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiTextInput}
                placeholder="Hỏi thêm về liều lượng, thời điểm tạt..."
                placeholderTextColor="#94a3b8"
                value={aiChatInput}
                onChangeText={setAiChatInput}
              />
              <TouchableOpacity
                style={styles.aiSendBtn}
                onPress={handleAskAI}
                disabled={aiLoading}
              >
                <Send size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── TAB 3: TREATMENT TIMELINE ── */}
      {activeTab === 'TIMELINE' && (
        <View style={styles.tabContent}>
          <Text style={styles.formTitle}>LỊCH SỬ TIẾN TRÌNH ĐIỀU TRỊ</Text>

          {!incident.updates || incident.updates.length === 0 ? (
            <View style={styles.emptyBox}>
              <Clock size={32} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Chưa có lần cập nhật điều trị nào</Text>
            </View>
          ) : (
            <View style={styles.timelineList}>
              {incident.updates.map((update, idx) => (
                <View key={update.id || idx} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.authorName}>
                        {update.author?.fullName || 'Kỹ thuật viên'}
                      </Text>
                      <Text style={styles.timelineTime}>
                        {new Date(update.createdAt).toLocaleString('vi-VN')}
                      </Text>
                    </View>

                    <Text style={styles.treatmentText}>
                      <Text style={styles.boldLabel}>
                        {update.eventType === 'TREATMENT' || update.eventType === 'RESOLVED'
                          ? 'Điều trị: '
                          : 'Sự kiện: '}
                      </Text>
                      {update.treatment}
                    </Text>

                    {update.observation ? (
                      <Text style={styles.treatmentText}>
                        <Text style={styles.boldLabel}>Quan sát: </Text>
                        {update.observation}
                      </Text>
                    ) : null}

                    {update.result ? (
                      <Text style={styles.treatmentText}>
                        <Text style={styles.boldLabel}>Kết quả: </Text>
                        {update.result}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
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
    gap: 14,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  masterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pondTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pondTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
  },
  farmTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  incidentTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  incidentDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  managerAssignBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 8,
  },
  managerAssignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  managerAssignTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e40af',
  },
  changeAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  changeAssignBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  assignPickerContainer: {
    gap: 6,
    paddingTop: 4,
  },
  techPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  techPickItemActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  techPickItemText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  techPickItemTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  noTechText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  notAssignedWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  warningTextWrap: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  warningDesc: {
    fontSize: 11,
    color: '#92400e',
    marginTop: 2,
    lineHeight: 16,
  },
  startTreatmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
    marginTop: 4,
  },
  startTreatmentBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#4f46e5',
  },
  tabContent: {
    marginTop: 4,
  },
  readOnlyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  readOnlyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  readOnlyText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  workspaceForm: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1e1b4b',
    letterSpacing: 0.3,
  },
  formSubtitle: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  catFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  catFilterChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  catFilterChipActive: {
    backgroundColor: '#4f46e5',
  },
  catFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  catFilterTextActive: {
    color: '#ffffff',
  },
  invSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  invSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginTop: 4,
  },
  invLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  invLoadingText: {
    fontSize: 12,
    color: '#64748b',
  },
  invListContainer: {
    gap: 6,
    maxHeight: 220,
  },
  invCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  invCardItemActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f46e5',
  },
  invCardItemLow: {
    borderColor: '#fde68a',
    backgroundColor: '#fffdf5',
  },
  invCardLeft: {
    flex: 1,
    gap: 2,
  },
  invBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  invCatBadge: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  invCatMedicine: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  invCatChemical: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
  },
  invCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  invCardNameActive: {
    color: '#4338ca',
    fontWeight: '800',
  },
  invCardSub: {
    fontSize: 11,
    color: '#64748b',
  },
  noInvText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: 8,
  },
  inputGroup: {
    gap: 4,
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
  },
  qtyInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  unitBadge: {
    paddingHorizontal: 14,
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
  },
  stockNotice: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  textAreaSmall: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 55,
    textAlignVertical: 'top',
  },
  formActionButtons: {
    gap: 8,
    marginTop: 6,
  },
  saveUpdateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4f46e5',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  saveUpdateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  resolveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  resolvedBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 8,
  },
  resolvedTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#065f46',
    textAlign: 'center',
  },
  resolvedDesc: {
    fontSize: 12,
    color: '#047857',
    textAlign: 'center',
  },
  reopenSection: {
    width: '100%',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 14,
    gap: 8,
  },
  reopenLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d97706',
  },
  reopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d97706',
    paddingVertical: 11,
    borderRadius: 12,
  },
  reopenBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  aiCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  aiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e1b4b',
  },
  aiSubtitle: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  aiStockMatchBox: {
    backgroundColor: '#f5f3ff',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  aiStockMatchTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5b21b6',
  },
  quickMedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  quickMedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  quickMedStock: {
    fontSize: 10,
    color: '#6b7280',
  },
  chatList: {
    gap: 10,
    marginTop: 4,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 14,
    maxWidth: '92%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4f46e5',
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatText: {
    fontSize: 12,
    lineHeight: 18,
  },
  userText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  botText: {
    color: '#1e293b',
  },
  chatTime: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  applyBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f46e5',
  },
  aiInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  aiTextInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  aiSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineList: {
    gap: 12,
    marginTop: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#c7d2fe',
    paddingLeft: 12,
    marginLeft: 6,
  },
  timelineItem: {
    position: 'relative',
  },
  timelineDot: {
    position: 'absolute',
    left: -18,
    top: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4f46e5',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e1b4b',
  },
  timelineTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  treatmentText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  boldLabel: {
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyBox: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 30,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
    marginTop: 3,
  },
});
