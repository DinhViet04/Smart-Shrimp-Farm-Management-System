import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Droplets, User, Mail, Phone, Lock, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

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
        return 'Phải chứa hoa, thường, số/ký tự đặc biệt';
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(Array.isArray(data.message) ? data.message[0] : (data.message || 'Lỗi kết nối Google'));
      } else {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
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
            <div class="flex items-center justify-center gap-3 w-full px-4 py-3 bg-white/70 hover:bg-white backdrop-blur-sm border border-slate-300/50 rounded-2xl cursor-pointer transition-all text-slate-700 font-semibold text-sm shadow-sm group">
              <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.369 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.109 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
              <span class="ml-1 group-hover:text-blue-600 transition-colors">Tiếp tục với Google</span>
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: formData.fullName,
            email: formData.email,
            password: formData.password,
            ...(formData.phone && { phone: formData.phone })
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setServerError(Array.isArray(data.message) ? data.message[0] : (data.message || 'Có lỗi xảy ra'));
        } else {
          navigate('/login');
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

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 font-sans selection:bg-cyan-200 overflow-hidden bg-slate-900">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes slowZoom {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-slow-zoom { animation: slowZoom 25s ease-in-out infinite; }
      `}</style>

      {/* Deep Ocean Background with Enhanced Saturation and Caustics */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src="anhnen.png"
          alt="Ocean Coral Reef"
          className="w-full h-full object-cover animate-slow-zoom saturate-150 contrast-125"
        />
        {/* Water Caustics light effect (Color Dodge) */}
        <div className="absolute inset-0 bg-cyan-400/10 mix-blend-color-dodge"></div>
        {/* Deep vignette shadow */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-900/60"></div>

        {/* Lively glowing orbs representing underwater light rays */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-300/10 rounded-full blur-[120px] animate-pulse mix-blend-screen"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] animate-pulse mix-blend-screen" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Centered Frosted Glass Panel */}
      <div className="relative z-10 w-full max-w-4xl bg-white/5 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,10,30,0.6)] flex flex-col md:flex-row overflow-hidden my-8 animate-float">

        {/* Left Side: System Information */}
        <div className="hidden md:flex flex-col justify-between w-5/12 p-10 bg-cyan-900/30 backdrop-blur-md border-r border-white/10 relative">

          <div className="relative z-10">
            {/* Image Logo */}
            <Link to="/" className="flex items-center gap-3 group inline-flex mb-12">
              <img src="/logonen.jpg" alt="SSFM Logo" className="w-12 h-12 rounded-full object-cover bg-white shadow-lg border-2 border-white/80 group-hover:scale-105 transition-transform duration-500" />
              <span className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">SSFM</span>
            </Link>

            {/* Serif Typography for elegance */}
            <h2 className="text-[2.25rem] font-serif font-semibold text-white mb-5 leading-snug drop-shadow-sm">Tạo Tài Khoản</h2>

            {/* High-end Sans-serif description */}
            <p className="text-slate-100 font-sans text-[15px] leading-relaxed tracking-wide mb-10 opacity-90">
              Tham gia hệ sinh thái trang trại kỹ thuật số. Giám sát hệ thống ao nuôi với công nghệ AI và 5T Care Loop.
            </p>

            {/* Minimalist Feature List */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-sm backdrop-blur-sm">
                  <ShieldCheck className="w-4 h-4 text-cyan-200" strokeWidth={1.5} />
                </div>
                <span className="text-[15px] font-medium tracking-wide text-white">Bảo mật dữ liệu tuyệt đối</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-sm backdrop-blur-sm">
                  <Droplets className="w-4 h-4 text-blue-200" strokeWidth={1.5} />
                </div>
                <span className="text-[15px] font-medium tracking-wide text-white">Tối ưu hoá nguồn nước</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-12 text-[13px] font-medium tracking-wide text-slate-300/60">
            © 2026 Smart Shrimp Farm Management
          </div>
        </div>

        {/* Right Side: Registration Form */}
        <div className="w-full md:w-7/12 p-8 sm:p-10 lg:p-12 bg-white/40 backdrop-blur-xl relative">
          {/* Back to Login Button */}
          <Link to="/login" className="absolute top-6 right-6 sm:top-8 sm:right-8 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors bg-white/50 hover:bg-white/80 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm border border-white/40">
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />

          </Link>

          {/* Mobile Logo */}
          <div className="md:hidden flex items-center gap-3 mb-8">
            <img src="/logonen.jpg" alt="SSFM Logo" className="w-10 h-10 rounded-full object-cover bg-white shadow-lg border-2 border-white/80" />
            <span className="text-2xl font-bold text-slate-900">SSFM</span>
          </div>

          <div className="mb-8">
            <h1 className="text-[2rem] font-bold text-slate-900 mb-2 tracking-tight">Đăng Ký Mới</h1>
            <p className="text-slate-600 text-[15px]">Điền thông tin của bạn để thiết lập trang trại.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest" htmlFor="fullName">
                  Họ và Tên <span className="text-blue-600">*</span>
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition-colors" strokeWidth={1.5} />
                  <input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={handleChange}
                    className={`w-full pl-11 pr-4 py-3 rounded-2xl bg-indigo-50/60 shadow-inner border ${errors.fullName ? 'border-red-400' : 'border-white/40'} focus:bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900 placeholder-slate-400 text-[14px] font-medium`}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                {errors.fullName && <p className="text-[11px] text-red-600 font-bold">{errors.fullName}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest" htmlFor="phone">
                  Số Điện Thoại
                </label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition-colors" strokeWidth={1.5} />
                  <input
                    id="phone"
                    type="tel"
                    maxLength={10}
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full pl-11 pr-4 py-3 rounded-2xl bg-indigo-50/60 shadow-inner border ${errors.phone ? 'border-red-400' : 'border-white/40'} focus:bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900 placeholder-slate-400 text-[14px] font-medium`}
                    placeholder="0912345678"
                  />
                </div>
                {errors.phone && <p className="text-[11px] text-red-600 font-bold">{errors.phone}</p>}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest" htmlFor="email">
                Địa chỉ Email <span className="text-blue-600">*</span>
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition-colors" strokeWidth={1.5} />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 rounded-2xl bg-indigo-50/60 shadow-inner border ${errors.email ? 'border-red-400' : 'border-white/40'} focus:bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900 placeholder-slate-400 text-[14px] font-medium`}
                  placeholder="hungncqde180400@fpt.edu.vn"
                />
              </div>
              {errors.email && <p className="text-[11px] text-red-600 font-bold">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Password */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest" htmlFor="password">
                  Mật Khẩu <span className="text-blue-600">*</span>
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition-colors" strokeWidth={1.5} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full pl-11 pr-10 py-3 rounded-2xl bg-indigo-50/60 shadow-inner border ${errors.password ? 'border-red-400' : 'border-white/40'} focus:bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900 placeholder-slate-400 text-[14px] font-medium tracking-widest`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-red-600 font-bold leading-tight">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest" htmlFor="confirmPassword">
                  Xác nhận <span className="text-blue-600">*</span>
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition-colors" strokeWidth={1.5} />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full pl-11 pr-4 py-3 rounded-2xl bg-indigo-50/60 shadow-inner border ${errors.confirmPassword ? 'border-red-400' : 'border-white/40'} focus:bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900 placeholder-slate-400 text-[14px] font-medium tracking-widest`}
                    placeholder="••••••••"
                  />
                </div>
                {errors.confirmPassword && <p className="text-[11px] text-red-600 font-bold leading-tight">{errors.confirmPassword}</p>}
              </div>
            </div>

            {serverError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-sm font-medium border border-red-100 flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-3.5 px-4 rounded-2xl transition-all flex justify-center items-center mt-5 shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 group ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang xử lý...
                </span>
              ) : (
                <span className="flex items-center gap-2 text-[15px]">
                  Hoàn Tất Đăng Ký
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={2} />
                </span>
              )}
            </button>
          </form>

          {/* Social Auth */}
          <div className="mt-7">
            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-slate-300/40"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Hoặc tiếp tục với</span>
              <div className="flex-grow border-t border-slate-300/40"></div>
            </div>
            <div className="mt-4 flex justify-center" ref={googleBtnRef}></div>
          </div>

          <p className="mt-7 text-center text-[14px] text-slate-600 font-medium">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-bold text-blue-600 hover:text-blue-800 transition-colors">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
