import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
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
} from 'react-native';
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
} from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import {
  chatGroupService,
  MobileChatGroup,
  MobileChatMessage,
} from '../services/chatGroupService';
import { farmService } from '../services/farmService';

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  FARM_MANAGER: { label: 'Quản lý trại', color: '#1d4ed8', bg: '#dbeafe' },
  TECHNICIAN: { label: 'Kỹ thuật viên', color: '#0e7490', bg: '#cffafe' },
  FARMER: { label: 'Nông dân', color: '#047857', bg: '#d1fae5' },
};

export default function ChatGroupScreen() {
  const { userId, userRole, currentUser } = useContext(AuthContext);

  const [groups, setGroups] = useState<MobileChatGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MobileChatMessage[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Message composer state
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Members & Add Member Modal
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'FARMER' | 'TECHNICIAN'>('FARMER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const selectedGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId;
  }, [selectedGroupId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const loadGroups = useCallback(async (keepSelection = true) => {
    try {
      const data = await chatGroupService.getGroups();
      setGroups(data || []);
      if (data && data.length > 0) {
        if (!keepSelection || !selectedGroupIdRef.current) {
          setSelectedGroupId(data[0].id);
        } else {
          const exists = data.some(g => g.id === selectedGroupIdRef.current);
          if (!exists) setSelectedGroupId(data[0].id);
        }
      } else {
        setSelectedGroupId(null);
      }
    } catch (err) {
      console.error('Failed to load chat groups:', err);
    } finally {
      setLoadingGroups(false);
      setRefreshing(false);
    }
  }, []);

  const loadMessages = useCallback(async (groupId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const data = await chatGroupService.getMessages(groupId);
      setMessages(data || []);
      if (!silent) scrollToBottom();
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
      setInviteError(null);
      setInviteSuccess(null);
      setMessageError(null);
    } else {
      setMessages([]);
    }
  }, [selectedGroupId, loadMessages]);

  // Periodic sync while screen is mounted
  useEffect(() => {
    const timer = setInterval(() => {
      if (selectedGroupIdRef.current) {
        void loadMessages(selectedGroupIdRef.current, true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [loadMessages]);

  const activeGroup = groups.find(g => g.id === selectedGroupId) || null;
  const isGroupManager =
    userRole === 'ADMIN' ||
    userRole === 'FARM_MANAGER' &&
      (!activeGroup?.farm?.ownerId || activeGroup.farm.ownerId === userId);

  const handleSendMessage = async () => {
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
      setMessages(prev => {
        if (prev.some(m => m.id === created.id)) return prev;
        return [...prev, created];
      });
      scrollToBottom();
      void loadGroups(true);
    } catch (err: any) {
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

  if (loadingGroups) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Đang tải nhóm chat trang trại...</Text>
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
        {/* Farm Group Selector Bar */}
        <View style={styles.groupBarWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupBarContent}
          >
            {groups.map(group => {
              const isSelected = group.id === selectedGroupId;
              const memberCount =
                group._count?.members ?? group.members?.length ?? 1;
              return (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupChip,
                    isSelected && styles.groupChipSelected,
                  ]}
                  onPress={() => setSelectedGroupId(group.id)}
                  activeOpacity={0.8}
                >
                  <Building2
                    size={15}
                    color={isSelected ? '#ffffff' : '#2563eb'}
                  />
                  <Text
                    style={[
                      styles.groupChipText,
                      isSelected && styles.groupChipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {group.farm?.name || group.name}
                  </Text>
                  <View
                    style={[
                      styles.groupCountBadge,
                      isSelected && styles.groupCountBadgeSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupCountText,
                        isSelected && styles.groupCountTextSelected,
                      ]}
                    >
                      {memberCount}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Active Group Header */}
        {activeGroup && (
          <View style={styles.activeHeader}>
            <View style={styles.activeHeaderLeft}>
              <Text style={styles.activeGroupName} numberOfLines={1}>
                {activeGroup.farm?.name || activeGroup.name}
              </Text>
              <View style={styles.activeMetaRow}>
                {activeGroup.farm?.address ? (
                  <>
                    <MapPin size={12} color="#64748b" />
                    <Text style={styles.activeMetaText} numberOfLines={1}>
                      {activeGroup.farm.address}
                    </Text>
                    <Text style={styles.activeMetaDot}>•</Text>
                  </>
                ) : null}
                <Text style={styles.activeSyncBadge}>Tự động đồng bộ</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.membersButton}
              onPress={() => {
                setInviteError(null);
                setInviteSuccess(null);
                setIsMembersModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Users size={15} color="#2563eb" />
              <Text style={styles.membersButtonText}>
                Thành viên ({activeGroup.members?.length || 1})
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
                      styles.msgBubble,
                      isMe ? styles.msgBubbleRight : styles.msgBubbleLeft,
                    ]}
                  >
                    <Text
                      style={[
                        styles.msgText,
                        isMe ? styles.msgTextRight : styles.msgTextLeft,
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
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
          <View style={styles.composerRow}>
            <TextInput
              style={styles.composerInput}
              value={messageInput}
              onChangeText={t => {
                setMessageInput(t);
                if (messageError) setMessageError(null);
              }}
              placeholder={
                activeGroup
                  ? `Nhắn tin tới ${activeGroup.farm?.name || activeGroup.name}...`
                  : 'Nhập tin nhắn...'
              }
              placeholderTextColor="#94a3b8"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (sending || !messageInput.trim()) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={sending || !messageInput.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={18} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
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
});

