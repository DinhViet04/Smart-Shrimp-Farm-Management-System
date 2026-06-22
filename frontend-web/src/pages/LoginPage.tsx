import { Link } from 'react-router-dom';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex font-sans bg-white">
      {/* Left side - Image & Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gray-900">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1595844730298-b960fa25e985?q=80&w=2070&auto=format&fit=crop"
            alt="Farm Login Background"
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
            <h2 className="text-4xl font-bold mb-4">Welcome back to your farm.</h2>
            <p className="text-lg text-white/80">Log in to manage your records, check environmental metrics, and access your 5T Care Dashboard.</p>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md">
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Log In</h1>
            <p className="text-gray-600">Enter your credentials to access your account.</p>
          </div>

          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); window.location.href = '/dashboard'; }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-gray-900"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                  Password
                </label>
                <a href="#" className="text-sm font-medium text-green-700 hover:text-green-800">
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-gray-900"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-semibold py-3 px-4 rounded-full transition-colors flex justify-center items-center"
            >
              Log In
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="#" className="font-semibold text-green-700 hover:text-green-800">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
