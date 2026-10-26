import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, Activity, Thermometer,
  CheckCircle2, TrendingUp, Droplets, Bot, Phone, Mail, MapPin,
  ChevronRight, CalendarDays, BarChart3, Scale, Package, Calculator
} from 'lucide-react';
import AnimatedImageBg from '../components/AnimatedImageBg';
import StatsMarquee from '../components/StatsMarquee';

// --- Animation Configs cho độ mượt tối đa ---
const smoothTransition = { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: smoothTransition }
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: smoothTransition }
};

const fadeInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: smoothTransition }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
};

interface PondStats {
  day: number;
  survival: number;
  temp: number;
  ph: number;
  do: number;
  fcr: number;
}

interface PondData {
  name: string;
  status: string;
  statusText: string;
  color: string;
  stats: PondStats;
}

const POND_DATA: Record<string, PondData> = {
  'A1': {
    name: 'Ao A1', status: 'optimal', statusText: 'Tối ưu', color: 'bg-emerald-500',
    stats: { day: 45, survival: 92, temp: 28.5, ph: 7.8, do: 6.8, fcr: 1.15 }
  },
  'A2': {
    name: 'Ao A2', status: 'warning', statusText: 'Cần lưu ý', color: 'bg-amber-400',
    stats: { day: 22, survival: 85, temp: 29.2, ph: 8.2, do: 5.5, fcr: 1.25 }
  },
  'B1': {
    name: 'Ao B1', status: 'danger', statusText: 'Nguy cơ', color: 'bg-red-500',
    stats: { day: 65, survival: 78, temp: 30.5, ph: 7.2, do: 4.2, fcr: 1.45 }
  }
};

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [activePond, setActivePond] = useState('A1');
  const [scrollY, setScrollY] = useState(0);

  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      setScrollY(window.scrollY);

      const sections = ['quy-trình-5t', 'bản-đồ', 'tính-năng', 'trợ-lý-ai'];
      let current = '';
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Kiểm tra nếu phần tử đang chiếm vị trí ngang qua mốc 150px từ top (vùng đọc chính của màn hình)
          if (rect.top <= 150 && rect.bottom >= 150) {
            current = section;
          }
        }
      }
      setActiveSection(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const blurAmount = Math.min((scrollY / 400) * 12, 12);
  const overlayOpacity = Math.min((scrollY / 500) * 0.6, 0.6);

  return (
    <div className="font-sans min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden">

      {/* --- 1. HEADER (NAVBAR) --- */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed left-0 w-full z-50 transition-all duration-500 ease-out ${scrolled ? 'top-4' : 'top-0'
          }`}
      >
        <div className={`mx-auto transition-all duration-500 ease-out ${scrolled
          ? 'max-w-[850px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgba(0,0,0,0.08)] rounded-full px-4 py-2.5'
          : 'max-w-7xl bg-transparent px-4 sm:px-6 lg:px-8 py-6 border border-transparent'
          }`}>
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/logonen.jpg" alt="SSFM Logo" className={`rounded-full object-cover bg-white shadow-md border border-white/60 group-hover:scale-105 transition-all duration-500 ${scrolled ? 'h-9 w-9' : 'h-12 w-12'}`} />
              <span className={`font-black tracking-tight transition-all duration-500 ${scrolled ? 'text-xl text-slate-900' : 'text-2xl text-white drop-shadow-md'}`}>SSFM</span>
            </Link>

            {/* Links */}
            <div className="hidden md:flex space-x-8 items-center">
              {['Quy trình 5T', 'Bản đồ', 'Tính năng', 'Trợ lý AI'].map((item, idx) => {
                const sectionId = item.toLowerCase().replace(/ /g, '-');
                const isActive = activeSection === sectionId;

                return (
                  <a key={idx} href={`#${sectionId}`} className={`font-bold text-sm tracking-wide transition-all duration-300 relative group ${isActive ? 'text-blue-600' : (scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-white/90 hover:text-white drop-shadow-sm')}`}>
                    {item}
                    <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-[2px] transition-all duration-300 rounded-full ${isActive ? 'w-[70%] bg-blue-600' : `w-0 group-hover:w-[70%] ${scrolled ? 'bg-blue-600' : 'bg-white'}`}`}></span>
                  </a>
                );
              })}
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center space-x-2">
              <Link to="/login" className={`font-bold text-sm tracking-wide transition-all duration-300 px-4 py-2 rounded-full ${scrolled ? 'text-slate-700 hover:bg-slate-100 hover:text-blue-600' : 'text-white hover:bg-white/10'}`}>Đăng nhập</Link>
              <Link to="/register" className="relative group px-5 py-2.5 rounded-full overflow-hidden shadow-lg shadow-blue-600/20 bg-blue-600 text-white hover:scale-105 hover:bg-blue-700 transition-all duration-300 active:scale-95">
                <span className="relative font-bold text-sm tracking-wide flex items-center gap-2">
                  Đăng ký <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* --- 2. HERO SECTION --- */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 min-h-[95vh] flex items-center justify-center overflow-hidden bg-slate-900">
        <motion.div
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 z-0"
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        >
          {/* Cinematic Animated Background */}
          <AnimatedImageBg src="/unnamed.jpg" className="absolute inset-0 w-full h-full" />

          {/* Hiệu ứng làm tối và mờ dần khi cuộn chuột xuống */}
          <div className="absolute inset-0 bg-slate-900 transition-opacity duration-75" style={{ opacity: 0.3 + overlayOpacity }}></div>
          <div className="absolute inset-0 transition-all duration-75" style={{ backdropFilter: `blur(${blurAmount}px)` }}></div>

          {/* Gradient chân trang chuyển êm sang section dưới */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-slate-50 via-slate-50/20 to-transparent"></div>
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="max-w-4xl mx-auto flex flex-col items-center"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 backdrop-blur-md border border-blue-400/20 text-blue-300 text-sm font-semibold mb-8 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Nền tảng số hóa Quy trình 5T
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-[1.15] tracking-tight">
              Quản Lý Trang Trại Tôm <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Thông Minh & Tối Ưu</span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl leading-relaxed font-medium">
              Số hóa toàn diện dữ liệu hàng ngày. Tự động tính toán tốc độ tăng trưởng, kiểm soát hệ số FCR và hỗ trợ quyết định chăm sóc chính xác nhất.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-center">
              <Link to="/register" className="w-full sm:w-auto group relative px-8 py-4 bg-blue-600 text-white rounded-full font-bold transition-all shadow-[0_8px_30px_rgba(37,99,235,0.3)] hover:shadow-[0_12px_40px_rgba(37,99,235,0.4)] hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2">
                Đăng ký tài khoản <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#quy-trình-5t" className="w-full sm:w-auto group px-8 py-4 bg-white/10 text-white border border-white/20 rounded-full font-bold hover:bg-white/20 transition-all backdrop-blur-sm active:scale-95 flex items-center justify-center gap-2">
                Khám phá quy trình 5T
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* --- 3. QUY TRÌNH 5T --- */}
      <section id="quy-trình-5t" className="py-24 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }} variants={fadeInUp}
            className="text-center max-w-3xl mx-auto mb-20"
          >
            <h2 className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-3">Vòng lặp chăm sóc 5 ngày</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">Cốt Lõi Quy Trình 5T Care</h3>
            <p className="text-slate-600 text-lg leading-relaxed">
              Giải pháp số hóa bám sát thực tiễn nuôi tôm. Nhập liệu nhanh chóng, tự động đối chiếu Bảng Mục Tiêu Chuẩn để đưa ra khuyến nghị chính xác nhất.
            </p>
          </motion.div>

          <div className="relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 rounded-full overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }} whileInView={{ x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 1.5, ease: "easeOut" }}
                className="w-full h-full bg-gradient-to-r from-blue-400 to-emerald-400"
              />
            </div>

            <motion.div
              variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }}
              className="grid md:grid-cols-3 gap-12 relative z-10"
            >
              {/* Step 1 */}
              <motion.div variants={fadeInUp} className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 hover:-translate-y-4 hover:scale-105 hover:shadow-2xl cursor-pointer transition-all duration-500 border-t-4 border-t-blue-500 group">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-inner transition-all duration-500 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 group-hover:rotate-3">
                  <CalendarDays className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3 text-center md:text-left">Ngày 1 - 4: Ghi Nhận</h4>
                <p className="text-slate-500 text-sm leading-relaxed text-center md:text-left">
                  Người nuôi sử dụng Mobile App để nhập liệu hàng ngày cực nhanh: Lượng thức ăn, tôm hao hụt, nhiệt độ và các chỉ số môi trường cơ bản.
                </p>
              </motion.div>

              {/* Step 2 */}
              <motion.div variants={fadeInUp} className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 hover:-translate-y-4 hover:scale-105 hover:shadow-2xl cursor-pointer transition-all duration-500 border-t-4 border-t-amber-500 group">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-inner transition-all duration-500 group-hover:bg-amber-500 group-hover:text-white group-hover:scale-110 group-hover:-rotate-3">
                  <Scale className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3 text-center md:text-left">Ngày 5: Lấy Mẫu & Đo</h4>
                <p className="text-slate-500 text-sm leading-relaxed text-center md:text-left">
                  Tiến hành bắt mẫu, cân trọng lượng (<span className="font-mono text-xs">G_m</span>) và đếm số lượng tôm (<span className="font-mono text-xs">N_đ</span>) để cập nhật vào hệ thống.
                </p>
              </motion.div>

              {/* Step 3 */}
              <motion.div variants={fadeInUp} className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 hover:-translate-y-4 hover:scale-105 hover:shadow-2xl cursor-pointer transition-all duration-500 border-t-4 border-t-emerald-500 group">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-inner transition-all duration-500 group-hover:bg-emerald-500 group-hover:text-white group-hover:scale-110 group-hover:rotate-3">
                  <BarChart3 className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3 text-center md:text-left">Hệ Thống Phân Tích</h4>
                <p className="text-slate-500 text-sm leading-relaxed text-center md:text-left">
                  Tự động tính toán Size, FCR thực tế. Đối chiếu chuẩn 5T để xuất Bảng Khuyến Nghị Cho Ăn cho 5 ngày tiếp theo, hiệu chỉnh theo nhiệt độ.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- 4. BẢN ĐỒ TƯƠNG TÁC (PRODUCT PREVIEW) --- */}
      <section id="bản-đồ" className="py-24 bg-white relative overflow-hidden">
        {/* Hiệu ứng mờ chuyển cảnh từ màu xám nhạt của section trên xuống */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none z-0"></div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }} variants={fadeInUp}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900">Bản Đồ Quản Lý Trực Quan</h3>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-8 h-auto lg:h-[650px]">
            {/* Interactive Map Area */}
            <motion.div
              initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={smoothTransition}
              className="flex-[3] bg-slate-100 rounded-[2rem] relative overflow-hidden group shadow-2xl shadow-slate-200 border border-slate-200 min-h-[400px]"
            >
              <img src="/map-bg.png" alt="Farm Map" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80" />

              {/* Pond Markers */}
              {Object.entries(POND_DATA).map(([key, data]) => {
                const isActive = activePond === key;
                // Hardcoded positions for visual mockup
                const positions: Record<string, string> = { 'A1': 'top-[25%] left-[30%]', 'A2': 'top-[45%] left-[55%]', 'B1': 'bottom-[20%] left-[25%]' };

                return (
                  <button
                    key={key}
                    onClick={() => setActivePond(key)}
                    className={`absolute ${positions[key]} w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 cursor-pointer outline-none focus:outline-none ${isActive ? `border-${data.color.split('-')[1]}-500 bg-${data.color.split('-')[1]}-500/40 scale-110 shadow-[0_0_30px_rgba(0,0,0,0.15)] z-20` : `border-white/80 bg-white/20 hover:scale-105 z-10`
                      }`}
                  >
                    <span className={`font-bold text-xs sm:text-sm px-3 py-1.5 rounded-lg shadow-sm transition-colors ${isActive ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}`}>
                      {data.name}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activePondRing"
                        className={`absolute inset-0 rounded-full border-2 ${data.color.replace('bg-', 'border-')} animate-ping opacity-50`}
                      />
                    )}
                  </button>
                );
              })}

              {/* Legend */}
              <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200">
                <h5 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Trạng thái</h5>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></div><span className="text-xs font-semibold text-slate-700">Tối ưu & An toàn</span></div>
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm"></div><span className="text-xs font-semibold text-slate-700">Cần lưu ý</span></div>
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div><span className="text-xs font-semibold text-slate-700">Cảnh báo rủi ro</span></div>
                </div>
              </div>
            </motion.div>

            {/* Sidebar Stats Panel */}
            <motion.div
              initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={smoothTransition}
              className="flex-[2] bg-white rounded-[2rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden flex flex-col"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePond}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={smoothTransition}
                  className="p-8 flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h4 className="text-3xl font-black text-slate-900 mb-2">{POND_DATA[activePond].name}</h4>
                      <p className="text-slate-500 font-medium">Thông số cập nhật 5 phút trước</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-sm ${POND_DATA[activePond].color}`}>
                      {POND_DATA[activePond].statusText}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Ngày tuổi</div>
                      <div className="text-3xl font-bold text-blue-600">{POND_DATA[activePond].stats.day}</div>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> FCR</div>
                      <div className="text-3xl font-bold text-blue-600">{POND_DATA[activePond].stats.fcr}</div>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><Thermometer className="w-4 h-4" /> Nhiệt độ</div>
                      <div className="text-2xl font-bold text-slate-900">{POND_DATA[activePond].stats.temp} <span className="text-sm text-slate-400">°C</span></div>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><Activity className="w-4 h-4" /> Độ pH</div>
                      <div className="text-2xl font-bold text-slate-900">{POND_DATA[activePond].stats.ph}</div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-slate-600">Tỷ lệ sống ước tính</span>
                      <span className="text-sm font-bold text-slate-900">{POND_DATA[activePond].stats.survival}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${POND_DATA[activePond].stats.survival}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className={`h-full rounded-full ${POND_DATA[activePond].color}`}
                      />
                    </div>
                  </div>

                  <button className="w-full mt-8 py-4 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 group active:scale-95">
                    Xem chi tiết ao <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- 5. TÍNH NĂNG (FEATURES) --- */}
      <section id="tính-năng" className="relative py-24 bg-[#EAF5F8] overflow-hidden">
        {/* Hiệu ứng mờ chuyển cảnh từ màu trắng của section trên xuống */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-white to-transparent pointer-events-none"></div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          {/* Header */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }} variants={fadeInUp}
            className="text-center max-w-3xl mx-auto flex flex-col items-center"
          >
            <div className="inline-block bg-[#336573] text-white font-bold tracking-widest uppercase text-[11px] px-5 py-2 rounded-full mb-6 shadow-sm">
              TÍNH NĂNG CỐT LÕI
            </div>
            <h3 className="text-3xl md:text-[40px] font-extrabold text-[#1e3a45] mb-2 leading-tight">
              Giải Pháp Toàn Diện Cho Người Nuôi
            </h3>
          </motion.div>

          {/* Cards Row */}
          <motion.div
            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }}
            className="flex flex-col lg:flex-row justify-center items-stretch gap-6 mt-16 max-w-6xl mx-auto"
          >
            {[
              { icon: Droplets, title: "Chất lượng Nước", desc: "Chất lượng nước đo: chất lượng\nmôi trường, chất lượng nước" },
              { icon: Package, title: "Quản lý Kho & Vật tư", desc: "Nhập xuất quản lý kho & vật lý,\nquản lý kho & Vật tư" },
              { icon: Calculator, title: "Tính Toán Hiệu suất", desc: "Hiệu suất dinh dưỡng sinh, tính toán\nhóa, định mức bền vững" },
            ].map((feat, i) => (
              <motion.div key={i} variants={fadeInUp} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex-1 flex items-center gap-5 hover:shadow-md transition-all hover:-translate-y-1">
                <div className="w-16 h-16 shrink-0 rounded-full border-[1.5px] border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[#336573]">
                  <feat.icon className="w-7 h-7" strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-[17px] font-bold text-slate-900 mb-1">{feat.title}</h4>
                  <p className="text-[13px] text-slate-500 leading-snug whitespace-pre-line">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Images Gallery */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }} variants={fadeInUp}
            className="mt-16 flex justify-center items-center gap-2 sm:gap-4 md:gap-5 w-full relative"
          >
            {/* Image 1 - Far Left */}
            <div className="w-24 h-36 sm:w-32 sm:h-48 md:w-48 md:h-64 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-lg opacity-80 hover:opacity-100 cursor-pointer transition-all duration-500 ease-out hover:scale-110 hover:-translate-y-4 hover:z-20 hover:shadow-2xl">
              <img src="/assets/khotom.png" alt="Shrimp farming" className="w-full h-full object-cover" />
            </div>

            {/* Image 2 - Mid Left */}
            <div className="w-32 h-48 sm:w-44 sm:h-60 md:w-60 md:h-80 rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-xl opacity-90 hover:opacity-100 cursor-pointer transition-all duration-500 ease-out hover:scale-110 hover:-translate-y-4 hover:z-20 hover:shadow-2xl">
              <img src="/feat-2.jpg" alt="Circular Pond" className="w-full h-full object-cover" />
            </div>

            {/* Image 3 - Center (Infographic) */}
            <div className="relative w-56 h-56 sm:w-72 sm:h-72 md:w-[400px] md:h-[400px] rounded-3xl md:rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-10 scale-105 bg-[#0b3858] flex items-center justify-center shrink-0 cursor-pointer transition-all duration-500 ease-out hover:scale-110 hover:-translate-y-4 hover:z-20 hover:shadow-[0_30px_60px_rgba(0,0,0,0.4)] group">
              <img src="/feat-4-new.jpg" alt="Infographic" className="w-full h-full object-cover" />
              {/* Overlay làm sáng màu xanh đậm của ảnh thành xanh lợt hơn (cyan) để hợp với dự án */}
              <div className="absolute inset-0 bg-cyan-400/50 mix-blend-screen transition-all duration-500 group-hover:bg-cyan-300/30 pointer-events-none"></div>
            </div>

            {/* Image 4 - Mid Right */}
            <div className="w-32 h-48 sm:w-44 sm:h-60 md:w-60 md:h-80 rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-xl opacity-90 hover:opacity-100 cursor-pointer transition-all duration-500 ease-out hover:scale-110 hover:-translate-y-4 hover:z-20 hover:shadow-2xl">
              <img src="/feat-3.jpg" alt="Rectangular Ponds" className="w-full h-full object-cover" />
            </div>

            {/* Image 5 - Far Right */}
            <div className="w-24 h-36 sm:w-32 sm:h-48 md:w-48 md:h-64 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-lg opacity-80 hover:opacity-100 cursor-pointer transition-all duration-500 ease-out hover:scale-110 hover:-translate-y-4 hover:z-20 hover:shadow-2xl">
              <img src="/feat-1.jpg" alt="Water Meter" className="w-full h-full object-cover" />
            </div>
          </motion.div>

        </div>
      </section>

      {/* --- 6. TRỢ LÝ KỸ THUẬT AI (RAG INTRO) --- */}
      <section id="trợ-lý-ai" className="py-24 bg-white relative overflow-hidden">
        {/* Hiệu ứng mờ chuyển cảnh từ màu xanh lợt của section trên xuống */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#EAF5F8] to-transparent pointer-events-none z-0"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }} variants={fadeInLeft}
              className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 aspect-square md:aspect-auto md:h-[600px] group"
            >
              <img src="/chat.png" alt="Farmer checking AI app" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>

              <div className="absolute bottom-8 left-8 right-8 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <span className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-bold tracking-wider uppercase text-emerald-300">Hoạt động 24/7</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }} variants={fadeInRight}
              className="flex flex-col justify-center"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600 mb-8 shadow-inner">
                <Bot className="w-8 h-8" />
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
                Trợ Lý Thông Minh <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Kho Tri Thức 5T</span>
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Được tích hợp công nghệ AI (RAG) dựa trên toàn bộ 10 chương cẩm nang Quy trình 5T. Bất cứ khi nào gặp sự cố về nước, bệnh trên tôm hay thắc mắc lượng thức ăn, hệ thống sẽ phân tích dữ liệu ao hiện tại và đưa ra câu trả lời chính xác, trích dẫn rõ nguồn.
              </p>

              <div className="space-y-4 mb-10">
                {['Phân tích FCR và gợi ý cắt giảm thức ăn', 'Nhận diện nguyên nhân giảm pH đột ngột', 'Đưa ra lịch trình xử lý nước chuẩn 5T'].map((text, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-slate-700 font-medium">{text}</span>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 inline-block relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <p className="text-sm text-slate-600 mb-4 relative z-10 font-medium">Hãy trải nghiệm tính năng này ngay ở góc phải màn hình.</p>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="animate-bounce">
                    <ArrowRight className="w-6 h-6 text-blue-500 rotate-45" />
                  </div>
                  <span className="text-sm font-bold text-blue-600 uppercase tracking-wide">Nhấn vào biểu tượng Tôm AI</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- 7. FOOTER & CTA CUỐI --- */}
      <footer className="bg-gradient-to-b from-cyan-950 via-[#061e2e] to-slate-950 pt-16 pb-6 relative overflow-hidden font-sans">

        {/* Lớp sương mù trắng phủ LÊN TRÊN (z-20) khung xanh để xóa mờ hoàn toàn đường cắt ngang */}
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-white via-white/60 to-transparent pointer-events-none z-20"></div>

        {/* Abstract Ambient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[300px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none z-0"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none z-0"></div>

        {/* Big CTA Banner - Phóng to Full Width và hiệu ứng kính mờ (Glassmorphism) */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.2 }} variants={fadeInUp}
          className="relative z-10 w-full pt-16 pb-12 md:pt-24 md:pb-20 mb-0"
        >
          {/* Background layer (Kéo dài xuống dưới 250px để mờ dần qua Footer) */}
          <div className="absolute top-0 left-0 right-0 -bottom-[300px] bg-gradient-to-r from-blue-600/70 to-cyan-500/70 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.3)] [mask-image:linear-gradient(to_bottom,transparent_0px,black_15%,black_70%,transparent_100%)] pointer-events-none -z-10"></div>

          {/* Soft inner glow overlay */}
          <div className="absolute top-0 left-0 right-0 -bottom-[300px] bg-gradient-to-b from-white/10 to-transparent opacity-30 pointer-events-none -z-10 [mask-image:linear-gradient(to_bottom,transparent_0px,black_15%,black_70%,transparent_100%)]"></div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center">
            {/* Badge */}
            <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6 shadow-xl shadow-cyan-900/20">
              <span className="text-white text-xs font-bold tracking-wider uppercase">Đột phá nông nghiệp thủy sản số 4.0</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight tracking-tight drop-shadow-md">Sẵn sàng chuyển đổi số trang trại của bạn?</h2>
            <p className="text-blue-50 text-base md:text-lg mb-10 max-w-2xl mx-auto drop-shadow-md">Tham gia cùng các hộ nông dân tiên phong áp dụng <strong className="text-white">Quy trình 5T</strong> để tối ưu chi phí, kiểm soát rủi ro dịch bệnh và bứt phá năng suất bền vững.</p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center mb-8 w-full sm:w-auto">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-blue-600 rounded-full font-bold text-sm md:text-base hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 shadow-xl w-full sm:w-auto">
                Tạo tài khoản miễn phí <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/contact" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-transparent border border-white/30 text-white rounded-full font-bold text-sm md:text-base hover:bg-white/10 transition-all w-full sm:w-auto shadow-xl">
                <CalendarDays className="w-4 h-4" /> Đặt lịch tư vấn
              </Link>
            </div>

            {/* Divider */}
            <div className="w-full max-w-3xl h-px bg-white/20 mb-6"></div>

            {/* Stats Marquee */}
            <StatsMarquee />
          </div>
        </motion.div>

        {/* Bọc lại Container cho Footer Info */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          {/* Footer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-6 border-b border-slate-800/60 pb-6">

            {/* Col 1 */}
            <div className="lg:col-span-3 pr-0">
              <Link to="/" className="flex items-center gap-3 mb-6">
                <div className="bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/20 flex-shrink-0">
                  <img src="/logonen.jpg" alt="SSFM Logo" className="h-10 w-10 rounded-lg object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-black tracking-tight text-white leading-none mb-1">SSFM</span>
                  <span className="text-[10px] text-cyan-400 font-bold tracking-widest leading-none">SMART SHRIMP FARM</span>
                </div>
              </Link>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Smart Shrimp Farm Management System - Nền tảng quản trị kỹ thuật số toàn diện, tích hợp AI và phân tích dữ liệu chuyên sâu dành riêng cho <strong className="text-slate-200">Quy trình 5T</strong>.
              </p>

              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">KẾT NỐI VỚI CHÚNG TÔI</h4>
              <div className="flex items-center gap-3">
                <a href="https://www.facebook.com/share/1B9ZssaT3X/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700/50">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="https://www.youtube.com/@smartshrimpfarmmanagement?si=dXcMV6DPsSS_HJDu" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700/50">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                </a>
                <a href="#" className="w-14 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700/50 text-xs font-bold">
                  Zalo
                </a>
              </div>
            </div>

            {/* Col 2 */}
            <div className="lg:col-span-3 lg:pl-4">
              <h3 className="text-white font-bold mb-6 flex items-center gap-2 text-[15px]">
                <span className="w-1 h-3.5 bg-cyan-500 rounded-full"></span> THÔNG TIN LIÊN HỆ
              </h3>
              <ul className="space-y-5">
                <li className="flex items-start gap-3 text-slate-400 text-sm">
                  <MapPin className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Khoa Công Nghệ Thông Tin, Trường ĐH KHTN ĐHQG-HCM, 227 Nguyễn Văn Cừ, Quận 5, TP.HCM</span>
                </li>
                <li className="flex items-start gap-3 text-slate-400 text-sm">
                  <Phone className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block text-base font-bold tracking-wide">0123 456 789</strong>
                    <span className="text-xs">Hỗ trợ kỹ thuật 24/7</span>
                  </div>
                </li>
                <li className="flex items-center gap-3 text-slate-400 text-sm">
                  <Mail className="w-5 h-5 text-cyan-500 shrink-0" />
                  <span className="text-white font-medium">support@ssfm.com</span>
                </li>
              </ul>
            </div>

            {/* Col 3 */}
            <div className="lg:col-span-3 lg:pl-8">
              <h3 className="text-white font-bold mb-6 flex items-center gap-2 text-[15px]">
                <span className="w-1 h-3.5 bg-cyan-500 rounded-full"></span> KHÁM PHÁ
              </h3>
              <ul className="space-y-3.5">
                {[
                  'Quy trình 5T chuẩn hóa',
                  'Bản đồ ao nuôi (IoT GIS)',
                  'Giám sát môi trường nước',
                  'Dự báo dịch bệnh AI',
                  'Báo cáo chi phí & sản lượng'
                ].map((item, idx) => (
                  <li key={idx}>
                    <a href="#" className="group text-slate-400 hover:text-cyan-400 text-sm flex items-start gap-2 transition-all duration-300">
                      <ChevronRight className="w-3.5 h-3.5 mt-1 shrink-0 text-cyan-500/50 group-hover:text-cyan-400 transition-colors" />
                      <span className="group-hover:translate-x-1 transition-transform duration-300">{item}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4 */}
            <div className="lg:col-span-3 lg:pl-8 flex flex-col">
              <h3 className="text-white font-bold mb-6 flex items-center gap-2 text-[15px]">
                <span className="w-1 h-3.5 bg-cyan-500 rounded-full"></span> TÀI NGUYÊN
              </h3>
              <ul className="space-y-3.5 mb-8">
                {[
                  'Đăng nhập Portal',
                  'Tài liệu API',
                  'Hướng dẫn sử dụng',
                  'Hỏi đáp (FAQ)'
                ].map((item, idx) => (
                  <li key={idx}>
                    <a href="#" className="group text-slate-400 hover:text-white text-sm flex items-start gap-2 transition-all duration-300">
                      <ChevronRight className="w-3.5 h-3.5 mt-1 shrink-0 text-slate-600 group-hover:text-white transition-colors" />
                      <span className="group-hover:translate-x-1 transition-transform duration-300">{item}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-slate-500 tracking-wide">
            <p>© 2024 <strong className="text-slate-300">SSFM Team</strong> (Khoa CNTT - ĐH KHTN ĐHQG-HCM). All rights reserved.</p>
            <div className="flex items-center gap-4 sm:gap-6">
              <a href="#" className="hover:text-cyan-400 transition-colors">Điều khoản dịch vụ</a>
              <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
              <a href="#" className="hover:text-cyan-400 transition-colors">Chính sách bảo mật</a>
              <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
              <a href="#" className="hover:text-cyan-400 transition-colors">An toàn dữ liệu</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}