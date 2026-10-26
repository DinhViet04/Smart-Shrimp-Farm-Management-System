import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  MessageSquare,
  History,
  Trash2,
  Copy,
  Check,
  Search,
  ArrowUp,
  Compass,
  Calendar,
  Layers,
  BookOpen,
  X,
  Plus,
  Sparkles,
  Bot,
} from 'lucide-react-native';
import {
  chatbotService,
  ChatMessage,
  ChatSession,
  ChatbotSource,
  PondOption,
  createNewSession,
} from '../services/chatbotService';

const MASCOT_IMAGE = require('../../assets/images/shrimp-mascot.jpg');

const QUICK_PROMPTS = [
  { label: '🦐 Tôm đục cơ, cong thân', query: 'Tôm bị đục cơ và cong thân thì nguyên nhân do đâu và phác đồ điều trị thế nào?' },
  { label: '💧 pH chiều cao > 8.5', query: 'Độ pH buổi chiều tăng vọt lên trên 8.5 thì xử lý hạ pH thế nào an toàn?' },
  { label: '🌧️ Giảm ăn khi trời mưa', query: 'Trời mưa lớn hoặc tôm đang lột xác đồng loạt thì giảm cữ ăn bao nhiêu phần trăm?' },
  { label: '🧪 Khí độc NO2 cao', query: 'Khí độc NO2 vượt ngưỡng an toàn trong ao tôm thì cấp cứu bằng biện pháp gì?' },
  { label: '📊 Tối ưu hệ số FCR', query: 'Quy tắc canh nhá và chia cữ ăn để kéo giảm hệ số FCR về mức 1.1 - 1.2?' },
];

export interface ChatbotScreenProps {
  onClose?: () => void;
}

