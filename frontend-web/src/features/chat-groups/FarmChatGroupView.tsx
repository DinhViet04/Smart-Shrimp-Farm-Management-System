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
  User,
  MessageCircle,
  X,
  Paperclip,
  FileText,
  Download,
  Reply,
  Check,
  CheckCheck,
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import {
  chatGroupService,
  type ChatAttachment,
  type ChatGroupItem,
  type ChatMessageItem,
} from '../../services/chat-group.service';
import { farmService } from '../../services/farm.service';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [chatFilter, setChatFilter] = useState<'ALL' | 'FARM_GROUP' | 'DIRECT'>('ALL');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showMemberPanel, setShowMemberPanel] = useState(true);
  const [showDirectPicker, setShowDirectPicker] = useState(false);
  const [startingDirectId, setStartingDirectId] = useState<string | null>(null);

  // Add member form state (for Farm Manager)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'FARMER' | 'TECHNICIAN'>('FARMER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedGroupIdRef = useRef<string | null>(null);
  const messagesCacheRef = useRef<Record<string, ChatMessageItem[]>>({});

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

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
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
    } catch (err: any) {
      console.error('Failed to load chat groups:', err);
      setLoadError(err?.message || 'Không thể kết nối tới máy chủ nhóm chat.');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const fetchMessages = useCallback(async (groupId: string) => {
    const cached = messagesCacheRef.current[groupId];
    if (cached) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setLoadingMessages(true);
    }
    try {
      const data = await chatGroupService.getMessages(groupId);
      messagesCacheRef.current[groupId] = data;
      if (selectedGroupIdRef.current === groupId) {
        setMessages(data);
        if (!cached) scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to load group messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

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
    } else {
      setMessages([]);
    }
  }, [selectedGroupId, fetchMessages]);

  // Socket.IO connection
  const socketRef = useRef<Socket | null>(null);

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
        scrollToBottom();
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
  }, [currentUserId, fetchGroups, fetchMessages]);

  const activeGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const isGroupManager =
    currentUser?.role === 'ADMIN' ||
    (activeGroup?.farm?.ownerId && activeGroup.farm.ownerId === currentUserId);

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

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessageError('Dung lượng tệp tối đa là 10MB.');
      return;
    }
    clearPendingFile();
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      setPendingPreviewUrl(URL.createObjectURL(file));
    }
    if (messageError) setMessageError(null);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    setMessageError(null);

    const trimmed = messageInput.trim();
    const fileToSend = pendingFile;
    const localPreview = pendingPreviewUrl;
    const replyTarget = replyingTo;

    if (!trimmed && !fileToSend) {
      setMessageError('Vui lòng nhập nội dung hoặc chọn tệp đính kèm.');
      return;
    }
    if (trimmed.length > 2000) {
      setMessageError('Tin nhắn không được vượt quá 2000 ký tự.');
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
                err: any,
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
    } catch (err: any) {
      setUploadingFile(false);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessageInput(trimmed);
      setMessageError(err.message || 'Không thể gửi tin nhắn.');
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
    } catch (err: any) {
      setInviteError(err.message || 'Không thể thêm thành viên vào nhóm.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!activeGroup?.farmId) return;
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
    } catch (err: any) {
      setInviteError(err.message || 'Không thể gỡ thành viên khỏi nhóm.');
    } finally {
      setRemovingUserId(null);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'FARM_MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3 h-3" /> Quản lý trại
          </span>
        );
      case 'TECHNICIAN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200">
            <FlaskConical className="w-3 h-3" /> Kỹ thuật viên
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <UserCheck className="w-3 h-3" /> Nông dân
          </span>
        );
    }
  };

  const getDirectPartner = (group: ChatGroupItem) => {
    if (group.type !== 'DIRECT') return null;
    return (
      group.members?.find((m) => m.userId !== currentUserId) ||
      group.members?.[0] ||
      null
    );
  };

  const getGroupDisplayName = (group: ChatGroupItem) => {
    if (group.type === 'DIRECT') {
      const partner = getDirectPartner(group);
      return partner?.user?.fullName || partner?.user?.email || group.name;
    }
    return group.farm?.name || group.name;
  };

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
    return Array.from(map.values());
  }, [groups, currentUserId]);

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
      setSelectedGroupId(dmGroup.id);
      setShowDirectPicker(false);
    } catch (err: any) {
      setMessageError(err.message || 'Không thể mở cuộc trò chuyện riêng.');
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
  }, [groups, chatFilter, searchTerm, unreadCounts, currentUserId]);

  if (loadingGroups) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold">Đang tải nhóm chat trang trại...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-3xl border border-red-200 shadow-sm h-[calc(100vh-140px)] flex flex-col items-center justify-center p-8 text-center">
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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm h-[calc(100vh-140px)] flex flex-col items-center justify-center p-8 text-center">
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

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm h-[calc(100vh-140px)] min-h-[580px] flex overflow-hidden">
      {/* Left Sidebar: Farm Chat Groups */}
      <div className="w-72 sm:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 flex-shrink-0">
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800">Trò chuyện</h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {groups.filter((g) => g.type !== 'DIRECT').length} nhóm trại •{' '}
                  {groups.filter((g) => g.type === 'DIRECT').length} riêng tư
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowDirectPicker(true)}
                title="Nhắn riêng cho thành viên"
                className="px-2 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Nhắn riêng</span>
              </button>
              <button
                onClick={() => void fetchGroups(true)}
                title="Làm mới danh sách"
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-1 mb-2.5">
            {(
              [
                { id: 'ALL', label: 'Tất cả' },
                { id: 'FARM_GROUP', label: 'Nhóm trại' },
                { id: 'DIRECT', label: 'Cá nhân' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setChatFilter(tab.id)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  chatFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm nhóm hoặc tên đồng nghiệp..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100/80 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredGroups.map((group) => {
            const isSelected = group.id === selectedGroupId;
            const isDirect = group.type === 'DIRECT';
            const partner = getDirectPartner(group);
            const displayName = getGroupDisplayName(group);
            const lastMsg = group.messages?.[0];
            const memberCount = group._count?.members ?? group.members?.length ?? 1;
            const unreadCount = unreadCounts[group.id] || 0;

            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                    : 'hover:bg-white'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                    isDirect
                      ? isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-indigo-100 text-indigo-700'
                      : isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {isDirect ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`text-sm font-bold truncate ${
                        isSelected ? 'text-blue-900' : 'text-slate-800'
                      }`}
                    >
                      {displayName}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                      {!isDirect && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" /> {memberCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {isDirect ? (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {partner?.user?.email || 'Tin nhắn riêng tư'}
                    </p>
                  ) : (
                    group.farm?.address && (
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {group.farm.address}
                      </p>
                    )
                  )}
                  <p
                    className={`text-xs truncate mt-1 ${
                      unreadCount > 0
                        ? 'font-bold text-slate-900'
                        : 'text-slate-500'
                    }`}
                  >
                    {lastMsg
                      ? `${lastMsg.isSystem ? '' : `${lastMsg.sender?.fullName || 'Thành viên'}: `}${
                          lastMsg.content ||
                          (lastMsg.attachmentType?.startsWith('image/')
                            ? '📷 Đã gửi một hình ảnh'
                            : '📎 Đã gửi một tệp đính kèm')
                        }`
                      : 'Chưa có tin nhắn'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: Active Chat Stream */}
      {activeGroup ? (
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/30">
          {/* Chat Header */}
          <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-sm flex-shrink-0 ${
                  activeGroup.type === 'DIRECT'
                    ? 'bg-gradient-to-br from-indigo-600 to-violet-500'
                    : 'bg-gradient-to-br from-blue-600 to-cyan-500'
                }`}
              >
                {activeGroup.type === 'DIRECT' ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-800 truncate">
                    {getGroupDisplayName(activeGroup)}
                  </h3>
                </div>
                {activeGroup.type === 'DIRECT' ? (
                  <p className="text-xs text-slate-500 flex items-center gap-2 truncate">
                    <span>Trò chuyện riêng tư</span>
                    {getDirectPartner(activeGroup)?.role &&
                      getRoleBadge(getDirectPartner(activeGroup)?.role)}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 flex items-center gap-2 truncate">
                    <span>{activeGroup.members?.length || 1} thành viên trong nhóm</span>
                    {activeGroup.farm?.address && (
                      <>
                        <span>•</span>
                        <span className="truncate">{activeGroup.farm.address}</span>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {activeGroup.type !== 'DIRECT' && (
              <button
                onClick={() => setShowMemberPanel((prev) => !prev)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  showMemberPanel
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Thành viên ({activeGroup.members?.length || 1})</span>
              </button>
            )}
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loadingMessages ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2">
                <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                <span>Đang tải lịch sử trò chuyện...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-medium">
                  Hãy gửi tin nhắn đầu tiên tới các thành viên trang trại!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="px-3.5 py-1.5 rounded-full bg-slate-200/75 text-slate-600 text-[11px] font-semibold max-w-lg text-center">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                const isMe = msg.senderId === currentUserId;
                const senderName =
                  msg.sender?.fullName || msg.sender?.email || 'Thành viên';
                const receiptStatus = (() => {
                  if (!isMe || msg.isSystem) return null;
                  if (msg.id.startsWith('temp-')) return 'SENDING';
                  const msgTime = new Date(msg.createdAt).getTime();
                  const others = (activeGroup?.members || []).filter(
                    (m) => m.userId !== currentUserId,
                  );
                  if (
                    others.some(
                      (m) => m.lastReadAt && new Date(m.lastReadAt).getTime() >= msgTime,
                    )
                  ) {
                    return 'READ';
                  }
                  if (
                    others.some(
                      (m) =>
                        m.lastDeliveredAt &&
                        new Date(m.lastDeliveredAt).getTime() >= msgTime,
                    )
                  ) {
                    return 'DELIVERED';
                  }
                  return 'SENT';
                })();

                return (
                  <div
                    key={msg.id}
                    className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-bold text-slate-600">
                        {isMe ? 'Bạn' : senderName}
                      </span>
                      {getRoleBadge(msg.sender?.role)}
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 max-w-[80%] ${
                        isMe ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm space-y-2 ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-xs'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                        }`}
                      >
                      {msg.replyTo && (
                        <div
                          className={`px-3 py-1.5 rounded-xl border-l-2 text-xs ${
                            isMe
                              ? 'bg-blue-700/60 border-l-blue-200 text-blue-50'
                              : 'bg-slate-100 border-l-blue-500 text-slate-600'
                          }`}
                        >
                          <p className="font-bold truncate">
                            {msg.replyTo.senderId === currentUserId
                              ? 'Bạn'
                              : msg.replyTo.sender?.fullName || 'Thành viên'}
                          </p>
                          <p className="truncate opacity-90">
                            {msg.replyTo.content ||
                              (msg.replyTo.attachmentName
                                ? `📎 ${msg.replyTo.attachmentName}`
                                : 'Tin nhắn đính kèm')}
                          </p>
                        </div>
                      )}
                      {msg.attachmentUrl && isImageAttachment(msg) ? (
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-xl"
                        >
                          <img
                            src={msg.attachmentUrl}
                            alt={msg.attachmentName || 'Hình ảnh đính kèm'}
                            className="max-h-64 w-auto rounded-xl object-cover"
                          />
                        </a>
                      ) : msg.attachmentUrl ? (
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={msg.attachmentName || undefined}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
                            isMe
                              ? 'bg-blue-700/60 border-blue-400/40 text-white hover:bg-blue-700'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <FileText className="w-5 h-5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">
                              {msg.attachmentName || 'Tài liệu đính kèm'}
                            </p>
                            {msg.attachmentSize ? (
                              <p
                                className={`text-[10px] ${
                                  isMe ? 'text-blue-100' : 'text-slate-400'
                                }`}
                              >
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
                    {!msg.id.startsWith('temp-') && (
                      <button
                        type="button"
                        onClick={() => setReplyingTo(msg)}
                        title="Trả lời tin nhắn này"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer flex-shrink-0"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                    {receiptStatus && (
                      <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] font-semibold">
                        {receiptStatus === 'SENDING' && (
                          <span className="text-slate-400">Đang gửi...</span>
                        )}
                        {receiptStatus === 'SENT' && (
                          <span className="text-slate-400 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Đã gửi
                          </span>
                        )}
                        {receiptStatus === 'DELIVERED' && (
                          <span className="text-slate-500 flex items-center gap-0.5">
                            <CheckCheck className="w-3 h-3" /> Đã nhận
                          </span>
                        )}
                        {receiptStatus === 'READ' && (
                          <span className="text-blue-600 flex items-center gap-0.5">
                            <CheckCheck className="w-3 h-3" /> Đã xem
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="p-4 bg-white border-t border-slate-200">
            {messageError && (
              <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{messageError}</span>
              </div>
            )}

            {replyingTo && (
              <div className="mb-2.5 px-3 py-2 bg-blue-50/70 border border-blue-200 border-l-4 border-l-blue-600 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                    <Reply className="w-3 h-3" />
                    Đang trả lời{' '}
                    {replyingTo.senderId === currentUserId
                      ? 'chính bạn'
                      : replyingTo.sender?.fullName || 'Thành viên'}
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    {replyingTo.content ||
                      (replyingTo.attachmentName
                        ? `📎 ${replyingTo.attachmentName}`
                        : 'Tin nhắn đính kèm')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {pendingFile && (
              <div className="mb-2.5 p-2 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {pendingPreviewUrl ? (
                    <img
                      src={pendingPreviewUrl}
                      alt={pendingFile.name}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {pendingFile.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatFileSize(pendingFile.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearPendingFile}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
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
                title="Đính kèm ảnh hoặc tài liệu (PDF, Word, Excel)"
                className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-2xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  if (messageError) setMessageError(null);
                }}
                placeholder={
                  activeGroup.type === 'DIRECT'
                    ? `Nhắn riêng cho ${getGroupDisplayName(activeGroup)}...`
                    : `Nhắn tin tới nhóm ${activeGroup.farm?.name || activeGroup.name}...`
                }
                className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button
                type="submit"
                disabled={(!messageInput.trim() && !pendingFile) || uploadingFile}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{uploadingFile ? 'Đang tải...' : 'Gửi'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Right Panel: Group Members & Quick Add Member to Farm + Chat Group */}
      {activeGroup && activeGroup.type !== 'DIRECT' && showMemberPanel && (
        <div className="w-80 border-l border-slate-200 bg-white flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-slate-200">
            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Thành viên nhóm ({activeGroup.members?.length || 0})
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Thành viên được thêm vào trang trại sẽ tự động vào nhóm chat này.
            </p>
          </div>

          {/* Add Member Form for Farm Manager */}
          {isGroupManager && (
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-2.5">
              <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                Thêm thành viên vào trại & nhóm
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
                  placeholder="Nhập email nhân sự..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as 'FARMER' | 'TECHNICIAN')
                    }
                    className="flex-1 px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="FARMER">Nông dân (Farmer)</option>
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

          {/* Member List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(activeGroup.members || []).map((member) => {
              const name =
                member.user?.fullName || member.user?.email || 'Thành viên';
              const isOwnerMember =
                member.userId === activeGroup.farm?.ownerId ||
                member.role === 'FARM_MANAGER';

              return (
                <div
                  key={member.id}
                  className="p-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {member.user?.email}
                    </p>
                    <div className="mt-1">{getRoleBadge(member.role)}</div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {member.userId !== currentUserId && (
                      <button
                        onClick={() => void handleStartDirectChat(member.userId)}
                        disabled={startingDirectId === member.userId}
                        title={`Nhắn riêng cho ${name}`}
                        className="px-2 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Nhắn riêng</span>
                      </button>
                    )}

                    {isGroupManager && !isOwnerMember && (
                      <button
                        onClick={() => void handleRemoveMember(member.userId, name)}
                        disabled={removingUserId === member.userId}
                        title="Gỡ khỏi trang trại & nhóm chat"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal chọn đồng nghiệp để nhắn riêng */}
      {showDirectPicker && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    Nhắn tin riêng
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chọn thành viên cùng trang trại để trao đổi nghiệp vụ riêng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDirectPicker(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-3 space-y-2">
              {colleagues.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">
                  Chưa có thành viên nào khác trong các trang trại của bạn.
                </p>
              ) : (
                colleagues.map((person) => (
                  <button
                    key={person.userId}
                    onClick={() => void handleStartDirectChat(person.userId)}
                    disabled={startingDirectId === person.userId}
                    className="w-full p-3 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all flex items-center justify-between gap-3 text-left cursor-pointer disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {person.fullName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {person.email}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {getRoleBadge(person.role)}
                          {person.farmNames.length > 0 && (
                            <span className="text-[10px] text-slate-500 truncate">
                              • {person.farmNames.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 flex-shrink-0">
                      {startingDirectId === person.userId ? 'Đang mở...' : 'Nhắn ngay'}
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

