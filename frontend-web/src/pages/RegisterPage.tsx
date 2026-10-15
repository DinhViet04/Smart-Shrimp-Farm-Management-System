import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Mail, Phone, Lock, ArrowRight, ArrowLeft, ShieldCheck,
  Building2, FlaskConical, Users, CheckCircle2, Gift, AlertTriangle,
  Eye, EyeOff, Activity, LineChart, Waves
} from 'lucide-react';
import { verifyInviteToken } from '../services/farm.service';

const getDashboardPath = (role?: string) => {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'FARMER':
      return '/farmer/dashboard';
    case 'TECHNICIAN':
      return '/technician/dashboard';
    case 'FARM_MANAGER':
    default:
      return '/dashboard';
  }
};

function Bubble({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none bubble border border-cyan-300/40"
      style={{
        ...style,
        background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.5) 0%, rgba(103,232,249,0.15) 60%, rgba(6,182,212,0.3) 100%)',
        backdropFilter: 'blur(1px)',
        boxShadow: 'inset -2px -2px 4px rgba(6,182,212,0.3), 0 0 6px rgba(103,232,249,0.2)',
      }}
    />
  );
}

const BUBBLES = [
  { size: 14, left: '8%', bottom: '12%', duration: 9, delay: 0 },
  { size: 9, left: '18%', bottom: '5%', duration: 12, delay: 1.5 },
  { size: 20, left: '28%', bottom: '8%', duration: 10, delay: 0.5 },
  { size: 7, left: '42%', bottom: '15%', duration: 14, delay: 2 },
  { size: 12, left: '55%', bottom: '6%', duration: 11, delay: 3 },
  { size: 18, left: '68%', bottom: '10%', duration: 8, delay: 4 },
  { size: 10, left: '78%', bottom: '14%', duration: 13, delay: 1 },
  { size: 6, left: '88%', bottom: '4%', duration: 15, delay: 2.5 },
  { size: 16, left: '92%', bottom: '9%', duration: 10, delay: 0.8 },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteTokenFromUrl = searchParams.get('inviteToken');

  // Invitation state
  const [inviteInfo, setInviteInfo] = useState<{
    valid: boolean;
    farmName?: string;
    managerName?: string;
    role?: string;
    email?: string;
    reason?: string;
    loading: boolean;
  }>({ valid: false, loading: !!inviteTokenFromUrl });

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'FARM_MANAGER',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Verify invite token on mount
  useEffect(() => {
    if (!inviteTokenFromUrl) return;
    let cancelled = false;
    verifyInviteToken(inviteTokenFromUrl).then(result => {
      if (cancelled) return;
      if (result.valid) {
        setInviteInfo({ loading: false, ...result });
        // Pre-fill email và role từ token
        setFormData(prev => ({
          ...prev,
          email: result.email ?? prev.email,
          role: result.role ?? prev.role,
        }));
      } else {
        setInviteInfo({ valid: false, loading: false, reason: result.reason });
      }
    });
    return () => { cancelled = true; };
  }, [inviteTokenFromUrl]);

  const getFieldError = (id: string, value: string, currentData: typeof formData): string => {
    if (id === 'fullName') {
      if (!value.trim()) return 'Họ tên không được để trống';
    } else if (id === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return 'Email không hợp lệ';
    } else if (id === 'phone') {
      if (value && !/^0[35789][0-9]{8}$/.test(value)) {
        return 'Số điện thoại phải 10 số (bắt đầu bằng 0)';
      }
    } else if (id === 'password') {
      const passwordRegex = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
      if (value.length < 8) {
        return 'Tối thiểu 8 ký tự';
      } else if (!passwordRegex.test(value)) {
        return 'Phải chứa chữ hoa, thường, số/ký tự đặc biệt';
      }
    } else if (id === 'confirmPassword') {
      if (value !== currentData.password) {
        return 'Mật khẩu không khớp';
      }
    }
    return '';
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    const ids = ['fullName', 'email', 'phone', 'password', 'confirmPassword'];

    let isValid = true;
    ids.forEach(id => {
      const err = getFieldError(id, formData[id as keyof typeof formData], formData);
      if (err) {
        newErrors[id] = err;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

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
        setServerError(Array.isArray(data.message) ? data.message[0] : (data.message || 'Lỗi kết nối Google'));
      } else {
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate(getDashboardPath(data.user.role));
      }
    } catch (error) {
      setServerError('Không thể kết nối máy chủ.');
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
              { theme: 'outline', size: 'large', width: '100%', shape: 'pill', logo_alignment: 'center' }
            );
          }
        } else if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = `
            <div class="flex items-center justify-center gap-2.5 w-full px-3 py-2 bg-white/80 hover:bg-white border border-slate-200 rounded-lg cursor-pointer transition-all text-slate-700 font-semibold text-xs shadow-sm hover:shadow group">
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.369 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.109 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
              <span>Tiếp tục với Google</span>
            </div>
          `;
        }
      }
    };
    const timer = setInterval(() => {
      if ((window as any).google) {
        initGoogle();
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (validateForm()) {
      setIsLoading(true);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/auth/register`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: formData.fullName,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            ...(formData.phone && { phone: formData.phone }),
            ...(inviteTokenFromUrl && { inviteToken: inviteTokenFromUrl }),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setServerError(Array.isArray(data.message) ? data.message[0] : (data.message || 'Có lỗi xảy ra'));
        } else {
          if (data.accessToken && data.user) {
            if (data.refreshToken) {
              localStorage.setItem('refreshToken', data.refreshToken);
            }
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('user', JSON.stringify(data.user));

            if (data.joinedFarm) {
              setServerError('');
              setIsLoading(false);
              navigate(getDashboardPath(data.user.role || formData.role), {
                state: { welcomeFarm: data.joinedFarm.name }
              });
            } else {
              navigate(getDashboardPath(data.user.role || formData.role));
            }
          } else {
            navigate('/login');
          }
        }
      } catch (error) {
        setServerError('Không thể kết nối đến máy chủ.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { id, value } = e.target;
    if (id === 'phone') value = value.replace(/\D/g, '').slice(0, 10);
    const newData = { ...formData, [id]: value };
    setFormData(newData);

    const fieldError = getFieldError(id, value, newData);
    setErrors(prev => {
      const nextErrors = { ...prev, [id]: fieldError };
      if (id === 'password' && newData.confirmPassword) {
        nextErrors.confirmPassword = getFieldError('confirmPassword', newData.confirmPassword, newData);
      }
      return nextErrors;
    });
  };

  const handleRoleSelect = (role: string) => {
    setFormData(prev => ({ ...prev, role }));
  };

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen relative flex items-center justify-center p-2 sm:p-3 lg:p-4 font-sans selection:bg-cyan-200 lg:overflow-hidden overflow-y-auto bg-slate-950">
      <style>{`
        @keyframes riseBubble {
          0%   { transform: translateY(0) scale(0.8); opacity: 0; }
          10%  { opacity: 1; }
          80%  { opacity: 0.7; }
          100% { transform: translateY(-100vh) translateX(20px) scale(1.1); opacity: 0; }
        }
        @keyframes lightRay {
          0%,100% { opacity: 0.35; transform: scaleX(1); }
          50%      { opacity: 0.55; transform: scaleX(1.08); }
        }
        .bubble   { animation: riseBubble var(--dur,10s) var(--delay,0s) ease-in infinite; }
        .light-ray { animation: lightRay 5s ease-in-out infinite; }

        .glass-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(34,211,238,0.45), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .btn-submit {
          background: linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%);
        }
        .btn-submit:hover { filter: brightness(1.08); }
        .btn-submit:active { transform: scale(0.99); }
      `}</style>

      {/* ── Background image ── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src="/anhnen.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover saturate-[1.3] contrast-110"
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
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-4xl lg:max-w-[55rem] my-auto flex flex-col md:flex-row overflow-hidden rounded-2xl md:rounded-[1.75rem]"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0,10,30,0.7), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        {/* ── Left panel (đồng bộ với LoginPage) ── */}
        <div
          className="hidden md:flex flex-col justify-between w-5/12 p-5 lg:p-6 relative overflow-hidden"
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
            <Link to="/" className="flex items-center gap-2.5 group mb-3.5 w-fit">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 shadow-md shadow-black/30">
                <img src="/logonen.jpg" alt="SSFM Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">SSFM</span>
            </Link>

            <h2 className="text-white text-xl lg:text-[1.35rem] font-extrabold leading-tight tracking-tight mb-1.5">
              Quản lý trang trại<br />
              <span className="text-cyan-300">thông minh</span>
            </h2>
            <p className="text-slate-300/70 text-xs leading-relaxed mb-3.5">
              Nền tảng giám sát và quản lý nuôi tôm toàn diện — từ chất lượng nước đến hiệu quả sản xuất.
            </p>

            {/* Features */}
            <div className="space-y-2">
              {[
                { icon: Activity, color: 'text-cyan-300', bg: 'bg-cyan-500/10', label: 'Giám sát thời gian thực' },
                { icon: LineChart, color: 'text-sky-300', bg: 'bg-sky-500/10', label: 'Báo cáo & Phân tích sinh trưởng' },
                { icon: ShieldCheck, color: 'text-teal-300', bg: 'bg-teal-500/10', label: 'Cảnh báo & Kiểm soát dịch bệnh' },
                { icon: Waves, color: 'text-blue-300', bg: 'bg-blue-500/10', label: 'Theo dõi môi trường ao nuôi' },
              ].map(({ icon: Icon, color, bg, label }) => (
                <div key={label} className="flex items-center gap-2.5 group cursor-default">
                  <div className={`w-7 h-7 rounded-lg ${bg} border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} strokeWidth={1.6} />
                  </div>
                  <span className="text-xs text-slate-200 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Contact info & copyright */}
          <div className="relative z-10 pt-2.5">
            {/* Support box */}
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm mb-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center text-cyan-300 flex-shrink-0">
                  <Phone className="w-3 h-3" />
                </div>
                <div className="text-[11px] leading-tight">
                  <span className="text-slate-300/70 block text-[9.5px]">Hotline kỹ thuật:</span>
                  <a href="tel:0123456789" className="text-cyan-300 hover:text-cyan-200 font-bold tracking-wide transition-colors">
                    0123 456 789 <span className="text-[9px] text-slate-300/60 font-normal">(24/7)</span>
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-sky-500/15 border border-sky-400/20 flex items-center justify-center text-sky-300 flex-shrink-0">
                  <Mail className="w-3 h-3" />
                </div>
                <div className="text-[11px] leading-tight">
                  <span className="text-slate-300/70 block text-[9.5px]">Email hỗ trợ:</span>
                  <a href="mailto:support@ssfm.com" className="text-sky-300 hover:text-sky-200 font-medium transition-colors">
                    support@ssfm.com
                  </a>
                </div>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-1.5" />
            <p className="text-[10px] text-slate-400/50 font-medium tracking-wide">
              © 2026 Smart Shrimp Farm Management
            </p>
          </div>
        </div>

        {/* ── Right panel: Registration Form ── */}
        <div
          className="w-full md:w-7/12 p-4 sm:p-5 lg:px-7 lg:py-4.5 relative flex flex-col justify-between"
          style={{
            background: 'linear-gradient(160deg, rgba(240,249,255,0.96) 0%, rgba(224,242,254,0.97) 100%)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Back to Login link */}
          <div className="flex items-center justify-between mb-2">
            {/* Mobile logo */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200">
                <img src="/logonen.jpg" alt="SSFM Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-base font-bold text-slate-800">SSFM</span>
            </div>

            <Link
              to={inviteTokenFromUrl ? `/login?inviteToken=${inviteTokenFromUrl}` : '/login'}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-cyan-700 transition-colors bg-white/70 hover:bg-white px-2.5 py-0.5 rounded-full border border-slate-200 shadow-sm"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Đăng nhập</span>
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-2">
            <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-0.5">
              {inviteTokenFromUrl && inviteInfo.valid ? 'Tạo Tài Khoản & Gia Nhập' : 'Tạo Tài Khoản'}
            </h1>
            <p className="text-slate-500 text-xs">
              {inviteTokenFromUrl && inviteInfo.valid
                ? `Hoàn tất đăng ký để tham gia "${inviteInfo.farmName}".`
                : 'Điền thông tin để đăng ký tài khoản SSFM.'}
            </p>
          </div>

          {/* Invite Banner */}
          <AnimatePresence>
            {inviteTokenFromUrl && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2.5"
              >
                {inviteInfo.loading ? (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50/90 rounded-lg border border-blue-200">
                    <div className="w-3.5 h-3.5 border-2 border-cyan-500/30 border-t-cyan-600 rounded-full animate-spin flex-shrink-0" />
                    <p className="text-xs text-cyan-800 font-semibold">Đang xác thực lời mời...</p>
                  </div>
                ) : inviteInfo.valid ? (
                  <div className="p-2.5 bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl border border-emerald-300 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                        <Gift className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-emerald-800 leading-snug">
                          🎉 Bạn được mời tham gia trang trại!
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5 leading-tight">
                          <strong>{inviteInfo.managerName}</strong> mời bạn vào <strong>&ldquo;{inviteInfo.farmName}&rdquo;</strong>{' '}
                          với vai trò <span className={`font-bold px-1 py-0.2 rounded text-[9.5px] ${inviteInfo.role === 'FARMER'
                              ? 'bg-emerald-200 text-emerald-800'
                              : 'bg-cyan-200 text-cyan-800'
                            }`}>{inviteInfo.role === 'FARMER' ? 'Nông Dân' : 'Kỹ Thuật Viên'}</span>.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-red-700">Link mời không hợp lệ</p>
                      <p className="text-[10px] text-red-600 mt-0.5">{inviteInfo.reason || 'Token đã hết hạn hoặc bị sai.'}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-2" onSubmit={handleSubmit}>
            {/* Full Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Full Name */}
              <div className="space-y-0.5">
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider" htmlFor="fullName">
                  Họ và Tên <span className="text-cyan-600">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
                  <input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('fullName')}
                    onBlur={() => setFocusedField(null)}
                    className={`glass-input w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/70 border ${errors.fullName ? 'border-red-300' : 'border-slate-200'} text-slate-900 text-xs sm:text-[13px] font-medium placeholder-slate-400 transition-all duration-200 hover:border-slate-300`}
                    style={{ boxShadow: focusedField === 'fullName' ? '0 0 0 2px rgba(6,182,212,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.04)' }}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                {errors.fullName && <p className="text-[10px] text-red-500 font-semibold">{errors.fullName}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-0.5">
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider" htmlFor="phone">
                  Số Điện Thoại
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
                  <input
                    id="phone"
                    type="tel"
                    maxLength={10}
                    value={formData.phone}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    className={`glass-input w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/70 border ${errors.phone ? 'border-red-300' : 'border-slate-200'} text-slate-900 text-xs sm:text-[13px] font-medium placeholder-slate-400 transition-all duration-200 hover:border-slate-300`}
                    style={{ boxShadow: focusedField === 'phone' ? '0 0 0 2px rgba(6,182,212,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.04)' }}
                    placeholder="0912345678"
                  />
                </div>
                {errors.phone && <p className="text-[10px] text-red-500 font-semibold">{errors.phone}</p>}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-0.5">
              <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider" htmlFor="email">
                Địa chỉ Email <span className="text-cyan-600">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className={`glass-input w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/70 border ${errors.email ? 'border-red-300' : 'border-slate-200'} text-slate-900 text-xs sm:text-[13px] font-medium placeholder-slate-400 transition-all duration-200 hover:border-slate-300`}
                  style={{ boxShadow: focusedField === 'email' ? '0 0 0 2px rgba(6,182,212,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.04)' }}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="text-[10px] text-red-500 font-semibold">{errors.email}</p>}
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Password */}
              <div className="space-y-0.5">
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider" htmlFor="password">
                  Mật Khẩu <span className="text-cyan-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    className={`glass-input w-full pl-8 pr-8 py-1.5 rounded-lg bg-white/70 border ${errors.password ? 'border-red-300' : 'border-slate-200'} text-slate-900 text-xs sm:text-[13px] font-medium placeholder-slate-400 transition-all duration-200 hover:border-slate-300 tracking-widest`}
                    style={{ boxShadow: focusedField === 'password' ? '0 0 0 2px rgba(6,182,212,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.04)' }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 transition-colors p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.8} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.8} />}
                  </button>
                </div>
                {errors.password && <p className="text-[10px] text-red-500 font-semibold leading-tight">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-0.5">
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider" htmlFor="confirmPassword">
                  Xác nhận <span className="text-cyan-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    className={`glass-input w-full pl-8 pr-8 py-1.5 rounded-lg bg-white/70 border ${errors.confirmPassword ? 'border-red-300' : 'border-slate-200'} text-slate-900 text-xs sm:text-[13px] font-medium placeholder-slate-400 transition-all duration-200 hover:border-slate-300 tracking-widest`}
                    style={{ boxShadow: focusedField === 'confirmPassword' ? '0 0 0 2px rgba(6,182,212,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.04)' }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 transition-colors p-0.5"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.8} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.8} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-[10px] text-red-500 font-semibold leading-tight">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-1 pt-0.5">
              <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                Chọn Vai Trò (Role) <span className="text-cyan-600">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Farm Manager */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('FARM_MANAGER')}
                  className={`p-2 rounded-lg border text-left transition-all relative flex flex-col justify-between cursor-pointer ${formData.role === 'FARM_MANAGER'
                      ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-400/40 shadow-sm text-sky-950'
                      : 'bg-white/60 hover:bg-white/90 border-slate-200 text-slate-700'
                    }`}
                >
                  {formData.role === 'FARM_MANAGER' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 absolute top-1.5 right-1.5" />
                  )}
                  <div className="w-5 h-5 rounded bg-sky-500/15 text-sky-600 flex items-center justify-center mb-0.5">
                    <Building2 className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold leading-tight">Quản Lý Trang Trại</div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">Chủ trại, quản lý ao & nhân sự</div>
                  </div>
                </button>

                {/* Technician */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('TECHNICIAN')}
                  className={`p-2 rounded-lg border text-left transition-all relative flex flex-col justify-between cursor-pointer ${formData.role === 'TECHNICIAN'
                      ? 'bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-400/40 shadow-sm text-cyan-950'
                      : 'bg-white/60 hover:bg-white/90 border-slate-200 text-slate-700'
                    }`}
                >
                  {formData.role === 'TECHNICIAN' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 absolute top-1.5 right-1.5" />
                  )}
                  <div className="w-5 h-5 rounded bg-cyan-500/15 text-cyan-600 flex items-center justify-center mb-0.5">
                    <FlaskConical className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold leading-tight">Kỹ Thuật Viên</div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">Đo nước, sức khỏe tôm & mẫu 5T</div>
                  </div>
                </button>

                {/* Farmer */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('FARMER')}
                  className={`p-2 rounded-lg border text-left transition-all relative flex flex-col justify-between cursor-pointer ${formData.role === 'FARMER'
                      ? 'bg-teal-500/10 border-teal-500 ring-2 ring-teal-400/40 shadow-sm text-teal-950'
                      : 'bg-white/60 hover:bg-white/90 border-slate-200 text-slate-700'
                    }`}
                >
                  {formData.role === 'FARMER' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 absolute top-1.5 right-1.5" />
                  )}
                  <div className="w-5 h-5 rounded bg-teal-500/15 text-teal-600 flex items-center justify-center mb-0.5">
                    <Users className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold leading-tight">Nông Dân</div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">Ghi nhận cho ăn & nhật ký ao</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-start gap-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg p-2 text-xs font-medium"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {serverError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button - static blue, no smooth/shimmer animation */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={isLoading}
              className={`btn-submit w-full text-white font-bold py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 text-[14px] shadow-md shadow-cyan-900/20 transition-all duration-200 mt-1 ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-105 hover:shadow-lg hover:shadow-cyan-900/30'
                }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  Hoàn Tất Đăng Ký
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-2 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Hoặc tiếp tục với</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google Auth */}
          <div className="flex justify-center" ref={googleBtnRef} />

          {/* Login Link */}
          <p className="mt-2 text-center text-xs text-slate-500 font-medium">
            Đã có tài khoản?{' '}
            <Link
              to={inviteTokenFromUrl ? `/login?inviteToken=${inviteTokenFromUrl}` : '/login'}
              className="font-bold text-cyan-600 hover:text-cyan-800 transition-colors"
            >
              Đăng nhập ngay
            </Link>
          </p>

          {/* Mobile support note */}
          <div className="md:hidden mt-2 pt-2 border-t border-slate-200/60 text-center">
            <p className="text-[10px] text-slate-500 font-medium">
              Hỗ trợ kỹ thuật: <a href="tel:0123456789" className="text-cyan-700 font-bold hover:underline">0123 456 789</a> (24/7) • <a href="mailto:support@ssfm.com" className="text-cyan-700 font-medium hover:underline">support@ssfm.com</a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