export default function ChatbotScreen({ onClose }: ChatbotScreenProps = {}) {
  // Navigation tabs: 'chat' | 'history'
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  
  // Sessions state (ChatGPT style multi-session)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  
  // Chat input & status
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Context: Pond list & selection
  const [ponds, setPonds] = useState<PondOption[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<string>('ALL');

  const flatListRef = useRef<FlatList>(null);

  // 1. Load initial sessions and ponds
  useEffect(() => {
    loadInitialSessions();
    loadPonds();
  }, []);

  const loadInitialSessions = async () => {
    try {
      const loadedSessions = await chatbotService.getSessions();
      const savedActiveId = await chatbotService.getActiveSessionId();

      setSessions(loadedSessions);
      if (savedActiveId && loadedSessions.some((s) => s.id === savedActiveId)) {
        setActiveSessionId(savedActiveId);
      } else {
        const firstId = loadedSessions[0]?.id || '';
        setActiveSessionId(firstId);
        if (firstId) {
          chatbotService.setActiveSessionId(firstId);
        }
      }
    } catch (e) {
      console.warn('Error loading sessions:', e);
      const fresh = createNewSession();
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    }
  };

  const loadPonds = async () => {
    try {
      const pondList = await chatbotService.getPonds();
      setPonds(pondList);
    } catch (e) {
      console.warn('Error loading ponds:', e);
    }
  };

  // Sync sessions with AsyncStorage whenever modified
  const updateSessions = async (newSessions: ChatSession[]) => {
    setSessions(newSessions);
    await chatbotService.saveSessions(newSessions);
  };

  // Current active session
  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || createNewSession();
  }, [sessions, activeSessionId]);

  const messages = currentSession?.messages || [];

  // Scroll to bottom on new message
  useEffect(() => {
    if (activeTab === 'chat' && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages.length, isTyping, activeTab]);

  // Actions: New Chat
  const handleNewChat = async () => {
    const newSession = createNewSession();
    const updated = [newSession, ...sessions];
    await updateSessions(updated);
    setActiveSessionId(newSession.id);
    await chatbotService.setActiveSessionId(newSession.id);
    setActiveTab('chat');
  };

  // Actions: Select Session from History
  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    await chatbotService.setActiveSessionId(sessionId);
    setActiveTab('chat');
  };

  // Actions: Delete Single Session
  const handleDeleteSession = (sessionId: string) => {
    Alert.alert(
      'Xóa cuộc trò chuyện',
      'Bạn có chắc chắn muốn xóa đoạn hội thoại này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            const filtered = sessions.filter((s) => s.id !== sessionId);
            if (filtered.length === 0) {
              const fresh = createNewSession();
              await updateSessions([fresh]);
              setActiveSessionId(fresh.id);
              await chatbotService.setActiveSessionId(fresh.id);
            } else {
              await updateSessions(filtered);
              if (activeSessionId === sessionId) {
                setActiveSessionId(filtered[0].id);
                await chatbotService.setActiveSessionId(filtered[0].id);
              }
            }
          },
        },
      ]
    );
  };

  // Actions: Clear All History
  const handleClearAllHistory = () => {
    Alert.alert(
      'Xóa toàn bộ lịch sử',
      'Bạn có chắc chắn muốn xóa toàn bộ các phiên trò chuyện?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tất cả',
          style: 'destructive',
          onPress: async () => {
            const fresh = createNewSession();
            await updateSessions([fresh]);
            setActiveSessionId(fresh.id);
            await chatbotService.setActiveSessionId(fresh.id);
            setActiveTab('chat');
          },
        },
      ]
    );
  };

  // Actions: Copy Message Content
  const handleCopyText = async (id: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Actions: Send Message
  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText || inputText).trim();
    if (!text || isTyping) return;

    const currentPond = ponds.find((p) => p.id === selectedPondId);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: timeStr,
      timestamp: Date.now(),
      pondId: selectedPondId !== 'ALL' ? selectedPondId : undefined,
      pondName: currentPond ? currentPond.name : undefined,
    };

    const updatedMessages = [...messages, userMsg];
    let newTitle = currentSession.title;
    if (currentSession.title === 'Cuộc trò chuyện mới') {
      newTitle = text.length > 32 ? text.slice(0, 32) + '...' : text;
    }

    const updatedSessions = sessions.map((s) =>
      s.id === currentSession.id
        ? {
            ...s,
            title: newTitle,
            updatedAt: new Date().toISOString(),
            messages: updatedMessages,
          }
        : s
    );

    await updateSessions(updatedSessions);
    setInputText('');
    setIsTyping(true);

    try {
      const result = await chatbotService.ask(
        text,
        selectedPondId !== 'ALL' ? selectedPondId : undefined,
        currentPond?.farmId
      );

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: result.answer,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        sources: result.sources,
        pondName: result.pondName || (currentPond ? currentPond.name : undefined),
        recommendations: result.recommendations,
        poweredBy: result.poweredBy,
      };

      const finalSessions = updatedSessions.map((s) =>
        s.id === currentSession.id
          ? {
              ...s,
              updatedAt: new Date().toISOString(),
              messages: [...updatedMessages, aiMsg],
            }
          : s
      );
      await updateSessions(finalSessions);
    } catch (err: any) {
      const fallbackAiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `Đã tiếp nhận câu hỏi của bạn về **"${text}"**.\n\nHệ thống đang phân tích các chỉ số ao và cẩm nang kỹ thuật nuôi tôm. Bạn có thể kiểm tra lại kết nối mạng hoặc thử lại sau giây lát.`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        isError: true,
      };

      const finalSessions = updatedSessions.map((s) =>
        s.id === currentSession.id
          ? {
              ...s,
              updatedAt: new Date().toISOString(),
              messages: [...updatedMessages, fallbackAiMsg],
            }
          : s
      );
      await updateSessions(finalSessions);
    } finally {
      setIsTyping(false);
    }
  };

  // Filtered sessions for History tab search
  const filteredSessions = useMemo(() => {
    if (!historySearchQuery.trim()) return sessions;
    const q = historySearchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [sessions, historySearchQuery]);

  // Markdown-like text formatter
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      if (!line.trim()) {
        return <View key={idx} style={{ height: 6 }} />;
      }

      // Check bold tags **bold**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');

      return (
        <View key={idx} style={[styles.textLineWrapper, isBullet && styles.bulletLine]}>
          <Text style={styles.messageText}>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <Text key={pIdx} style={styles.boldText}>
                    {part.slice(2, -2)}
                  </Text>
                );
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <Text key={pIdx} style={styles.codeText}>
                    {part.slice(1, -1)}
                  </Text>
                );
              }
              return part;
            })}
          </Text>
        </View>
      );
    });
  };

  // Render AI or User Message Bubble
  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';

    if (isUser) {
      return (
        <View style={styles.userMessageContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userMessageText}>{item.text}</Text>
            <Text style={styles.userTimeText}>{item.time}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.aiMessageContainer}>
        {/* 3D Orange Mascot Avatar */}
        <View style={styles.mascotAvatarWrapper}>
          <Image source={MASCOT_IMAGE} style={styles.mascotAvatar} />
        </View>

        <View style={styles.aiBubbleWrapper}>
          {/* Pond Context Badge */}
          {item.pondName && (
            <View style={styles.pondContextBadge}>
              <Compass size={12} color="#059669" />
              <Text style={styles.pondContextText}>Ngữ cảnh: {item.pondName}</Text>
            </View>
          )}

          {/* Formatted Content */}
          <View style={styles.aiContentContainer}>{renderFormattedText(item.text)}</View>

          {/* Citations / 5T Manual Sources */}
          {item.sources && item.sources.length > 0 && (
            <View style={styles.sourcesContainer}>
              <Text style={styles.sourcesHeader}>Cẩm nang tham khảo:</Text>
              <View style={styles.sourcePillList}>
                {item.sources.map((src, sIdx) => {
                  const title = typeof src === 'string' ? src : src.title;
                  const score = typeof src === 'object' && src.relevanceScore
                    ? Math.round(src.relevanceScore * 100)
                    : null;
                  return (
                    <View key={sIdx} style={styles.sourcePill}>
                      <BookOpen size={11} color="#059669" />
                      <Text style={styles.sourcePillTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      {score !== null && (
                        <Text style={styles.sourcePillScore}>{score}%</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* AI Toolbar (Copy & Time) */}
          {item.id !== 'welcome-chatgpt' && (
            <View style={styles.aiToolbar}>
              <TouchableOpacity
                onPress={() => handleCopyText(item.id, item.text)}
                style={styles.copyButton}
                activeOpacity={0.7}
              >
                {copiedMessageId === item.id ? (
                  <>
                    <Check size={13} color="#059669" />
                    <Text style={styles.copiedText}>Đã sao chép</Text>
                  </>
                ) : (
                  <>
                    <Copy size={13} color="#94a3b8" />
                    <Text style={styles.copyText}>Sao chép</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.aiTimeText}>{item.time}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* ── 1. TOP HEADER & TAB SWITCHER (Trò chuyện / Lịch sử) ── */}
        <View style={styles.header}>
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              onPress={() => setActiveTab('chat')}
              style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
              activeOpacity={0.8}
            >
              <Image source={MASCOT_IMAGE} style={styles.tabMascotIcon} />
              <Text style={[styles.tabButtonText, activeTab === 'chat' && styles.tabButtonTextActive]}>
                Trò chuyện
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('history')}
              style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
              activeOpacity={0.8}
            >
              <History size={14} color={activeTab === 'history' ? '#0284c7' : '#64748b'} />
              <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>
                Lịch sử
              </Text>
              <View style={styles.historyCountBadge}>
                <Text style={styles.historyCountText}>{sessions.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Right Action Icons */}
          <View style={styles.headerRightActions}>
            {activeTab === 'chat' && (
              <TouchableOpacity
                onPress={handleNewChat}
                style={styles.newChatHeaderButton}
                activeOpacity={0.7}
                accessibilityLabel="Cuộc trò chuyện mới"
              >
                <Plus size={18} color="#0f172a" />
              </TouchableOpacity>
            )}
            {onClose && (
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeHeaderButton}
                activeOpacity={0.7}
                accessibilityLabel="Đóng"
              >
                <X size={18} color="#0f172a" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── 2. VIEW: TAB LỊCH SỬ (DEDICATED FULL HISTORY VIEW) ── */}
        {activeTab === 'history' ? (
          <View style={styles.historyContainer}>
            {/* Search Bar & New Chat CTA */}
            <View style={styles.historyTopControls}>
              <View style={styles.searchBar}>
                <Search size={15} color="#94a3b8" />
                <TextInput
                  value={historySearchQuery}
                  onChangeText={setHistorySearchQuery}
                  placeholder="Tìm kiếm đoạn hội thoại..."
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                />
                {historySearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setHistorySearchQuery('')}>
                    <X size={15} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={handleNewChat}
                style={styles.newChatCtaButton}
                activeOpacity={0.8}
              >
                <Plus size={15} color="#ffffff" />
                <Text style={styles.newChatCtaText}>Mới</Text>
              </TouchableOpacity>
            </View>

            {/* Sessions List */}
            <FlatList
              data={filteredSessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.sessionListContent}
              ListEmptyComponent={
                <View style={styles.emptySessionsContainer}>
                  <Bot size={40} color="#cbd5e1" />
                  <Text style={styles.emptySessionsTitle}>Không tìm thấy cuộc trò chuyện nào</Text>
                  <Text style={styles.emptySessionsSubtitle}>
                    Bắt đầu một cuộc trò chuyện mới để lưu lại lịch sử tư vấn nuôi tôm.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isActive = item.id === activeSessionId;
                const lastUserMsg = item.messages.filter((m) => m.sender === 'user').slice(-1)[0];

                return (
                  <TouchableOpacity
                    onPress={() => handleSelectSession(item.id)}
                    style={[styles.sessionCard, isActive && styles.sessionCardActive]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sessionCardContent}>
                      <View style={styles.sessionCardHeader}>
                        <View
                          style={[
                            styles.sessionIconWrapper,
                            isActive && styles.sessionIconWrapperActive,
                          ]}
                        >
                          <MessageSquare size={14} color={isActive ? '#059669' : '#64748b'} />
                        </View>
                        <Text
                          style={[styles.sessionTitle, isActive && styles.sessionTitleActive]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                      </View>

                      {lastUserMsg && (
                        <Text style={styles.sessionPreviewText} numberOfLines={1}>
                          {lastUserMsg.text}
                        </Text>
                      )}

                      <View style={styles.sessionMetaRow}>
                        <View style={styles.sessionMetaItem}>
                          <Calendar size={11} color="#94a3b8" />
                          <Text style={styles.sessionMetaText}>{item.createdAt}</Text>
                        </View>
                        <Text style={styles.sessionMetaDot}>•</Text>
                        <View style={styles.sessionMetaItem}>
                          <Layers size={11} color="#94a3b8" />
                          <Text style={styles.sessionMetaText}>
                            {item.messages.length} tin nhắn
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Delete button */}
                    <TouchableOpacity
                      onPress={() => handleDeleteSession(item.id)}
                      style={styles.deleteSessionButton}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Bottom Clear All Bar */}
            {sessions.length > 1 && (
              <View style={styles.clearAllFooter}>
                <Text style={styles.clearAllCountText}>
                  Tổng cộng {sessions.length} phiên trò chuyện
                </Text>
                <TouchableOpacity
                  onPress={handleClearAllHistory}
                  style={styles.clearAllButton}
                  activeOpacity={0.7}
                >
                  <Trash2 size={13} color="#ef4444" />
                  <Text style={styles.clearAllButtonText}>Xóa tất cả</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* ── 3. VIEW: TAB TRÒ CHUYỆN (FULL CHAT STREAM VIEW) ── */
          <View style={styles.chatContainer}>
            {/* Pond Context Selector Pills */}
            <View style={styles.pondSelectorContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pondSelectorScroll}
              >
                <TouchableOpacity
                  onPress={() => setSelectedPondId('ALL')}
                  style={[
                    styles.pondPill,
                    selectedPondId === 'ALL' && styles.pondPillActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Sparkles
                    size={12}
                    color={selectedPondId === 'ALL' ? '#ffffff' : '#059669'}
                  />
                  <Text
                    style={[
                      styles.pondPillText,
                      selectedPondId === 'ALL' && styles.pondPillTextActive,
                    ]}
                  >
                    Tất cả / Tư vấn chung
                  </Text>
                </TouchableOpacity>

                {ponds.map((pond) => (
                  <TouchableOpacity
                    key={pond.id}
                    onPress={() => setSelectedPondId(pond.id)}
                    style={[
                      styles.pondPill,
                      selectedPondId === pond.id && styles.pondPillActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Compass
                      size={12}
                      color={selectedPondId === pond.id ? '#ffffff' : '#2563eb'}
                    />
                    <Text
                      style={[
                        styles.pondPillText,
                        selectedPondId === pond.id && styles.pondPillTextActive,
                      ]}
                    >
                      {pond.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Chat Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messagesListContent}
              ListFooterComponent={
                isTyping ? (
                  <View style={styles.typingIndicatorContainer}>
                    <View style={styles.mascotAvatarWrapper}>
                      <Image source={MASCOT_IMAGE} style={styles.mascotAvatar} />
                    </View>
                    <View style={styles.typingBubble}>
                      <ActivityIndicator size="small" color="#f97316" />
                      <Text style={styles.typingText}>Smart Shrimp AI đang suy nghĩ...</Text>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* Quick Prompts (Dải gợi ý nhanh) */}
            <View style={styles.quickPromptsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickPromptsScroll}
              >
                {QUICK_PROMPTS.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleSendMessage(item.query)}
                    style={styles.quickPromptPill}
                    activeOpacity={0.8}
                    disabled={isTyping}
                  >
                    <Text style={styles.quickPromptText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ── 4. CHATGPT CAPSULE PROMPT BAR ── */}
            <View style={styles.inputFooter}>
              <View style={styles.capsuleInputWrapper}>
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Nhắn tin cho Smart Shrimp AI..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  style={styles.textInput}
                />
                <TouchableOpacity
                  onPress={() => handleSendMessage()}
                  disabled={!inputText.trim() || isTyping}
                  style={[
                    styles.sendCircleButton,
                    inputText.trim() && !isTyping ? styles.sendCircleButtonActive : null,
                  ]}
                  activeOpacity={0.8}
                >
                  <ArrowUp size={18} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <Text style={styles.disclaimerText}>
                Smart Shrimp AI kết hợp cẩm nang kỹ thuật & cảm biến ao. Hãy đối chiếu khi ra quyết định lớn.
              </Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
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
    backgroundColor: '#ffffff',
  },

  // Header & Tab Switcher
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  tabSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabMascotIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  historyCountBadge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  historyCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newChatHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pond Selector
  pondSelectorContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    backgroundColor: '#ffffff',
  },
  pondSelectorScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pondPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 5,
  },
  pondPillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  pondPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pondPillTextActive: {
    color: '#ffffff',
  },

  // Chat Container & Message Stream
  chatContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  messagesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },

  // User Message (Soft Gray Capsule)
  userMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userMessageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0f172a',
  },
  userTimeText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 4,
  },

  // AI Message (Full Width with 3D Mascot Avatar)
  aiMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  mascotAvatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fb923c',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    marginTop: 2,
  },
  mascotAvatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  aiBubbleWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  pondContextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    marginBottom: 6,
  },
  pondContextText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  aiContentContainer: {
    gap: 2,
  },
  textLineWrapper: {
    marginBottom: 2,
  },
  bulletLine: {
    paddingLeft: 6,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#1e293b',
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  codeText: {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },

  // Citations / 5T Sources
  sourcesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sourcesHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  sourcePillList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  sourcePillTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
    maxWidth: 160,
  },
  sourcePillScore: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },

  // AI Toolbar (Copy & Time)
  aiToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  copyText: {
    fontSize: 11,
    color: '#64748b',
  },
  copiedText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  aiTimeText: {
    fontSize: 10,
    color: '#94a3b8',
  },

  // Typing indicator
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },

  // Quick Prompts
  quickPromptsContainer: {
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  quickPromptsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickPromptPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickPromptText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },

  // Input Footer (ChatGPT Style Capsule)
  inputFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  capsuleInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    maxHeight: 90,
    paddingRight: 8,
  },
  sendCircleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircleButtonActive: {
    backgroundColor: '#0f172a',
  },
  disclaimerText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },

  // ── HISTORY TAB STYLES ──
  historyContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  historyTopControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  newChatCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  newChatCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  sessionListContent: {
    gap: 10,
    paddingBottom: 20,
  },
  emptySessionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptySessionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  emptySessionsSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 260,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  sessionCardActive: {
    borderColor: '#10b981',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
  },
  sessionCardContent: {
    flex: 1,
    gap: 4,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionIconWrapperActive: {
    backgroundColor: '#ecfdf5',
  },
  sessionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  sessionTitleActive: {
    color: '#0f172a',
  },
  sessionPreviewText: {
    fontSize: 12,
    color: '#64748b',
    paddingLeft: 34,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 34,
    marginTop: 2,
  },
  sessionMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionMetaText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  sessionMetaDot: {
    fontSize: 10,
    color: '#cbd5e1',
  },
  deleteSessionButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  clearAllFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  clearAllCountText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearAllButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
});
