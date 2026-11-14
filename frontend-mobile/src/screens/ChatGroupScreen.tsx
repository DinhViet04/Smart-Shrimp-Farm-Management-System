import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  Linking,
  BackHandler,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  MessageSquare,
  Send,
  Users,
  UserPlus,
  Building2,
  MapPin,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  MessageCircle,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Reply,
  Check,
  CheckCheck,
  ChevronLeft,
  Search,
} from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import {
  chatGroupService,
  MobileChatAttachment,
  MobileChatGroup,
  MobileChatMessage,
} from '../services/chatGroupService';
import { farmService } from '../services/farmService';

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  FARM_MANAGER: { label: 'Quản lý trại', color: '#1d4ed8', bg: '#dbeafe' },
  TECHNICIAN: { label: 'Kỹ thuật viên', color: '#0e7490', bg: '#cffafe' },
  FARMER: { label: 'Nông dân', color: '#047857', bg: '#d1fae5' },
};

const getGroupActivityTime = (g: MobileChatGroup) => {
  const ts = g.messages?.[0]?.createdAt || g.updatedAt;
  return ts ? new Date(ts).getTime() : 0;
};

const sortGroupsByPriority = (
  list: MobileChatGroup[],
  unreadMap: Record<string, number>,
) =>
  [...list].sort((a, b) => {
    const unreadA = (unreadMap[a.id] || 0) > 0 ? 1 : 0;
    const unreadB = (unreadMap[b.id] || 0) > 0 ? 1 : 0;
    if (unreadA !== unreadB) return unreadB - unreadA;
    return getGroupActivityTime(b) - getGroupActivityTime(a);
  });

const isImageAttachmentHelper = (msg?: {
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}) => {
  if (!msg?.attachmentUrl) return false;
  if (msg.attachmentType?.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(msg.attachmentUrl);
};

const formatConversationTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) {
    return 'Hôm qua';
  }
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const getLastMessageSnippet = (
  group: MobileChatGroup,
  myUserId?: string | null,
) => {
  const lastMsg = group.messages?.[0];
  if (!lastMsg) return 'Chưa có tin nhắn nào';
  if (lastMsg.isSystem) return lastMsg.content;
  const isMe = lastMsg.senderId === myUserId;
  const prefix = isMe
    ? 'Bạn: '
    : lastMsg.sender?.fullName
    ? `${lastMsg.sender.fullName}: `
    : '';
  if (lastMsg.attachmentUrl) {
    const isImage = isImageAttachmentHelper(lastMsg);
    if (isImage) {
      return `${prefix}[Hình ảnh]${lastMsg.content ? ` ${lastMsg.content}` : ''}`;
    }
    return `${prefix}[Tài liệu: ${lastMsg.attachmentName || 'Tệp'}]${
      lastMsg.content ? ` ${lastMsg.content}` : ''
    }`;
  }
  return `${prefix}${lastMsg.content || ''}`;
};

