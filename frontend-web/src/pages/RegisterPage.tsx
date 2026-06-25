import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const getFieldError = (id: string, value: string, currentData: typeof formData): string => {
    if (id === 'fullName') {
      if (!value.trim()) return 'Họ tên không được để trống';
    } else if (id === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return 'Email không hợp lệ';
    } else if (id === 'phone') {
      if (value && !/^0[35789][0-9]{8}$/.test(value)) {
        return 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 0';
      }
    } else if (id === 'password') {
      const passwordRegex = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
      if (value.length < 8) {
        return 'Mật khẩu phải có ít nhất 8 ký tự';
      } else if (!passwordRegex.test(value)) {
        return 'Mật khẩu phải chứa chữ hoa, thường và số/ký tự đặc biệt';
      }
    } else if (id === 'confirmPassword') {
      if (value !== currentData.password) {
        return 'Mật khẩu xác nhận không khớp';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (validateForm()) {
      setIsLoading(true);
      try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fullName: formData.fullName,
            email: formData.email,
            password: formData.password,
            ...(formData.phone && { phone: formData.phone })
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Backend returned an error (e.g., ConflictException if email exists)
          let errorMsg = data.message || 'Có lỗi xảy ra, vui lòng thử lại';
          if (Array.isArray(data.message)) {
            errorMsg = data.message[0]; // If ValidationPipe returns array of errors
          }
          setServerError(errorMsg);
        } else {
          // Success! Redirect to login (or dashboard)
          navigate('/login');
        }
      } catch (error) {
        setServerError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { id, value } = e.target;
    
    // Force phone to be digits only, max 10 chars
    if (id === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }

    const newData = { ...formData, [id]: value };
    setFormData(newData);
    
    // Live validation
    const fieldError = getFieldError(id, value, newData);
    setErrors((prev) => {
      const nextErrors = { ...prev, [id]: fieldError };
      // Special case: if password changed, re-validate confirmPassword if it's already filled
      if (id === 'password' && newData.confirmPassword) {
        nextErrors.confirmPassword = getFieldError('confirmPassword', newData.confirmPassword, newData);
      }
      return nextErrors;
    });
  };

  return (
    <div className="min-h-screen flex font-sans bg-white">
      {/* Left side - Image & Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gray-900">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1586771107445-d3ca888129ff?q=80&w=2072&auto=format&fit=crop"
            alt="Farm Registration Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-green-900/60 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-black/40"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-700 font-bold text-xl italic">
                S
              </div>
              <span className="text-3xl font-semibold tracking-tight text-white">SSFM</span>
            </Link>
          </div>
          <div className="max-w-md">
            <h2 className="text-4xl font-bold mb-4">Join our farming community.</h2>
            <p className="text-lg text-white/80">Create an account to track your crops, monitor environments, and ensure the best yields.</p>
          </div>
        </div>
      </div>

      {/* Right side - Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl italic">
                S
              </div>
              <span className="text-3xl font-semibold tracking-tight text-gray-900">SSFM</span>
            </Link>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
            <p className="text-gray-600">Enter your details to get started.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-lg border ${errors.fullName ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-gray-900`}
                placeholder="John Doe"
              />
              {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-lg border ${errors.email ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-gray-900`}
                placeholder="you@example.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                maxLength={10}
                value={formData.phone}
                onChange={handleChange}
                className={`w-full px-4 py-3 rounded-lg border ${errors.phone ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-gray-900`}
                placeholder="0912345678"
              />
              {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg border ${errors.password ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-gray-900 pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none mt-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmPassword">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-gray-900 pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none mt-0"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
            </div>

            {serverError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-semibold py-3 px-4 rounded-full transition-colors flex justify-center items-center mt-6 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Processing...' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-green-700 hover:text-green-800">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
