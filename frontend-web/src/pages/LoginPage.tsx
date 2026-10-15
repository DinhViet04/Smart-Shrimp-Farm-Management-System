import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, ArrowRight, Activity, LineChart, Eye, EyeOff, UserCheck, ShieldCheck, Waves } from 'lucide-react';
import { verifyInviteToken } from '../services/farm.service';

/* ─── Floating bubble particle ─── */
function Bubble({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.55), rgba(103,232,249,0.08))',
        border: '1px solid rgba(255,255,255,0.18)',
        backdropFilter: 'blur(2px)',
        ...style,
      }}
    />
  );
}

const BUBBLES = [
  { size: 14, left: '8%', bottom: '12%', duration: 9, delay: 0 },
  { size: 9, left: '18%', bottom: '5%', duration: 12, delay: 1.5 },
  { size: 20, left: '28%', bottom: '8%', duration: 10, delay: 3 },
  { size: 7, left: '42%', bottom: '3%', duration: 14, delay: 0.5 },
  { size: 12, left: '55%', bottom: '10%', duration: 11, delay: 2 },
  { size: 18, left: '68%', bottom: '6%', duration: 8, delay: 4 },
  { size: 10, left: '78%', bottom: '14%', duration: 13, delay: 1 },
  { size: 6, left: '88%', bottom: '4%', duration: 15, delay: 2.5 },
  { size: 16, left: '92%', bottom: '9%', duration: 10, delay: 0.8 },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteTokenFromUrl = searchParams.get('inviteToken');

  const [inviteInfo, setInviteInfo] = useState<{
    valid: boolean;
    farmName?: string;
    managerName?: string;
    role?: string;
    email?: string;
    reason?: string;
    loading: boolean;
  }>({ valid: false, loading: !!inviteTokenFromUrl });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inviteTokenFromUrl) return;
    let cancelled = false;
    verifyInviteToken(inviteTokenFromUrl).then((result) => {
      if (cancelled) return;
      if (result.valid) {
        setInviteInfo({ loading: false, ...result });
        if (result.email) setEmail(result.email);
      } else {
        setInviteInfo({ valid: false, loading: false, reason: result.reason });
      }
    });
    return () => { cancelled = true; };
  }, [inviteTokenFromUrl]);

  const handleGoogleLogin = async (response: any) => {
    setServerError('');
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/auth/google`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(Array.isArray(data.message) ? data.message[0] : (data.message || 'Đăng nhập Google thất bại'));
      } else {
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        let redirectPath = '/dashboard';
        if (data.user.role === 'ADMIN') redirectPath = '/admin/dashboard';
        else if (data.user.role === 'FARMER') redirectPath = '/farmer/dashboard';
        else if (data.user.role === 'TECHNICIAN') redirectPath = '/technician/dashboard';
        navigate(redirectPath);
      }
    } catch {
      setServerError('Không thể kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initGoogle = () => {
      if ((window as any).google?.accounts?.id) {
        const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id-here.apps.googleusercontent.com';
        if (googleClientId && !googleClientId.includes('your-google-client-id-here')) {
          (window as any).google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleLogin,
            auto_select: false,
          });
          if (googleBtnRef.current) {
            (window as any).google.accounts.id.renderButton(
              googleBtnRef.current,
              { theme: 'outline', size: 'large', width: '100%', shape: 'pill', logo_alignment: 'center' },
            );
          }
        } else if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = `
            <button type="button" id="google-signin-btn" class="flex items-center justify-center gap-3 w-full px-4 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl cursor-pointer transition-all text-white font-semibold text-sm group">
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.369 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.109 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
              <span>Đăng nhập với Google</span>
            </button>`;
        }
      }
    };
    const timer = setInterval(() => {
      if ((window as any).google) { initGoogle(); clearInterval(timer); }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(inviteTokenFromUrl ? { inviteToken: inviteTokenFromUrl } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setServerError(Array.isArray(data.message) ? data.message[0] : (data.message || 'Sai email hoặc mật khẩu'));
      } else {
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        let redirectPath = '/dashboard';
        if (data.user.role === 'ADMIN') redirectPath = '/admin/dashboard';
        else if (data.user.role === 'FARMER') redirectPath = '/farmer/dashboard';
        else if (data.user.role === 'TECHNICIAN') redirectPath = '/technician/dashboard';
        navigate(redirectPath, {
          state: data.joinedFarm ? { welcomeFarm: data.joinedFarm.name } : undefined,
        });
      }
    } catch {
      setServerError('Không thể kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative flex items-center justify-center font-sans overflow-hidden bg-slate-950">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Outfit', sans-serif; }

        @keyframes riseBubble {
          0%   { transform: translateY(0) translateX(0) scale(1);    opacity: 0;   }
          10%  { opacity: 1; }
          80%  { opacity: 0.7; }
          100% { transform: translateY(-100vh) translateX(20px) scale(1.1); opacity: 0; }
        }
        @keyframes bgPan {
          0%,100% { transform: scale(1.08) translateY(0); }
          50%      { transform: scale(1.12) translateY(-1.5%); }
        }
        @keyframes lightRay {
          0%,100% { opacity: 0.35; transform: scaleX(1); }
          50%      { opacity: 0.55; transform: scaleX(1.08); }
        }
        @keyframes floatCard {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px); }
        }
        .bg-pan   { animation: bgPan 20s ease-in-out infinite; }
        .float-card { animation: floatCard 7s ease-in-out infinite; }
        .bubble   { animation: riseBubble var(--dur,10s) var(--delay,0s) ease-in infinite; }
        .light-ray { animation: lightRay 5s ease-in-out infinite; }

        /* Glass input glow on focus */
        .glass-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(34,211,238,0.45), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .btn-shimmer {
          background: linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%);
        }
        .btn-shimmer:hover { filter: brightness(1.08); }
        .btn-shimmer:active { transform: scale(0.99); }
      `}</style>

      {/* ── Background image ── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src="/anhnen.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover bg-pan saturate-[1.3] contrast-110"
        />
        {/* Deep vignette */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-cyan-950/50 to-slate-950/85" />
        {/* Caustic light overlay */}
        <div className="absolute inset-0 bg-cyan-400/5 mix-blend-color-dodge" />

        {/* Animated light rays */}
        <div className="absolute top-0 left-1/4 w-1 h-3/4 origin-top light-ray"
          style={{ background: 'linear-gradient(180deg,rgba(103,232,249,0.3) 0%,transparent 100%)', transform: 'rotate(-8deg)', filter: 'blur(8px)' }} />
        <div className="absolute top-0 left-2/5 w-1.5 h-2/3 origin-top light-ray"
          style={{ background: 'linear-gradient(180deg,rgba(186,230,253,0.2) 0%,transparent 100%)', transform: 'rotate(4deg)', filter: 'blur(10px)', animationDelay: '1.5s' }} />
        <div className="absolute top-0 right-1/4 w-1 h-3/5 origin-top light-ray"
          style={{ background: 'linear-gradient(180deg,rgba(103,232,249,0.25) 0%,transparent 100%)', transform: 'rotate(12deg)', filter: 'blur(7px)', animationDelay: '3s' }} />

        {/* Rising bubbles */}
        {BUBBLES.map((b, i) => (
          <Bubble
            key={i}
            style={{
              width: b.size,
              height: b.size,
              left: b.left,
              bottom: b.bottom,
              '--dur': `${b.duration}s`,
              '--delay': `${b.delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── Glow orbs ── */}
      <div className="absolute top-1/3 left-1/5 w-96 h-96 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/5 w-80 h-80 rounded-full bg-sky-500/15 blur-[90px] pointer-events-none animate-pulse" style={{ animationDelay: '2.5s' }} />

      {/* ── Main card ── */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-4xl mx-4 flex flex-col md:flex-row overflow-hidden rounded-[2rem] float-card"
        style={{
          boxShadow: '0 40px 80px -20px rgba(0,10,30,0.7), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        {/* ── Left panel ── */}
        <div
          className="hidden md:flex flex-col justify-between w-5/12 p-10 relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(6,30,60,0.92) 0%, rgba(7,55,80,0.88) 60%, rgba(4,40,70,0.95) 100%)',
            borderRight: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Decorative corner glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/10 blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-sky-600/10 blur-[60px] pointer-events-none" />

          {/* Top: Logo + headline */}
          <div className="relative z-10">
            <Link to="/" className="flex items-center gap-3 group mb-10 w-fit">
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/20 shadow-lg shadow-black/30">
                <img src="/logonen.jpg" alt="SSFM Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">SSFM</span>
            </Link>

            <h2 className="text-white text-3xl font-extrabold leading-tight tracking-tight mb-3">
              Quản lý trang trại<br />
              <span className="text-cyan-300">thông minh</span>
            </h2>
            <p className="text-slate-300/70 text-[13.5px] leading-relaxed">
              Nền tảng giám sát và quản lý nuôi tôm toàn diện — từ chất lượng nước đến hiệu quả sản xuất.
            </p>

            {/* Features */}
            <div className="mt-10 space-y-5">
              {[
                { icon: Activity, color: 'text-cyan-300', bg: 'bg-cyan-500/10', label: 'Giám sát thời gian thực' },
                { icon: LineChart, color: 'text-sky-300', bg: 'bg-sky-500/10', label: 'Báo cáo & Phân tích sinh trưởng' },
                { icon: ShieldCheck, color: 'text-teal-300', bg: 'bg-teal-500/10', label: 'Cảnh báo & Kiểm soát dịch bệnh' },
                { icon: Waves, color: 'text-blue-300', bg: 'bg-blue-500/10', label: 'Theo dõi môi trường ao nuôi' },
              ].map(({ icon: Icon, color, bg, label }) => (
                <div key={label} className="flex items-center gap-3.5 group cursor-default">
                  <div className={`w-9 h-9 rounded-xl ${bg} border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.6} />
                  </div>
                  <span className="text-[13.5px] text-slate-200 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: copyright + water wave decoration */}
          <div className="relative z-10">
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
            <p className="text-[11px] text-slate-400/50 font-medium tracking-wide">
              © 2026 Smart Shrimp Farm Management
            </p>
          </div>
        </div>

        {/* ── Right panel: Form ── */}
        <div
          className="w-full md:w-7/12 p-8 sm:p-10 relative"
          style={{
            background: 'linear-gradient(160deg, rgba(240,249,255,0.96) 0%, rgba(224,242,254,0.97) 100%)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2.5 mb-7">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200">
              <img src="/logonen.jpg" alt="SSFM Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold text-slate-800">SSFM</span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-[1.9rem] font-extrabold text-slate-900 tracking-tight leading-none mb-1.5">
              Đăng Nhập
            </h1>
            <p className="text-slate-500 text-sm">Nhập thông tin tài khoản để tiếp tục.</p>
          </div>

          {/* Invite Banner */}
          <AnimatePresence>
            {inviteTokenFromUrl && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-2xl border border-blue-200 bg-blue-50 shadow-sm"
              >
                {inviteInfo.loading ? (
                  <div className="flex items-center gap-3 text-blue-700 text-sm font-semibold">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Đang kiểm tra lời mời tham gia...
                  </div>
                ) : inviteInfo.valid ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                      <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      Lời mời tham gia trang trại
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed pl-6">
                      Bạn được mời gia nhập <strong>{inviteInfo.farmName}</strong> với vai trò{' '}
                      <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-200 text-blue-900">
                        {inviteInfo.role === 'TECHNICIAN' ? 'Kỹ Thuật Viên' : 'Nông Dân'}
                      </span>.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-rose-600 font-semibold">{inviteInfo.reason || 'Liên kết mời không hợp lệ hoặc đã hết hạn.'}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Mail
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'email' ? 'text-cyan-600' : 'text-slate-400'}`}
                  strokeWidth={1.8}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="your@email.com"
                  required
                  className="glass-input w-full pl-10 pr-4 py-3 rounded-xl bg-white/70 border border-slate-200 text-slate-900 text-sm font-medium placeholder-slate-400 transition-all duration-200 hover:border-slate-300"
                  style={{ boxShadow: focusedField === 'email' ? '0 0 0 2px rgba(6,182,212,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.04)' }}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                  Mật Khẩu
                </label>
                <Link
                  to="/forgot-password"
                  state={{ email }}
                  className="text-[12px] font-semibold text-cyan-600 hover:text-cyan-800 transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'password' ? 'text-cyan-600' : 'text-slate-400'}`}
                  strokeWidth={1.8}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  required
                  className="glass-input w-full pl-10 pr-12 py-3 rounded-xl bg-white/70 border border-slate-200 text-slate-900 text-sm font-medium placeholder-slate-400 transition-all duration-200 hover:border-slate-300 tracking-widest"
                  style={{ boxShadow: focusedField === 'password' ? '0 0 0 2px rgba(6,182,212,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.04)' }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 transition-colors p-1 rounded-lg"
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" strokeWidth={1.8} />
                    : <Eye className="w-4 h-4" strokeWidth={1.8} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2 pt-0.5">
              <input
                id="remember-me"
                type="checkbox"
                className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
              />
              <label htmlFor="remember-me" className="text-sm text-slate-600 font-medium cursor-pointer select-none">
                Ghi nhớ tài khoản
              </label>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm font-medium"
                >
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {serverError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className={`btn-shimmer w-full text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 text-[15px] shadow-lg shadow-cyan-900/20 transition-all duration-200 mt-1 ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-105 hover:shadow-xl hover:shadow-cyan-900/30'}`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  Đăng Nhập Ngay
                  <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Hoặc tiếp tục với</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google login */}
          <div className="flex justify-center" ref={googleBtnRef} />

          {/* Register link */}
          <p className="mt-7 text-center text-sm text-slate-500 font-medium">
            Chưa có tài khoản?{' '}
            <Link
              to={inviteTokenFromUrl ? `/register?inviteToken=${inviteTokenFromUrl}` : '/register'}
              className="font-bold text-cyan-600 hover:text-cyan-800 transition-colors"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
