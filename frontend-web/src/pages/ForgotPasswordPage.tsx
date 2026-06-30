import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, Lock, ShieldCheck, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email || '';

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    setServerMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        setServerError(Array.isArray(data.message) ? data.message[0] : (data.message || 'Không thể gửi OTP'));
      } else {
        setServerMessage(data.message || 'OTP đã được gửi');
        setStep('reset');
      }
    } catch {
      setServerError('Không thể kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    setServerMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, password, confirmPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        setServerError(Array.isArray(data.message) ? data.message[0] : (data.message || 'Không thể đặt lại mật khẩu'));
      } else {
        setServerMessage(data.message || 'Đặt lại mật khẩu thành công');
        setTimeout(() => navigate('/login'), 1200);
      }
    } catch {
      setServerError('Không thể kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordRegex = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 font-sans selection:bg-cyan-200 overflow-hidden bg-slate-900">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img src="anhnen.png" alt="Ocean Coral Reef" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-900/60"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-[0_35px_60px_-15px_rgba(0,10,30,0.6)] p-8 sm:p-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
        </Link>

        <div className="mt-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/20 border border-cyan-400/30">
            <KeyRound className="h-7 w-7 text-cyan-200" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-white">{step === 'email' ? 'Quên mật khẩu' : 'Đặt lại mật khẩu'}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {step === 'email'
              ? 'Nhập email đã đăng ký để nhận mã OTP.'
              : 'Nhập mã OTP và mật khẩu mới để hoàn tất.'}
          </p>
        </div>

        {serverError && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{serverError}</div>
        )}
        {serverMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{serverMessage}</div>
        )}

        {step === 'email' ? (
          <form className="mt-8 space-y-5" onSubmit={handleSendOtp}>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-200" htmlFor="forgot-email">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/20 bg-white/80 py-3.5 pl-11 pr-4 text-slate-900 outline-none ring-0"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3.5 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? 'Đang gửi...' : 'Gửi mã OTP'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleResetPassword}>
            <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 text-sm text-slate-200">
              <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Email nhận mã</div>
              <div className="mt-1 text-slate-100">{email}</div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-200" htmlFor="otp">
                OTP
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-2xl border border-white/20 bg-white/80 py-3.5 px-4 text-slate-900 outline-none ring-0"
                placeholder="123456"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-200" htmlFor="new-password">
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/20 bg-white/80 py-3.5 pl-11 pr-4 text-slate-900 outline-none ring-0"
                  placeholder="••••••••"
                  required
                />
              </div>
              {password && !passwordRegex.test(password) && (
                <p className="text-xs text-slate-300">Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số hoặc ký tự đặc biệt.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-200" htmlFor="confirm-password">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/20 bg-white/80 py-3.5 pl-11 pr-4 text-slate-900 outline-none ring-0"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3.5 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
