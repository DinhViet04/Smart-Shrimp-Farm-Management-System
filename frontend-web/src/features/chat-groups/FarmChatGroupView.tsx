import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import {
  chatGroupService,
  ChatGroupItem,
  ChatMessageItem,
} from '../../services/chat-group.service';
import { farmService } from '../../services/farm.service';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function FarmChatGroupView() {
  const [groups, setGroups] = useState<ChatGroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMemberPanel, setShowMemberPanel] = useState(true);

  // Add member form state (for Farm Manager)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'FARMER' | 'TECHNICIAN'>('FARMER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedGroupIdRef = useRef<string | null>(null);

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
      const data = await chatGroupService.getGroups();
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
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const fetchMessages = useCallback(async (groupId: string) => {
    setLoadingMessages(true);
    try {
      const data = await chatGroupService.getMessages(groupId);
      setMessages(data);
      scrollToBottom();
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
      setInviteError(null);
      setInviteSuccess(null);
      setMessageError(null);
    } else {
      setMessages([]);
    }
  }, [selectedGroupId, fetchMessages]);

  // Realtime Socket.IO connection
  useEffect(() => {
    if (!currentUserId) return;
    const token = localStorage.getItem('access_token');
    const socket: Socket = io(`${apiUrl}/notifications`, {
      query: { userId: currentUserId },
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
    });

    socket.on('newChatMessage', (msg: ChatMessageItem) => {
      if (msg.groupId === selectedGroupIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
      void fetchGroups(true);
    });

    socket.on('chatGroupUpdated', () => {
      void fetchGroups(true);
      if (selectedGroupIdRef.current) {
        void fetchMessages(selectedGroupIdRef.current);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId, fetchGroups, fetchMessages]);

  const activeGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const isGroupManager =
    currentUser?.role === 'ADMIN' ||
    (activeGroup?.farm?.ownerId && activeGroup.farm.ownerId === currentUserId);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    setMessageError(null);

    const trimmed = messageInput.trim();
    if (!trimmed) {
      setMessageError('Vui lòng nhập nội dung tin nhắn.');
      return;
    }
    if (trimmed.length > 2000) {
      setMessageError('Tin nhắn không được vượt quá 2000 ký tự.');
      return;
    }

    setSending(true);
    try {
      const created = await chatGroupService.sendMessage(activeGroup.id, trimmed);
      setMessageInput('');
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });
      scrollToBottom();
      void fetchGroups(true);
    } catch (err: any) {
      setMessageError(err.message || 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
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

  const filteredGroups = groups.filter((g) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      g.name?.toLowerCase().includes(q) ||
      g.farm?.name?.toLowerCase().includes(q) ||
      g.farm?.address?.toLowerCase().includes(q)
    );
  });

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
                <h2 className="text-sm font-black text-slate-800">Nhóm Chat Trại</h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {groups.length} trang trại đang tham gia
                </p>
              </div>
            </div>
            <button
              onClick={() => void fetchGroups(true)}
              title="Làm mới danh sách nhóm"
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm nhóm theo tên trại..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100/80 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredGroups.map((group) => {
            const isSelected = group.id === selectedGroupId;
            const lastMsg = group.messages?.[0];
            const memberCount = group._count?.members ?? group.members?.length ?? 1;

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
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`text-sm font-bold truncate ${
                        isSelected ? 'text-blue-900' : 'text-slate-800'
                      }`}
                    >
                      {group.farm?.name || group.name}
                    </p>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 flex-shrink-0">
                      <Users className="w-2.5 h-2.5" /> {memberCount}
                    </span>
                  </div>
                  {group.farm?.address && (
                    <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {group.farm.address}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 truncate mt-1">
                    {lastMsg
                      ? `${lastMsg.isSystem ? '' : `${lastMsg.sender?.fullName || 'Thành viên'}: `}${lastMsg.content}`
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
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-800 truncate">
                    {activeGroup.farm?.name || activeGroup.name}
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Tự động đồng bộ
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-2 truncate">
                  <span>{activeGroup.members?.length || 1} thành viên trong nhóm</span>
                  {activeGroup.farm?.address && (
                    <>
                      <span>•</span>
                      <span className="truncate">{activeGroup.farm.address}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

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

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
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
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
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
            <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  if (messageError) setMessageError(null);
                }}
                placeholder={`Nhắn tin tới nhóm ${activeGroup.farm?.name || activeGroup.name}...`}
                className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button
                type="submit"
                disabled={sending || !messageInput.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Gửi</span>
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Right Panel: Group Members & Quick Add Member to Farm + Chat Group */}
      {activeGroup && showMemberPanel && (
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