export default function ChatGroupScreen() {
  const { userId, userRole, currentUser, userToken } = useContext(AuthContext);

  const [groups, setGroups] = useState<MobileChatGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MobileChatMessage[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Message composer state
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    uri: string;
    name: string;
    type: string;
    size?: number;
    isImage: boolean;
  } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Members & Add Member Modal
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [showDirectPicker, setShowDirectPicker] = useState(false);
  const [startingDirectId, setStartingDirectId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [replyingTo, setReplyingTo] = useState<MobileChatMessage | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [listFilter, setListFilter] = useState<'ALL' | 'FARM_GROUP' | 'DIRECT'>('ALL');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'FARMER' | 'TECHNICIAN'>('FARMER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const selectedGroupIdRef = useRef<string | null>(null);
  const messagesCacheRef = useRef<Record<string, MobileChatMessage[]>>({});

  useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId;
  }, [selectedGroupId]);

  useEffect(() => {
    const onBackPress = () => {
      if (selectedGroupIdRef.current) {
        setSelectedGroupId(null);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const loadGroups = useCallback(async (keepSelection = false) => {
    try {
      setLoadError(null);
      const rawData = await chatGroupService.getGroups();
      const data = [...(rawData || [])].sort(
        (a, b) => getGroupActivityTime(b) - getGroupActivityTime(a),
      );
      setGroups(data);
      if (keepSelection && selectedGroupIdRef.current) {
        const exists = data.some(g => g.id === selectedGroupIdRef.current);
        if (!exists) setSelectedGroupId(null);
      }
    } catch (err: any) {
      console.error('Failed to load chat groups:', err);
      setLoadError(err?.message || 'Không thể kết nối tới máy chủ nhóm chat.');
    } finally {
      setLoadingGroups(false);
      setRefreshing(false);
    }
  }, []);

  const loadMessages = useCallback(async (groupId: string, silent = false) => {
    const cached = messagesCacheRef.current[groupId];
    if (cached && !silent) {
      setMessages(cached);
      setLoadingMessages(false);
    } else if (!silent) {
      setLoadingMessages(true);
    }
    try {
      const data = await chatGroupService.getMessages(groupId);
      const safeData = data || [];
      messagesCacheRef.current[groupId] = safeData;
      if (selectedGroupIdRef.current === groupId) {
        setMessages(safeData);
        if (!silent && !cached) scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to load group messages:', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups(false);
  }, [loadGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      void loadMessages(selectedGroupId, false);
      if (socketRef.current?.connected) {
        socketRef.current.emit('markChatReceipt', {
          groupId: selectedGroupId,
          type: 'READ',
        });
      }
      setUnreadCounts(prev => {
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
  }, [selectedGroupId, loadMessages]);

  const userTokenRef = useRef<string | null>(userToken);
  useEffect(() => {
    userTokenRef.current = userToken;
  }, [userToken]);

  // Socket.IO connection
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId || !userToken) return;

    const socket: Socket = io(`${API_BASE_URL}/notifications`, {
      query: { userId },
      auth: cb => {
        cb({ token: userTokenRef.current || userToken });
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      void loadGroups(true);
      if (selectedGroupIdRef.current) {
        void loadMessages(selectedGroupIdRef.current, true);
      }
    });

    socket.on('newChatMessage', (msg: MobileChatMessage) => {
      if (messagesCacheRef.current[msg.groupId]) {
        const cached = messagesCacheRef.current[msg.groupId];
        if (!cached.some(m => m.id === msg.id)) {
          messagesCacheRef.current[msg.groupId] = [...cached, msg];
        }
      }
      if (msg.groupId === selectedGroupIdRef.current) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          const tempIdx = prev.findIndex(
            m =>
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
        if (msg.senderId !== userId) {
          socket.emit('markChatReceipt', {
            groupId: msg.groupId,
            type: 'READ',
          });
        }
      } else if (msg.senderId !== userId) {
        socket.emit('markChatReceipt', {
          groupId: msg.groupId,
          type: 'DELIVERED',
        });
        setUnreadCounts(prev => ({
          ...prev,
          [msg.groupId]: (prev[msg.groupId] || 0) + 1,
        }));
      }
      setGroups(prev => {
        const exists = prev.some(g => g.id === msg.groupId);
        if (!exists) {
          void loadGroups(true);
          return prev;
        }
        return prev
          .map(g =>
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
        setGroups(prev =>
          prev.map(g => {
            if (g.id !== receipt.groupId || !g.members) return g;
            return {
              ...g,
              members: g.members.map(m =>
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
      void loadGroups(true);
      if (selectedGroupIdRef.current) {
        void loadMessages(selectedGroupIdRef.current, true);
      }
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [userId, userToken, loadGroups, loadMessages]);

  const sortedGroups = useMemo(
    () => sortGroupsByPriority(groups, unreadCounts),
    [groups, unreadCounts],
  );

  const activeGroup = groups.find(g => g.id === selectedGroupId) || null;
  const isGroupManager =
    userRole === 'ADMIN' ||
    userRole === 'FARM_MANAGER' &&
      (!activeGroup?.farm?.ownerId || activeGroup.farm.ownerId === userId);

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

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setMessageError('Vui lòng cấp quyền truy cập thư viện ảnh.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        setMessageError('Dung lượng ảnh tối đa là 10MB.');
        return;
      }
      setMessageError(null);
      setPendingAttachment({
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
        size: asset.fileSize,
        isImage: true,
      });
    } catch {
      setMessageError('Không thể chọn hình ảnh.');
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        setMessageError('Dung lượng tệp tối đa là 10MB.');
        return;
      }
      setMessageError(null);
      setPendingAttachment({
        uri: asset.uri,
        name: asset.name || `file-${Date.now()}`,
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size,
        isImage: false,
      });
    } catch {
      setMessageError('Không thể chọn tệp tài liệu.');
    }
  };

  const handleSendMessage = async () => {
    if (!activeGroup) return;
    setMessageError(null);

    const trimmed = messageInput.trim();
    const attachmentToSend = pendingAttachment;
    const replyTarget = replyingTo;
    if (!trimmed && !attachmentToSend) {
      setMessageError('Vui lòng nhập nội dung hoặc chọn tệp đính kèm.');
      return;
    }
    if (trimmed.length > 2000) {
      setMessageError('Tin nhắn không được vượt quá 2000 ký tự.');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MobileChatMessage = {
      id: tempId,
      groupId: activeGroup.id,
      senderId: userId || '',
      content: trimmed,
      attachmentUrl: attachmentToSend?.uri || null,
      attachmentName: attachmentToSend?.name || null,
      attachmentType: attachmentToSend?.type || null,
      attachmentSize: attachmentToSend?.size || null,
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
        id: userId || '',
        fullName: currentUser?.fullName || currentUser?.name || 'Bạn',
        email: currentUser?.email || '',
        role: userRole || 'FARM_MANAGER',
        avatarUrl: currentUser?.avatarUrl,
      },
    };

    setMessageInput('');
    setPendingAttachment(null);
    setReplyingTo(null);
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();
    setSending(true);
    const applyCreatedMessage = (created: MobileChatMessage) => {
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId);
        if (withoutTemp.some(m => m.id === created.id)) return withoutTemp;
        return [...withoutTemp, created];
      });
      setGroups(prev =>
        prev
          .map(g =>
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
      let uploadedAttachment: MobileChatAttachment | undefined;
      if (attachmentToSend) {
        const token = userTokenRef.current || userToken || '';
        setUploadingFile(true);
        uploadedAttachment = await chatGroupService.uploadAttachment(
          activeGroup.id,
          {
            uri: attachmentToSend.uri,
            name: attachmentToSend.name,
            type: attachmentToSend.type,
          },
          token,
        );
        setUploadingFile(false);
      }

      const socket = socketRef.current;
      if (socket?.connected) {
        const created = await new Promise<MobileChatMessage>(
          (resolve, reject) => {
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
                  res?: {
                    ok?: boolean;
                    message?: MobileChatMessage;
                    error?: string;
                  },
                ) => {
                  if (err) return reject(err);
                  if (res?.ok && res.message) return resolve(res.message);
                  return reject(
                    new Error(res?.error || 'Không thể gửi tin nhắn qua socket'),
                  );
                },
              );
          },
        ).catch(() =>
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
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setMessageInput(trimmed);
      setMessageError(err?.message || 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  const handleAddMember = async () => {
    if (!activeGroup?.farmId) return;
    setInviteError(null);
    setInviteSuccess(null);

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setInviteError('Vui lòng nhập địa chỉ email nhân sự.');
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
      setInviteError('Không thể thêm chính email của Chủ trang trại.');
      return;
    }
    const alreadyInGroup = activeGroup.members?.some(
      m => m.user?.email?.toLowerCase() === normalizedEmail,
    );
    if (alreadyInGroup) {
      setInviteError('Thành viên này đã có trong trang trại và nhóm chat.');
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
      await loadGroups(true);
      await loadMessages(activeGroup.id, true);
    } catch (err: any) {
      setInviteError(err?.message || 'Không thể thêm thành viên vào nhóm.');
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
      setInviteSuccess(`Đã gỡ ${memberName} khỏi trang trại và nhóm chat.`);
      await loadGroups(true);
      await loadMessages(activeGroup.id, true);
    } catch (err: any) {
      setInviteError(err?.message || 'Không thể gỡ thành viên.');
    } finally {
      setRemovingUserId(null);
    }
  };

  const getDirectPartner = (group: MobileChatGroup) => {
    if (group.type !== 'DIRECT') return null;
    return (
      group.members?.find(m => m.userId !== userId) ||
      group.members?.[0] ||
      null
    );
  };

  const getGroupDisplayName = (group: MobileChatGroup) => {
    if (group.type === 'DIRECT') {
      const partner = getDirectPartner(group);
      return partner?.user?.fullName || partner?.user?.email || group.name;
    }
    return group.farm?.name || group.name;
  };

  const colleagues = useMemo(() => {
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
    groups.forEach(g => {
      if (g.type === 'DIRECT') return;
      const farmLabel = g.farm?.name || g.name;
      (g.members || []).forEach(m => {
        if (!m.userId || m.userId === userId) return;
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
  }, [groups, userId]);

  const filteredListGroups = useMemo(() => {
    return sortedGroups.filter(g => {
      const isDirect = g.type === 'DIRECT';
      if (listFilter === 'FARM_GROUP' && isDirect) return false;
      if (listFilter === 'DIRECT' && !isDirect) return false;

      const q = listSearch.trim().toLowerCase();
      if (!q) return true;
      const name = getGroupDisplayName(g).toLowerCase();
      const partner = isDirect ? getDirectPartner(g) : null;
      const partnerEmail = partner?.user?.email?.toLowerCase() || '';
      const farmName = (g.farm?.name || '').toLowerCase();
      const farmAddress = (g.farm?.address || '').toLowerCase();
      return (
        name.includes(q) ||
        partnerEmail.includes(q) ||
        farmName.includes(q) ||
        farmAddress.includes(q)
      );
    });
  }, [sortedGroups, listFilter, listSearch, userId]);

  const handleStartDirectChat = async (targetUserId: string) => {
    if (!targetUserId || targetUserId === userId) return;
    setStartingDirectId(targetUserId);
    setMessageError(null);
    try {
      const dmGroup = await chatGroupService.startDirectChat(targetUserId);
      setGroups(prev => {
        const exists = prev.some(g => g.id === dmGroup.id);
        const next = exists
          ? prev.map(g => (g.id === dmGroup.id ? dmGroup : g))
          : [dmGroup, ...prev];
        return next.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });
      setSelectedGroupId(dmGroup.id);
      setIsMembersModalOpen(false);
      setShowDirectPicker(false);
    } catch (err: any) {
      setMessageError(err?.message || 'Không thể mở cuộc trò chuyện riêng.');
    } finally {
      setStartingDirectId(null);
    }
  };

  if (loadingGroups) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Đang tải nhóm chat trang trại...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centerBox}>
        <View style={[styles.emptyIconBox, { backgroundColor: '#fef2f2' }]}>
          <AlertCircle size={36} color="#dc2626" />
        </View>
        <Text style={styles.emptyTitle}>Không thể tải Nhóm Chat</Text>
        <Text style={[styles.emptySubtitle, { color: '#dc2626' }]}>
          {loadError}
        </Text>
        <TouchableOpacity
          style={styles.reloadBtn}
          onPress={() => {
            setLoadingGroups(true);
            void loadGroups(false);
          }}
        >
          <RefreshCw size={16} color="#ffffff" />
          <Text style={styles.reloadBtnText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.centerBox}>
        <View style={styles.emptyIconBox}>
          <MessageSquare size={36} color="#2563eb" />
        </View>
        <Text style={styles.emptyTitle}>Chưa có Nhóm Chat Trang Trại</Text>
        <Text style={styles.emptySubtitle}>
          Khi bạn tạo trang trại mới hoặc được phân công vào trang trại, nhóm chat sẽ tự động được tạo và thêm bạn vào nhóm.
        </Text>
        <TouchableOpacity
          style={styles.reloadBtn}
          onPress={() => {
            setLoadingGroups(true);
            void loadGroups(false);
          }}
        >
          <RefreshCw size={16} color="#ffffff" />
          <Text style={styles.reloadBtnText}>Tải lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {!selectedGroupId || !activeGroup ? (
          /* ================= CONVERSATIONS LIST SCREEN ================= */
          <View style={styles.convListContainer}>
            {/* Header */}
            <View style={styles.convListHeader}>
              <View>
                <Text style={styles.convListTitle}>Đoạn chat</Text>
                <Text style={styles.convListSubtitle}>
                  {groups.length} cuộc trò chuyện
                </Text>
              </View>
              <TouchableOpacity
                style={styles.newDirectBtn}
                onPress={() => setShowDirectPicker(true)}
                activeOpacity={0.8}
              >
                <MessageCircle size={15} color="#ffffff" />
                <Text style={styles.newDirectBtnText}>Nhắn riêng</Text>
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View style={styles.searchBox}>
              <Search size={16} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm cuộc trò chuyện..."
                placeholderTextColor="#94a3b8"
                value={listSearch}
                onChangeText={setListSearch}
              />
              {listSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setListSearch('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={15} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabsRow}>
              {(['ALL', 'FARM_GROUP', 'DIRECT'] as const).map(tab => {
                const label =
                  tab === 'ALL'
                    ? 'Tất cả'
                    : tab === 'FARM_GROUP'
                    ? 'Trang trại'
                    : 'Nhắn riêng';
                const isSelected = listFilter === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.filterTab,
                      isSelected && styles.filterTabSelected,
                    ]}
                    onPress={() => setListFilter(tab)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        isSelected && styles.filterTabTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Conversations List */}
            <ScrollView
              style={styles.convScrollView}
              contentContainerStyle={styles.convScrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    void loadGroups(false);
                  }}
                  colors={['#2563eb']}
                />
              }
            >
              {filteredListGroups.length === 0 ? (
                <View style={styles.emptyListBox}>
                  <MessageSquare size={34} color="#cbd5e1" />
                  <Text style={styles.emptyListText}>
                    {listSearch
                      ? 'Không tìm thấy cuộc trò chuyện phù hợp'
                      : 'Chưa có cuộc trò chuyện nào'}
                  </Text>
                </View>
              ) : (
                filteredListGroups.map(group => {
                  const isDirect = group.type === 'DIRECT';
                  const unreadCount = unreadCounts[group.id] || 0;
                  const displayName = getGroupDisplayName(group);
                  const lastMsg = group.messages?.[0];
                  const lastTime = formatConversationTime(
                    lastMsg?.createdAt || group.updatedAt,
                  );
                  const snippet = getLastMessageSnippet(group, userId);

                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={styles.convItem}
                      onPress={() => setSelectedGroupId(group.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.convAvatar,
                          isDirect
                            ? styles.convAvatarDirect
                            : styles.convAvatarFarm,
                        ]}
                      >
                        {isDirect ? (
                          <User size={22} color="#4f46e5" />
                        ) : (
                          <Building2 size={22} color="#2563eb" />
                        )}
                      </View>

                      <View style={styles.convInfoCol}>
                        <View style={styles.convTopRow}>
                          <Text
                            style={[
                              styles.convName,
                              unreadCount > 0 && styles.convNameUnread,
                            ]}
                            numberOfLines={1}
                          >
                            {displayName}
                          </Text>
                          <Text
                            style={[
                              styles.convTime,
                              unreadCount > 0 && styles.convTimeUnread,
                            ]}
                          >
                            {lastTime}
                          </Text>
                        </View>

                        <View style={styles.convBottomRow}>
                          <Text
                            style={[
                              styles.convSnippet,
                              unreadCount > 0 && styles.convSnippetUnread,
                            ]}
                            numberOfLines={1}
                          >
                            {snippet}
                          </Text>
                          {unreadCount > 0 && (
                            <View style={styles.convUnreadBadge}>
                              <Text style={styles.convUnreadBadgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        ) : (
          /* ================= CHAT DETAIL SCREEN ================= */
          <View style={styles.chatDetailContainer}>
            {/* Chat Detail Header */}
            <View style={styles.chatDetailHeader}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setSelectedGroupId(null)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ChevronLeft size={24} color="#0f172a" />
              </TouchableOpacity>

              <View
                style={[
                  styles.detailAvatar,
                  activeGroup.type === 'DIRECT'
                    ? styles.convAvatarDirect
                    : styles.convAvatarFarm,
                ]}
              >
                {activeGroup.type === 'DIRECT' ? (
                  <User size={16} color="#4f46e5" />
                ) : (
                  <Building2 size={16} color="#2563eb" />
                )}
              </View>

              <View style={styles.detailHeaderInfo}>
                <Text style={styles.activeGroupName} numberOfLines={1}>
                  {getGroupDisplayName(activeGroup)}
                </Text>
                <Text style={styles.activeMetaText} numberOfLines={1}>
                  {activeGroup.type === 'DIRECT'
                    ? getDirectPartner(activeGroup)?.user?.email ||
                      'Trò chuyện riêng tư'
                    : `${activeGroup.members?.length || 1} thành viên${
                        activeGroup.farm?.name ? ` • ${activeGroup.farm.name}` : ''
                      }`}
                </Text>
              </View>

              {activeGroup.type !== 'DIRECT' && (
                <TouchableOpacity
                  style={styles.membersButton}
                  onPress={() => {
                    setInviteError(null);
                    setInviteSuccess(null);
                    setIsMembersModalOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Users size={16} color="#2563eb" />
                  <Text style={styles.membersButtonText}>
                    {activeGroup.members?.length || 1}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

        {/* Messages Feed */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadGroups(true);
                if (selectedGroupId) void loadMessages(selectedGroupId, false);
              }}
              colors={['#2563eb']}
            />
          }
          onContentSizeChange={() => scrollToBottom()}
        >
          {loadingMessages ? (
            <View style={styles.loadingMessagesBox}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.loadingMessagesText}>
                Đang tải tin nhắn nhóm...
              </Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.loadingMessagesBox}>
              <Text style={styles.loadingMessagesText}>
                Hãy gửi tin nhắn đầu tiên tới các thành viên trang trại!
              </Text>
            </View>
          ) : (
            messages.map(msg => {
              if (msg.isSystem) {
                return (
                  <View key={msg.id} style={styles.systemMsgRow}>
                    <View style={styles.systemMsgBubble}>
                      <Text style={styles.systemMsgText}>{msg.content}</Text>
                    </View>
                  </View>
                );
              }

              const isMe = msg.senderId === userId;
              const senderName =
                msg.sender?.fullName || msg.sender?.email || 'Thành viên';
              const roleInfo =
                ROLE_BADGE[msg.sender?.role || 'FARMER'] || ROLE_BADGE.FARMER;
              const timeStr = new Date(msg.createdAt).toLocaleTimeString(
                'vi-VN',
                { hour: '2-digit', minute: '2-digit' },
              );
              const receiptStatus = (() => {
                if (!isMe || msg.isSystem) return null;
                if (msg.id.startsWith('temp-')) return 'SENDING';
                const msgTime = new Date(msg.createdAt).getTime();
                const others = (activeGroup?.members || []).filter(
                  m => m.userId !== userId,
                );
                if (
                  others.some(
                    m => m.lastReadAt && new Date(m.lastReadAt).getTime() >= msgTime,
                  )
                ) {
                  return 'READ';
                }
                if (
                  others.some(
                    m =>
                      m.lastDeliveredAt &&
                      new Date(m.lastDeliveredAt).getTime() >= msgTime,
                  )
                ) {
                  return 'DELIVERED';
                }
                return 'SENT';
              })();

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.msgWrapper,
                    isMe ? styles.msgWrapperRight : styles.msgWrapperLeft,
                  ]}
                >
                  <View style={styles.msgSenderRow}>
                    <Text style={styles.msgSenderName}>
                      {isMe ? 'Bạn' : senderName}
                    </Text>
                    <View
                      style={[
                        styles.rolePill,
                        { backgroundColor: roleInfo.bg },
                      ]}
                    >
                      <Text
                        style={[styles.rolePillText, { color: roleInfo.color }]}
                      >
                        {roleInfo.label}
                      </Text>
                    </View>
                    <Text style={styles.msgTime}>{timeStr}</Text>
                  </View>

                  <View
                    style={[
                      styles.bubbleRow,
                      isMe ? styles.bubbleRowRight : styles.bubbleRowLeft,
                    ]}
                  >
                    {!msg.id.startsWith('temp-') && isMe && (
                      <TouchableOpacity
                        style={styles.replyActionBtn}
                        onPress={() => setReplyingTo(msg)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Reply size={13} color="#94a3b8" />
                      </TouchableOpacity>
                    )}

                    <View
                      style={[
                        styles.msgBubble,
                        isMe ? styles.msgBubbleRight : styles.msgBubbleLeft,
                      ]}
                    >
                    {msg.replyTo ? (
                      <View
                        style={[
                          styles.replyQuoteBox,
                          isMe
                            ? styles.replyQuoteBoxRight
                            : styles.replyQuoteBoxLeft,
                        ]}
                      >
                        <Text
                          style={[
                            styles.replyQuoteSender,
                            isMe && { color: '#dbeafe' },
                          ]}
                          numberOfLines={1}
                        >
                          {msg.replyTo.senderId === userId
                            ? 'Bạn'
                            : msg.replyTo.sender?.fullName || 'Thành viên'}
                        </Text>
                        <Text
                          style={[
                            styles.replyQuoteText,
                            isMe && { color: '#eff6ff' },
                          ]}
                          numberOfLines={1}
                        >
                          {msg.replyTo.content ||
                            (msg.replyTo.attachmentName
                              ? `📎 ${msg.replyTo.attachmentName}`
                              : 'Tin nhắn đính kèm')}
                        </Text>
                      </View>
                    ) : null}
                    {msg.attachmentUrl && isImageAttachment(msg) ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          if (msg.attachmentUrl?.startsWith('http')) {
                            void Linking.openURL(msg.attachmentUrl);
                          }
                        }}
                      >
                        <Image
                          source={{ uri: msg.attachmentUrl }}
                          style={styles.msgImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : msg.attachmentUrl ? (
                      <TouchableOpacity
                        style={[
                          styles.msgFileCard,
                          isMe
                            ? styles.msgFileCardRight
                            : styles.msgFileCardLeft,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (msg.attachmentUrl?.startsWith('http')) {
                            void Linking.openURL(msg.attachmentUrl);
                          }
                        }}
                      >
                        <FileText
                          size={18}
                          color={isMe ? '#ffffff' : '#2563eb'}
                        />
                        <View style={styles.msgFileInfo}>
                          <Text
                            style={[
                              styles.msgFileName,
                              isMe ? styles.msgTextRight : styles.msgTextLeft,
                            ]}
                            numberOfLines={1}
                          >
                            {msg.attachmentName || 'Tài liệu đính kèm'}
                          </Text>
                          {msg.attachmentSize ? (
                            <Text
                              style={[
                                styles.msgFileSize,
                                isMe && { color: '#dbeafe' },
                              ]}
                            >
                              {formatFileSize(msg.attachmentSize)}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ) : null}
                    {msg.content ? (
                      <Text
                        style={[
                          styles.msgText,
                          isMe ? styles.msgTextRight : styles.msgTextLeft,
                          msg.attachmentUrl ? { marginTop: 6 } : null,
                        ]}
                      >
                        {msg.content}
                      </Text>
                    ) : null}
                  </View>

                  {!msg.id.startsWith('temp-') && !isMe && (
                    <TouchableOpacity
                      style={styles.replyActionBtn}
                      onPress={() => setReplyingTo(msg)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Reply size={13} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>
                  {receiptStatus ? (
                    <View style={styles.receiptRow}>
                      {receiptStatus === 'SENDING' ? (
                        <Text style={styles.receiptText}>Đang gửi...</Text>
                      ) : receiptStatus === 'SENT' ? (
                        <>
                          <Check size={11} color="#94a3b8" />
                          <Text style={styles.receiptText}>Đã gửi</Text>
                        </>
                      ) : receiptStatus === 'DELIVERED' ? (
                        <>
                          <CheckCheck size={11} color="#64748b" />
                          <Text style={[styles.receiptText, { color: '#64748b' }]}>
                            Đã nhận
                          </Text>
                        </>
                      ) : (
                        <>
                          <CheckCheck size={11} color="#2563eb" />
                          <Text style={[styles.receiptText, { color: '#2563eb' }]}>
                            Đã xem
                          </Text>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Composer */}
        <View style={styles.composerWrapper}>
          {messageError ? (
            <View style={styles.composerErrorRow}>
              <AlertCircle size={14} color="#dc2626" />
              <Text style={styles.composerErrorText}>{messageError}</Text>
            </View>
          ) : null}

          {replyingTo ? (
            <View style={styles.replyBanner}>
              <View style={styles.replyBannerInfo}>
                <Text style={styles.replyBannerTitle}>
                  Đang trả lời{' '}
                  {replyingTo.senderId === userId
                    ? 'chính bạn'
                    : replyingTo.sender?.fullName || 'Thành viên'}
                </Text>
                <Text style={styles.replyBannerText} numberOfLines={1}>
                  {replyingTo.content ||
                    (replyingTo.attachmentName
                      ? `📎 ${replyingTo.attachmentName}`
                      : 'Tin nhắn đính kèm')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.pendingRemoveBtn}
                onPress={() => setReplyingTo(null)}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          ) : null}

          {pendingAttachment ? (
            <View style={styles.pendingAttachRow}>
              {pendingAttachment.isImage ? (
                <Image
                  source={{ uri: pendingAttachment.uri }}
                  style={styles.pendingThumb}
                />
              ) : (
                <View style={styles.pendingDocIcon}>
                  <FileText size={18} color="#2563eb" />
                </View>
              )}
              <View style={styles.pendingAttachInfo}>
                <Text style={styles.pendingAttachName} numberOfLines={1}>
                  {pendingAttachment.name}
                </Text>
                {pendingAttachment.size ? (
                  <Text style={styles.pendingAttachSize}>
                    {formatFileSize(pendingAttachment.size)}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setPendingAttachment(null)}
                style={styles.pendingRemoveBtn}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.composerRow}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => void handlePickImage()}
              disabled={uploadingFile}
            >
              <ImageIcon size={18} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => void handlePickDocument()}
              disabled={uploadingFile}
            >
              <Paperclip size={18} color="#475569" />
            </TouchableOpacity>
            <TextInput
              style={styles.composerInput}
              value={messageInput}
              onChangeText={t => {
                setMessageInput(t);
                if (messageError) setMessageError(null);
              }}
              placeholder={
                activeGroup
                  ? activeGroup.type === 'DIRECT'
                    ? `Nhắn riêng cho ${getGroupDisplayName(activeGroup)}...`
                    : `Nhắn tin tới ${getGroupDisplayName(activeGroup)}...`
                  : 'Nhập tin nhắn...'
              }
              placeholderTextColor="#94a3b8"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageInput.trim() && !pendingAttachment) || uploadingFile
                  ? styles.sendButtonDisabled
                  : null,
              ]}
              onPress={handleSendMessage}
              disabled={
                (!messageInput.trim() && !pendingAttachment) || uploadingFile
              }
            >
              {uploadingFile ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={18} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}
  </KeyboardAvoidingView>

      {/* Members & Add Member Modal */}
      <Modal visible={isMembersModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Users size={20} color="#2563eb" />
                <Text style={styles.modalTitle}>
                  Thành viên Nhóm Chat ({activeGroup?.members?.length || 0})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsMembersModalOpen(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtext}>
              Thành viên được thêm vào trang trại sẽ tự động được thêm vào nhóm chat này.
            </Text>

            {/* Manager Add Member Section */}
            {isGroupManager && (
              <View style={styles.addMemberBox}>
                <View style={styles.addMemberHeader}>
                  <UserPlus size={15} color="#2563eb" />
                  <Text style={styles.addMemberTitle}>
                    Thêm thành viên vào trang trại & nhóm chat
                  </Text>
                </View>

                {inviteError ? (
                  <View style={styles.alertErrorBox}>
                    <AlertCircle size={14} color="#dc2626" />
                    <Text style={styles.alertErrorText}>{inviteError}</Text>
                  </View>
                ) : null}

                {inviteSuccess ? (
                  <View style={styles.alertSuccessBox}>
                    <CheckCircle2 size={14} color="#059669" />
                    <Text style={styles.alertSuccessText}>{inviteSuccess}</Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.emailInput}
                  value={inviteEmail}
                  onChangeText={t => {
                    setInviteEmail(t);
                    if (inviteError) setInviteError(null);
                  }}
                  placeholder="Nhập email nhân sự (VD: farmer@gmail.com)..."
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <View style={styles.roleSelectRow}>
                  {(['FARMER', 'TECHNICIAN'] as const).map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roleSelectBtn,
                        inviteRole === r && styles.roleSelectBtnActive,
                      ]}
                      onPress={() => setInviteRole(r)}
                    >
                      <Text
                        style={[
                          styles.roleSelectBtnText,
                          inviteRole === r && styles.roleSelectBtnTextActive,
                        ]}
                      >
                        {r === 'FARMER' ? 'Nông dân' : 'Kỹ thuật viên'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.addSubmitBtn,
                      inviting && styles.sendButtonDisabled,
                    ]}
                    onPress={handleAddMember}
                    disabled={inviting}
                  >
                    {inviting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.addSubmitBtnText}>Thêm</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Members List */}
            <ScrollView style={styles.membersListScroll}>
              {(activeGroup?.members || []).map(member => {
                const name =
                  member.user?.fullName || member.user?.email || 'Thành viên';
                const rBadge =
                  ROLE_BADGE[member.role] || ROLE_BADGE.FARMER;
                const isOwnerMember =
                  member.role === 'FARM_MANAGER' ||
                  member.userId === activeGroup?.farm?.ownerId;

                return (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {name.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={styles.memberEmail} numberOfLines={1}>
                        {member.user?.email}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.rolePill,
                        { backgroundColor: rBadge.bg },
                      ]}
                    >
                      <Text
                        style={[styles.rolePillText, { color: rBadge.color }]}
                      >
                        {rBadge.label}
                      </Text>
                    </View>
                    {member.userId !== userId && (
                      <TouchableOpacity
                        style={styles.dmMemberBtn}
                        onPress={() => void handleStartDirectChat(member.userId)}
                        disabled={startingDirectId === member.userId}
                      >
                        <MessageCircle size={15} color="#4f46e5" />
                      </TouchableOpacity>
                    )}
                    {isGroupManager && !isOwnerMember && (
                      <TouchableOpacity
                        style={styles.removeMemberBtn}
                        onPress={() =>
                          void handleRemoveMember(member.userId, name)
                        }
                        disabled={removingUserId === member.userId}
                      >
                        <Trash2 size={16} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Direct Chat Picker Modal */}
      <Modal visible={showDirectPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MessageCircle size={20} color="#4f46e5" />
                <Text style={styles.modalTitle}>Nhắn tin riêng</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDirectPicker(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtext}>
              Chọn thành viên cùng trang trại để trao đổi nghiệp vụ riêng tư.
            </Text>

            <ScrollView style={styles.membersListScroll}>
              {colleagues.length === 0 ? (
                <Text style={styles.emptyDirectText}>
                  Chưa có thành viên nào khác trong các trang trại của bạn.
                </Text>
              ) : (
                colleagues.map(person => {
                  const rBadge = ROLE_BADGE[person.role] || ROLE_BADGE.FARMER;
                  return (
                    <TouchableOpacity
                      key={person.userId}
                      style={styles.memberRow}
                      onPress={() => void handleStartDirectChat(person.userId)}
                      disabled={startingDirectId === person.userId}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.memberAvatar,
                          { backgroundColor: '#eef2ff' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.memberAvatarText,
                            { color: '#4f46e5' },
                          ]}
                        >
                          {person.fullName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {person.fullName}
                        </Text>
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {person.farmNames.length > 0
                            ? `${person.email} • ${person.farmNames.join(', ')}`
                            : person.email}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.rolePill,
                          { backgroundColor: rBadge.bg },
                        ]}
                      >
                        <Text
                          style={[styles.rolePillText, { color: rBadge.color }]}
                        >
                          {rBadge.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  flexOne: { flex: 1 },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  reloadBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reloadBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  groupBarWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 10,
  },
  groupBarContent: { paddingHorizontal: 12, gap: 8 },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 220,
  },
  groupChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  groupChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    flexShrink: 1,
  },
  groupChipTextSelected: { color: '#ffffff' },
  groupCountBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  groupCountBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
  groupCountText: { fontSize: 10, fontWeight: '800', color: '#475569' },
  groupCountTextSelected: { color: '#ffffff' },

  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  activeHeaderLeft: { flex: 1, minWidth: 0 },
  activeGroupName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  activeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  activeMetaText: { fontSize: 11, color: '#64748b', flexShrink: 1 },
  activeMetaDot: { fontSize: 11, color: '#94a3b8' },
  activeSyncBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  membersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  membersButtonText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },

  messagesContainer: { flex: 1, backgroundColor: '#f8fafc' },
  messagesContent: { padding: 14, paddingBottom: 20, gap: 10 },
  loadingMessagesBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMessagesText: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  systemMsgRow: { alignItems: 'center', marginVertical: 4 },
  systemMsgBubble: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: '90%',
  },
  systemMsgText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },

  msgWrapper: { maxWidth: '82%', marginVertical: 2 },
  msgWrapperRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgWrapperLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  msgSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
    paddingHorizontal: 2,
  },
  msgSenderName: { fontSize: 11, fontWeight: '700', color: '#475569' },
  rolePill: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 },
  rolePillText: { fontSize: 9.5, fontWeight: '800' },
  msgTime: { fontSize: 10, color: '#94a3b8' },
  msgBubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
  },
  msgBubbleRight: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  msgBubbleLeft: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextRight: { color: '#ffffff' },
  msgTextLeft: { color: '#0f172a' },

  composerWrapper: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  composerErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  composerErrorText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
    maxHeight: 90,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 12,
  },

  addMemberBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  addMemberHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addMemberTitle: { fontSize: 12, fontWeight: '800', color: '#1e293b' },
  alertErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 8,
    borderRadius: 8,
  },
  alertErrorText: { fontSize: 11, fontWeight: '600', color: '#dc2626', flex: 1 },
  alertSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 8,
    borderRadius: 8,
  },
  alertSuccessText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    flex: 1,
  },
  emailInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  roleSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  roleSelectBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  roleSelectBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  roleSelectBtnTextActive: { color: '#2563eb', fontWeight: '800' },
  addSubmitBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubmitBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },

  membersListScroll: { maxHeight: 320 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  memberEmail: { fontSize: 11, color: '#64748b' },
  removeMemberBtn: { padding: 6 },
  dmMemberBtn: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
  },
  directNewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  directNewChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  directChipSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  emptyDirectText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 24,
  },
  msgImage: {
    width: 210,
    height: 170,
    borderRadius: 12,
  },
  msgFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 170,
  },
  msgFileCardRight: {
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
  },
  msgFileCardLeft: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  msgFileInfo: { flex: 1, minWidth: 0 },
  msgFileName: { fontSize: 12, fontWeight: '700' },
  msgFileSize: { fontSize: 10, color: '#64748b', marginTop: 2 },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAttachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  pendingThumb: { width: 40, height: 40, borderRadius: 8 },
  pendingDocIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAttachInfo: { flex: 1, minWidth: 0 },
  pendingAttachName: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  pendingAttachSize: { fontSize: 10, color: '#64748b' },
  pendingRemoveBtn: { padding: 4 },
  unreadChipBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadChipBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  replyActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  replyQuoteBox: {
    borderLeftWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  replyQuoteBoxRight: {
    backgroundColor: 'rgba(29, 78, 216, 0.55)',
    borderLeftColor: '#bfdbfe',
  },
  replyQuoteBoxLeft: {
    backgroundColor: '#f1f5f9',
    borderLeftColor: '#2563eb',
  },
  replyQuoteSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  replyQuoteText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
    paddingHorizontal: 4,
  },
  receiptText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  replyBannerInfo: { flex: 1, minWidth: 0 },
  replyBannerTitle: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  replyBannerText: { fontSize: 12, color: '#475569', marginTop: 1 },

  convListContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  convListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  convListTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  convListSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  newDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  newDirectBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    padding: 0,
  },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterTabSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTabTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },
  convScrollView: {
    flex: 1,
  },
  convScrollContent: {
    paddingBottom: 24,
  },
  emptyListBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyListText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  convAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  convAvatarFarm: {
    backgroundColor: '#eff6ff',
  },
  convAvatarDirect: {
    backgroundColor: '#eef2ff',
  },
  convInfoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  convTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  convName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  convNameUnread: {
    fontWeight: '800',
    color: '#0f172a',
  },
  convTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    flexShrink: 0,
  },
  convTimeUnread: {
    color: '#2563eb',
    fontWeight: '700',
  },
  convBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 3,
  },
  convSnippet: {
    fontSize: 12.5,
    color: '#64748b',
    flex: 1,
  },
  convSnippetUnread: {
    color: '#0f172a',
    fontWeight: '700',
  },
  convUnreadBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  convUnreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  chatDetailContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  chatDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 4,
    borderRadius: 8,
  },
  detailAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
});

