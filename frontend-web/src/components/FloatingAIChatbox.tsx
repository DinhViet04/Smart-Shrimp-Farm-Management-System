import { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  X, 
  SendHorizontal, 
  RotateCcw, 
  Lightbulb, 
  Waves, 
  Droplets, 
  Scale, 
  Activity,
  BookOpen,
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  Database
} from 'lucide-react';
import { chatbotService, type ChatbotSource, type KnowledgeDoc } from '../services/chatbot.service';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  suggestions?: string[];
  sources?: ChatbotSource[];
  pondName?: string;
}

const QUICK_PROMPTS = [
  { icon: Droplets, label: 'Chỉ số pH & Oxy tối ưu?' },
  { icon: Waves, label: 'Mật độ thả giống tôm thẻ?' },
  { icon: Scale, label: 'Cách tính và tối ưu FCR?' },
  { icon: Activity, label: 'Xử lý khí độc NH3 & NO2 cao?' },
];

export default function FloatingAIChatbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [showNotificationBadge, setShowNotificationBadge] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');

  // Quản lý tài liệu RAG
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [newDocData, setNewDocData] = useState({
    title: '',
    category: 'GENERAL',
    content: '',
  });
  const [docSaving, setDocSaving] = useState(false);
  const [docMessage, setDocMessage] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: `Xin chào! Tôi là **Trợ Lý Kỹ Thuật Nuôi Tôm RAG 4.0** 🦐\n\nTôi được trang bị **kho tài liệu kỹ thuật nuôi tôm chuyên sâu** và có khả năng đọc dữ liệu môi trường thực tế tại trang trại của bạn. Hãy hỏi tôi về các quy chuẩn nước, cách kéo giảm FCR, xử lý bệnh hoặc chọn câu hỏi gợi ý bên dưới!`,
      time: 'Vừa xong',
      suggestions: ['Chỉ số pH & Oxy tối ưu?', 'Cách tính và tối ưu FCR?', 'Xử lý khí độc NH3 & NO2 cao?'],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollToBottom();
      setShowNotificationBadge(false);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen, messages, isTyping, activeTab]);

  // Load danh sách tài liệu RAG khi mở tab kho tri thức
  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const data = await chatbotService.getDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('Không thể tải tài liệu RAG:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'knowledge') {
      loadDocuments();
    }
  }, [isOpen, activeTab]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // 1. Gửi lên RAG backend
      const result = await chatbotService.ask(text);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: result.answer,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        sources: result.sources,
        pondName: result.pondName,
        suggestions: ['Chỉ số pH & Oxy tối ưu?', 'Cách tính và tối ưu FCR?', 'Xử lý khí độc NH3 & NO2 cao?'],
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      // 2. Fallback nếu backend offline hoặc lỗi mạng
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `🤖 **Trợ lý AI:** Đã tiếp nhận câu hỏi của bạn về: **"${text}"**.\n\nHệ thống đang kết nối đến kho dữ liệu RAG. Bạn có thể bấm vào biểu tượng **"Kho Tri Thức"** ở thanh công cụ phía trên để xem các tài liệu hướng dẫn kỹ thuật nuôi tôm đã được nạp sẵn.`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          suggestions: ['Chỉ số pH & Oxy tối ưu?', 'Cách tính và tối ưu FCR?', 'Xử lý khí độc NH3 & NO2 cao?'],
        };
        setMessages(prev => [...prev, aiMsg]);
      }, 500);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'ai',
        text: 'Cuộc trò chuyện đã được làm mới. Tôi có thể giúp gì thêm cho vụ nuôi tôm của bạn hôm nay?',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        suggestions: ['Chỉ số pH & Oxy tối ưu?', 'Cách tính và tối ưu FCR?', 'Xử lý khí độc NH3 & NO2 cao?'],
      },
    ]);
  };

  // Thêm tài liệu mới vào RAG
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocData.title.trim() || !newDocData.content.trim()) return;

    setDocSaving(true);
    setDocMessage(null);
    try {
      await chatbotService.createDocument(newDocData);
      setDocMessage('Đã thêm tài liệu và phân tích vector RAG thành công!');
      setNewDocData({ title: '', category: 'GENERAL', content: '' });
      setShowAddDocModal(false);
      loadDocuments();
      setTimeout(() => setDocMessage(null), 4000);
    } catch (err: any) {
      setDocMessage(err.message || 'Lỗi khi lưu tài liệu');
    } finally {
      setDocSaving(false);
    }
  };

  // Xóa tài liệu khỏi RAG
  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi kho tri thức RAG?')) return;
    try {
      await chatbotService.deleteDocument(id);
      loadDocuments();
    } catch (err) {
      alert('Không thể xóa tài liệu này');
    }
  };

  // Helper format markdown text
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-blue-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={pIdx} className="bg-slate-100 text-blue-700 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        return part;
      });

      return (
        <p key={idx} className={`text-sm leading-relaxed ${line.startsWith('•') ? 'pl-2 text-slate-700' : 'text-slate-800'}`}>
          {formattedParts}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto">
      {/* ── 1. CHAT BUBBLE WINDOW ────────────────────────────────────────────── */}
      {isOpen && (
        <div 
          className="w-[360px] sm:w-[420px] h-[590px] max-h-[85vh] rounded-3xl shadow-2xl shadow-blue-950/25 border border-white/80 backdrop-blur-2xl bg-white/95 flex flex-col overflow-hidden mb-4 animate-in zoom-in-90 fade-in slide-in-from-bottom-5 duration-300 origin-bottom-right"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-600 px-5 py-3.5 text-white flex items-center justify-between shadow-md relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner">
                  <Bot className="w-6 h-6 text-cyan-200 animate-pulse" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-indigo-700 rounded-full" />
              </div>
              <div>
                <h3 className="font-black text-sm tracking-tight flex items-center gap-1.5">
                  Trợ Lý Tôm AI (RAG)
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </h3>
                <p className="text-[11px] text-cyan-100 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Học từ tài liệu & dữ liệu ao thật
                </p>
              </div>
            </div>

            {/* Header Actions & Mode Switcher */}
            <div className="flex items-center gap-1 relative z-10">
              <button
                onClick={() => setActiveTab(activeTab === 'chat' ? 'knowledge' : 'chat')}
                className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
                  activeTab === 'knowledge' 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-white/85 hover:text-white hover:bg-white/15'
                }`}
                title="Kho tri thức tài liệu RAG"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Tài liệu</span>
              </button>
              
              {activeTab === 'chat' && (
                <button
                  onClick={handleResetChat}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  title="Làm mới đoạn hội thoại"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="Thu nhỏ cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── TAB CHAT VIEW ──────────────────────────────────────────────── */}
          {activeTab === 'chat' ? (
            <>
              {/* Quick Prompts Bar */}
              <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200/60 overflow-x-auto flex items-center gap-1.5 no-scrollbar flex-shrink-0">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1 flex items-center gap-1 flex-shrink-0">
                  <Lightbulb className="w-3 h-3 text-amber-500" /> Gợi ý:
                </span>
                {QUICK_PROMPTS.map((prompt, pIdx) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={pIdx}
                      onClick={() => handleSendMessage(prompt.label)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-full border border-slate-200/80 text-xs font-semibold whitespace-nowrap transition-all shadow-2xs hover:border-blue-300 cursor-pointer flex items-center gap-1 flex-shrink-0"
                    >
                      <Icon className="w-3 h-3 text-blue-500" />
                      <span>{prompt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Chat Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
                  >
                    <div 
                      className={`max-w-[88%] rounded-2xl p-3.5 shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-br-none shadow-blue-500/20'
                          : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/70 shadow-slate-200/50'
                      }`}
                    >
                      {msg.sender === 'ai' ? (
                        <div className="space-y-2">
                          {renderFormattedText(msg.text)}

                          {/* RAG Sources Citations (Nguồn trích dẫn) */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                              <p className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                                <BookOpen className="w-3 h-3" /> Nguồn trích dẫn từ kho tri thức:
                              </p>
                              <div className="space-y-1">
                                {msg.sources.map((src, sIdx) => (
                                  <div 
                                    key={sIdx}
                                    className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-1.5 text-[11px] text-slate-600"
                                    title={src.snippet}
                                  >
                                    <div className="flex items-center justify-between font-semibold text-indigo-900">
                                      <span className="truncate">📄 {src.title} (Đoạn {src.chunkIndex})</span>
                                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                        Khớp {Math.round(src.relevanceScore * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                      {msg.time}
                    </span>

                    {/* Follow-up Suggestions from AI */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSendMessage(sug)}
                            className="px-2.5 py-1 bg-white hover:bg-cyan-50 text-cyan-800 border border-cyan-200/80 rounded-xl text-[11px] font-semibold transition-all hover:border-cyan-400 cursor-pointer shadow-2xs"
                          >
                            👉 {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* AI Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium pl-1 animate-in fade-in duration-200">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                      <Bot className="w-4 h-4 text-blue-600 animate-spin" />
                    </div>
                    <div className="bg-white px-3.5 py-2 rounded-2xl rounded-bl-none border border-slate-200 shadow-xs flex items-center gap-1.5">
                      <span className="text-[11px] text-blue-600 font-semibold">Đang truy xuất RAG & suy nghĩ</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Footer */}
              <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Hỏi AI dựa trên tài liệu đã nạp (pH, FCR, khí độc...)..."
                  className="flex-1 bg-slate-100/80 border border-slate-200/80 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim()}
                  className="p-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 disabled:opacity-40 text-white rounded-2xl transition-all shadow-md shadow-blue-500/25 hover:scale-105 active:scale-95 disabled:hover:scale-100 cursor-pointer flex-shrink-0"
                  title="Gửi câu hỏi"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            /* ── TAB KNOWLEDGE MANAGEMENT VIEW ────────────────────────────── */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/70 p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    Kho Tri Thức Tài Liệu
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">Tài liệu được AI học để trả lời cho bạn</p>
                </div>
                <button
                  onClick={() => setShowAddDocModal(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition-all hover:scale-105 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm tài liệu
                </button>
              </div>

              {docMessage && (
                <div className="mb-3 p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{docMessage}</span>
                </div>
              )}

              {/* Documents List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {loadingDocs ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Đang tải kho tri thức...</span>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">Chưa có tài liệu nào trong kho</p>
                    <p className="text-[11px] mt-1">Hãy thêm tài liệu để AI bắt đầu học!</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-[10px] font-bold uppercase">
                            {doc.category}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {doc._count?.chunks || 0} chunks vector
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-800 line-clamp-1">{doc.title}</h5>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                          {doc.content}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa tài liệu này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Thêm tài liệu mới */}
              {showAddDocModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs">
                  <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-4 space-y-3 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-800">Thêm Tài Liệu Cho AI Học</h4>
                      <button onClick={() => setShowAddDocModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateDocument} className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Tiêu đề tài liệu / Quy trình *</label>
                        <input
                          required
                          type="text"
                          value={newDocData.title}
                          onChange={(e) => setNewDocData({ ...newDocData, title: e.target.value })}
                          placeholder="Ví dụ: Quy trình ủ vi sinh tạt đáy"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:bg-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Thể loại</label>
                        <select
                          value={newDocData.category}
                          onChange={(e) => setNewDocData({ ...newDocData, category: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none"
                        >
                          <option value="GENERAL">Chung / Kỹ thuật nuôi</option>
                          <option value="WATER_QUALITY">Môi trường nước (pH, Oxy, Khí độc)</option>
                          <option value="FEEDING">Thức ăn & Quản lý FCR</option>
                          <option value="SHRIMP_DISEASE">Phòng & Trị bệnh tôm</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Nội dung chi tiết tài liệu *</label>
                        <textarea
                          required
                          rows={6}
                          value={newDocData.content}
                          onChange={(e) => setNewDocData({ ...newDocData, content: e.target.value })}
                          placeholder="Dán nội dung hướng dẫn kỹ thuật hoặc quy trình thực tế của bạn vào đây. AI sẽ tự động phân tách và học thuộc..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 leading-relaxed"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddDocModal(false)}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={docSaving}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                          {docSaving ? 'Đang phân tích...' : 'Lưu & Nạp Vector'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 2. FLOATING STICKER TRIGGER BUTTON ──────────────────────────────── */}
      <div className="relative flex items-center">
        {!isOpen && showNotificationBadge && (
          <div className="absolute right-20 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-blue-100 flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-right-4 duration-500 group">
            <span className="text-xs font-bold text-slate-700">
              Trợ lý Tôm AI (RAG) sẵn sàng 🦐
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowNotificationBadge(false); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-t border-r border-blue-100 transform rotate-45" />
          </div>
        )}

        {/* Sticker Main Button */}
        <div className="relative group">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 rounded-full blur-md opacity-70 group-hover:opacity-100 animate-pulse transition duration-500 pointer-events-none" />

          <button
            onClick={() => setIsOpen(prev => !prev)}
            className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 transform group-hover:scale-110 active:scale-95 cursor-pointer border-2 border-white/80 ${
              isOpen 
                ? 'bg-slate-800 hover:bg-slate-900 rotate-90' 
                : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 hover:shadow-cyan-500/50'
            }`}
            title={isOpen ? "Thu nhỏ Trợ lý AI" : "Mở Trợ lý Nuôi Tôm AI"}
          >
            {isOpen ? (
              <X className="w-7 h-7 text-white" />
            ) : (
              <div className="relative flex items-center justify-center">
                <Bot className="w-7 h-7 text-white transform group-hover:-rotate-12 transition-transform duration-300" />
                <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 animate-ping" />
              </div>
            )}

            {!isOpen && (
              <span className="absolute bottom-0 right-0 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
