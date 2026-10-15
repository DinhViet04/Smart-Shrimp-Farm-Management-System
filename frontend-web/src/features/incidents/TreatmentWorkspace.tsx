import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  FlaskConical,
  Layers,
  Package,
  Pill,
  RefreshCw,
  Send,
  Stethoscope,
  Trash2,
  Waves,
} from 'lucide-react';
import { incidentService, type Incident, type IncidentUpdate } from '../../services/incident.service';
import { inventoryService } from '../../services/inventory.service';
import { chatbotService } from '../../services/chatbot.service';

interface InventoryItem {
  id: string;
  itemName: string;
  category: 'FEED' | 'MEDICINE' | 'CHEMICAL';
  quantity: number;
  unit: string;
  minThreshold: number;
  supplier?: { name: string } | null;
}

interface TreatmentWorkspaceProps {
  incident: Incident;
  onBack: () => void;
  currentUserRole: string;
  currentUserId?: string;
}

interface AIChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface SelectedTreatmentItem {
  inventoryId: string;
  item: InventoryItem;
  quantity: string;
  error?: string;
}

interface FieldErrors {
  treatmentNote?: string;
  resultNote?: string;
}

export default function TreatmentWorkspace({
  incident,
  onBack,
  currentUserRole,
  currentUserId,
}: TreatmentWorkspaceProps) {
  const [incidentDetail, setIncidentDetail] = useState<Incident>(incident);
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Inventory state
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [selectedItems, setSelectedItems] = useState<SelectedTreatmentItem[]>([]);
  const [treatmentNote, setTreatmentNote] = useState<string>('');
  const [observationNote, setObservationNote] = useState<string>('');
  const [resultNote, setResultNote] = useState<string>('');
  const [reopenReason, setReopenReason] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MEDICINE' | 'CHEMICAL'>('ALL');

  // Validation state
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Action & Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [isShrimpRecovered, setIsShrimpRecovered] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // AI State
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string>('');
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);

  const pondId = incidentDetail.crop?.pond?.id || incident.crop?.pond?.id;
  const pondName = incidentDetail.crop?.pond?.name || incident.crop?.pond?.name || 'Ao nuôi';
  const farmName = incidentDetail.crop?.pond?.farm?.name || incident.crop?.pond?.farm?.name || 'Trang trại';

  // Can user perform treatment actions?
  const canUpdateTreatment =
    currentUserRole === 'TECHNICIAN'
      ? incidentDetail.assignedToId === currentUserId
      : currentUserRole === 'FARM_MANAGER' || currentUserRole === 'ADMIN';

  // 1. Fetch incident detail and inventory items
  const loadData = useCallback(async () => {
    setLoadingDetail(true);
    setLoadingInventory(true);
    let targetFarmId = incidentDetail.crop?.pond?.farm?.id || incident.crop?.pond?.farm?.id;
    try {
      const detail = await incidentService.getById(incident.id);
      setIncidentDetail(detail);
      if (detail.crop?.pond?.farm?.id) {
        targetFarmId = detail.crop.pond.farm.id;
      }
    } catch {
      // Use fallback prop if details fetch fails
    } finally {
      setLoadingDetail(false);
    }

    if (targetFarmId) {
      try {
        const invData = await inventoryService.getAll('', 'ALL', targetFarmId);
        // Normalize array from response
        const items: InventoryItem[] = Array.isArray(invData)
          ? invData
          : invData.data || invData.content || [];
        setInventories(items);
      } catch (err) {
        console.error('Failed to load inventory:', err);
      } finally {
        setLoadingInventory(false);
      }
    } else {
      setLoadingInventory(false);
    }
  }, [incident.id, incident.crop?.pond?.farm?.id, incidentDetail.crop?.pond?.farm?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clear notice after timeout
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  // 2. Automatically request AI Analysis on mount
  const runAIAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    const prompt = `Phân tích sự cố thủy sản: "${incident.title}". 
Mô tả chi tiết: "${incident.description}". 
Địa điểm: ${pondName} - ${farmName}. 
Hãy thực hiện các nội dung sau:
1. Chẩn đoán các nguyên nhân có thể gây ra sự cố này và mức độ rủi ro.
2. Đối chiếu trực tiếp với danh mục thuốc & hóa chất hiện có trong kho trang trại:
   - Với thuốc/hóa chất CÓ SẴN TRONG KHO: Ghi rõ trạng thái [CÓ SẴN TRONG KHO], tồn kho thực tế, công dụng và liều lượng xử lý khuyến nghị.
   - Với thuốc/hóa chất KHO CHƯA CÓ: Hãy thông báo rõ ràng là [KHO HIỆN CHƯA CÓ THUỐC NÀY - Cần mua bổ sung], và BẮT BUỘC nêu đầy đủ công dụng, hoạt chất, liều lượng chuẩn và cách dùng chi tiết để kỹ thuật viên chủ động mua bên ngoài.
3. Hướng dẫn các bước điều trị, thời điểm tạt/trộn thức ăn và các chỉ số môi trường nước cần theo dõi sát sao.`;

    try {
      const res = await chatbotService.ask(prompt, pondId);
      setChatHistory([
        {
          id: 'init-ai-1',
          sender: 'ai',
          text: res.answer,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Không thể lấy kết quả phân tích từ AI.');
    } finally {
      setAiLoading(false);
    }
  }, [incident.title, incident.description, pondName, farmName, pondId]);

  useEffect(() => {
    runAIAnalysis();
  }, [runAIAnalysis]);

  // Handle asking AI a follow-up question
  const handleAskAI = async () => {
    if (!aiChatInput.trim() || aiLoading) return;
    const userMsg = aiChatInput.trim();
    setAiChatInput('');

    const userChat: AIChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsg,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => [...prev, userChat]);
    setAiLoading(true);

    try {
      const prompt = `Đối với sự cố "${incident.title}" tại ${pondName}: ${userMsg}. 
(Lưu ý: Đối chiếu trực tiếp với danh mục kho thuốc/hóa chất của trang trại. Thuốc nào có sẵn thì ghi rõ tồn kho và cách dùng; thuốc nào chưa có trong kho thì thông báo rõ là chưa có trong kho và BẮT BUỘC cung cấp đầy đủ công dụng, liều dùng, cách dùng để trang trại mua bổ sung).`;
      const res = await chatbotService.ask(prompt, pondId);
      const aiChat: AIChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, aiChat]);
    } catch {
      setNotice({ type: 'error', message: 'Không thể phản hồi câu hỏi lúc này.' });
    } finally {
      setAiLoading(false);
    }
  };

  // Filtered inventory items for treatment (Medicine & Chemical)
  const availableInventory = inventories.filter((item) => {
    if (categoryFilter === 'MEDICINE') return item.category === 'MEDICINE';
    if (categoryFilter === 'CHEMICAL') return item.category === 'CHEMICAL';
    return item.category === 'MEDICINE' || item.category === 'CHEMICAL';
  });

  // Add item to selected list
  const handleAddItem = (id: string) => {
    if (!id) return;
    const item = inventories.find((i) => i.id === id);
    if (!item) return;
    if (selectedItems.some((si) => si.inventoryId === id)) {
      setNotice({ type: 'error', message: `"${item.itemName}" đã có trong danh sách chọn.` });
      return;
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        inventoryId: id,
        item,
        quantity: '',
      },
    ]);
    setFieldErrors((prev) => ({ ...prev, treatmentNote: undefined }));
  };

  // Remove item from selected list
  const handleRemoveItem = (id: string) => {
    setSelectedItems((prev) => prev.filter((si) => si.inventoryId !== id));
  };

  // Update quantity for a selected item
  const handleItemQuantityChange = (id: string, val: string) => {
    setSelectedItems((prev) =>
      prev.map((si) => {
        if (si.inventoryId !== id) return si;
        const num = Number(val);
        let error: string | undefined;
        if (val && (!isNaN(num) && num > si.item.quantity)) {
          error = `Vượt tồn kho (Tối đa: ${si.item.quantity} ${si.item.unit})`;
        }
        return { ...si, quantity: val, error };
      })
    );
  };

  const handleNoteChange = (val: string) => {
    setTreatmentNote(val);
    setFieldErrors((prev) => ({ ...prev, treatmentNote: undefined }));
  };

  // Validate form inputs
  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    let hasItemError = false;

    if (selectedItems.length > 0) {
      const updated = selectedItems.map((si) => {
        const qty = Number(si.quantity);
        let err: string | undefined;
        if (!si.quantity || isNaN(qty) || qty <= 0) {
          err = 'Vui lòng nhập liều lượng > 0';
          hasItemError = true;
        } else if (qty > si.item.quantity) {
          err = `Vượt tồn kho (${si.item.quantity} ${si.item.unit})`;
          hasItemError = true;
        }
        return { ...si, error: err };
      });
      setSelectedItems(updated);
    } else if (!treatmentNote.trim()) {
      errors.treatmentNote = 'Vui lòng nhập biện pháp điều trị đã thực hiện hoặc chọn thuốc/hóa chất từ kho.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0 && !hasItemError;
  };

  // Submit treatment update + deduct inventory
  const handleRecordTreatment = async (shouldResolve = false) => {
    // 1. Validation khi bấm "Hoàn tất điều trị": bắt buộc xác nhận tôm đã hết bệnh và có kết quả đánh giá lâm sàng
    if (shouldResolve) {
      if (!isShrimpRecovered) {
        setNotice({
          type: 'error',
          message: 'Chỉ hoàn tất điều trị khi tôm đã hết bệnh! Nếu tôm vẫn đang điều trị hoặc cần theo dõi thêm, vui lòng nhấn "Lưu đợt điều trị (Tiếp tục điều trị)".',
        });
        return;
      }
      if (!resultNote.trim()) {
        setFieldErrors((prev) => ({
          ...prev,
          resultNote: 'Vui lòng nhập đánh giá lâm sàng xác nhận tôm đã hết bệnh (ví dụ: tôm ăn mạnh, gan ruột bình thường, tỷ lệ bệnh về 0%).',
        }));
        setNotice({
          type: 'error',
          message: 'Vui lòng nhập đánh giá lâm sàng xác nhận tôm đã hết bệnh trước khi hoàn tất điều trị.',
        });
        return;
      }
    }

    if (!validateForm()) {
      setNotice({ type: 'error', message: 'Vui lòng kiểm tra lại liều lượng các loại thuốc/hóa chất hoặc biện pháp điều trị.' });
      return;
    }

    if (shouldResolve) setResolving(true);
    else setSubmitting(true);
    setNotice(null);

    try {
      // Step 0: If incident status is OPEN, start treatment automatically first
      if (incidentDetail.status === 'OPEN') {
        try {
          await incidentService.startTreatment(incidentDetail.id);
        } catch {
          // If already started, ignore error
        }
      }

      let finalNote = treatmentNote.trim();
      const pondTag = pondName ? ` [${pondName}]` : '';
      const usageSummaries: string[] = [];

      // Step 1: Record inventory usage for each selected item
      if (selectedItems.length > 0) {
        for (const si of selectedItems) {
          const qtyNum = Number(si.quantity);
          const usagePayload: { quantityUsed: number; notes?: string; pondId?: string } = {
            quantityUsed: qtyNum,
            notes: `[Điều trị sự cố${pondTag}: ${incidentDetail.title}] ${finalNote || 'Xuất kho điều trị'}`,
          };

          if (pondId && typeof pondId === 'string' && pondId.trim()) {
            usagePayload.pondId = pondId.trim();
          }

          await inventoryService.recordUsage(si.inventoryId, usagePayload);
          usageSummaries.push(`${si.item.itemName} (${qtyNum} ${si.item.unit})`);
        }
      }

      if (!finalNote && usageSummaries.length > 0) {
        finalNote = `Sử dụng: ${usageSummaries.join(', ')} để điều trị sự cố.`;
      }

      let fullTreatmentText = finalNote;
      if (usageSummaries.length > 0) {
        const usagePrefix = `[Xuất kho ${pondName}: ${usageSummaries.join(', ')}]`;
        fullTreatmentText = finalNote ? `${usagePrefix} ${finalNote}` : usagePrefix;
      }

      // Step 2: Record update or resolve incident
      if (shouldResolve) {
        await incidentService.resolve(incidentDetail.id, {
          treatment: fullTreatmentText || 'Đã hoàn tất quá trình điều trị (Xác nhận tôm đã hết bệnh).',
          result: resultNote.trim() || undefined,
        });
        setNotice({
          type: 'success',
          message: 'Đã hoàn tất điều trị thành công! Tôm đã khỏi bệnh và sự cố được chuyển sang Lịch sử & Nhật ký điều trị.',
        });
      } else {
        await incidentService.addUpdate(incidentDetail.id, {
          treatment: fullTreatmentText,
          observation: observationNote.trim() || undefined,
          result: resultNote.trim() || undefined,
        });
        setNotice({
          type: 'success',
          message: selectedItems.length > 0
            ? `Đã lưu đợt điều trị và xuất kho ${selectedItems.length} loại vật tư! Bạn có thể tiếp tục điều trị nhiều đợt tiếp theo.`
            : 'Đã lưu đợt điều trị thành công! Sự cố tiếp tục được theo dõi trong Quá trình điều trị.',
        });
      }

      // Reset form & reload data
      setSelectedItems([]);
      setTreatmentNote('');
      setObservationNote('');
      setResultNote('');
      setIsShrimpRecovered(false);
      setFieldErrors({});
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Có lỗi xảy ra khi ghi nhận điều trị.',
      });
    } finally {
      setSubmitting(false);
      setResolving(false);
    }
  };

  // Reopen incident
  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng nhập lý do mở lại sự cố.' });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      await incidentService.reopen(incidentDetail.id, reopenReason.trim());
      setReopenReason('');
      setNotice({ type: 'success', message: 'Đã mở lại sự cố thành công!' });
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Có lỗi xảy ra khi mở lại sự cố.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Quick apply AI recommendation medicine into notes & selected items
  const quickApplyMedicine = (medName: string) => {
    // Check if item exists in inventory
    const match = inventories.find(
      (inv) =>
        inv.itemName.toLowerCase().includes(medName.toLowerCase()) ||
        medName.toLowerCase().includes(inv.itemName.toLowerCase())
    );
    if (match) {
      if (!selectedItems.some((si) => si.inventoryId === match.id)) {
        setSelectedItems((prev) => [
          ...prev,
          {
            inventoryId: match.id,
            item: match,
            quantity: '',
          },
        ]);
        setNotice({
          type: 'success',
          message: `Đã thêm "${match.itemName}" vào danh sách điều trị (Tồn kho: ${match.quantity} ${match.unit})`,
        });
      } else {
        setNotice({
          type: 'success',
          message: `"${match.itemName}" đã có sẵn trong danh sách điều trị`,
        });
      }
    }
    setTreatmentNote((prev) =>
      prev ? `${prev}\n- Áp dụng: ${medName}` : `- Áp dụng phác đồ AI: ${medName}`
    );
    setFieldErrors((prev) => ({ ...prev, treatmentNote: undefined }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Toast Notification */}
      {notice && (
        <div
          className={`fixed right-6 top-6 z-[100] flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-8 fade-in duration-300 ${notice.type === 'error'
            ? 'border-rose-200 bg-rose-50/95 text-rose-800'
            : 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
            }`}
        >
          {notice.type === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          )}
          <p className="text-sm font-bold leading-snug">{notice.message}</p>
        </div>
      )}

      {/* Navigation & Breadcrumb Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/90 p-5 sm:p-6 shadow-xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          {/* Breadcrumb path */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
            <button
              onClick={onBack}
              className="hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1 font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sự cố & Điều trị</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-indigo-600 font-bold">2. Quá trình điều trị</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-bold max-w-[260px] truncate">{incidentDetail.title}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800">{incidentDetail.title}</h1>
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
                incidentDetail.status === 'RESOLVED'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-700'
              }`}
            >
              {incidentDetail.status === 'RESOLVED' ? '✓ Đã hoàn tất điều trị' : '● Đang can thiệp điều trị'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Trang trại: <strong>{farmName}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-bold">
              <Waves className="w-3.5 h-3.5 text-cyan-600" />
              <span>Ao nuôi: <strong>{pondName}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                Vụ: <strong>{incidentDetail.crop?.stage === 'NURSERY' ? 'Ương' : 'Thương phẩm'}</strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Báo cáo: {new Date(incidentDetail.createdAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh sách</span>
          </button>
          <button
            onClick={loadData}
            disabled={loadingDetail}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loadingDetail ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT / MAIN COLUMN (7 cols out of 12) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Card: Thông tin ca bệnh & Dấu hiệu ao nuôi */}
          <div className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800">Thông tin ca bệnh & Dấu hiệu lâm sàng</h2>
                  <p className="text-[11px] text-slate-400">Dữ liệu ghi nhận từ ao nuôi</p>
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
                {incidentDetail.updates?.length || 0} đợt điều trị đã ghi
              </span>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Mô tả dấu hiệu lâm sàng:
                </label>
                <div className="mt-1 rounded-2xl bg-amber-50/60 p-3.5 text-xs leading-relaxed text-slate-800 border border-amber-200/60 font-medium">
                  {incidentDetail.description}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <span className="text-slate-400 text-[11px] font-medium">Người báo cáo:</span>
                  <p className="mt-0.5 font-bold text-slate-800">
                    {incidentDetail.reporter?.fullName || 'Nông dân / Kỹ thuật viên'}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {incidentDetail.reporter?.role === 'FARMER' ? 'Nông dân' : incidentDetail.reporter?.role === 'TECHNICIAN' ? 'Kỹ thuật viên' : 'Quản lý'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <span className="text-slate-400 text-[11px] font-medium">Phụ trách điều trị:</span>
                  <p className="mt-0.5 font-bold text-indigo-700">
                    {incidentDetail.assignedTo?.fullName || 'Chưa phân công'}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {incidentDetail.assignedTo?.email || 'Đang chờ chỉ định'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Cập nhật điều trị & Vật tư kho */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-800">
                        Cập nhật điều trị & Vật tư kho
                      </h2>
                      <p className="text-xs text-slate-400">
                        Ghi nhận biện pháp, theo dõi lâm sàng và khấu trừ kho vật tư
                      </p>
                    </div>
                  </div>
                  <Package className="h-5 w-5 text-indigo-400" />
                </div>

                {!canUpdateTreatment && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-semibold text-amber-800">
                    Chú ý: Bạn không được phân công điều trị sự cố này nên chỉ có thể xem tiến trình.
                  </div>
                )}

                {incidentDetail.status === 'RESOLVED' ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm font-semibold text-emerald-800 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold">Sự cố này đã được điều trị xong và đóng lại.</p>
                        {incidentDetail.resolvedAt && (
                          <p className="text-xs text-emerald-600 font-medium">Thời gian đóng: {new Date(incidentDetail.resolvedAt).toLocaleString('vi-VN')}</p>
                        )}
                      </div>
                    </div>

                    {(currentUserRole === 'FARM_MANAGER' || currentUserRole === 'ADMIN' || canUpdateTreatment) && (
                      <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                        <h4 className="font-black text-amber-900 text-sm">Mở lại sự cố</h4>
                        <textarea
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          rows={2}
                          placeholder="Lý do mở lại sự cố (ví dụ: tôm tái phát triệu chứng)..."
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={handleReopen}
                          disabled={submitting}
                          className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-amber-600 transition-all disabled:opacity-50"
                        >
                          {submitting ? 'Đang mở lại...' : 'Mở lại sự cố'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {/* Section 1: Chọn thuốc/hóa chất từ kho (Có thể chọn nhiều loại) */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-indigo-600" /> Xuất thuốc / Hóa chất từ kho (Có thể chọn nhiều loại)
                        </label>
                        <div className="flex gap-1 rounded-xl bg-white p-1 border border-slate-200/80 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setCategoryFilter('ALL')}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${categoryFilter === 'ALL'
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'text-slate-500 hover:text-slate-700'
                              }`}
                          >
                            Tất cả
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryFilter('MEDICINE')}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${categoryFilter === 'MEDICINE'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'text-slate-500 hover:text-slate-700'
                              }`}
                          >
                            <Pill className="h-3 w-3" /> Thuốc
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryFilter('CHEMICAL')}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${categoryFilter === 'CHEMICAL'
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-slate-500 hover:text-slate-700'
                              }`}
                          >
                            <FlaskConical className="h-3 w-3" /> Hóa chất
                          </button>
                        </div>
                      </div>

                      {/* Dropdown to add item */}
                      <div className="relative">
                        <select
                          value=""
                          onChange={(e) => {
                            handleAddItem(e.target.value);
                          }}
                          disabled={!canUpdateTreatment || loadingInventory}
                          className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 shadow-xs cursor-pointer"
                        >
                          <option value="">+ Chọn thuốc/hóa chất từ kho để thêm vào danh sách...</option>
                          {availableInventory.map((item) => {
                            const isChosen = selectedItems.some((si) => si.inventoryId === item.id);
                            return (
                              <option key={item.id} value={item.id} disabled={isChosen}>
                                [{item.category === 'MEDICINE' ? 'Thuốc' : 'Hóa chất'}] {item.itemName} — Còn kho: {item.quantity} {item.unit} {isChosen ? '✓ (Đã thêm)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* List of selected items */}
                      {selectedItems.length > 0 ? (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-0.5">
                            <span className="flex items-center gap-1.5 text-indigo-950 font-extrabold">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              Đã chọn ({selectedItems.length} loại vật tư):
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedItems([])}
                              className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              Xóa tất cả
                            </button>
                          </div>

                          {selectedItems.map((si) => (
                            <div
                              key={si.inventoryId}
                              className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs transition-all hover:border-indigo-200"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${si.item.category === 'MEDICINE'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}
                                  >
                                    {si.item.category === 'MEDICINE' ? (
                                      <Pill className="h-3 w-3" />
                                    ) : (
                                      <FlaskConical className="h-3 w-3" />
                                    )}
                                    {si.item.category === 'MEDICINE' ? 'Thuốc' : 'Hóa chất'}
                                  </span>
                                  <span className="font-extrabold text-sm text-slate-800">
                                    {si.item.itemName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  <span className="text-xs text-slate-500 font-medium">
                                    Tồn: <strong className="text-indigo-600 font-bold">{si.item.quantity} {si.item.unit}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(si.inventoryId)}
                                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                    title="Bỏ mặt hàng này"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2.5 flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-600 shrink-0">
                                  Liều lượng dùng <span className="text-red-500">*</span>:
                                </label>
                                <div className="relative flex-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={si.quantity}
                                    onChange={(e) => handleItemQuantityChange(si.inventoryId, e.target.value)}
                                    placeholder={`Nhập liều lượng (tối đa ${si.item.quantity})...`}
                                    className={`w-full rounded-xl border bg-slate-50/50 py-2 pl-3 pr-14 text-sm font-bold text-slate-800 outline-none transition-colors ${si.error
                                      ? 'border-red-400 bg-red-50/40 focus:border-red-500'
                                      : 'border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                                      }`}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                    {si.item.unit}
                                  </span>
                                </div>
                              </div>
                              {si.error && (
                                <p className="mt-1 text-right text-xs font-bold text-red-600 flex items-center justify-end gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {si.error}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 text-center text-xs text-slate-400">
                          <Package className="h-4 w-4 text-slate-300" />
                          Chưa chọn thuốc/hóa chất nào. Bạn có thể chọn nhiều loại thuốc & hóa chất ở menu trên để xuất dùng cùng lúc.
                        </div>
                      )}
                    </div>

                    {/* Section 2: Form Cập nhật điều trị Nhanh */}
                    <div className="space-y-4 pt-1">
                      {/* Field 1: Biện pháp điều trị đã thực hiện */}
                      <div>
                        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Biện pháp điều trị đã thực hiện {selectedItems.length === 0 && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          rows={3}
                          value={treatmentNote}
                          onChange={(e) => handleNoteChange(e.target.value)}
                          placeholder="Biện pháp điều trị đã thực hiện..."
                          disabled={!canUpdateTreatment}
                          className={`w-full rounded-2xl border p-3.5 text-sm outline-none transition-colors ${fieldErrors.treatmentNote
                            ? 'border-red-400 bg-red-50/40 focus:border-red-500'
                            : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                            } disabled:opacity-60`}
                        />
                        {fieldErrors.treatmentNote && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {fieldErrors.treatmentNote}
                          </p>
                        )}
                      </div>

                      {/* Field 2: Quan sát sau điều trị */}
                      <div>
                        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Quan sát sau điều trị <span className="text-slate-400 font-normal">(không bắt buộc)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={observationNote}
                          onChange={(e) => setObservationNote(e.target.value)}
                          placeholder="Quan sát sau điều trị (không bắt buộc)..."
                          disabled={!canUpdateTreatment}
                          className="w-full rounded-2xl border border-slate-200 p-3.5 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                        />
                      </div>

                      {/* Field 3: Kết quả & Đánh giá lâm sàng */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                            Kết quả & Đánh giá lâm sàng {isShrimpRecovered ? (
                              <span className="text-red-500 font-bold">* (Bắt buộc để đóng sự cố)</span>
                            ) : (
                              <span className="text-slate-400 font-normal">(không bắt buộc)</span>
                            )}
                          </label>
                          {isShrimpRecovered && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              ✓ Chế độ nghiệm thu khỏi bệnh
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          value={resultNote}
                          onChange={(e) => {
                            setResultNote(e.target.value);
                            if (fieldErrors.resultNote) {
                              setFieldErrors((prev) => ({ ...prev, resultNote: undefined }));
                            }
                          }}
                          placeholder={isShrimpRecovered 
                            ? "Nhập đánh giá tôm đã hết bệnh (ví dụ: Tôm đã ăn mạnh trở lại, đường ruột đầy thức ăn, gan tụy màu nâu đen đặc trưng, không còn tôm tấp mé/rớt đáy)..."
                            : "Ghi nhận kết quả sau đợt dùng thuốc (không bắt buộc nếu vẫn đang theo dõi)..."
                          }
                          disabled={!canUpdateTreatment}
                          className={`w-full rounded-2xl border p-3.5 text-sm outline-none transition-colors ${
                            fieldErrors.resultNote
                              ? 'border-red-400 bg-red-50/40 focus:border-red-500'
                              : isShrimpRecovered
                              ? 'border-emerald-300 bg-emerald-50/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                              : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                          } disabled:opacity-60`}
                        />
                        {fieldErrors.resultNote && (
                          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {fieldErrors.resultNote}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Khối xác nhận tôm hết bệnh để hoàn tất điều trị */}
                    <div className={`rounded-2xl border transition-all p-4 ${
                      isShrimpRecovered
                        ? 'border-emerald-300 bg-emerald-50/80 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                    }`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="confirmShrimpRecovered"
                          checked={isShrimpRecovered}
                          onChange={(e) => {
                            setIsShrimpRecovered(e.target.checked);
                            if (!e.target.checked && fieldErrors.resultNote) {
                              setFieldErrors((prev) => ({ ...prev, resultNote: undefined }));
                            }
                          }}
                          disabled={!canUpdateTreatment}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="confirmShrimpRecovered" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                          <span className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                            <CheckCircle2 className={`h-4 w-4 ${isShrimpRecovered ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span>Xác nhận tôm đã hết bệnh hoàn toàn & sức khỏe ao nuôi phục hồi</span>
                          </span>
                          <p className="mt-1 text-[11px] font-normal text-slate-600 leading-relaxed">
                            <strong>Lưu ý:</strong> Quá trình điều trị có thể nhập thuốc và can thiệp nhiều lần liên tiếp. Chỉ tích chọn xác nhận khi tôm đã thực sự khỏi bệnh để đóng sự cố và chuyển vào <strong>Lịch sử & Nhật ký điều trị</strong>.
                          </p>
                        </label>
                      </div>
                    </div>

                    {/* Inline Notice Banner */}
                    {notice && (
                      <div
                        className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200 ${notice.type === 'error'
                          ? 'border-rose-300 bg-rose-50 text-rose-800'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          }`}
                      >
                        {notice.type === 'error' ? (
                          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 animate-bounce" />
                        )}
                        <div className="flex-1 text-sm font-extrabold">{notice.message}</div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {canUpdateTreatment && (
                      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                        {/* Nút 1: Lưu đợt điều trị (tiếp tục theo dõi nhiều lần) */}
                        <button
                          type="button"
                          onClick={() => handleRecordTreatment(false)}
                          disabled={submitting || resolving}
                          className="flex-1 rounded-2xl bg-indigo-600 py-3.5 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
                        >
                          {submitting ? (
                            <span className="flex items-center justify-center gap-2">
                              <RefreshCw className="h-4 w-4 animate-spin" /> Đang lưu đợt điều trị...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-1.5">
                              <Stethoscope className="h-4 w-4" />
                              {selectedItems.length > 0 
                                ? `Lưu đợt điều trị & Trừ kho (${selectedItems.length} loại)` 
                                : 'Lưu đợt điều trị (Tiếp tục theo dõi)'}
                            </span>
                          )}
                        </button>

                        {/* Nút 2: Hoàn tất điều trị (chỉ khi tôm đã hết bệnh) */}
                        <button
                          type="button"
                          onClick={() => handleRecordTreatment(true)}
                          disabled={submitting || resolving}
                          className={`flex-1 rounded-2xl py-3.5 px-4 text-xs font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer ${
                            isShrimpRecovered
                              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'
                              : 'bg-slate-700 hover:bg-slate-800 opacity-90'
                          }`}
                          title={!isShrimpRecovered ? 'Vui lòng tích chọn "Xác nhận tôm đã hết bệnh" phía trên để hoàn tất điều trị' : undefined}
                        >
                          {resolving ? (
                            <span className="flex items-center justify-center gap-2">
                              <RefreshCw className="h-4 w-4 animate-spin" /> Đang hoàn tất...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-1.5">
                              <Check className="h-4 w-4" /> Hoàn tất điều trị (Tôm đã hết bệnh)
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2: Timeline nhật ký điều trị đã ghi nhận */}
              <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur-xl">
                <h3 className="flex items-center gap-2 font-black text-slate-800">
                  <Clock className="h-4 w-4 text-indigo-500" /> Nhật ký điều trị đã ghi nhận (
                  {incidentDetail.updates?.length || 0})
                </h3>

                <div className="mt-4 space-y-3">
                  {incidentDetail.updates && incidentDetail.updates.length > 0 ? (
                    incidentDetail.updates.map((upd: IncidentUpdate) => (
                      <div key={upd.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="flex items-center justify-between text-xs">
                          <strong className="text-slate-800">{upd.author?.fullName || 'Kỹ thuật viên'}</strong>
                          <span className="text-slate-400">
                            {new Date(upd.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700 leading-relaxed font-medium">
                          {upd.treatment}
                        </p>
                        {upd.observation && (
                          <p className="mt-1 text-xs text-slate-500 italic">
                            Quan sát: {upd.observation}
                          </p>
                        )}
                        {upd.result && (
                          <p className="mt-1 text-xs text-emerald-600 font-semibold">
                            Kết quả: {upd.result}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Chưa có nhật ký điều trị nào.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

        {/* RIGHT COLUMN: AI ANALYSIS & RECOMMENDATIONS (5 cols out of 12) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="sticky top-6 flex flex-col rounded-3xl border border-sky-200/90 bg-gradient-to-b from-[#e6f4fc] via-[#f0f8fd] to-[#dff0fa] p-6 text-slate-800 shadow-xl shadow-sky-900/5 backdrop-blur-xl min-h-[620px]">
            {/* AI Header */}
            <div className="flex items-center justify-between border-b border-sky-200/90 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 p-1 shadow-md shadow-sky-400/20 ring-2 ring-sky-300/70">
                  <img
                    src="/assets/treatment-robot-shrimp.png"
                    alt="Trợ lý Tôm AI"
                    className="h-full w-full object-contain drop-shadow"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-lg font-black text-sky-950">Smart Shrimp AI </h2>
                  </div>
                  <p className="text-xs text-sky-700/90 font-medium">Phân tích sự cố & Gợi ý Thuốc/Hóa chất</p>
                </div>
              </div>

              <button
                onClick={runAIAnalysis}
                disabled={aiLoading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 border border-sky-200 text-sky-700 hover:bg-sky-100/90 hover:text-sky-950 shadow-xs transition-all disabled:opacity-50"
                title="Phân tích lại"
              >
                <RefreshCw className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* AI Content View */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 max-h-[520px]">
              {aiLoading && chatHistory.length === 0 ? (
                <div className="py-10">
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-sky-200/70 bg-white/85 p-8 text-center shadow-sm backdrop-blur-sm">
                    <div className="relative mb-3 flex h-20 w-20 items-center justify-center">
                      <div className="absolute inset-0 animate-ping rounded-full bg-sky-400/20" />
                      <img
                        src="/assets/treatment-robot-shrimp.png"
                        alt="Trợ lý Tôm AI"
                        className="relative h-18 w-18 object-contain drop-shadow-md animate-bounce"
                      />
                    </div>
                    <h4 className="text-sm font-bold text-sky-950">AI đang phân tích sự cố...</h4>
                    <p className="mt-1 max-w-xs text-xs text-sky-700/80 leading-relaxed">
                      Đang quét dấu hiệu lâm sàng, tìm kiếm phác đồ điều trị và đối soát tồn kho ao nuôi...
                    </p>
                  </div>
                </div>
              ) : aiError ? (
                <div className="rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-xs text-rose-800 shadow-sm">
                  <p className="font-bold flex items-center gap-2 text-rose-700">
                    <AlertCircle className="h-4 w-4" /> Không thể chẩn đoán
                  </p>
                  <p className="mt-1 text-rose-600">{aiError}</p>
                  <button
                    onClick={runAIAnalysis}
                    className="mt-3 rounded-xl bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700 shadow-sm"
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stock Match Recommendations */}
                  <div className="rounded-2xl border border-sky-200/90 bg-white/90 p-4 text-xs shadow-sm">
                    <h3 className="flex items-center gap-1.5 font-bold text-sky-950">
                      <Pill className="h-4 w-4 text-sky-600" /> Vật tư kho tương thích đề xuất:
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {inventories.filter(i => i.category === 'MEDICINE' || i.category === 'CHEMICAL').length === 0 ? (
                        <span className="text-slate-400 italic">Chưa có thuốc/hóa chất trong kho</span>
                      ) : (
                        inventories
                          .filter((i) => i.category === 'MEDICINE' || i.category === 'CHEMICAL')
                          .slice(0, 4)
                          .map((item) => (
                            <button
                              key={item.id}
                              onClick={() => quickApplyMedicine(item.itemName)}
                              className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-1.5 font-semibold text-sky-900 transition-all hover:bg-sky-100 hover:border-sky-300 hover:shadow-xs"
                            >
                              <span>{item.itemName}</span>
                              <span className="text-[10px] text-sky-600 font-bold">({item.quantity} {item.unit})</span>
                            </button>
                          ))
                      )}
                    </div>
                  </div>

                  {/* AI Chat History */}
                  {chatHistory.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'
                        }`}
                    >
                      <div
                        className={`max-w-[92%] rounded-2xl p-4 text-xs leading-relaxed ${msg.sender === 'user'
                          ? 'bg-sky-600 text-white rounded-br-none shadow-sm'
                          : 'bg-white/95 text-slate-800 border border-sky-200/90 rounded-bl-none shadow-sm'
                          }`}
                      >
                        {msg.sender === 'ai' && (
                          <div className="mb-2 flex items-center gap-2 border-b border-sky-100 pb-2 font-bold text-sky-900">
                            <img
                              src="/assets/treatment-robot-shrimp.png"
                              alt="AI Mascot"
                              className="h-5 w-5 rounded-full object-contain bg-sky-50 border border-sky-200 p-0.5"
                            />
                            <span>Khuyên dùng & Phác đồ điều trị AI:</span>
                          </div>
                        )}
                        <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                      </div>
                      <span className="text-[10px] text-sky-800/60 font-medium px-1">{msg.timestamp}</span>
                    </div>
                  ))}

                  {aiLoading && (
                    <div className="flex items-center gap-2 text-xs text-sky-800 font-semibold p-2.5 rounded-xl bg-white/70 border border-sky-200/70 shadow-xs">
                      <img
                        src="/assets/treatment-robot-shrimp.png"
                        alt="AI"
                        className="h-5 w-5 rounded-full object-contain animate-bounce bg-sky-50 p-0.5"
                      />
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600" />
                      <span>Trợ lý Tôm AI đang soạn câu trả lời...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Interactive Chat Input */}
            <div className="mt-4 pt-3 border-t border-sky-200/90">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskAI();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  placeholder="Hỏi AI thêm về phác đồ hay cách dùng thuốc..."
                  disabled={aiLoading}
                  className="flex-1 rounded-2xl border border-sky-200 bg-white px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-200 shadow-xs"
                />
                <button
                  type="submit"
                  disabled={!aiChatInput.trim() || aiLoading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white font-bold hover:bg-sky-600 disabled:opacity-40 transition-all shadow-sm shadow-sky-500/25"
                  title="Gửi câu hỏi"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
