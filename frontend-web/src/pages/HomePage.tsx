import { Link } from 'react-router-dom';
import { ChevronDown, Play } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="font-sans min-h-screen bg-white text-gray-800">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 w-full z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold italic">
                  S
                </div>
                <span className="text-2xl font-semibold text-gray-800 tracking-tight">SSFM</span>
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-8 items-center">
              <div className="relative group cursor-pointer flex items-center text-gray-600 hover:text-gray-900 font-medium text-sm">
                Features <ChevronDown className="ml-1 w-4 h-4" />
              </div>
              <Link to="#" className="text-gray-600 hover:text-gray-900 font-medium text-sm">Pricing</Link>
              <div className="relative group cursor-pointer flex items-center text-gray-600 hover:text-gray-900 font-medium text-sm">
                Resources <ChevronDown className="ml-1 w-4 h-4" />
              </div>
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm">Login</Link>
              <Link
                to="/login"
                className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2.5 rounded-full font-medium text-sm transition-colors"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-20 h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1592982537447-6f296d04843b?q=80&w=2070&auto=format&fit=crop"
            alt="Farm Background"
            className="w-full h-full object-cover"
          />
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black/50"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center sm:px-6 lg:px-8 mt-10">
          <p className="text-white/90 text-sm font-semibold tracking-wider uppercase mb-4">
            FARM MANAGEMENT SOFTWARE
          </p>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            The modern way to <br className="hidden md:block" /> manage your farm.
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10">
            Improve farm efficiency, productivity, and profitability with the all-in-one farm & livestock platform that drives results by bringing your team, records, sales, data and more together in one easy to use place.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button className="bg-white hover:bg-gray-50 text-gray-900 px-8 py-3.5 rounded-full font-semibold text-base transition-colors flex items-center gap-2">
              <Play className="w-4 h-4 fill-current" /> Watch demo
            </button>
            <Link to="/login" className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-8 py-3.5 rounded-full font-semibold text-base transition-colors">
              Get started
            </Link>
          </div>
        </div>

        {/* Curved Divider at the bottom */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
          <svg
            className="relative block w-full h-[100px] md:h-[150px]"
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            {/* Multiple paths to create the layered wave effect seen in the design */}
            <path
              d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V120H0Z"
              fill="#ffffff"
              opacity=".25"
            ></path>
            <path
              d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5V120H0Z"
              fill="#ffffff"
              opacity=".5"
            ></path>
            <path
              d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V120H0Z"
              fill="#ffffff"
            ></path>
          </svg>
        </div>
      </div>

      {/* Content Below Hero */}
      <div className="bg-white py-24 text-center px-4">
        <h2 className="text-3xl md:text-5xl font-medium text-gray-900 mb-6">
          The farm management software<br className="hidden md:block" /> for everything you do.
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          SSFM is the all-in-one farm management software designed to take the complexity out of running your operations.
        </p>
      </div>
    </div>
  );
}