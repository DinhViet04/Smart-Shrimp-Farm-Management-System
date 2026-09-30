import { useState, useRef, useEffect } from 'react';
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
  FileCheck2, 
  Compass, 
  Search, 
  MessageCircle,
  Calendar,
  Layers
} from 'lucide-react';
import { chatbotService, type ChatbotSource } from '../services/chatbot.service';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  sources?: ChatbotSource[];
  pondName?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'ssfm_chatgpt_style_sessions_v2';
const ACTIVE_SESSION_KEY = 'ssfm_chatgpt_active_session_id_v2';

const createNewSession = (title = 'Cuộc trò chuyện mới'): ChatSession => {
  const now = new Date();
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    createdAt: now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
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

export default function FloatingAIChatbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNotificationBadge, setShowNotificationBadge] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Tab điều hướng riêng biệt: 'chat' hoặc 'history'
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

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

  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || createNewSession();
  const messages = currentSession.messages;

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
  }, [sessions, activeSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollToBottom();
      setShowNotificationBadge(false);
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
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setActiveTab('chat');
    setTimeout(() => textareaRef.current?.focus(), 200);
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setActiveTab('chat');
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
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
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện?')) return;
    const fresh = createNewSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setActiveTab('chat');
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    let newTitle = currentSession.title;
    if (currentSession.title === 'Cuộc trò chuyện mới') {
      newTitle = text.length > 32 ? text.slice(0, 32) + '...' : text;
    }

    setSessions(prev =>
      prev.map(s =>
        s.id === currentSession.id
          ? { ...s, title: newTitle, updatedAt: new Date().toISOString(), messages: updatedMessages }
          : s
      )
    );

    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsTyping(true);

    try {
      const result = await chatbotService.ask(text);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: result.answer,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        sources: result.sources,
        pondName: result.pondName,
      };

      setSessions(prev =>
        prev.map(s =>
          s.id === currentSession.id
            ? { ...s, updatedAt: new Date().toISOString(), messages: [...updatedMessages, aiMsg] }
            : s
        )
      );
    } catch (err) {
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `Đã tiếp nhận câu hỏi của bạn về **"${text}"**. Hệ thống đang phân tích chỉ số ao và cẩm nang kỹ thuật nuôi tôm.`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };

        setSessions(prev =>
          prev.map(s =>
            s.id === currentSession.id
              ? { ...s, updatedAt: new Date().toISOString(), messages: [...updatedMessages, aiMsg] }
              : s
          )
        );
      }, 400);
    } finally {
      setIsTyping(false);
    }
  };

  // Lọc danh sách lịch sử theo từ khóa tìm kiếm
  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    s.messages.some(m => m.text.toLowerCase().includes(historySearchQuery.toLowerCase()))
  );

  // Helper format markdown text kiểu ChatGPT
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={pIdx} className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        return part;
      });

      return (
        <p key={idx} className={`text-[13.5px] leading-relaxed text-slate-800 ${line.startsWith('•') || line.startsWith('-') ? 'pl-2' : ''}`}>
          {formattedParts}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto font-sans">
      {/* ── 1. MAIN CHATGPT WINDOW ───────────────────────────────────────────── */}
      {isOpen && (
        <div 
          className={`rounded-3xl shadow-2xl shadow-slate-950/20 border border-slate-200/90 bg-white flex flex-col overflow-hidden mb-3 transition-all duration-300 animate-in zoom-in-95 origin-bottom-right ${
            isExpanded 
              ? 'w-[94vw] sm:w-[700px] md:w-[780px] h-[86vh]' 
              : 'w-[370px] sm:w-[460px] h-[640px] max-h-[85vh]'
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
                <img src="/assets/shrimp-mascot.jpg" alt="Shrimp AI" className="w-4 h-4 rounded-full object-cover" />
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
                onClick={() => setIsExpanded(prev => !prev)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer hidden sm:flex"
                title={isExpanded ? "Thu nhỏ cửa sổ" : "Mở rộng cửa sổ"}
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
                  className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
                >
                  <SquarePen className="w-3.5 h-3.5" />
                  <span>Đoạn chat mới</span>
                </button>
              </div>

              {/* Sessions List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {filteredSessions.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <MessageCircle className="w-10 h-10 mb-2.5 opacity-30 text-slate-600" />
                    <p className="text-xs font-bold text-slate-600">Không tìm thấy cuộc trò chuyện nào</p>
                    <p className="text-[11px] text-slate-400 mt-1">Hãy bắt đầu một cuộc trò chuyện mới để lưu lại lịch sử.</p>
                  </div>
                ) : (
                  filteredSessions.map((s) => {
                    const isActive = s.id === activeSessionId;
                    const lastUserMsg = s.messages.filter(m => m.sender === 'user').slice(-1)[0];
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSession(s.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 group relative ${
                          isActive
                            ? 'bg-white border-emerald-500/50 ring-2 ring-emerald-500/10 shadow-sm'
                            : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                            <h4 className={`text-xs font-bold truncate flex-1 ${isActive ? 'text-slate-900' : 'text-slate-800'}`}>
                              {s.title}
                            </h4>
                          </div>

                          {lastUserMsg && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 pl-9">
                              {lastUserMsg.text}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium pl-9 pt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {s.createdAt}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {s.messages.length} tin nhắn
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            title="Xóa cuộc trò chuyện này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Clear All Button */}
              {sessions.length > 1 && (
                <div className="pt-3 border-t border-slate-200/80 mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Tổng cộng {sessions.length} phiên trò chuyện
                  </span>
                  <button
                    onClick={handleClearAllHistory}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Xóa tất cả</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── 3. VIEW: TAB TRÒ CHUYỆN (FULL CHAT STREAM VIEW) ──────────────── */
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-2 animate-in fade-in duration-200">
                    {msg.sender === 'user' ? (
                      /* USER MESSAGE: Modern Soft Gray Capsule */
                      <div className="flex justify-end">
                        <div className="max-w-[85%] sm:max-w-[75%] bg-[#f4f4f4] text-slate-900 px-4 py-2.5 rounded-3xl rounded-br-md text-[13.5px] leading-relaxed">
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      /* AI MESSAGE: Full Width with Orange Shrimp Mascot Avatar & Markdown */
                      <div className="flex gap-3 items-start max-w-full">
                        {/* Orange Shrimp 3D Avatar */}
                        <img 
                          src="/assets/shrimp-mascot.jpg" 
                          alt="Shrimp AI" 
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-orange-400/50 flex-shrink-0 mt-0.5 shadow-xs bg-slate-900" 
                        />

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Pond Context Badge */}
                          {msg.pondName && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-semibold text-slate-700">
                              <Compass className="w-3 h-3 text-emerald-600" />
                              <span>Ngữ cảnh: {msg.pondName}</span>
                            </div>
                          )}

                          {/* Formatted Content */}
                          <div className="space-y-1">
                            {renderFormattedText(msg.text)}
                          </div>

                          {/* Citations (Cẩm nang tham khảo) */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100">
                              <div className="flex flex-wrap gap-1.5">
                                {msg.sources.map((src, sIdx) => (
                                  <div 
                                    key={sIdx}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-600"
                                    title={src.snippet}
                                  >
                                    <FileCheck2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                    <span className="font-medium truncate max-w-[200px]">{src.title}</span>
                                    <span className="text-[10px] text-emerald-700 font-bold">
                                      {Math.round(src.relevanceScore * 100)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
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
                                    <span className="text-[10px] text-emerald-600 font-semibold">Đã sao chép</span>
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
                      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── INPUT FOOTER (ChatGPT Capsule Prompt Bar) ───────────────── */}
              <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex-shrink-0">
                <div className="relative rounded-3xl border border-slate-300/80 bg-slate-50/70 focus-within:bg-white focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all shadow-xs px-4 py-2 flex items-end gap-2">
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
                    placeholder="Nhắn tin cho Smart Shrimp AI..."
                    className="flex-1 bg-transparent resize-none outline-none text-[13.5px] leading-relaxed text-slate-800 placeholder:text-slate-400 max-h-[120px] py-1"
                  />

                  {/* Circular Send Button (ChatGPT Arrow Up) */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 mb-0.5 ${
                      inputMessage.trim() && !isTyping
                        ? 'bg-slate-900 text-white hover:bg-black shadow-xs hover:scale-105 active:scale-95'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title="Gửi câu hỏi (Enter)"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Subtitle Disclaimer */}
                <p className="text-[10px] text-center text-slate-400 mt-2">
                  Smart Shrimp AI kết hợp cẩm nang kỹ thuật & cảm biến ao. Hãy đối chiếu khi ra quyết định lớn.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. FLOATING TRIGGER BUTTON (VIBRANT 3D ORANGE SHRIMP) ───────────── */}
      <div className="relative flex items-center">
        {!isOpen && showNotificationBadge && (
          <div className="absolute right-20 bg-white px-3.5 py-1.5 rounded-full shadow-xl border border-orange-200/80 flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-right-4 duration-300">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>Trợ lý Tôm AI</span> 🦐
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowNotificationBadge(false); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 transform hover:scale-110 active:scale-95 cursor-pointer border-2 border-white/90 overflow-hidden relative p-0.5 group ${
            isOpen 
              ? 'bg-gradient-to-tr from-amber-500 via-orange-500 to-cyan-400 shadow-orange-500/50 ring-4 ring-orange-500/30' 
              : 'bg-gradient-to-tr from-amber-500 via-orange-500 to-cyan-400 shadow-orange-500/35 ring-4 ring-orange-400/20'
          }`}
          title={isOpen ? "Thu nhỏ Trợ lý Tôm AI" : "Mở Trợ lý Tôm AI"}
        >
          <img 
            src="/assets/shrimp-mascot.jpg" 
            alt="Smart Shrimp Mascot" 
            className={`w-full h-full object-cover rounded-full transition-all duration-700 ease-out transform ${
              isOpen ? 'rotate-[360deg] scale-100' : 'rotate-0 group-hover:rotate-12 group-hover:scale-105'
            }`} 
          />
        </button>
      </div>
    </div>
  );
}
