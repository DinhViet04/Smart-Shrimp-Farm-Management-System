import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  UserPlus,
  Building2,
  MapPin,
  Search,
  ShieldCheck,
  FlaskConical,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  MessageCircle,
  X,
  Paperclip,
  FileText,
  Download,
  Reply,
  Check,
  CheckCheck,
  ArrowLeft,
  ArrowDown,
  Clock,
  Upload,
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import {
  chatGroupService,
  type ChatAttachment,
  type ChatGroupItem,
  type ChatMessageItem,
} from '../../services/chat-group.service';
import { farmService } from '../../services/farm.service';
import { getErrorMessage } from '../../utils/errors';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Các tin liên tiếp của cùng một người trong khoảng này được gộp thành một cụm. */
const GROUPING_WINDOW_MS = 5 * 60 * 1000;
/** Khoảng cách (px) tới đáy được coi là "đang ở cuối cuộc trò chuyện". */
const NEAR_BOTTOM_PX = 120;

const getGroupActivityTime = (g: ChatGroupItem) => {
  const ts = g.messages?.[0]?.createdAt || g.updatedAt;
  return ts ? new Date(ts).getTime() : 0;
};

const sortGroupsByPriority = (
  list: ChatGroupItem[],
  unreadMap: Record<string, number>,
) =>
  [...list].sort((a, b) => {
    const unreadA = (unreadMap[a.id] || 0) > 0 ? 1 : 0;
    const unreadB = (unreadMap[b.id] || 0) > 0 ? 1 : 0;
    if (unreadA !== unreadB) return unreadB - unreadA;
    return getGroupActivityTime(b) - getGroupActivityTime(a);
  });

// ─── Tiện ích hiển thị ──────────────────────────────────────────────────────

const AVATAR_TONES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
  'bg-lime-100 text-lime-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

