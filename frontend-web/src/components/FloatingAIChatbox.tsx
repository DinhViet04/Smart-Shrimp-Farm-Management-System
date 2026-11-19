import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  X,
  ArrowUp,
  SquarePen,
  History,
  Trash2,
  MessageSquare,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Compass,
  Search,
  MessageCircle,
  Calendar,
  AlertTriangle,
  Building2,
  Waves,
  Droplets,
  CheckCircle2,
  Loader2,
  Sparkles,
  Plus,
  FileSpreadsheet,
  Download,
  Package,
} from 'lucide-react';
import {
  chatbotService,
  type ChatbotSource,
  type RealtimeWeather,
  type AgentActionDraft,
} from '../services/chatbot.service';
import { apiFetch } from '../utils/api';
import WaterRecordCard from './WaterRecordCard';
import CropCreateCard from './CropCreateCard';
import { getErrorMessage } from '../utils/errors';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  sources?: ChatbotSource[];
  pondName?: string;
  sourceType?: 'LOCAL_DOCUMENT' | 'OPENAI_KNOWLEDGE' | 'HYBRID';
  hasLocalKnowledge?: boolean;
  weather?: RealtimeWeather;
  actionDraft?: AgentActionDraft;
  /** Tin nhắn kết thúc phiếu đang chờ (hủy, không đủ quyền...) -> khóa các phiếu trước đó */
  endsPendingAction?: boolean;
}

/** Phiếu tạo trang trại / ao / vụ: chỉ phiếu mới nhất còn hiệu lực */
const CREATE_INTENTS = ['CREATE_FARM', 'CREATE_POND', 'CREATE_CROP'];

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

// Lịch sử chat được lưu RIÊNG theo từng tài khoản (khóa gắn với user id)
const STORAGE_KEY_PREFIX = 'ssfm_chatgpt_style_sessions_v3';
const ACTIVE_SESSION_KEY_PREFIX = 'ssfm_chatgpt_active_session_id_v3';
// Khóa cũ dùng chung cho mọi tài khoản -> xóa để không lộ lịch sử chat giữa các tài khoản
// Vị trí nút Tôm AI do người dùng kéo thả (lưu theo trình duyệt)
const LAUNCHER_POS_KEY = 'ssfm_ai_launcher_dock_v2';
const LEGACY_LAUNCHER_POS_KEY = 'ssfm_ai_launcher_pos_v1';
type LauncherDock = { side: 'left' | 'right'; y: number };
const LAUNCHER_MARGIN = 24; // khoảng cách mặc định tới mép dưới
const SIDE_GAP = 16;        // khoảng cách từ nút tới viền trái/phải khi đã bám viền
const EDGE_GAP = 8;         // khoảng cách tối thiểu tới mép màn hình
const WINDOW_GAP = 12;      // khoảng cách giữa nút và khung chat
const DRAG_THRESHOLD = 5;   // px: di chuyển ít hơn mức này vẫn tính là click

const clampLauncher = (x: number, y: number, size: number, vw: number, vh: number) => ({
  x: Math.min(Math.max(EDGE_GAP, x), Math.max(EDGE_GAP, vw - size - EDGE_GAP)),
  y: Math.min(Math.max(EDGE_GAP, y), Math.max(EDGE_GAP, vh - size - EDGE_GAP)),
});

// Class đầy đủ để Tailwind sinh CSS (không ghép chuỗi động)
const WINDOW_ORIGIN = {
  'bottom-right': 'origin-bottom-right',
  'bottom-left': 'origin-bottom-left',
  'top-right': 'origin-top-right',
  'top-left': 'origin-top-left',
} as const;

const LEGACY_SHARED_KEYS =['ssfm_chatgpt_style_sessions_v2', 'ssfm_chatgpt_active_session_id_v2'];

const getChatOwnerId = (): string => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.id || user?.userId || 'guest';
  } catch {
    return 'guest';
  }
};

const createNewSession = (title = 'Cuộc trò chuyện mới'): ChatSession => {
  const now = new Date();
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    createdAt: now.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    updatedAt: now.toISOString(),
    messages: [
      {
        id: 'welcome-chatgpt',
        sender: 'ai',
        text: `Tôi có thể giúp gì cho vụ nuôi tôm của bạn hôm nay?`,
        time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ],
  };
};

const stripReferenceSources = (text: string): string => {
  if (!text) return '';
  return text
    .replace(
      /(?:\r?\n)+\s*(?:📖\s*|📚\s*)?(?:Nguồn\s*(?:tham\s*khảo|trích\s*dẫn)?|Tài\s*liệu\s*tham\s*khảo|Cẩm\s*nang\s*tham\s*khảo)[\s\S]*$/i,
      '',
    )
    .trim();
};

/**
 * Khung chat được mount lại (key = user id) mỗi khi đổi tài khoản đăng nhập,
 * để state trong bộ nhớ và lịch sử chat không bị dùng chung giữa các tài khoản.
 */
