import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  FlaskConical,
  Package,
  Pill,
  RefreshCw,
  Send,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { incidentService, type Incident, type IncidentUpdate } from '../../services/incident.service';
import { inventoryService } from '../../services/inventory.service';
import { chatbotService, type ChatbotResponse } from '../../services/chatbot.service';
import LoadingMotion from '../../components/LoadingMotion';

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

interface FieldErrors {
  selectedInventoryId?: string;
  quantityUsed?: string;
  treatmentNote?: string;
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
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [quantityUsed, setQuantityUsed] = useState<string>('');
  const [treatmentNote, setTreatmentNote] = useState<string>('');
  const [observationNote, setObservationNote] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MEDICINE' | 'CHEMICAL'>('ALL');
  
  // Validation state
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Action & Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // AI State
  const [aiLoading, setAiLoading] = useState(true);
  const [aiResponse, setAiResponse] = useState<ChatbotResponse | null>(null);
  const [aiError, setAiError] = useState<string>('');
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);

  const farmId = incident.crop?.pond?.farm?.id;
  const pondId = incident.crop?.pond?.id;
  const pondName = incident.crop?.pond?.name || 'Ao nuôi';
  const farmName = incident.crop?.pond?.farm?.name || 'Trang trại';

  // Can user perform treatment actions?
  const canUpdateTreatment =
    currentUserRole === 'TECHNICIAN'
      ? incidentDetail.assignedToId === currentUserId
      : currentUserRole === 'FARM_MANAGER' || currentUserRole === 'ADMIN';

  // 1. Fetch incident detail and inventory items
  const loadData = useCallback(async () => {
    setLoadingDetail(true);
    setLoadingInventory(true);
    try {
      const detail = await incidentService.getById(incident.id);
      setIncidentDetail(detail);
    } catch {
      // Use fallback prop if details fetch fails
    } finally {
      setLoadingDetail(false);
    }

    if (farmId) {
      try {
        const invData = await inventoryService.getAll('', 'ALL', farmId);
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
  }, [incident.id, farmId]);

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
Hãy thực hiện 3 công việc:
1. Chẩn đoán các nguyên nhân có thể gây ra sự cố này.
2. Đưa ra danh sách thuốc hoặc hóa chất khuyên dùng cụ thể và liều lượng xử lý khuyến nghị.
3. Hướng dẫn các bước điều trị và theo dõi môi trường nước.`;

    try {
      const res = await chatbotService.ask(prompt, pondId);
      setAiResponse(res);
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
      const prompt = `Đối với sự cố "${incident.title}" tại ${pondName}: ${userMsg}`;
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

  const selectedItem = inventories.find((i) => i.id === selectedInventoryId);

  // Clear field errors on change
  const handleInventorySelect = (id: string) => {
    setSelectedInventoryId(id);
    setFieldErrors((prev) => ({ ...prev, selectedInventoryId: undefined, quantityUsed: undefined }));
  };

  const handleQuantityChange = (val: string) => {
    setQuantityUsed(val);
    setFieldErrors((prev) => ({ ...prev, quantityUsed: undefined }));
  };

  const handleNoteChange = (val: string) => {
    setTreatmentNote(val);
    setFieldErrors((prev) => ({ ...prev, treatmentNote: undefined }));
  };

  // Validate form inputs
  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    if (selectedInventoryId) {
      const qty = Number(quantityUsed);
      if (!quantityUsed || isNaN(qty) || qty <= 0) {
        errors.quantityUsed = 'Vui lòng nhập số lượng/liều lượng lớn hơn 0.';
      } else if (selectedItem && qty > selectedItem.quantity) {
        errors.quantityUsed = `Vượt quá tồn kho hiện có (${selectedItem.quantity} ${selectedItem.unit}).`;
      }
    } else if (!treatmentNote.trim()) {
      errors.treatmentNote = 'Vui lòng chọn thuốc/hóa chất từ kho hoặc nhập phác đồ điều trị.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit treatment update + deduct inventory
  const handleRecordTreatment = async (shouldResolve = false) => {
    if (!validateForm()) {
      setNotice({ type: 'error', message: 'Vui lòng kiểm tra các trường bị lỗi bên dưới.' });
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
      if (!finalNote && selectedItem) {
        finalNote = `Sử dụng ${selectedItem.itemName} (${quantityUsed} ${selectedItem.unit}) để điều trị sự cố.`;
      }

      let fullTreatmentText = finalNote;

      // Step 1: Record inventory usage if an item is selected
      if (selectedInventoryId && selectedItem) {
        const qtyNum = Number(quantityUsed);

        const usagePayload: { quantityUsed: number; notes?: string; pondId?: string } = {
          quantityUsed: qtyNum,
        };

        if (finalNote && finalNote.trim()) {
          usagePayload.notes = `[Điều trị sự cố: ${incidentDetail.title}] ${finalNote.trim()}`;
        }

        if (pondId && typeof pondId === 'string' && pondId.trim()) {
          usagePayload.pondId = pondId.trim();
        }

        await inventoryService.recordUsage(selectedInventoryId, usagePayload);

        const usagePrefix = `[Xuất kho: ${selectedItem.itemName} — ${qtyNum} ${selectedItem.unit}]`;
        fullTreatmentText = `${usagePrefix} ${finalNote}`;
      }

      // Step 2: Record update or resolve incident
      if (shouldResolve) {
        await incidentService.resolve(incidentDetail.id, {
          treatment: fullTreatmentText || 'Đã hoàn tất điều trị sự cố.',
          result: observationNote.trim() || undefined,
        });
        setNotice({ type: 'success', message: 'Đã hoàn tất điều trị và trừ kho vật tư thành công!' });
      } else {
        await incidentService.addUpdate(incidentDetail.id, {
          treatment: fullTreatmentText,
          observation: observationNote.trim() || undefined,
        });
        setNotice({ type: 'success', message: 'Đã ghi nhận phương án điều trị & khấu trừ tồn kho!' });
      }

      // Reset form & reload data
      setSelectedInventoryId('');
      setQuantityUsed('');
      setTreatmentNote('');
      setObservationNote('');
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

  // Quick apply AI recommendation medicine into notes
  const quickApplyMedicine = (medName: string) => {
    // Check if item exists in inventory
    const match = inventories.find(
      (inv) => inv.itemName.toLowerCase().includes(medName.toLowerCase()) || medName.toLowerCase().includes(inv.itemName.toLowerCase())
    );
    if (match) {
      setSelectedInventoryId(match.id);
      setNotice({ type: 'success', message: `Đã chọn "${match.itemName}" từ kho (Tồn kho: ${match.quantity} ${match.unit})` });
      setFieldErrors((prev) => ({ ...prev, selectedInventoryId: undefined, quantityUsed: undefined }));
    }
    setTreatmentNote((prev) => (prev ? `${prev}\n- Áp dụng: ${medName}` : `- Áp dụng phác đồ AI: ${medName}`));
    setFieldErrors((prev) => ({ ...prev, treatmentNote: undefined }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Toast Notification */}
      {notice && (
        <div
          className={`fixed right-6 top-6 z-[100] flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-8 fade-in duration-300 ${
            notice.type === 'error'
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

      {/* Navigation Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/85 p-6 shadow-xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 shadow-xs transition-all hover:bg-slate-200 hover:-translate-x-0.5"
            title="Quay lại danh sách sự cố"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-800">{incidentDetail.title}</h1>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  incidentDetail.status === 'TREATING'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : incidentDetail.status === 'RESOLVED'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {incidentDetail.status === 'TREATING'
                  ? 'Đang điều trị'
                  : incidentDetail.status === 'RESOLVED'
                  ? 'Đã xử lý'
                  : 'Chờ xử lý'}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              <strong className="text-slate-700">{farmName}</strong> · {pondName} · Báo cáo ngày{' '}
              {new Date(incidentDetail.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loadingDetail}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
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
          {/* Card 1: Ban đầu & Chi tiết sự cố */}
          <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800">Thông tin ban đầu sự cố</h2>
                  <p className="text-xs text-slate-400">Dấu hiệu ghi nhận từ hiện trường</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {incidentDetail.description}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <span className="text-slate-400">Người báo cáo:</span>
                  <p className="mt-0.5 font-bold text-slate-700">
                    {incidentDetail.reporter?.fullName || 'Nông dân/Kỹ thuật viên'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <span className="text-slate-400">Phụ trách điều trị:</span>
                  <p className="mt-0.5 font-bold text-indigo-600">
                    {incidentDetail.assignedTo?.fullName || 'Chưa phân công'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Mục chọn Thuốc / Hóa chất link từ Kho */}
          <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800">
                    Chọn Thuốc / Hóa chất từ Kho & Ghi nhận điều trị
                  </h2>
                  <p className="text-xs text-slate-400">
                    Khấu trừ tự động tồn kho khi ghi nhận biện pháp
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

            <div className="mt-5 space-y-4">
              {/* Category selector */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Loại vật tư sử dụng
                  </label>
                  <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('ALL')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        categoryFilter === 'ALL'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('MEDICINE')}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        categoryFilter === 'MEDICINE'
                          ? 'bg-white text-emerald-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Pill className="h-3 w-3" /> Thuốc
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('CHEMICAL')}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        categoryFilter === 'CHEMICAL'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <FlaskConical className="h-3 w-3" /> Hóa chất
                    </button>
                  </div>
                </div>

                {/* Dropdown list of Inventory items */}
                <select
                  value={selectedInventoryId}
                  onChange={(e) => handleInventorySelect(e.target.value)}
                  disabled={!canUpdateTreatment || loadingInventory}
                  className={`w-full rounded-2xl border bg-white p-3.5 text-sm font-semibold text-slate-800 outline-none transition-colors ${
                    fieldErrors.selectedInventoryId
                      ? 'border-red-400 bg-red-50/30 focus:border-red-500'
                      : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                  } disabled:opacity-60`}
                >
                  <option value="">-- Chọn thuốc/hóa chất từ kho (Tùy chọn) --</option>
                  {availableInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category === 'MEDICINE' ? 'Thuốc' : 'Hóa chất'}] {item.itemName} — Còn kho: {item.quantity} {item.unit}
                    </option>
                  ))}
                </select>

                {selectedItem && (
                  <div className="mt-2 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-2 text-xs">
                    <span className="font-semibold text-indigo-900">
                      Mặt hàng đã chọn: <strong>{selectedItem.itemName}</strong>
                    </span>
                    <span className="font-bold text-indigo-700">
                      Tồn hiện tại: {selectedItem.quantity} {selectedItem.unit}
                    </span>
                  </div>
                )}
              </div>

              {/* Quantity Used Input */}
              {selectedInventoryId && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Liều lượng / Số lượng xuất sử dụng <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={quantityUsed}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder="Ví dụ: 2.5"
                      className={`w-full rounded-2xl border py-3 pl-4 pr-16 text-sm font-bold text-slate-800 outline-none transition-colors ${
                        fieldErrors.quantityUsed
                          ? 'border-red-400 bg-red-50/40 focus:border-red-500'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {selectedItem?.unit || 'đơn vị'}
                    </span>
                  </div>
                  {fieldErrors.quantityUsed && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {fieldErrors.quantityUsed}
                    </p>
                  )}
                </div>
              )}

              {/* Treatment details / Notes */}
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Phác đồ / Hướng dẫn điều trị {!selectedInventoryId && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={treatmentNote}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder="Ghi rõ cách pha chế, thời điểm tạt thuốc, các chú ý an toàn..."
                  disabled={!canUpdateTreatment}
                  className={`w-full rounded-2xl border p-3.5 text-sm outline-none transition-colors ${
                    fieldErrors.treatmentNote
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

              {/* Inline Notice Banner */}
              {notice && (
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200 ${
                    notice.type === 'error'
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
                  <button
                    type="button"
                    onClick={() => handleRecordTreatment(false)}
                    disabled={submitting || resolving}
                    className="flex-1 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" /> Đang lưu & trừ kho...
                      </span>
                    ) : (
                      'Ghi nhận cập nhật & Trừ kho'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRecordTreatment(true)}
                    disabled={submitting || resolving}
                    className="flex-1 rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-700 hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {resolving ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" /> Đang hoàn tất...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <Check className="h-4 w-4" /> Đã điều trị xong & Đóng sự cố
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Timeline of treatment updates */}
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
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">Chưa có nhật ký điều trị nào.</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI ANALYSIS & RECOMMENDATIONS (5 cols out of 12) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="sticky top-6 flex flex-col rounded-3xl border border-indigo-100 bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-900 p-6 text-white shadow-2xl backdrop-blur-xl min-h-[620px]">
            {/* AI Header */}
            <div className="flex items-center justify-between border-b border-indigo-800/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-lg shadow-cyan-500/20">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">Trợ lý AI Chẩn đoán</h2>
                    <span className="flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-extrabold text-cyan-300 border border-cyan-400/30">
                      <Sparkles className="h-3 w-3" /> Gemini
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/70">Phân tích sự cố & Gợi ý Thuốc/Hóa chất</p>
                </div>
              </div>

              <button
                onClick={runAIAnalysis}
                disabled={aiLoading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                title="Phân tích lại"
              >
                <RefreshCw className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* AI Content View */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 max-h-[520px]">
              {aiLoading && chatHistory.length === 0 ? (
                <div className="py-12">
                  <LoadingMotion
                    mode="card"
                    title="AI đang phân tích sự cố..."
                    subtitle="Đang quét dấu hiệu lâm sàng, tìm kiếm phác đồ điều trị và đối soát tồn kho..."
                    icon={<Bot className="w-10 h-10 text-cyan-400 animate-bounce" />}
                    color="teal"
                  />
                </div>
              ) : aiError ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300">
                  <p className="font-bold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Không thể chẩn đoán
                  </p>
                  <p className="mt-1">{aiError}</p>
                  <button
                    onClick={runAIAnalysis}
                    className="mt-3 rounded-xl bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700"
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stock Match Recommendations */}
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/40 p-4 text-xs">
                    <h3 className="flex items-center gap-1.5 font-bold text-cyan-300">
                      <Pill className="h-4 w-4 text-cyan-400" /> Vật tư kho tương thích đề xuất:
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
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
                              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 font-semibold text-white transition-all hover:bg-cyan-500/20 hover:border-cyan-400"
                            >
                              <span>{item.itemName}</span>
                              <span className="text-[10px] text-cyan-300">({item.quantity} {item.unit})</span>
                            </button>
                          ))
                      )}
                    </div>
                  </div>

                  {/* AI Chat History */}
                  {chatHistory.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${
                        msg.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[92%] rounded-2xl p-4 text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-slate-800/90 text-indigo-50 border border-indigo-700/40 rounded-bl-none shadow-md'
                        }`}
                      >
                        {msg.sender === 'ai' && (
                          <div className="mb-2 flex items-center gap-1.5 font-bold text-cyan-300">
                            <Bot className="h-3.5 w-3.5" /> Khuyên dùng & Phác đồ điều trị AI:
                          </div>
                        )}
                        <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                      </div>
                      <span className="text-[10px] text-slate-400 px-1">{msg.timestamp}</span>
                    </div>
                  ))}

                  {aiLoading && (
                    <div className="flex items-center gap-2 text-xs text-cyan-300 font-semibold p-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> AI đang soạn câu trả lời...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Interactive Chat Input */}
            <div className="mt-4 pt-3 border-t border-indigo-800/60">
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
                  className="flex-1 rounded-2xl border border-indigo-700/50 bg-slate-900/90 px-4 py-2.5 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
                <button
                  type="submit"
                  disabled={!aiChatInput.trim() || aiLoading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 disabled:opacity-50 transition-all"
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