const toneFor = (key: string) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const dayDiff = (date: Date) =>
  Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const formatDayLabel = (iso: string) => {
  const date = new Date(iso);
  const diff = dayDiff(date);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/** Thời gian rút gọn cho danh sách hội thoại. */
const formatListTime = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = dayDiff(date);
  if (diff === 0) return formatTime(iso);
  if (diff === 1) return 'Hôm qua';
  if (diff < 7) return date.toLocaleDateString('vi-VN', { weekday: 'short' });
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

function Avatar({
  name,
  seed,
  size = 'md',
  className = '',
}: {
  name: string;
  seed: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass =
    size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';
  return (
    <div
      className={`${sizeClass} ${toneFor(seed)} rounded-full flex items-center justify-center font-black flex-shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

const ROLE_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  FARM_MANAGER: {
    label: 'Quản lý trại',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  TECHNICIAN: {
    label: 'Kỹ thuật viên',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: <FlaskConical className="w-3 h-3" />,
  },
  FARMER: {
    label: 'Nông dân',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <UserCheck className="w-3 h-3" />,
  },
};

const RoleBadge = ({ role }: { role?: string }) => {
  const meta = ROLE_META[role || ''] || ROLE_META.FARMER;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${meta.className}`}
    >
      {meta.icon} {meta.label}
    </span>
  );
};

type ReceiptStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ';

const ReceiptLabel = ({ status }: { status: ReceiptStatus }) => {
  switch (status) {
    case 'SENDING':
      return (
        <span className="text-slate-400 flex items-center gap-0.5">
          <Clock className="w-3 h-3" /> Đang gửi
        </span>
      );
    case 'SENT':
      return (
        <span className="text-slate-400 flex items-center gap-0.5">
          <Check className="w-3 h-3" /> Đã gửi
        </span>
      );
    case 'DELIVERED':
      return (
        <span className="text-slate-500 flex items-center gap-0.5">
          <CheckCheck className="w-3 h-3" /> Đã nhận
        </span>
      );
    case 'READ':
      return (
        <span className="text-blue-600 flex items-center gap-0.5">
          <CheckCheck className="w-3 h-3" /> Đã xem
        </span>
      );
  }
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageAttachment = (msg: {
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}) => {
  if (!msg.attachmentUrl) return false;
  if (msg.attachmentType?.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(msg.attachmentUrl);
};

const previewOf = (msg: {
  content?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
}) =>
  msg.content ||
  (msg.attachmentType?.startsWith('image/')
    ? '📷 Hình ảnh'
    : msg.attachmentName
      ? `📎 ${msg.attachmentName}`
      : '📎 Tệp đính kèm');

// ─── Component ──────────────────────────────────────────────────────────────

export default function FarmChatGroupView() {
  const [groups, setGroups] = useState<ChatGroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessageItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [chatFilter, setChatFilter] = useState<'ALL' | 'FARM_GROUP' | 'DIRECT'>('ALL');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Màn hình rộng: mở sẵn cột thành viên; màn hình hẹp: dạng ngăn kéo, đóng mặc định.
  const [showMemberPanel, setShowMemberPanel] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1280,
  );
  // Màn hình hẹp (< lg) chỉ hiển thị một khung: danh sách hoặc cuộc trò chuyện.
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showDirectPicker, setShowDirectPicker] = useState(false);
  const [directSearch, setDirectSearch] = useState('');
  const [startingDirectId, setStartingDirectId] = useState<string | null>(null);
  const [newIncomingCount, setNewIncomingCount] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Add member form state (for Farm Manager)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'FARMER' | 'TECHNICIAN'>('FARMER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const selectedGroupIdRef = useRef<string | null>(null);
  const messagesCacheRef = useRef<Record<string, ChatMessageItem[]>>({});
  const dragDepthRef = useRef(0);

  const currentUser = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const currentUserId = currentUser?.id || currentUser?.userId || currentUser?.sub;

  useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId;
  }, [selectedGroupId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    // Chờ DOM cập nhật xong rồi mới cuộn.
    requestAnimationFrame(() => {
      const el = messagesContainerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      isNearBottomRef.current = true;
      setNewIncomingCount(0);
    });
  }, []);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) setNewIncomingCount((c) => (c === 0 ? c : 0));
  };

  const fetchGroups = useCallback(async (keepSelection = true) => {
    try {
      setLoadError(null);
      const rawData = await chatGroupService.getGroups();
      const data = [...rawData].sort(
        (a, b) => getGroupActivityTime(b) - getGroupActivityTime(a),
      );
      setGroups(data);
      if (data.length > 0) {
        if (!keepSelection || !selectedGroupIdRef.current) {
          setSelectedGroupId(data[0].id);
        } else {
          const stillExists = data.some((g) => g.id === selectedGroupIdRef.current);
          if (!stillExists) {
            setSelectedGroupId(data[0].id);
          }
        }
      } else {
        setSelectedGroupId(null);
      }
    } catch (err) {
      console.error('Failed to load chat groups:', err);
      setLoadError(getErrorMessage(err) || 'Không thể kết nối tới máy chủ nhóm chat.');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const fetchMessages = useCallback(
    async (groupId: string) => {
      const cached = messagesCacheRef.current[groupId];
      if (cached) {
        setMessages(cached);
        setLoadingMessages(false);
        scrollToBottom('auto');
      } else {
        setLoadingMessages(true);
      }
      try {
        const data = await chatGroupService.getMessages(groupId);
        messagesCacheRef.current[groupId] = data;
        if (selectedGroupIdRef.current === groupId) {
          setMessages(data);
          if (!cached || isNearBottomRef.current) scrollToBottom('auto');
        }
      } catch (err) {
        console.error('Failed to load group messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [scrollToBottom],
  );

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    void fetchGroups(false);
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      void fetchMessages(selectedGroupId);
      if (socketRef.current?.connected) {
        socketRef.current.emit('markChatReceipt', {
          groupId: selectedGroupId,
          type: 'READ',
        });
      }
      setUnreadCounts((prev) => {
        if (!prev[selectedGroupId]) return prev;
        const next = { ...prev };
        delete next[selectedGroupId];
        return next;
      });
      setReplyingTo(null);
      setInviteError(null);
      setInviteSuccess(null);
      setMessageError(null);
      setNewIncomingCount(0);
    } else {
      setMessages([]);
    }
  }, [selectedGroupId, fetchMessages]);

  // Socket.IO connection

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!currentUserId || !token) return;

    const socket: Socket = io(`${apiUrl}/notifications`, {
      query: { userId: currentUserId },
      auth: (cb) => {
        cb({ token: localStorage.getItem('accessToken') });
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      void fetchGroups(true);
      if (selectedGroupIdRef.current) {
        void fetchMessages(selectedGroupIdRef.current);
      }
    });

    socket.on('newChatMessage', (msg: ChatMessageItem) => {
      if (messagesCacheRef.current[msg.groupId]) {
        const cached = messagesCacheRef.current[msg.groupId];
        if (!cached.some((m) => m.id === msg.id)) {
          messagesCacheRef.current[msg.groupId] = [...cached, msg];
        }
      }
      if (msg.groupId === selectedGroupIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          // Replace matching optimistic temp message if present
          const tempIdx = prev.findIndex(
            (m) =>
              m.id.startsWith('temp-') &&
              m.senderId === msg.senderId &&
              m.content === msg.content,
          );
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = msg;
            return next;
          }
          return [...prev, msg];
        });
        // Chỉ tự cuộn khi người dùng đang ở cuối; nếu đang đọc tin cũ thì hiện nút "Tin nhắn mới".
        if (msg.senderId === currentUserId || isNearBottomRef.current) {
          scrollToBottom();
        } else {
          setNewIncomingCount((c) => c + 1);
        }
        if (msg.senderId !== currentUserId) {
          socket.emit('markChatReceipt', {
            groupId: msg.groupId,
            type: 'READ',
          });
        }
      } else if (msg.senderId !== currentUserId) {
        socket.emit('markChatReceipt', {
          groupId: msg.groupId,
          type: 'DELIVERED',
        });
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.groupId]: (prev[msg.groupId] || 0) + 1,
        }));
      }
      setGroups((prev) => {
        const exists = prev.some((g) => g.id === msg.groupId);
        if (!exists) {
          void fetchGroups(true);
          return prev;
        }
        return prev
          .map((g) =>
            g.id === msg.groupId
              ? { ...g, messages: [msg], updatedAt: msg.createdAt }
              : g,
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
      });
    });

    socket.on(
      'chatReceiptUpdated',
      (receipt: {
        groupId: string;
        userId: string;
        lastDeliveredAt?: string;
        lastReadAt?: string;
      }) => {
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== receipt.groupId || !g.members) return g;
            return {
              ...g,
              members: g.members.map((m) =>
                m.userId === receipt.userId
                  ? {
                      ...m,
                      ...(receipt.lastDeliveredAt
                        ? { lastDeliveredAt: receipt.lastDeliveredAt }
                        : {}),
                      ...(receipt.lastReadAt
                        ? { lastReadAt: receipt.lastReadAt }
                        : {}),
                    }
                  : m,
              ),
            };
          }),
        );
      },
    );

    socket.on('chatGroupUpdated', () => {
      void fetchGroups(true);
      if (selectedGroupIdRef.current) {
        void fetchMessages(selectedGroupIdRef.current);
      }
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [currentUserId, fetchGroups, fetchMessages, scrollToBottom]);

  const activeGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const isActiveDirect = activeGroup?.type === 'DIRECT';
  const isGroupManager =
    currentUser?.role === 'ADMIN' ||
    (activeGroup?.farm?.ownerId && activeGroup.farm.ownerId === currentUserId);

  const selectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setMobileView('chat');
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      setShowMemberPanel(false);
    }
  };

  // ─── Tệp đính kèm ──────────────────────────────────────────────────────

  const clearPendingFile = () => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingFile(null);
    setPendingPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const attachFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setMessageError('Dung lượng tệp tối đa là 10MB.');
      return;
    }
    clearPendingFile();
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      setPendingPreviewUrl(URL.createObjectURL(file));
    }
    setMessageError(null);
    textareaRef.current?.focus();
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) attachFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(e.clipboardData.files || [])[0];
    if (file) {
      e.preventDefault();
      attachFile(file);
    }
  };

  const hasDraggedFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types || []).includes('Files');

  const handleDragEnter = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) attachFile(file);
  };

  // Ô nhập tự giãn chiều cao theo nội dung (tối đa ~6 dòng).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [messageInput]);

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Bỏ qua khi bộ gõ tiếng Việt (Telex/VNI) đang ghép ký tự.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
    if (e.key === 'Escape' && replyingTo) {
      setReplyingTo(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || uploadingFile) return;
    setMessageError(null);

    const trimmed = messageInput.trim();
    const fileToSend = pendingFile;
    const localPreview = pendingPreviewUrl;
    const replyTarget = replyingTo;

    if (!trimmed && !fileToSend) {
      return;
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setMessageError(`Tin nhắn không được vượt quá ${MAX_MESSAGE_LENGTH} ký tự.`);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessageItem = {
      id: tempId,
      groupId: activeGroup.id,
      senderId: currentUserId || '',
      content: trimmed,
      attachmentUrl: localPreview || null,
      attachmentName: fileToSend?.name || null,
      attachmentType: fileToSend?.type || null,
      attachmentSize: fileToSend?.size || null,
      replyToId: replyTarget?.id || null,
      replyTo: replyTarget
        ? {
            id: replyTarget.id,
            content: replyTarget.content,
            attachmentName: replyTarget.attachmentName,
            attachmentType: replyTarget.attachmentType,
            senderId: replyTarget.senderId,
            sender: replyTarget.sender
              ? {
                  id: replyTarget.sender.id,
                  fullName: replyTarget.sender.fullName,
                }
              : null,
          }
        : null,
      isSystem: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUserId || '',
        fullName: currentUser?.fullName || currentUser?.name || 'Bạn',
        email: currentUser?.email || '',
        role: currentUser?.role || 'FARM_MANAGER',
        avatarUrl: currentUser?.avatarUrl,
      },
    };

    setMessageInput('');
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setReplyingTo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();
    const applyCreatedMessage = (created: ChatMessageItem) => {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === created.id)) return withoutTemp;
        return [...withoutTemp, created];
      });
      setGroups((prev) =>
        prev
          .map((g) =>
            g.id === activeGroup.id
              ? { ...g, messages: [created], updatedAt: created.createdAt }
              : g,
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
      );
    };

    try {
      let uploadedAttachment: ChatAttachment | undefined;
      if (fileToSend) {
        setUploadingFile(true);
        uploadedAttachment = await chatGroupService.uploadAttachment(
          activeGroup.id,
          fileToSend,
        );
        setUploadingFile(false);
      }

      const socket = socketRef.current;
      if (socket?.connected) {
        const created = await new Promise<ChatMessageItem>((resolve, reject) => {
          socket
            .timeout(4000)
            .emit(
              'sendChatMessage',
              {
                groupId: activeGroup.id,
                content: trimmed,
                ...(uploadedAttachment || {}),
                ...(replyTarget ? { replyToId: replyTarget.id } : {}),
              },
              (
                err: Error | null,
                res?: { ok?: boolean; message?: ChatMessageItem; error?: string },
              ) => {
                if (err) return reject(err);
                if (res?.ok && res.message) return resolve(res.message);
                return reject(
                  new Error(res?.error || 'Không thể gửi tin nhắn qua socket'),
                );
              },
            );
        }).catch(() =>
          chatGroupService.sendMessage(
            activeGroup.id,
            trimmed,
            uploadedAttachment,
            replyTarget?.id,
          ),
        );
        applyCreatedMessage(created);
      } else {
        const created = await chatGroupService.sendMessage(
          activeGroup.id,
          trimmed,
          uploadedAttachment,
          replyTarget?.id,
        );
        applyCreatedMessage(created);
      }
    } catch (err) {
      setUploadingFile(false);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessageInput(trimmed);
      setMessageError(getErrorMessage(err) || 'Không thể gửi tin nhắn.');
    }
  };

  const handleAddMemberToFarmAndGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup?.farmId) return;
    setInviteError(null);
    setInviteSuccess(null);

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setInviteError('Vui lòng nhập email thành viên cần thêm.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setInviteError('Định dạng email không hợp lệ (VD: user@example.com).');
      return;
    }
    if (
      currentUser?.email &&
      currentUser.email.toLowerCase() === normalizedEmail
    ) {
      setInviteError('Bạn đã là Chủ trang trại trong nhóm chat này.');
      return;
    }
    const alreadyInGroup = activeGroup.members?.some(
      (m) => m.user?.email?.toLowerCase() === normalizedEmail,
    );
    if (alreadyInGroup) {
      setInviteError('Thành viên này đã có mặt trong nhóm chat trang trại.');
      return;
    }

    setInviting(true);
    try {
      const res = await farmService.inviteByEmail(
        activeGroup.farmId,
        normalizedEmail,
        inviteRole,
      );
      setInviteEmail('');
      setInviteSuccess(
        res.message ||
          `Đã thêm ${normalizedEmail} vào trang trại và nhóm chat thành công.`,
      );
      await fetchGroups(true);
      await fetchMessages(activeGroup.id);
    } catch (err) {
      setInviteError(getErrorMessage(err) || 'Không thể thêm thành viên vào nhóm.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!activeGroup?.farmId) return;
    if (!window.confirm(`Gỡ ${memberName} khỏi trang trại và nhóm chat?`)) return;
    setInviteError(null);
    setInviteSuccess(null);
    setRemovingUserId(memberUserId);
    try {
      await farmService.unassignStaff(activeGroup.farmId, memberUserId);
      setInviteSuccess(
        `Đã gỡ ${memberName} khỏi trang trại và nhóm chat.`,
      );
      await fetchGroups(true);
      await fetchMessages(activeGroup.id);
    } catch (err) {
      setInviteError(getErrorMessage(err) || 'Không thể gỡ thành viên khỏi nhóm.');
    } finally {
      setRemovingUserId(null);
    }
  };

  const getDirectPartner = useCallback(
    (group: ChatGroupItem) => {
      if (group.type !== 'DIRECT') return null;
      return (
        group.members?.find((m) => m.userId !== currentUserId) ||
        group.members?.[0] ||
        null
      );
    },
    [currentUserId],
  );

  const getGroupDisplayName = useCallback(
    (group: ChatGroupItem) => {
      if (group.type === 'DIRECT') {
        const partner = getDirectPartner(group);
        return partner?.user?.fullName || partner?.user?.email || group.name;
      }
      return group.farm?.name || group.name;
    },
    [getDirectPartner],
  );

  // Danh sách đồng nghiệp cùng trang trại để mở chat riêng nhanh
  const colleagues = React.useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        fullName: string;
        email: string;
        role: string;
        farmNames: string[];
      }
    >();
    groups.forEach((g) => {
      if (g.type === 'DIRECT') return;
      const farmLabel = g.farm?.name || g.name;
      (g.members || []).forEach((m) => {
        if (!m.userId || m.userId === currentUserId) return;
        const existing = map.get(m.userId);
        if (existing) {
          if (farmLabel && !existing.farmNames.includes(farmLabel)) {
            existing.farmNames.push(farmLabel);
          }
        } else {
          map.set(m.userId, {
            userId: m.userId,
            fullName: m.user?.fullName || m.user?.email || 'Thành viên',
            email: m.user?.email || '',
            role: m.user?.role || m.role,
            farmNames: farmLabel ? [farmLabel] : [],
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'vi'),
    );
  }, [groups, currentUserId]);

  const filteredColleagues = useMemo(() => {
    const q = directSearch.trim().toLowerCase();
    if (!q) return colleagues;
    return colleagues.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.farmNames.some((f) => f.toLowerCase().includes(q)),
    );
  }, [colleagues, directSearch]);

  const handleStartDirectChat = async (targetUserId: string) => {
    if (!targetUserId || targetUserId === currentUserId) return;
    setStartingDirectId(targetUserId);
    setMessageError(null);
    try {
      const dmGroup = await chatGroupService.startDirectChat(targetUserId);
      setGroups((prev) => {
        const exists = prev.some((g) => g.id === dmGroup.id);
        const next = exists
          ? prev.map((g) => (g.id === dmGroup.id ? dmGroup : g))
          : [dmGroup, ...prev];
        return next.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });
      selectGroup(dmGroup.id);
      setShowDirectPicker(false);
      setDirectSearch('');
    } catch (err) {
      setMessageError(getErrorMessage(err) || 'Không thể mở cuộc trò chuyện riêng.');
    } finally {
      setStartingDirectId(null);
    }
  };

  const filteredGroups = useMemo(() => {
    const filtered = groups.filter((g) => {
      const isDirect = g.type === 'DIRECT';
      if (chatFilter === 'FARM_GROUP' && isDirect) return false;
      if (chatFilter === 'DIRECT' && !isDirect) return false;

      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      const displayName = getGroupDisplayName(g).toLowerCase();
      const partnerEmail = getDirectPartner(g)?.user?.email?.toLowerCase() || '';
      return (
        displayName.includes(q) ||
        partnerEmail.includes(q) ||
        g.farm?.name?.toLowerCase().includes(q) ||
        g.farm?.address?.toLowerCase().includes(q)
      );
    });
    return sortGroupsByPriority(filtered, unreadCounts);
  }, [groups, chatFilter, searchTerm, unreadCounts, getGroupDisplayName, getDirectPartner]);

  const tabCounts = useMemo(() => {
    const unreadOf = (pred: (g: ChatGroupItem) => boolean) =>
      groups.filter((g) => pred(g) && (unreadCounts[g.id] || 0) > 0).length;
    return {
      ALL: unreadOf(() => true),
      FARM_GROUP: unreadOf((g) => g.type !== 'DIRECT'),
      DIRECT: unreadOf((g) => g.type === 'DIRECT'),
    };
  }, [groups, unreadCounts]);

  // Thời điểm xa nhất mà người khác đã nhận / đã xem → tính trạng thái một lần.
  const receiptMarks = useMemo(() => {
    let read = 0;
    let delivered = 0;
    (activeGroup?.members || []).forEach((m) => {
      if (m.userId === currentUserId) return;
      const r = m.lastReadAt ? new Date(m.lastReadAt).getTime() : 0;
      const d = m.lastDeliveredAt ? new Date(m.lastDeliveredAt).getTime() : 0;
      read = Math.max(read, r);
      delivered = Math.max(delivered, d, r);
    });
    return { read, delivered };
  }, [activeGroup?.members, currentUserId]);

  const lastOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m.isSystem && m.senderId === currentUserId) return m.id;
    }
    return null;
  }, [messages, currentUserId]);

  const getReceiptStatus = (msg: ChatMessageItem): ReceiptStatus | null => {
    if (msg.senderId !== currentUserId || msg.isSystem) return null;
    if (msg.id.startsWith('temp-')) return 'SENDING';
    if (msg.id !== lastOwnMessageId) return null;
    const t = new Date(msg.createdAt).getTime();
    if (receiptMarks.read >= t) return 'READ';
    if (receiptMarks.delivered >= t) return 'DELIVERED';
    return 'SENT';
  };

  // Gộp tin theo cụm người gửi + chèn mốc ngày.
  const renderItems = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const t = new Date(msg.createdAt).getTime();
      const showDay =
        !prev || startOfDay(new Date(prev.createdAt)) !== startOfDay(new Date(msg.createdAt));
      const continuesFrom = (a?: ChatMessageItem, b?: ChatMessageItem) =>
        !!a &&
        !!b &&
        !a.isSystem &&
        !b.isSystem &&
        a.senderId === b.senderId &&
        startOfDay(new Date(a.createdAt)) === startOfDay(new Date(b.createdAt)) &&
        Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) <
          GROUPING_WINDOW_MS;
      return {
        msg,
        time: t,
        showDay,
        isFirstOfRun: !continuesFrom(prev, msg),
        isLastOfRun: !continuesFrom(msg, next),
      };
    });
  }, [messages]);

  const sortedMembers = useMemo(() => {
    const rank = (role?: string) => (role === 'FARM_MANAGER' ? 0 : role === 'TECHNICIAN' ? 1 : 2);
    return [...(activeGroup?.members || [])].sort((a, b) => {
      const isOwnerA = a.userId === activeGroup?.farm?.ownerId ? -1 : 0;
      const isOwnerB = b.userId === activeGroup?.farm?.ownerId ? -1 : 0;
      if (isOwnerA !== isOwnerB) return isOwnerA - isOwnerB;
      if (rank(a.role) !== rank(b.role)) return rank(a.role) - rank(b.role);
      return (a.user?.fullName || '').localeCompare(b.user?.fullName || '', 'vi');
    });
  }, [activeGroup?.members, activeGroup?.farm?.ownerId]);

  // ─── Trạng thái toàn trang ─────────────────────────────────────────────

  const shellClass =
    'bg-white rounded-3xl border border-slate-200 shadow-sm h-[calc(100vh-140px)] min-h-[520px]';

  if (loadingGroups) {
    return (
      <div className={`${shellClass} flex overflow-hidden`}>
        <div className="w-full lg:w-80 border-r border-slate-200 p-4 space-y-4">
          <div className="h-9 rounded-xl bg-slate-100 animate-pulse" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
                <div className="h-2.5 w-full rounded bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:flex flex-1 items-center justify-center text-slate-400 text-sm gap-2">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          Đang tải cuộc trò chuyện...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${shellClass} border-red-200 flex flex-col items-center justify-center p-8 text-center`}>
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">
          Không thể tải Nhóm Chat Trang Trại
        </h3>
        <p className="text-sm text-red-600 max-w-md mb-4">{loadError}</p>
        <button
          onClick={() => {
            setLoadingGroups(true);
            void fetchGroups(false);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={`${shellClass} flex flex-col items-center justify-center p-8 text-center`}>
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">
          Chưa có Nhóm Chat Trang Trại
        </h3>
        <p className="text-sm text-slate-500 max-w-md">
          Khi bạn tạo trang trại mới hoặc được phân công vào một trang trại, nhóm chat của trang trại đó sẽ tự động được khởi tạo và thêm bạn vào nhóm.
        </p>
      </div>
    );
  }

  const activeName = activeGroup ? getGroupDisplayName(activeGroup) : '';
  const activePartner = activeGroup ? getDirectPartner(activeGroup) : null;
  const charsLeft = MAX_MESSAGE_LENGTH - messageInput.length;

  // ─── Khối giao diện ────────────────────────────────────────────────────

  const sidebar = (
    <aside
      className={`${
        mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
      } w-full lg:w-80 xl:w-[340px] border-r border-slate-200 flex-col bg-white flex-shrink-0 min-h-0`}
    >
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">Trò chuyện</h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {groups.filter((g) => g.type !== 'DIRECT').length} nhóm trại ·{' '}
              {groups.filter((g) => g.type === 'DIRECT').length} cá nhân
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void fetchGroups(true)}
              title="Làm mới danh sách"
              aria-label="Làm mới danh sách"
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDirectPicker(true)}
              title="Tin nhắn riêng mới"
              aria-label="Tin nhắn riêng mới"
              className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm nhóm, đồng nghiệp..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-100 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              aria-label="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl" role="tablist">
          {(
            [
              { id: 'ALL', label: 'Tất cả' },
              { id: 'FARM_GROUP', label: 'Nhóm trại' },
              { id: 'DIRECT', label: 'Cá nhân' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={chatFilter === tab.id}
              onClick={() => setChatFilter(tab.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                chatFilter === tab.id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" aria-label="có tin chưa đọc" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {filteredGroups.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Search className="w-6 h-6 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-medium">
              {searchTerm ? `Không tìm thấy "${searchTerm}"` : 'Chưa có cuộc trò chuyện nào'}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isSelected = group.id === selectedGroupId;
            const isDirect = group.type === 'DIRECT';
            const displayName = getGroupDisplayName(group);
            const lastMsg = group.messages?.[0];
            const unreadCount = unreadCounts[group.id] || 0;
            const lastIsMine = lastMsg && !lastMsg.isSystem && lastMsg.senderId === currentUserId;
            const lastSender = lastMsg?.isSystem
              ? ''
              : lastIsMine
                ? 'Bạn: '
                : !isDirect && lastMsg
                  ? `${(lastMsg.sender?.fullName || 'Thành viên').split(' ').slice(-1)[0]}: `
                  : '';

            return (
              <button
                key={group.id}
                onClick={() => selectGroup(group.id)}
                className={`w-full text-left px-2.5 py-2.5 rounded-2xl transition-colors flex items-center gap-3 cursor-pointer ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}
              >
                {isDirect ? (
                  <Avatar name={displayName} seed={getDirectPartner(group)?.userId || group.id} size="lg" />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`text-sm truncate ${
                        unreadCount > 0 ? 'font-black text-slate-900' : 'font-bold text-slate-800'
                      } ${isSelected ? 'text-blue-900' : ''}`}
                    >
                      {displayName}
                    </p>
                    <span
                      className={`text-[11px] flex-shrink-0 ${
                        unreadCount > 0 ? 'text-blue-600 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {formatListTime(lastMsg?.createdAt || group.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className={`text-xs truncate ${
                        unreadCount > 0 ? 'font-semibold text-slate-800' : 'text-slate-500'
                      }`}
                    >
                      {lastMsg ? `${lastSender}${previewOf(lastMsg)}` : 'Chưa có tin nhắn'}
                    </p>
                    {unreadCount > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );

  const memberPanel =
    activeGroup && !isActiveDirect && showMemberPanel ? (
      <>
        {/* Nền mờ cho dạng ngăn kéo trên màn hình hẹp */}
        <div
          className="xl:hidden absolute inset-0 bg-slate-900/20 z-20"
          onClick={() => setShowMemberPanel(false)}
          aria-hidden="true"
        />
        <aside className="absolute xl:static right-0 inset-y-0 z-30 w-[320px] max-w-[90%] border-l border-slate-200 bg-white flex flex-col flex-shrink-0 shadow-xl xl:shadow-none min-h-0">
          <div className="px-4 py-3.5 border-b border-slate-200 flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Thành viên ({activeGroup.members?.length || 0})
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Nhân sự của trang trại tự động có mặt trong nhóm.
              </p>
            </div>
            <button
              onClick={() => setShowMemberPanel(false)}
              aria-label="Đóng danh sách thành viên"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isGroupManager && (
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-2.5">
              <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                Thêm nhân sự vào trại & nhóm
              </p>

              {inviteError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold rounded-xl flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{inviteError}</span>
                </div>
              )}

              {inviteSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold rounded-xl flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{inviteSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddMemberToFarmAndGroup} className="space-y-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  placeholder="Email nhân sự..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <div className="flex gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as 'FARMER' | 'TECHNICIAN')
                    }
                    className="flex-1 px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="FARMER">Nông dân</option>
                    <option value="TECHNICIAN">Kỹ thuật viên</option>
                  </select>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{inviting ? 'Đang thêm...' : 'Thêm'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {sortedMembers.map((member) => {
              const name = member.user?.fullName || member.user?.email || 'Thành viên';
              const isMe = member.userId === currentUserId;
              const isOwnerMember =
                member.userId === activeGroup.farm?.ownerId ||
                member.role === 'FARM_MANAGER';

              return (
                <div
                  key={member.id}
                  className="group/member px-2 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <Avatar name={name} seed={member.userId} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {name}
                      {isMe && <span className="text-slate-400 font-medium"> (bạn)</span>}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 min-w-0">
                      <RoleBadge role={member.role} />
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-100 xl:opacity-0 xl:group-hover/member:opacity-100 focus-within:opacity-100 transition-opacity">
                    {!isMe && (
                      <button
                        onClick={() => void handleStartDirectChat(member.userId)}
                        disabled={startingDirectId === member.userId}
                        title={`Nhắn riêng cho ${name}`}
                        aria-label={`Nhắn riêng cho ${name}`}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    {isGroupManager && !isOwnerMember && (
                      <button
                        onClick={() => void handleRemoveMember(member.userId, name)}
                        disabled={removingUserId === member.userId}
                        title="Gỡ khỏi trang trại & nhóm chat"
                        aria-label={`Gỡ ${name} khỏi nhóm`}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </>
    ) : null;

  const chatPane = activeGroup ? (
    <section
      className={`${
        mobileView === 'list' ? 'hidden lg:flex' : 'flex'
      } flex-1 flex-col min-w-0 min-h-0 bg-slate-50/60 relative`}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => hasDraggedFiles(e) && e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="px-3 sm:px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setMobileView('list')}
            aria-label="Quay lại danh sách"
            className="lg:hidden p-2 -ml-1 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {isActiveDirect ? (
            <Avatar name={activeName} seed={activePartner?.userId || activeGroup.id} size="lg" />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[15px] font-black text-slate-800 truncate">{activeName}</h3>
            {isActiveDirect ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                {activePartner?.role && <RoleBadge role={activePartner.role} />}
                <span className="truncate">{activePartner?.user?.email}</span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 min-w-0">
                <span className="flex-shrink-0">{activeGroup.members?.length || 1} thành viên</span>
                {activeGroup.farm?.address && (
                  <>
                    <span aria-hidden="true">·</span>
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{activeGroup.farm.address}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {!isActiveDirect && (
          <button
            onClick={() => setShowMemberPanel((prev) => !prev)}
            aria-pressed={showMemberPanel}
            title="Thành viên nhóm"
            className={`p-2 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer flex-shrink-0 ${
              showMemberPanel
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Thành viên</span>
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="h-full overflow-y-auto px-3 sm:px-6 py-4"
          aria-live="polite"
        >
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2">
              <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
              <span>Đang tải lịch sử trò chuyện...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-6">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-sm font-bold text-slate-600">Chưa có tin nhắn</p>
              <p className="text-xs mt-1">
                {isActiveDirect
                  ? `Gửi lời chào tới ${activeName}.`
                  : 'Hãy gửi tin nhắn đầu tiên tới các thành viên trang trại!'}
              </p>
            </div>
          ) : (
            renderItems.map(({ msg, showDay, isFirstOfRun, isLastOfRun }) => {
              const dayDivider = showDay ? (
                <div className="flex items-center gap-3 my-4" role="separator">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-500 first-letter:uppercase">
                    {formatDayLabel(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              ) : null;

              if (msg.isSystem) {
                return (
                  <React.Fragment key={msg.id}>
                    {dayDivider}
                    <div className="flex justify-center my-3">
                      <div className="px-3 py-1 rounded-full bg-slate-200/70 text-slate-600 text-[11px] font-semibold max-w-lg text-center">
                        {msg.content}
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              const isMe = msg.senderId === currentUserId;
              const isTemp = msg.id.startsWith('temp-');
              const senderName = msg.sender?.fullName || msg.sender?.email || 'Thành viên';
              const receipt = getReceiptStatus(msg);
              const hasImage = !!msg.attachmentUrl && isImageAttachment(msg);
              const imageOnly = hasImage && !msg.content && !msg.replyTo;

              const bubbleShape = isMe
                ? `rounded-2xl ${isFirstOfRun ? '' : 'rounded-tr-md'} ${isLastOfRun ? '' : 'rounded-br-md'}`
                : `rounded-2xl ${isFirstOfRun ? '' : 'rounded-tl-md'} ${isLastOfRun ? '' : 'rounded-bl-md'}`;

              return (
                <React.Fragment key={msg.id}>
                  {dayDivider}
                  <div
                    className={`group flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${
                      isFirstOfRun ? 'mt-3' : 'mt-0.5'
                    }`}
                  >
                    {/* Ảnh đại diện người gửi (chỉ ở tin cuối của cụm) */}
                    {!isMe && (
                      <div className="w-8 flex-shrink-0 flex items-end">
                        {isLastOfRun && <Avatar name={senderName} seed={msg.senderId} size="sm" />}
                      </div>
                    )}

                    <div
                      className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[70%] ${
                        isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      {isFirstOfRun && !isMe && !isActiveDirect && (
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-bold text-slate-600">{senderName}</span>
                          {msg.sender?.role && msg.sender.role !== 'FARMER' && (
                            <RoleBadge role={msg.sender.role} />
                          )}
                        </div>
                      )}

                      <div className={`flex items-center gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div
                          title={new Date(msg.createdAt).toLocaleString('vi-VN')}
                          className={`text-sm leading-relaxed min-w-0 ${bubbleShape} ${
                            imageOnly
                              ? 'p-0 overflow-hidden'
                              : isMe
                                ? 'px-3.5 py-2 bg-blue-600 text-white'
                                : 'px-3.5 py-2 bg-white text-slate-800 border border-slate-200'
                          } ${isTemp ? 'opacity-70' : ''} space-y-1.5`}
                        >
                          {msg.replyTo && (
                            <div
                              className={`px-2.5 py-1.5 rounded-lg border-l-2 text-xs ${
                                isMe
                                  ? 'bg-blue-700/50 border-l-blue-200 text-blue-50'
                                  : 'bg-slate-100 border-l-blue-500 text-slate-600'
                              }`}
                            >
                              <p className="font-bold truncate">
                                {msg.replyTo.senderId === currentUserId
                                  ? 'Bạn'
                                  : msg.replyTo.sender?.fullName || 'Thành viên'}
                              </p>
                              <p className="truncate opacity-90">{previewOf(msg.replyTo)}</p>
                            </div>
                          )}
                          {hasImage ? (
                            <a
                              href={msg.attachmentUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`block overflow-hidden ${imageOnly ? '' : 'rounded-xl'}`}
                            >
                              <img
                                src={msg.attachmentUrl!}
                                alt={msg.attachmentName || 'Hình ảnh đính kèm'}
                                loading="lazy"
                                className={`max-h-72 max-w-full w-auto object-cover ${
                                  imageOnly ? 'rounded-2xl border border-slate-200' : 'rounded-xl'
                                }`}
                              />
                            </a>
                          ) : msg.attachmentUrl ? (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={msg.attachmentName || undefined}
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-colors max-w-xs ${
                                isMe
                                  ? 'bg-blue-700/50 border-blue-400/40 text-white hover:bg-blue-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isMe ? 'bg-white/15' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate">
                                  {msg.attachmentName || 'Tài liệu đính kèm'}
                                </p>
                                {msg.attachmentSize ? (
                                  <p className={`text-[10px] ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                                    {formatFileSize(msg.attachmentSize)}
                                  </p>
                                ) : null}
                              </div>
                              <Download className="w-4 h-4 flex-shrink-0 opacity-80" />
                            </a>
                          ) : null}

                          {msg.content ? (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          ) : null}
                        </div>

                        {!isTemp && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(msg);
                              textareaRef.current?.focus();
                            }}
                            title="Trả lời"
                            aria-label="Trả lời tin nhắn này"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-full transition-all cursor-pointer flex-shrink-0"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {(isLastOfRun || receipt) && (
                        <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] font-semibold text-slate-400">
                          {isLastOfRun && <span>{formatTime(msg.createdAt)}</span>}
                          {receipt && (
                            <>
                              {isLastOfRun && <span aria-hidden="true">·</span>}
                              <ReceiptLabel status={receipt} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {newIncomingCount > 0 && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            {newIncomingCount} tin nhắn mới
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="px-3 sm:px-4 py-3 bg-white border-t border-slate-200">
        {messageError && (
          <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">{messageError}</span>
            <button
              type="button"
              onClick={() => setMessageError(null)}
              aria-label="Ẩn lỗi"
              className="p-0.5 hover:bg-red-100 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {replyingTo && (
          <div className="mb-2 px-3 py-2 bg-slate-50 border-l-4 border-l-blue-600 rounded-lg flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                <Reply className="w-3 h-3" />
                Trả lời{' '}
                {replyingTo.senderId === currentUserId
                  ? 'chính bạn'
                  : replyingTo.sender?.fullName || 'Thành viên'}
              </p>
              <p className="text-xs text-slate-600 truncate">{previewOf(replyingTo)}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Hủy trả lời"
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {pendingFile && (
          <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {pendingPreviewUrl ? (
                <img
                  src={pendingPreviewUrl}
                  alt={pendingFile.name}
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{pendingFile.name}</p>
                <p className="text-[11px] text-slate-400">
                  {uploadingFile ? 'Đang tải lên...' : formatFileSize(pendingFile.size)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearPendingFile}
              aria-label="Bỏ tệp đính kèm"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSendMessage} className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={handleSelectFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            title="Đính kèm ảnh hoặc tài liệu (tối đa 10MB)"
            aria-label="Đính kèm tệp"
            className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                if (messageError) setMessageError(null);
              }}
              onKeyDown={handleComposerKeyDown}
              onPaste={handlePaste}
              maxLength={MAX_MESSAGE_LENGTH + 200}
              placeholder={
                isActiveDirect
                  ? `Nhắn cho ${activeName}...`
                  : `Nhắn tới nhóm ${activeGroup.farm?.name || activeGroup.name}...`
              }
              aria-label="Nội dung tin nhắn"
              className="block w-full resize-none px-4 py-2.5 bg-slate-100 border border-transparent rounded-2xl text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors max-h-40 leading-relaxed"
            />
            {charsLeft < 200 && (
              <span
                className={`absolute right-3 bottom-1 text-[10px] font-bold ${
                  charsLeft < 0 ? 'text-red-600' : 'text-slate-400'
                }`}
              >
                {charsLeft}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={(!messageInput.trim() && !pendingFile) || uploadingFile || charsLeft < 0}
            aria-label="Gửi tin nhắn"
            title="Gửi (Enter) · Xuống dòng (Shift + Enter)"
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex-shrink-0"
          >
            {uploadingFile ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
        <p className="hidden sm:block mt-1.5 px-1 text-[10px] text-slate-400">
          Enter để gửi · Shift + Enter để xuống dòng · Dán hoặc kéo thả ảnh/tệp vào khung chat
        </p>
      </div>

      {isDraggingFile && (
        <div className="absolute inset-2 z-40 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/90 flex flex-col items-center justify-center text-blue-700 pointer-events-none">
          <Upload className="w-8 h-8 mb-2" />
          <p className="text-sm font-bold">Thả tệp để đính kèm</p>
          <p className="text-xs text-blue-600/80">Ảnh, PDF, Word, Excel · tối đa 10MB</p>
        </div>
      )}
    </section>
  ) : (
    <section className="hidden lg:flex flex-1 items-center justify-center text-slate-400 text-sm">
      Chọn một cuộc trò chuyện để bắt đầu
    </section>
  );

  return (
    <div className={`${shellClass} flex overflow-hidden relative`}>
      {sidebar}
      {chatPane}
      {memberPanel}

      {/* Modal chọn đồng nghiệp để nhắn riêng */}
      {showDirectPicker && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowDirectPicker(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nhắn tin riêng"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">Tin nhắn riêng mới</h3>
                <p className="text-[11px] text-slate-500">
                  Chọn đồng nghiệp cùng trang trại để trao đổi riêng
                </p>
              </div>
              <button
                onClick={() => setShowDirectPicker(false)}
                aria-label="Đóng"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  type="text"
                  value={directSearch}
                  onChange={(e) => setDirectSearch(e.target.value)}
                  placeholder="Tìm theo tên, email hoặc trang trại..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 min-h-0">
              {filteredColleagues.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">
                  {colleagues.length === 0
                    ? 'Chưa có thành viên nào khác trong các trang trại của bạn.'
                    : 'Không tìm thấy đồng nghiệp phù hợp.'}
                </p>
              ) : (
                filteredColleagues.map((person) => (
                  <button
                    key={person.userId}
                    onClick={() => void handleStartDirectChat(person.userId)}
                    disabled={startingDirectId === person.userId}
                    className="w-full px-3 py-2.5 rounded-2xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-left cursor-pointer disabled:opacity-60"
                  >
                    <Avatar name={person.fullName} seed={person.userId} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{person.fullName}</p>
                        <RoleBadge role={person.role} />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {person.farmNames.length > 0 ? person.farmNames.join(', ') : person.email}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-blue-600 flex-shrink-0">
                      {startingDirectId === person.userId ? 'Đang mở...' : 'Nhắn'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