export default function FloatingAIChatbox() {
  useLocation(); // re-render khi điều hướng (đăng nhập / đăng xuất) để nhận user mới
  const ownerId = getChatOwnerId();

  useEffect(() => {
    try {
      LEGACY_SHARED_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }, []);

  return <ChatboxForUser key={ownerId} ownerId={ownerId} />;
}

function ChatboxForUser({ ownerId }: { ownerId: string }) {
  const STORAGE_KEY = `${STORAGE_KEY_PREFIX}:${ownerId}`;
  const ACTIVE_SESSION_KEY = `${ACTIVE_SESSION_KEY_PREFIX}:${ownerId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // ── Vị trí nút Tôm AI: luôn bám viền trái/phải, kéo lên xuống tự do ──
  // null = vị trí mặc định (viền phải, sát đáy)
  const [dock, setDock] = useState<LauncherDock | null>(() => {
    try {
      localStorage.removeItem(LEGACY_LAUNCHER_POS_KEY);
      const raw = localStorage.getItem(LAUNCHER_POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return (p?.side === 'left' || p?.side === 'right') && typeof p?.y === 'number' ? p : null;
    } catch {
      return null;
    }
  });
  // Vị trí tạm thời trong lúc đang kéo (null khi không kéo)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [isDragging, setIsDragging] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // File upload state (chỉ dành cho Quản lý / Admin)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nhận diện vai trò người dùng hiện tại
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  // Nhập kho bằng tệp qua AI chỉ dành cho Quản lý trang trại (ADMIN chỉ giám sát, backend từ chối)
  const canUploadInventoryFile = currentUser?.role === 'FARM_MANAGER';

  // Tab điều hướng riêng biệt: 'chat' hoặc 'history'
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [executedActions, setExecutedActions] = useState<
    Record<string, { success: boolean; message: string; redirectTab?: string }>
  >({});
  const [activePendingAction, setActivePendingAction] = useState<any>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Khởi tạo sessions từ localStorage
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Lỗi khi đọc session từ localStorage:', e);
    }
    return [createNewSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (savedId) return savedId;
    } catch (e) {
      console.error('Lỗi khi đọc activeSessionId:', e);
    }
    return sessions[0]?.id || '';
  });

  const currentSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || createNewSession();
  const messages = currentSession.messages;
  const isTechnician = currentUser?.role === 'TECHNICIAN';
  // Chỉ thẻ thông số nước mới nhất được phép chỉnh sửa/lưu (tránh lưu trùng từ thẻ cũ)
  const latestWaterCardId = [...messages]
    .reverse()
    .find((m) => m.actionDraft?.intent === 'RECORD_WATER_QUALITY' && m.actionDraft.pondOptions?.length)?.id;
  const isFarmManager = currentUser?.role === 'FARM_MANAGER';
  // Phiếu / thẻ tạo trang trại, ao, vụ nuôi còn hiệu lực = phiếu tạo mới nhất, chưa bị hủy bởi
  // tin nhắn sau. Sửa phiếu sẽ sinh phiếu mới -> phiếu cũ bị khóa, tránh bấm nhầm tạo trùng.
  const latestCreateDraftId = [...messages]
    .reverse()
    .find((m) => m.endsPendingAction || (m.actionDraft && CREATE_INTENTS.includes(m.actionDraft.intent)))?.id;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Lưu sessions vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      if (activeSessionId) {
        localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
      }
    } catch (e) {
      console.error('Lỗi khi lưu localStorage:', e);
    }
  }, [sessions, activeSessionId, STORAGE_KEY, ACTIVE_SESSION_KEY]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [isOpen, messages, isTyping, activeTab]);

  // Tự co giãn chiều cao textarea theo nội dung gõ
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputMessage]);

  const handleNewChat = () => {
    const newSession = createNewSession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setActiveTab('chat');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => textareaRef.current?.focus(), 200);
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setActiveTab('chat');
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh = createNewSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearAllHistory = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    const fresh = createNewSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setActiveTab('chat');
    setShowClearConfirm(false);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputMessage).trim();
    if ((!text && !selectedFile) || isTyping) return;

    const fileToUpload = selectedFile;
    const displayText = fileToUpload
      ? text
        ? `📎 [Đính kèm tệp: ${fileToUpload.name}]\n${text}`
        : `📎 Tải lên tệp: ${fileToUpload.name}`
      : text;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: displayText,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    let newTitle = currentSession.title;
    if (currentSession.title === 'Cuộc trò chuyện mới') {
      const titleCandidate =
        text || (fileToUpload ? `Nhập kho từ ${fileToUpload.name}` : 'Cuộc trò chuyện mới');
      newTitle = titleCandidate.length > 32 ? titleCandidate.slice(0, 32) + '...' : titleCandidate;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSession.id
          ? { ...s, title: newTitle, updatedAt: new Date().toISOString(), messages: updatedMessages }
          : s,
      ),
    );

    if (overrideText === undefined) setInputMessage('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsTyping(true);

    try {
      const historyContext = updatedMessages
        .slice(-6)
        .map((m) => ({ sender: m.sender, text: m.text }));
      let result;

      if (fileToUpload) {
        result = await chatbotService.uploadAndParse(fileToUpload, text, historyContext);
      } else {
        result = await chatbotService.ask(text, undefined, historyContext, activePendingAction);
      }

      if (result.clearPendingAction) {
        setActivePendingAction(null);
      } else if (result.actionDraft?.type === 'SLOT_FILLING') {
        setActivePendingAction({
          intent: result.actionDraft.intent,
          collectedData: result.actionDraft.collectedData,
        });
      } else if (result.actionDraft?.type === 'CONFIRM_ACTION') {
        // Giữ dữ liệu phiếu để người dùng có thể ra lệnh sửa trước khi lưu
        // (vd "sửa pH 8.1", "đổi diện tích thành 1500m2", "tạo 4 ao thay vì 3")
        const editableIntents = ['RECORD_WATER_QUALITY', 'CREATE_FARM', 'CREATE_POND', 'CREATE_CROP'];
        setActivePendingAction(
          editableIntents.includes(result.actionDraft.intent)
            ? { intent: result.actionDraft.intent, collectedData: result.actionDraft.collectedData }
            : null,
        );
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: stripReferenceSources(result.answer),
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        sources: [],
        pondName: result.pondName,
        sourceType: result.sourceType,
        hasLocalKnowledge: result.hasLocalKnowledge,
        weather: undefined,
        actionDraft: result.actionDraft,
        endsPendingAction: result.clearPendingAction || undefined,
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession.id
            ? { ...s, updatedAt: new Date().toISOString(), messages: [...updatedMessages, aiMsg] }
            : s,
        ),
      );
    } catch (err) {
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `Dạ, tôi chưa nhận được phản hồi từ hệ thống: ${
            getErrorMessage(err) || 'Vui lòng kiểm tra lại kết nối và thử lại'
          }. Bạn hãy thử gửi lại yêu cầu nhé!`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSession.id
              ? { ...s, updatedAt: new Date().toISOString(), messages: [...updatedMessages, aiMsg] }
              : s,
          ),
        );
      }, 400);
    } finally {
      setIsTyping(false);
    }
  };

  // Tải file Excel báo cáo tồn kho
  const handleDownloadInventoryExcel = async (farmId: string, farmName: string) => {
    setIsExportingExcel(true);
    try {
      const res = await apiFetch(chatbotService.getInventoryExportUrl(farmId));
      if (!res.ok) {
        throw new Error('Không thể tải file báo cáo tồn kho từ hệ thống');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeFarmName = (farmName || 'Trang_Trai').replace(/\s+/g, '_');
      a.download = `Bao_Cao_Ton_Kho_${safeFarmName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(getErrorMessage(err) || 'Có lỗi xảy ra khi tải file Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Lọc danh sách lịch sử theo từ khóa tìm kiếm
  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
      s.messages.some((m) => m.text.toLowerCase().includes(historySearchQuery.toLowerCase())),
  );

  const handleConfirmAction = async (msgId: string, draft: AgentActionDraft) => {
    setExecutingActionId(msgId);
    try {
      const res = await chatbotService.executeAction({
        intent: draft.intent,
        data: draft.collectedData,
        draftId: draft.draftId,
      });

      setExecutedActions((prev) => ({
        ...prev,
        [msgId]: { success: true, message: res.message, redirectTab: res.redirectTab },
      }));

      // Kích hoạt sự kiện để Dashboard reload danh sách farm/ao/vụ/kho/môi trường nước
      window.dispatchEvent(new CustomEvent('farm_data_updated', { detail: res }));
      window.dispatchEvent(new CustomEvent('inventory_updated', { detail: res }));

      const isWaterRecord = draft.intent === 'RECORD_WATER_QUALITY';
      if (isWaterRecord) {
        window.dispatchEvent(new CustomEvent('water_quality_updated', { detail: res }));
      }
      // Phiếu đã lưu -> kết thúc phiên sửa phiếu
      setActivePendingAction(null);

      const isImport = draft.intent === 'IMPORT_INVENTORY';
      const aiReply: ChatMessage = {
        id: `ai-success-${Date.now()}`,
        sender: 'ai',
        text: isWaterRecord || res.alreadyExecuted
          ? res.message
          : isImport
          ? `🎉 **Nhập kho hoàn tất!**\n\n${res.message}\n\n📋 **Lịch sử nhập kho:** Hệ thống đã tự động ghi nhận phiếu nhập kho tương ứng vào mục **Quản Lý Kho ➔ Nhật ký sử dụng**. Bạn có thể vào xem chi tiết mọi biến động số lượng, người thực hiện và chứng từ đính kèm bất cứ lúc nào!`
          : `${res.message}\n\n✅ Dữ liệu mới đã được khởi tạo thành công vào hệ thống. Bạn có thể mở mục **${
              res.redirectTab || 'Quản lý'
            }** để kiểm tra!`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession.id
            ? { ...s, updatedAt: new Date().toISOString(), messages: [...s.messages, aiReply] }
            : s,
        ),
      );
    } catch (err) {
      alert(getErrorMessage(err) || 'Có lỗi xảy ra khi thực thi hành động');
    } finally {
      setExecutingActionId(null);
    }
  };

  // Helper format markdown text kiểu ChatGPT
  const renderFormattedText = (rawText: string) => {
    const cleanedText = stripReferenceSources(rawText);
    const lines = cleanedText.split('\n');
    return lines.map((line, idx) => {
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={pIdx}
              className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

      return (
        <p
          key={idx}
          className={`text-[13.5px] leading-relaxed text-slate-800 ${
            line.startsWith('•') || line.startsWith('-') ? 'pl-2' : ''
          }`}
        >
          {formattedParts}
        </p>
      );
    });
  };

  // ── Kéo thả nút Tôm AI ───────────────────────────────────────────────────
  // Theo dõi kích thước màn hình để giữ nút luôn nằm trong màn hình
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const launcherSize = launcherRef.current?.offsetWidth ?? 64;
  const dockSide = dock?.side ?? 'right';
  const dockY = dock?.y ?? viewport.h - LAUNCHER_MARGIN - launcherSize;
  const launcherPos = dragPos ?? clampLauncher(
    dockSide === 'left' ? SIDE_GAP : viewport.w - launcherSize - SIDE_GAP,
    dockY,
    launcherSize,
    viewport.w,
    viewport.h
  );

  const handleLauncherPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    suppressClickRef.current = false;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: launcherPos.x,
      origY: launcherPos.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleLauncherPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      setIsDragging(true);
    }
    setDragPos(clampLauncher(drag.origX + dx, drag.origY + dy, launcherSize, window.innerWidth, window.innerHeight));
  };

  const endLauncherDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!drag?.moved) return;
    // Vừa kéo xong -> không coi là click mở/đóng chat
    suppressClickRef.current = true;
    setIsDragging(false);
    const dropped = clampLauncher(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      launcherSize,
      window.innerWidth,
      window.innerHeight
    );
    // Thả ra -> tự nhảy về viền trái/phải gần hơn, giữ nguyên độ cao
    const nextDock: LauncherDock = {
      side: dropped.x + launcherSize / 2 < window.innerWidth / 2 ? 'left' : 'right',
      y: dropped.y,
    };
    setDock(nextDock);
    setDragPos(null);
    try {
      localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify(nextDock));
    } catch {
      /* ignore */
    }
  };

  const handleLauncherClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setIsOpen((prev) => !prev);
  };

  // Khung chat mở về phía còn nhiều chỗ trống so với vị trí nút
  const launcherOnRight = launcherPos.x + launcherSize / 2 > viewport.w / 2;
  const launcherOnBottom = launcherPos.y + launcherSize / 2 > viewport.h / 2;
  const chatWindowStyle: React.CSSProperties = {
    ...(launcherOnRight
      ? { right: Math.max(EDGE_GAP, viewport.w - (launcherPos.x + launcherSize)) }
      : { left: Math.max(EDGE_GAP, launcherPos.x) }),
    ...(launcherOnBottom
      ? { bottom: viewport.h - launcherPos.y + WINDOW_GAP }
      : { top: launcherPos.y + launcherSize + WINDOW_GAP }),
    maxHeight: Math.max(
      240,
      (launcherOnBottom ? launcherPos.y : viewport.h - launcherPos.y - launcherSize) - WINDOW_GAP - EDGE_GAP
    ),
    maxWidth: viewport.w - EDGE_GAP * 2,
  };
  const chatWindowOrigin =
    WINDOW_ORIGIN[`${launcherOnBottom ? 'bottom' : 'top'}-${launcherOnRight ? 'right' : 'left'}` as keyof typeof WINDOW_ORIGIN];

  return (
    <div className="pointer-events-auto font-sans">
      {/* ── 1. MAIN CHATGPT WINDOW ───────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={chatWindowStyle}
          className={`fixed z-50 rounded-3xl shadow-2xl shadow-slate-950/20 border border-slate-200/90 bg-white flex flex-col overflow-hidden transition-[width,height] duration-300 animate-in zoom-in-95 ${chatWindowOrigin} ${
            isExpanded
              ? 'w-[94vw] sm:w-[700px] md:w-[840px] h-[86vh]'
              : 'w-[370px] sm:w-[480px] h-[660px]'
          }`}
        >
          {/* Header Navigation Bar (Chuyển Tab Riêng Biệt: Chat / Lịch Sử) */}
          <div className="h-14 border-b border-slate-100 px-4 flex items-center justify-between bg-white flex-shrink-0 z-20">
            {/* Left: Tab Switcher (Trò Chuyện / Lịch Sử) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <img
                  src="/assets/shrimp-mascot.jpg"
                  alt="Shrimp AI"
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span>Trò chuyện</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5 text-sky-600" />
                <span>Lịch sử</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-600 font-extrabold">
                  {sessions.length}
                </span>
              </button>
            </div>

            {/* Right Action Icons */}
            <div className="flex items-center gap-1">
              {activeTab === 'chat' && (
                <button
                  onClick={handleNewChat}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Cuộc trò chuyện mới"
                >
                  <SquarePen className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setIsExpanded((prev) => !prev)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer hidden sm:flex"
                title={isExpanded ? 'Thu nhỏ cửa sổ' : 'Mở rộng cửa sổ'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── 2. VIEW: TAB LỊCH SỬ RIÊNG BIỆT (DEDICATED FULL HISTORY TAB) ──── */}
          {activeTab === 'history' ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/60 p-4 sm:p-5">
              {/* Top Controls: Search Bar & New Chat CTA */}
              <div className="flex items-center gap-2.5 mb-3.5 flex-shrink-0">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Tìm kiếm đoạn hội thoại..."
                    className="w-full bg-white border border-slate-200/90 rounded-2xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 shadow-2xs"
                  />
                  {historySearchQuery && (
                    <button
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={handleNewChat}
                  className="px-3.5 py-2 rounded-2xl bg-slate-900 text-white hover:bg-black font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <SquarePen className="w-3.5 h-3.5" />
                  <span>Đoạn chat mới</span>
                </button>
              </div>

              {/* History Session Cards List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {filteredSessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <MessageCircle className="w-10 h-10 stroke-[1.5] mb-2 opacity-50" />
                    <p className="text-xs font-medium">Không tìm thấy đoạn hội thoại nào phù hợp</p>
                  </div>
                ) : (
                  filteredSessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    const messageCount = session.messages.filter((m) => m.id !== 'welcome-chatgpt').length;
                    const lastMessage = session.messages[session.messages.length - 1];

                    return (
                      <div
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        className={`group p-3 rounded-2xl border transition-all cursor-pointer relative ${
                          isActive
                            ? 'bg-white border-sky-400/80 shadow-md ring-2 ring-sky-500/10'
                            : 'bg-white/80 border-slate-200/70 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isActive ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {session.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Xóa đoạn chat này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {lastMessage && (
                          <p className="text-[11px] text-slate-500 truncate mt-1.5 pl-9">
                            {lastMessage.sender === 'user' ? 'Bạn: ' : 'AI: '}
                            {lastMessage.text}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 pl-9">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{session.createdAt}</span>
                          </div>
                          <span>{messageCount} tin nhắn</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Clear History CTA */}
              {sessions.length > 1 && (
                <div className="pt-3 border-t border-slate-200/80 flex justify-between items-center flex-shrink-0">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Tổng cộng: {sessions.length} phiên trò chuyện
                  </span>
                  <button
                    onClick={handleClearAllHistory}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Xóa toàn bộ lịch sử</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── 3. VIEW: CHAT TAB (FULL CONVERSATION FLOW) ─────────────────── */
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-2 animate-in fade-in duration-200">
                    {msg.sender === 'user' ? (
                      /* USER MESSAGE: Modern Soft Gray Capsule */
                      <div className="flex justify-end">
                        <div className="max-w-[85%] sm:max-w-[75%] bg-[#f4f4f4] text-slate-900 px-4 py-2.5 rounded-3xl rounded-br-md text-[13.5px] leading-relaxed whitespace-pre-line">
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      /* AI MESSAGE: Full Width with Orange Shrimp Mascot Avatar & Markdown */
                      <div className="flex gap-3 items-start max-w-full">
                        <img
                          src="/assets/shrimp-mascot.jpg"
                          alt="Shrimp AI"
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-orange-400/50 flex-shrink-0 mt-0.5 shadow-xs bg-slate-900"
                        />

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Header Badges: Pond Context & Knowledge Source */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {msg.pondName && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-semibold text-slate-700">
                                <Compass className="w-3 h-3 text-emerald-600" />
                                <span>Ngữ cảnh: {msg.pondName}</span>
                              </div>
                            )}
                          </div>

                          {/* Formatted Content */}
                          <div className="space-y-1">{renderFormattedText(msg.text)}</div>

                          {/* ── AGENT ACTION: SLOT FILLING QUICK CHIPS ── */}
                          {/* ── AGENT ACTION: THẺ THÔNG SỐ NƯỚC (nhập / sửa trực tiếp trong chat) ── */}
                          {/* Thẻ chỉ hiện khi đã xác định được ao (backend gửi kèm pondOptions) */}
                          {msg.actionDraft?.intent === 'RECORD_WATER_QUALITY' &&
                            Boolean(msg.actionDraft.pondOptions?.length) && (
                            <WaterRecordCard
                              draft={msg.actionDraft}
                              executed={Boolean(executedActions[msg.id])}
                              executing={executingActionId === msg.id}
                              readOnlyReason={
                                !isTechnician
                                  ? 'Chỉ Kỹ thuật viên mới có quyền lưu số đo môi trường nước.'
                                  : msg.id !== latestWaterCardId
                                    ? 'Thẻ này đã được thay bằng thẻ mới hơn bên dưới.'
                                    : undefined
                              }
                              onSubmit={(data) =>
                                handleConfirmAction(msg.id, { ...msg.actionDraft!, collectedData: data })
                              }
                            />
                          )}

                          {/* ── AGENT ACTION: THẺ TẠO VỤ NUÔI (chỉ Quản lý trang trại) ── */}
                          {msg.actionDraft?.intent === 'CREATE_CROP' &&
                            Boolean(msg.actionDraft.cropPondOptions?.length) && (
                            <CropCreateCard
                              draft={msg.actionDraft}
                              executed={Boolean(executedActions[msg.id])}
                              executing={executingActionId === msg.id}
                              readOnlyReason={
                                !isFarmManager
                                  ? 'Chỉ Quản lý trang trại mới có quyền tạo vụ nuôi qua trợ lý AI.'
                                  : msg.id !== latestCreateDraftId
                                    ? 'Thẻ này đã được thay bằng thẻ mới hơn bên dưới.'
                                    : undefined
                              }
                              onSubmit={(data) =>
                                handleConfirmAction(msg.id, { ...msg.actionDraft!, collectedData: data })
                              }
                            />
                          )}

                          {msg.actionDraft?.type === 'SLOT_FILLING' &&
                            // Nhập số đo nước: chỉ hiện nút chọn nhanh ở bước hỏi trang trại / ao
                            !(msg.actionDraft.intent === 'RECORD_WATER_QUALITY' && msg.actionDraft.pondOptions?.length) &&
                            // Tạo vụ nuôi: chọn ao ngay trên thẻ
                            !msg.actionDraft.cropPondOptions?.length &&
                            msg.actionDraft.quickSuggestions &&
                            msg.actionDraft.quickSuggestions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-2">
                                {msg.actionDraft.quickSuggestions.map((suggestion, sIdx) => (
                                  <button
                                    key={sIdx}
                                    onClick={() => {
                                      // Chọn trang trại / ao khi nhập số đo nước -> gửi luôn
                                      if (msg.actionDraft?.intent === 'RECORD_WATER_QUALITY') {
                                        handleSendMessage(suggestion);
                                        return;
                                      }
                                      setInputMessage(suggestion);
                                      if (textareaRef.current) textareaRef.current.focus();
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200/80 shadow-2xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    <span>{suggestion}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                          {/* ── AGENT ACTION: INVENTORY IMPORT CONFIRMATION CARD ── */}
                          {msg.actionDraft?.type === 'CONFIRM_ACTION' &&
                            msg.actionDraft.intent === 'IMPORT_INVENTORY' && (
                              <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 via-white to-white p-3.5 shadow-sm space-y-3">
                                {/* Header */}
                                <div className="flex items-center gap-2.5 border-b border-emerald-100 pb-2.5">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                                    <Package className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                        Xác nhận nhập kho vật tư
                                      </h4>
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                        {msg.actionDraft.inventoryItems?.length || 0} mặt hàng
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium truncate">
                                      Trang trại:{' '}
                                      <strong className="text-slate-700">
                                        {msg.actionDraft.farmName ||
                                          msg.actionDraft.summary?.['Trang trại nhận hàng'] ||
                                          'Chưa chọn'}
                                      </strong>
                                    </p>
                                  </div>
                                </div>

                                {/* Table of Parsed Items */}
                                {msg.actionDraft.inventoryItems &&
                                  msg.actionDraft.inventoryItems.length > 0 && (
                                    <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white max-h-64 shadow-2xs">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead className="sticky top-0 bg-slate-50 z-10">
                                          <tr className="text-slate-600 border-b border-slate-200 text-[10.5px] font-bold uppercase">
                                            <th className="py-2 px-2 text-center w-7">#</th>
                                            <th className="py-2 px-2.5">Tên vật tư</th>
                                            <th className="py-2 px-2 text-center">Phân loại</th>
                                            <th className="py-2 px-2 text-center">Quy cách</th>
                                            <th className="py-2 px-2 text-right">Số lượng</th>
                                            <th className="py-2 px-2 text-right">Đơn giá</th>
                                            <th className="py-2 px-2 text-right">Ngưỡng báo</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {msg.actionDraft.inventoryItems.map((item, iIdx) => {
                                            const catConfig =
                                              item.category === 'FEED'
                                                ? {
                                                    label: 'Thức ăn',
                                                    bg: 'bg-sky-50 text-sky-700 border-sky-200',
                                                  }
                                                : item.category === 'MEDICINE'
                                                ? {
                                                    label: 'Thuốc / Men',
                                                    bg: 'bg-purple-50 text-purple-700 border-purple-200',
                                                  }
                                                : {
                                                    label: 'Hóa chất',
                                                    bg: 'bg-amber-50 text-amber-700 border-amber-200',
                                                  };

                                            return (
                                              <tr
                                                key={iIdx}
                                                className="hover:bg-slate-50/80 transition-colors"
                                              >
                                                <td className="py-2 px-2 text-center text-slate-400 font-medium text-[11px]">
                                                  {iIdx + 1}
                                                </td>
                                                <td className="py-2 px-2.5">
                                                  <div className="flex items-center gap-2">
                                                    {item.imageUrl ? (
                                                      <div className="w-8 h-8 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center">
                                                        <img
                                                          src={item.imageUrl}
                                                          alt={item.itemName}
                                                          className="w-full h-full object-cover"
                                                          onError={(e) => {
                                                            (e.target as HTMLElement).style.display = 'none';
                                                          }}
                                                        />
                                                      </div>
                                                    ) : null}
                                                    <div className="min-w-0 flex-1">
                                                      <div className="font-bold text-slate-800 text-[11.5px] leading-tight truncate">
                                                        {item.itemName}
                                                      </div>
                                                      {(item.description || item.supplierName || item.sizeSpec) && (
                                                        <div className="text-[10px] text-slate-400 font-medium truncate max-w-[190px] mt-0.5" title={item.description || ''}>
                                                          {item.supplierName && <span className="text-indigo-600 font-semibold mr-1">[{item.supplierName}]</span>}
                                                          {item.sizeSpec && <span className="text-amber-700 font-semibold mr-1">Cỡ: {item.sizeSpec} -</span>}
                                                          {item.description || ''}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                  <span
                                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${catConfig.bg}`}
                                                  >
                                                    {catConfig.label}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-2 text-center text-slate-700 font-medium text-[11px]">
                                                  {item.packageType ? (
                                                    <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold text-[10.5px]">
                                                      {item.packageType} {item.weightPerPkg ? `(${item.weightPerPkg} ${item.unit})` : ''}
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-400">-</span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-2 text-right font-black text-slate-900 text-[12px]">
                                                  {item.packageQty ? (
                                                    <div className="flex flex-col items-end">
                                                      <span>{item.packageQty.toLocaleString('vi-VN')} {item.packageType || 'đơn vị'}</span>
                                                      <span className="text-[10px] text-slate-400 font-normal">({item.quantity.toLocaleString('vi-VN')} {item.unit})</span>
                                                    </div>
                                                  ) : (
                                                    <span>{item.quantity.toLocaleString('vi-VN')} {item.unit}</span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-2 text-right text-emerald-700 font-bold text-[11.5px]">
                                                  {item.pricePerPackage && item.pricePerPackage > 0
                                                    ? `${item.pricePerPackage.toLocaleString('vi-VN')} đ`
                                                    : <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="py-2 px-2 text-right text-slate-500 text-[11px] font-medium">
                                                  {item.minThreshold
                                                    ? `${item.minThreshold.toLocaleString('vi-VN')} ${item.unit}`
                                                    : '-'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                {/* Action Buttons */}
                                {executedActions[msg.id] ? (
                                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold animate-in fade-in">
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      <span>
                                        {executedActions[msg.id].message ||
                                          'Đã nhập thành công vào kho!'}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={() => handleConfirmAction(msg.id, msg.actionDraft!)}
                                      disabled={executingActionId === msg.id}
                                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                      {executingActionId === msg.id ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          <span>Đang cập nhật kho...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Xác nhận nhập kho ngay</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setInputMessage('Hủy bỏ yêu cầu nhập kho này');
                                        textareaRef.current?.focus();
                                      }}
                                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                                    >
                                      Hủy bỏ
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                          {/* ── AGENT ACTION: INVENTORY EXPORT DOWNLOAD CARD ── */}
                          {msg.actionDraft?.type === 'CONFIRM_ACTION' &&
                            msg.actionDraft.intent === 'EXPORT_INVENTORY' && (
                              <div className="mt-3 rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/80 via-white to-white p-3.5 shadow-sm space-y-3">
                                <div className="flex items-center gap-2.5 border-b border-sky-100 pb-2">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                                    <FileSpreadsheet className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                      Báo cáo tồn kho đã sẵn sàng
                                    </h4>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                      Trang trại:{' '}
                                      <strong className="text-slate-800">
                                        {msg.actionDraft.farmName ||
                                          msg.actionDraft.summary?.['Trang trại'] ||
                                          'Chưa rõ'}
                                      </strong>
                                    </p>
                                  </div>
                                </div>

                                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Mặt hàng tồn:</span>
                                    <span className="font-bold text-slate-900">
                                      {msg.actionDraft.summary?.['Tổng số mặt hàng'] || 'Tất cả'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Định dạng tệp:</span>
                                    <span className="font-semibold text-sky-700">
                                      Microsoft Excel (.xlsx)
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() =>
                                    handleDownloadInventoryExcel(
                                      msg.actionDraft!.collectedData.farmId,
                                      msg.actionDraft!.farmName || '',
                                    )
                                  }
                                  disabled={isExportingExcel}
                                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                  {isExportingExcel ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>Đang tạo file Excel...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-4 h-4" />
                                      <span>Tải về file Excel (.xlsx)</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                          {/* ── AGENT ACTION: CREATE FARM / POND / CROP CONFIRMATION CARD ── */}
                          {msg.actionDraft?.type === 'CONFIRM_ACTION' &&
                            msg.actionDraft.summary &&
                            msg.actionDraft.intent !== 'IMPORT_INVENTORY' &&
                            msg.actionDraft.intent !== 'EXPORT_INVENTORY' &&
                            msg.actionDraft.intent !== 'RECORD_WATER_QUALITY' &&
                            // Vụ nuôi có thẻ nhập liệu riêng (CropCreateCard)
                            !msg.actionDraft.cropPondOptions?.length && (
                              <div className="mt-3 rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white p-3.5 shadow-sm space-y-3">
                                {/* Header */}
                                <div className="flex items-center gap-2 border-b border-indigo-100/80 pb-2">
                                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-xs">
                                    {msg.actionDraft.intent === 'CREATE_FARM' && (
                                      <Building2 className="w-4 h-4" />
                                    )}
                                    {msg.actionDraft.intent === 'CREATE_POND' && (
                                      <Waves className="w-4 h-4" />
                                    )}
                                    {msg.actionDraft.intent === 'CREATE_CROP' && (
                                      <Sparkles className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                      {msg.actionDraft.intent === 'CREATE_FARM' &&
                                        'Xác nhận tạo Trang trại mới'}
                                      {msg.actionDraft.intent === 'CREATE_POND' &&
                                        'Xác nhận tạo Ao nuôi mới'}
                                      {msg.actionDraft.intent === 'CREATE_CROP' &&
                                        'Xác nhận tạo Vụ nuôi mới'}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                      Vui lòng kiểm tra lại thông số kỹ thuật bên dưới
                                    </p>
                                  </div>
                                </div>

                                {/* Parameter Rows */}
                                <div className="grid grid-cols-1 gap-1 text-xs bg-white/90 p-2.5 rounded-xl border border-indigo-50 shadow-2xs">
                                  {Object.entries(msg.actionDraft.summary).map(([key, val]) => (
                                    <div
                                      key={key}
                                      className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0"
                                    >
                                      <span className="text-slate-500 font-medium text-[11px]">
                                        {key}:
                                      </span>
                                      <span className="font-bold text-slate-800 text-[11.5px] text-right">
                                        {val}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Action Buttons */}
                                {executedActions[msg.id] ? (
                                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      <span>Đã tạo thành công vào hệ thống!</span>
                                    </div>
                                  </div>
                                ) : CREATE_INTENTS.includes(msg.actionDraft.intent) && msg.id !== latestCreateDraftId ? (
                                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-semibold text-center">
                                    {messages.find((m) => m.endsPendingAction && messages.indexOf(m) > messages.indexOf(msg))
                                      ? 'Phiếu này đã bị hủy.'
                                      : 'Phiếu này đã được thay bằng phiếu mới hơn bên dưới.'}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={() => handleConfirmAction(msg.id, msg.actionDraft!)}
                                      disabled={executingActionId === msg.id}
                                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                      {executingActionId === msg.id ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          <span>Đang tạo bản ghi...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Xác nhận tạo ngay</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setInputMessage('Sửa phiếu: ');
                                        textareaRef.current?.focus();
                                      }}
                                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                                    >
                                      Sửa lại
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                          {/* AI Action Toolbar (Copy) */}
                          {msg.id !== 'welcome-chatgpt' && (
                            <div className="flex items-center gap-2 pt-1 text-slate-400">
                              <button
                                onClick={() => handleCopyText(msg.id, msg.text)}
                                className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer text-xs flex items-center gap-1"
                                title="Sao chép câu trả lời"
                              >
                                {copiedMessageId === msg.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-[10px] text-emerald-600 font-semibold">
                                      Đã sao chép
                                    </span>
                                  </>
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* AI Thinking Indicator */}
                {isTyping && (
                  <div className="flex gap-3 items-start animate-in fade-in duration-150">
                    <img
                      src="/assets/shrimp-mascot.jpg"
                      alt="Shrimp AI Thinking"
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-orange-400/60 animate-pulse flex-shrink-0 shadow-xs bg-slate-900"
                    />
                    <div className="flex items-center gap-1.5 py-2">
                      <span
                        className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── INPUT FOOTER (ChatGPT Capsule Prompt Bar) ───────────────── */}
              <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex-shrink-0">
                {/* File Attachment Chip Preview (Nếu Manager chọn tệp) */}
                {selectedFile && (
                  <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 animate-in fade-in">
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className="w-4 h-4 text-sky-600 flex-shrink-0" />
                      <span className="font-semibold truncate">{selectedFile.name}</span>
                      <span className="text-[10px] text-sky-500 flex-shrink-0">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-sky-600 hover:text-sky-900 p-0.5 rounded-md hover:bg-sky-100 cursor-pointer ml-2"
                      title="Bỏ tệp này"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="relative rounded-3xl border border-slate-300/80 bg-slate-50/70 focus-within:bg-white focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all shadow-xs px-3 sm:px-4 py-2 flex items-end gap-2">
                  {/* File Upload Button [+] (Chỉ hiển thị cho FARM_MANAGER) */}
                  {canUploadInventoryFile && (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSelectedFile(e.target.files[0]);
                          }
                        }}
                        accept=".xlsx,.xls,.pdf,.docx,.doc"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isTyping}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition-all cursor-pointer flex-shrink-0 mb-0.5"
                        title="Tải lên tệp Excel (.xlsx, .xls), PDF hoặc Word để AI nhập kho tự động"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </>
                  )}

                  {/* Nút mở nhanh Thẻ thông số nước (Kỹ thuật viên) */}
                  {isTechnician && (
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Nhập số đo môi trường nước')}
                      disabled={isTyping}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sky-600 hover:text-sky-800 hover:bg-sky-100 transition-all cursor-pointer flex-shrink-0 mb-0.5 disabled:opacity-50"
                      title="Mở thẻ nhập thông số môi trường nước"
                    >
                      <Droplets className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  )}

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      selectedFile
                        ? 'Thêm ghi chú hoặc bấm Gửi để AI nhập kho...'
                        : 'Nhắn tin cho Smart Shrimp AI...'
                    }
                    className="flex-1 bg-transparent resize-none outline-none text-[13.5px] leading-relaxed text-slate-800 placeholder:text-slate-400 max-h-[120px] py-1"
                  />

                  {/* Circular Send Button (ChatGPT Arrow Up) */}
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={(!inputMessage.trim() && !selectedFile) || isTyping}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 mb-0.5 ${
                      (inputMessage.trim() || selectedFile) && !isTyping
                        ? 'bg-slate-900 text-white hover:bg-black shadow-xs hover:scale-105 active:scale-95'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title="Gửi câu hỏi hoặc tệp (Enter)"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Subtitle Disclaimer */}
                <p className="text-[10px] text-center text-slate-400 mt-2">
                  {canUploadInventoryFile
                    ? 'Bạn có thể bấm dấu [+] để tải tệp hóa đơn/kho (Excel, PDF, Word) cho AI xử lý tự động.'
                    : 'Smart Shrimp AI kết hợp cẩm nang kỹ thuật & cảm biến ao. Hãy đối chiếu khi ra quyết định lớn.'}
                </p>
              </div>
            </div>
          )}

          {/* Modal xác nhận xóa toàn bộ lịch sử trò chuyện */}
          {showClearConfirm && (
            <div
              className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
              onClick={() => setShowClearConfirm(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-5 text-center border border-slate-100 animate-in zoom-in-95 duration-200"
              >
                <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-3 shadow-inner">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <h4 className="text-base font-black text-slate-800">Xóa tất cả lịch sử?</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                  Toàn bộ các phiên trò chuyện trước đây với Trợ lý Tôm AI sẽ bị xóa và không thể khôi phục.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={confirmClearAll}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all cursor-pointer"
                  >
                    Xác nhận xóa
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. FLOATING TRIGGER BUTTON (VIBRANT 3D ORANGE SHRIMP) ───────────── */}
      <div
        className={`fixed z-50 flex items-center ${
          isDragging ? '' : 'transition-[left,top] duration-300 ease-out motion-reduce:transition-none'
        }`}
        style={{ left: launcherPos.x, top: launcherPos.y }}
      >
        <button
          ref={launcherRef}
          onClick={handleLauncherClick}
          onPointerDown={handleLauncherPointerDown}
          onPointerMove={handleLauncherPointerMove}
          onPointerUp={endLauncherDrag}
          onPointerCancel={endLauncherDrag}
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-2xl transition-[transform,box-shadow] duration-500 transform select-none touch-none border-2 border-white/90 overflow-hidden relative p-0.5 group ${
            isDragging ? 'scale-110 cursor-grabbing' : 'hover:scale-110 active:scale-95 cursor-pointer'
          } ${
            isOpen
              ? 'bg-gradient-to-tr from-amber-500 via-orange-500 to-cyan-400 shadow-orange-500/50 ring-4 ring-orange-500/30'
              : 'bg-gradient-to-tr from-amber-500 via-orange-500 to-cyan-400 shadow-orange-500/35 ring-4 ring-orange-400/20'
          }`}
          title={isOpen ? 'Thu nhỏ Trợ lý Tôm AI (kéo để di chuyển)' : 'Mở Trợ lý Tôm AI (kéo để di chuyển)'}
        >
          <img
            src="/assets/shrimp-mascot.jpg"
            alt="Smart Shrimp Mascot"
            draggable={false}
            className={`w-full h-full object-cover rounded-full transition-all duration-700 ease-out transform ${
              isOpen
                ? 'rotate-[360deg] scale-100'
                : 'rotate-0 group-hover:rotate-12 group-hover:scale-105'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
