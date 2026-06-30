import { Link } from 'react-router-dom';
import {
  Droplets, ArrowRight, Bot, Activity, Thermometer, Waves,
  AlertTriangle, CheckCircle2, Map as MapIcon, Send,
  TrendingUp, ActivitySquare, CheckCircle, Camera,
  Phone, Mail, MapPin
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Tính toán độ mờ (opacity) và độ blur dựa theo thao tác cuộn (cuộn đến 500px là mờ tối đa)
  const blurAmount = Math.min((scrollY / 500) * 12, 12);
  const opacityAmount = Math.min((scrollY / 600) * 0.95, 0.95);

  return (
    <div className="font-sans min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-200 selection:text-blue-900 overflow-hidden">

      {/* Dynamic Navigation */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-white/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)] py-4' : 'bg-transparent py-6'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <img src="/logonen.jpg" alt="SSFM Logo" className="h-12 w-12 rounded-full object-cover bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-white/60 group-hover:scale-105 transition-all duration-300" />
                <span className={`text-2xl font-bold tracking-tight transition-colors duration-300 drop-shadow-md ${scrolled ? 'text-slate-800' : 'text-white'}`}>SSFM</span>
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-12 items-center">
              <a href="#features" className={`font-semibold text-base tracking-wide transition-colors relative group drop-shadow-md ${scrolled ? 'text-slate-700 hover:text-blue-600' : 'text-white hover:text-blue-200'}`}>
                Tính năng
                <span className="absolute -bottom-1.5 left-0 w-0 h-[3px] bg-blue-500 transition-all duration-300 group-hover:w-full rounded-full"></span>
              </a>
              <a href="#map" className={`font-semibold text-base tracking-wide transition-colors relative group drop-shadow-md ${scrolled ? 'text-slate-700 hover:text-blue-600' : 'text-white hover:text-blue-200'}`}>
                Bản đồ trang trại
                <span className="absolute -bottom-1.5 left-0 w-0 h-[3px] bg-blue-500 transition-all duration-300 group-hover:w-full rounded-full"></span>
              </a>
              <a href="#about" className={`font-semibold text-base tracking-wide transition-colors relative group drop-shadow-md ${scrolled ? 'text-slate-700 hover:text-blue-600' : 'text-white hover:text-blue-200'}`}>
                Về chúng tôi
                <span className="absolute -bottom-1.5 left-0 w-0 h-[3px] bg-blue-500 transition-all duration-300 group-hover:w-full rounded-full"></span>
              </a>
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/login" className={`font-bold text-base tracking-wide transition-colors drop-shadow-md ${scrolled ? 'text-slate-700 hover:text-blue-600' : 'text-white hover:text-blue-200'}`}>Đăng nhập</Link>
              <Link
                to="/register"
                className="relative group px-7 py-3 rounded-full overflow-hidden shadow-[0_8px_25px_rgba(37,99,235,0.25)] bg-blue-600 text-white border border-blue-500"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 transition-transform duration-300 group-hover:scale-105 opacity-0 group-hover:opacity-100"></div>
                <span className="relative font-extrabold text-base tracking-wide flex items-center gap-2">
                  Dùng thử <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-40 pb-20 lg:pt-48 lg:pb-32 min-h-screen flex items-center bg-white">
        {/* Minimal Background Image Overlay with Dynamic Scroll Fade */}
        <div className="absolute inset-0 z-0 overflow-hidden bg-white">
          {/* Parallax Image */}
          <div className="absolute inset-0" style={{ transform: `translateY(${scrollY * 0.35}px)` }}>
            <img src="/unnamed.jpg" alt="Aquaculture Farm" className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'auto' }} />
          </div>

          {/* Dynamic Scroll Fade & Blur */}
          <div className="absolute inset-0 bg-white" style={{ opacity: opacityAmount }}></div>
          <div className="absolute inset-0" style={{ backdropFilter: `blur(${blurAmount}px)` }}></div>

          {/* Static Gradient fade to white at the bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-white via-white/80 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

            {/* Left Column: Text */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white text-sm font-semibold mb-6 shadow-md">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400"></span>
                </span>
                Hệ thống Quản lý Ao Tôm Thông minh
              </div>

              <h1 className="text-5xl lg:text-7xl font-extrabold text-white mb-6 leading-[1.1] tracking-tight drop-shadow-lg">
                Nâng Tầm <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-200">Nông Nghiệp</span><br />
                Công Nghệ Cao.
              </h1>

              <p className="mt-4 text-lg text-white max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed font-medium drop-shadow-md">
                Chuyển đổi số toàn diện trang trại nuôi tôm. Tự động hóa quy trình, tối ưu hóa hệ số FCR, và cảnh báo sớm rủi ro môi trường với nền tảng công nghệ tiên tiến nhất.
              </p>

              <div className="flex flex-col sm:flex-row justify-center lg:justify-start items-center gap-5">
                <Link to="/register" className="group relative px-8 py-4 bg-blue-600 text-white hover:bg-blue-700 rounded-full font-bold transition-all shadow-[0_8px_25px_rgba(37,99,235,0.25)] hover:shadow-[0_12px_35px_rgba(37,99,235,0.35)] hover:-translate-y-1 flex items-center gap-2 w-full sm:w-auto justify-center">
                  Dùng thử ngay <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

              </div>
            </div>

            {/* Right Column: Floating Glassmorphism Dashboard */}
            <div className="relative hidden lg:block h-[600px]">
              {/* Main Dashboard Panel */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[460px] bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-white/60 p-6 z-20">
                <div className="flex justify-between items-center mb-6 border-b border-slate-200/60 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Ao nuôi A1 - Tăng trưởng</h3>
                    <p className="text-xs text-slate-500">Cập nhật trực tiếp</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/10 text-green-700 border border-green-500/20 rounded-full text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ổn định
                  </span>
                </div>

                {/* Minimal Charts */}
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600 font-medium flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Tốc độ tăng trưởng</span>
                      <span className="font-bold text-slate-900">1.2 g/ngày</span>
                    </div>
                    {/* Mock Line Chart */}
                    <div className="h-16 w-full flex items-end gap-1">
                      {[30, 45, 40, 60, 55, 75, 80, 95].map((h, i) => (
                        <div key={i} className="flex-1 bg-blue-100/50 rounded-t-md relative group overflow-hidden">
                          <div className="absolute bottom-0 w-full bg-blue-500 rounded-t-md transition-all duration-500" style={{ height: `${h}%` }}></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/50 p-4 rounded-2xl border border-white/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Thermometer className="w-3 h-3" /> Nhiệt độ</div>
                        <div className="font-bold text-lg text-slate-900">28.5 <span className="text-xs font-normal text-slate-400">°C</span></div>
                      </div>
                      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                        <div className="text-xs text-blue-600 mb-1 flex items-center gap-1"><Droplets className="w-3 h-3" /> Oxy hòa tan</div>
                        <div className="font-bold text-lg text-slate-900">6.8 <span className="text-xs font-normal text-slate-400">mg/L</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Alert Card */}
              <div className="absolute top-[10%] right-[-10%] w-[260px] bg-white/70 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/60 p-4 z-30 animate-[bounce_4s_infinite]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-red-100/80 rounded-xl flex items-center justify-center text-red-600 flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Cảnh báo môi trường</h4>
                    <p className="text-xs text-slate-500 mt-1">Độ pH tại Ao B2 giảm xuống ngưỡng nguy hiểm (7.2).</p>
                  </div>
                </div>
              </div>

              {/* Floating Water Quality */}
              <div className="absolute bottom-[15%] left-[-15%] w-[240px] bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-4 z-30 text-slate-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100/80 rounded-xl flex items-center justify-center text-blue-600">
                    <ActivitySquare className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold">Chỉ số pH</h4>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-slate-900">7.8</span>
                  <span className="text-xs font-semibold text-green-600 mb-1 flex items-center bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Tối ưu <CheckCircle className="w-3 h-3 ml-1" /></span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                  <div className="bg-blue-500 h-1.5 rounded-full w-[78%]"></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Feature Sections with Real Images */}
      <div id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-3">Tính Năng Nâng Cao</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-6">Kiểm Soát Toàn Diện Với Hình Ảnh Thực Tế</h3>
          </div>

          {/* Section 1: Water Quality with Real Photo */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 lg:order-1">
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100 group">
                <img src="/xu-ly-ao-nuoi-dam-bao-moi-truong-nuoi-tom-tot-nhat.jpg" alt="Water Testing" className="w-full h-[400px] object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="w-5 h-5 text-blue-300" />
                    <span className="text-sm font-semibold text-blue-100">Hình ảnh thực tế từ nông trại</span>
                  </div>
                  <p className="text-sm opacity-90">Theo dõi thông số môi trường nước cực kỳ chính xác.</p>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 bg-blue-50/50 rounded-[2rem] p-8 shadow-sm border border-blue-100">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                    <Waves className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-blue-900">Giám sát chất lượng nước</h4>
                    <p className="text-sm text-slate-500">Phân tích theo thời gian thực</p>
                  </div>
                </div>
                <span className="px-4 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-bold border border-green-200">
                  An toàn
                </span>
              </div>

              {/* Charts Display */}
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-600 font-semibold flex items-center gap-2">Chỉ số pH</span>
                    <span className="font-bold text-lg text-blue-900">7.8</span>
                  </div>
                  <div className="relative h-12 flex items-end gap-1">
                    {[40, 45, 50, 55, 60, 55, 50, 48, 50, 55].map((h, i) => (
                      <div key={i} className="flex-1 bg-blue-50 rounded-t-sm relative">
                        <div className="absolute bottom-0 w-full bg-gradient-to-t from-blue-400 to-blue-300 rounded-t-sm" style={{ height: `${h}%` }}></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-sm text-slate-500 mb-2">Oxy hòa tan (DO)</div>
                    <div className="text-2xl font-bold text-blue-900 mb-2">6.5 <span className="text-sm font-normal text-slate-400">mg/L</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full w-[80%]"></div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-sm text-slate-500 mb-2">Độ mặn</div>
                    <div className="text-2xl font-bold text-blue-900 mb-2">15 <span className="text-sm font-normal text-slate-400">ppt</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full w-[60%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: AI & Analytics with Real Photo */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="bg-blue-50/50 rounded-[2rem] p-8 shadow-sm border border-blue-100 flex flex-col h-full">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-blue-900">Phân tích AI & Trợ lý RAG</h4>
                  <p className="text-sm text-slate-500">Tư vấn thông minh 24/7</p>
                </div>
              </div>

              {/* Chat Interface Mockup */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 bg-blue-600 text-white flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold">Trợ lý Tôm Thông Minh</span>
                </div>
                <div className="p-5 flex-1 space-y-4 overflow-y-auto min-h-[250px]">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-blue-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%] text-sm font-medium shadow-sm">
                      Gợi ý lượng thức ăn cho Ao A1 hôm nay?
                    </div>
                  </div>
                  {/* Bot Message */}
                  <div className="flex justify-start">
                    <div className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[90%] text-sm shadow-sm space-y-2">
                      <p>Dựa trên phân tích <strong>FCR (1.15)</strong> và dự báo thời tiết, hệ thống khuyến nghị:</p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        <li>Giảm <strong>10%</strong> lượng thức ăn cữ chiều.</li>
                        <li>Bổ sung vitamin C để tăng sức đề kháng.</li>
                      </ul>
                      <div className="mt-2 text-xs text-blue-700 font-semibold bg-blue-100 inline-block px-2 py-1 rounded">Độ tin cậy: 98%</div>
                    </div>
                  </div>
                </div>
                {/* Chat Input */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2">
                  <input type="text" placeholder="Hỏi trợ lý AI..." className="flex-1 bg-white rounded-full px-4 py-2 text-sm outline-none border border-slate-200 focus:border-blue-500" readOnly />
                  <button className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                    <Send className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100 group h-full min-h-[450px]">
                <img src="/chat.jpg" alt="Farmer checking app" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-blue-300" />
                    <span className="text-sm font-semibold text-blue-100">Quản lý mọi lúc mọi nơi</span>
                  </div>
                  <p className="text-sm opacity-90">Sử dụng AI để phân tích số liệu ngay trên hiện trường thực tế.</p>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* Pond Management Map Section */}
      <div id="map" className="py-24 bg-blue-50 relative overflow-hidden border-t border-blue-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-3">Số Hóa Trang Trại</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-4">Bản Đồ Quản Lý Trực Quan</h3>
            <p className="text-slate-600">Theo dõi toàn cảnh trạng thái các ao nuôi trên bản đồ thời gian thực.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 h-[700px]">

            {/* Map Area */}
            <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 relative overflow-hidden group shadow-lg">
              <img src="/map-bg.png" alt="Satellite Farm View" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700 mix-blend-luminosity" />
              <div className="absolute inset-0 bg-blue-100/30"></div>

              {/* Circular Ponds Overlay */}
              <div className="absolute top-[20%] left-[30%] w-32 h-32 rounded-full border-4 border-blue-500 bg-blue-500/40 flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-pulse">
                <span className="text-white font-bold text-sm bg-blue-900/80 px-2 py-1 rounded">Ao A1</span>
              </div>

              <div className="absolute top-[45%] left-[50%] w-36 h-36 rounded-full border-4 border-amber-400 bg-amber-400/40 flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                <span className="text-white font-bold text-sm bg-amber-900/80 px-2 py-1 rounded">Ao A2</span>
              </div>

              <div className="absolute bottom-[15%] left-[25%] w-28 h-28 rounded-full border-4 border-red-500 bg-red-500/40 flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                <span className="text-white font-bold text-sm bg-red-900/80 px-2 py-1 rounded">Ao B1</span>
              </div>

              <div className="absolute top-[30%] right-[15%] w-32 h-32 rounded-full border-4 border-blue-500 bg-blue-500/40 flex items-center justify-center cursor-pointer">
                <span className="text-white font-bold text-sm bg-blue-900/80 px-2 py-1 rounded">Ao C1</span>
              </div>

              {/* Map Controls */}
              <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur border border-slate-200 p-3 rounded-xl flex flex-col gap-2 shadow-lg">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-xs font-medium text-slate-700">Tối ưu & An toàn</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div><span className="text-xs font-medium text-slate-700">Cần lưu ý</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-xs font-medium text-slate-700">Cảnh báo nguy cơ</span></div>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div className="w-full lg:w-96 bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-col shadow-lg">
              <h4 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-900"><MapIcon className="text-blue-500" /> Chi tiết Ao A1</h4>

              <div className="space-y-6 flex-1">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="text-sm text-slate-500 mb-1">Thông số vụ nuôi</div>
                  <div className="text-xl font-bold text-blue-600">Ngày 45 <span className="text-sm text-slate-400 font-normal">/ 90 ngày</span></div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="text-sm text-slate-500 mb-1">Tỷ lệ sống ước tính</div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold text-green-600">92%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full w-[92%]"></div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-slate-500">Biểu đồ tiêu thụ thức ăn</div>
                    <span className="text-xs text-blue-600 font-semibold bg-white px-2 py-1 rounded border border-blue-100">7 ngày qua</span>
                  </div>
                  {/* Bar Chart Mock */}
                  <div className="h-24 flex items-end gap-2">
                    {[40, 50, 45, 60, 70, 65, 80].map((h, i) => (
                      <div key={i} className="flex-1 bg-blue-200 rounded-t hover:bg-blue-300 transition-colors relative group">
                        <div className="absolute bottom-0 w-full bg-blue-500 rounded-t transition-all" style={{ height: `${h}%` }}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button className="w-full mt-6 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
                Xem Báo Cáo Chi Tiết
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Comprehensive Features Grid (Moved to Bottom) */}
      <div className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-3">Hệ Sinh Thái Toàn Diện</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-6">Đầy Đủ Tính Năng Cho Trang Trại Của Bạn</h3>
            <p className="text-slate-600">Smart Shrimp Farm Management System (SSFM) cung cấp giải pháp số hóa toàn diện giúp bạn dễ dàng theo dõi, quản lý và tối ưu hóa mọi quy trình nuôi tôm.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: MapIcon, title: "Quản lý Ao & Nông trại", desc: "Quản lý danh mục nông trại, sơ đồ ao nuôi và theo dõi toàn bộ lịch sử vụ nuôi." },
              { icon: Droplets, title: "Chất lượng Nước", desc: "Ghi nhận và theo dõi các thông số môi trường (pH, độ mặn, DO), phân tích xu hướng." },
              { icon: Activity, title: "Quản lý Tồn kho", desc: "Kiểm soát lượng thức ăn, quản lý nhà cung cấp và theo dõi lịch sử xuất nhập vật tư." },
              { icon: TrendingUp, title: "Chăm sóc & FCR", desc: "Tính toán kích cỡ, tỷ lệ sống, sinh khối, hệ số FCR và dự báo hiệu suất tăng trưởng." },
              { icon: AlertTriangle, title: "Cảnh báo & Sự cố", desc: "Phát hiện rủi ro, cảnh báo sớm biến động môi trường và theo dõi tiến trình xử lý." },
              { icon: Bot, title: "AI & Thống kê", desc: "Trợ lý ảo RAG giải đáp kỹ thuật, phân tích dữ liệu AI và xuất báo cáo tự động." }
            ].map((feat, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 hover:shadow-[0_8px_40px_rgba(37,99,235,0.08)] hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-blue-100/50">
                  <feat.icon className="w-7 h-7" />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-3">{feat.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* About & Contact Section */}
      <footer id="about" className="bg-slate-900 pt-20 pb-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

            {/* Company Info */}
            <div className="lg:col-span-2">
              <Link to="/" className="flex items-center gap-3 mb-6">
                <img src="/logonen.jpg" alt="SSFM Logo" className="h-10 w-10 rounded-full object-cover bg-white shadow-sm" />
                <span className="text-2xl font-bold tracking-tight text-white">SSFM</span>
              </Link>
              <p className="text-slate-400 text-sm leading-relaxed max-w-md mb-8">
                Hệ thống Quản lý Trang trại Nuôi tôm Thông minh (SSFM) cung cấp nền tảng quản trị kỹ thuật số toàn diện, tích hợp công nghệ AI và phân tích dữ liệu chuyên sâu để tối ưu hóa năng suất và giảm thiểu rủi ro môi trường.
              </p>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Liên hệ</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-400 text-sm">123 Đường Công Nghệ Mới, Quận Đổi Mới, TP. Hồ Chí Minh</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <span className="text-slate-400 text-sm">0123 456 789</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <span className="text-slate-400 text-sm">contact@ssfm-example.com</span>
                </li>
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Liên kết nhanh</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-slate-400 text-sm hover:text-blue-400 transition-colors">Tính năng hệ thống</a></li>
                <li><a href="#map" className="text-slate-400 text-sm hover:text-blue-400 transition-colors">Bản đồ trang trại</a></li>
                <li><Link to="/login" className="text-slate-400 text-sm hover:text-blue-400 transition-colors">Đăng nhập</Link></li>
                <li><Link to="/register" className="text-slate-400 text-sm hover:text-blue-400 transition-colors">Đăng ký trải nghiệm</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-slate-800 text-center md:flex md:justify-between md:items-center">
            <p className="text-slate-500 text-sm">&copy; {new Date().getFullYear()} Smart Shrimp Farm Management. All rights reserved.</p>
            <div className="mt-4 md:mt-0 flex gap-6 justify-center">
              <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Điều khoản dịch vụ</a>
              <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Chính sách bảo mật</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}