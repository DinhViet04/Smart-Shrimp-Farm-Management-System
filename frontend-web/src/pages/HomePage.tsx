import { Link } from 'react-router-dom';
import { 
  Droplets, LineChart, ArrowRight, Layers, Bot, Package, ShieldAlert, 
  CheckCircle2, Activity, TrendingUp, Cpu, Thermometer, Waves 
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="font-sans min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-200 selection:text-blue-900 overflow-hidden">
      
      {/* Dynamic Navigation */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm py-4' : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-400 rounded-xl transform rotate-3 group-hover:rotate-6 transition-transform duration-300"></div>
                  <div className="absolute inset-0 bg-white rounded-xl transform -rotate-3 group-hover:-rotate-6 transition-transform duration-300 shadow-sm"></div>
                  <Droplets className="w-6 h-6 text-blue-600 relative z-10" />
                </div>
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">SSFM</span>
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-10 items-center">
              <a href="#features" className="text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors relative group">
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
              </a>
              <a href="#modules" className="text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors relative group">
                System Modules
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
              </a>
              <a href="#about" className="text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors relative group">
                Company
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
              </a>
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/login" className="text-slate-600 hover:text-blue-600 font-semibold text-sm transition-colors">Sign In</Link>
              <Link
                to="/login"
                className="relative group px-6 py-2.5 rounded-full overflow-hidden shadow-lg shadow-blue-500/20"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 transition-transform duration-300 group-hover:scale-105"></div>
                <span className="relative text-white font-medium text-sm flex items-center gap-2">
                  Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-40 pb-20 lg:pt-48 lg:pb-32 min-h-screen flex items-center">
        {/* Advanced Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzBlYTU4MiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40"></div>
          
          {/* Glowing Orbs */}
          <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-b from-blue-50 to-cyan-50 blur-[120px] mix-blend-multiply"></div>
          <div className="absolute top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-cyan-50 to-blue-100 blur-[100px] mix-blend-multiply opacity-70"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Text */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-blue-100 text-blue-600 text-sm font-semibold mb-6 animate-fade-in-up shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
                SSFM 2.0 is now live
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 mb-6 leading-[1.1] animate-fade-in-up tracking-tight" style={{ animationDelay: '0.1s' }}>
                Precision <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500">
                  Aquaculture
                </span><br/>
                Made Simple.
              </h1>
              
              <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 mb-10 animate-fade-in-up leading-relaxed" style={{ animationDelay: '0.2s' }}>
                Centralize your shrimp farm operations. Monitor water quality in real-time, optimize feed conversion ratios, and leverage AI to predict risks before they happen.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center lg:justify-start items-center gap-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <Link to="/login" className="group relative px-8 py-4 bg-slate-900 hover:bg-slate-800 rounded-full font-semibold text-white transition-all shadow-xl hover:shadow-slate-900/20 hover:-translate-y-1 flex items-center gap-2 w-full sm:w-auto justify-center">
                  Start Managing Now <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button className="px-8 py-4 rounded-full font-semibold text-slate-700 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center group">
                  <Activity className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" /> Watch Demo
                </button>
              </div>
              
              {/* Trust Indicators */}
              <div className="mt-12 pt-8 border-t border-slate-200/60 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <p className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Trusted by modern farms</p>
                <div className="flex justify-center lg:justify-start gap-8 opacity-60 grayscale">
                  <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><Waves className="w-6 h-6"/> AquaCorp</div>
                  <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><LineChart className="w-6 h-6"/> YieldPro</div>
                </div>
              </div>
            </div>

            {/* Right Column: Floating UI Elements */}
            <div className="relative hidden lg:block h-[600px] animate-fade-in-left" style={{ animationDelay: '0.2s' }}>
              {/* Main Dashboard Card */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-2xl shadow-2xl shadow-blue-900/10 border border-slate-100 p-6 z-20 animate-float">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Pond Alpha - Quality</h3>
                    <p className="text-xs text-slate-400">Live Monitoring</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Optimal
                  </span>
                </div>
                
                {/* Chart Mockup */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500 font-medium flex items-center gap-1"><Thermometer className="w-4 h-4"/> Temperature</span>
                      <span className="font-bold text-slate-700">28.5°C</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full w-[70%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500 font-medium flex items-center gap-1"><Droplets className="w-4 h-4"/> Dissolved Oxygen (DO)</span>
                      <span className="font-bold text-slate-700">6.2 mg/L</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-gradient-to-r from-cyan-400 to-cyan-500 h-2 rounded-full w-[85%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500 font-medium flex items-center gap-1"><Activity className="w-4 h-4"/> pH Level</span>
                      <span className="font-bold text-slate-700">7.8</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-2 rounded-full w-[60%]"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Alert Card */}
              <div className="absolute top-[15%] right-[-5%] w-[240px] bg-white rounded-xl shadow-xl shadow-amber-900/5 border border-slate-100 p-4 z-30 animate-float" style={{ animationDelay: '1.5s' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 flex-shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">AI Warning</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Slight NH3 increase detected in Pond Beta.</p>
                  </div>
                </div>
              </div>

              {/* Floating Stat Card */}
              <div className="absolute bottom-[20%] left-[-10%] w-[220px] bg-white rounded-xl shadow-xl shadow-blue-900/5 border border-slate-100 p-4 z-30 animate-float" style={{ animationDelay: '3s' }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-600">Avg. FCR</h4>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-slate-800">1.24</span>
                  <span className="text-xs font-semibold text-emerald-500 mb-1 flex items-center">-0.05 <TrendingUp className="w-3 h-3 ml-0.5"/></span>
                </div>
              </div>
              
              {/* Decorative Circles */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-slate-200/50 rounded-full z-10"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-blue-200/60 rounded-full z-10 border-dashed animate-[spin_60s_linear_infinite]"></div>
            </div>

          </div>
        </div>
      </div>

      {/* Modules Section */}
      <div id="modules" className="py-32 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-3">Core Infrastructure</h2>
            <h3 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Everything you need to scale</h3>
            <p className="text-lg text-slate-600">
              A comprehensive suite of tools designed specifically for modern aquaculture operations, transforming data into actionable insights.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Cards mapped individually to ensure Tailwind reads classes correctly */}
            {[
              {
                icon: <Layers className="w-7 h-7" />,
                title: "Farm & Pond Management",
                desc: "Centralized management for multi-pond operations. Assign crops, track daily activities, and digitize your entire workflow.",
                bgClass: "bg-blue-50",
                textClass: "text-blue-600",
                borderClass: "border-blue-100/50",
                gradientClass: "from-blue-50"
              },
              {
                icon: <Droplets className="w-7 h-7" />,
                title: "Water Quality Monitoring",
                desc: "Track critical environmental parameters like pH, salinity, DO, and temperature to ensure a stable farming environment.",
                bgClass: "bg-cyan-50",
                textClass: "text-cyan-600",
                borderClass: "border-cyan-100/50",
                gradientClass: "from-cyan-50"
              },
              {
                icon: <Package className="w-7 h-7" />,
                title: "Inventory & Feed",
                desc: "Optimize resource utilization by tracking feed consumption, managing inventory, and preventing stock accumulation.",
                bgClass: "bg-sky-50",
                textClass: "text-sky-600",
                borderClass: "border-sky-100/50",
                gradientClass: "from-sky-50"
              },
              {
                icon: <LineChart className="w-7 h-7" />,
                title: "Care & Analytics",
                desc: "Calculate survival rates, estimate biomass, evaluate FCR, and deeply analyze shrimp growth performance.",
                bgClass: "bg-emerald-50",
                textClass: "text-emerald-600",
                borderClass: "border-emerald-100/50",
                gradientClass: "from-emerald-50"
              },
              {
                icon: <ShieldAlert className="w-7 h-7" />,
                title: "Smart Warning System",
                desc: "Detect environmental risks and receive early warning notifications when abnormal situations occur to protect crops.",
                bgClass: "bg-amber-50",
                textClass: "text-amber-600",
                borderClass: "border-amber-100/50",
                gradientClass: "from-amber-50"
              },
              {
                icon: <Bot className="w-7 h-7" />,
                title: "AI Analysis & Chatbot",
                desc: "Leverage AI for water quality assessment, and use the RAG Chatbot for instant shrimp farming knowledge retrieval.",
                bgClass: "bg-indigo-50",
                textClass: "text-indigo-600",
                borderClass: "border-indigo-100/50",
                gradientClass: "from-indigo-50"
              }
            ].map((module, index) => (
              <div 
                key={index} 
                className="group relative bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-500 hover:-translate-y-2 overflow-hidden"
              >
                {/* Hover Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${module.gradientClass} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                
                <div className="relative z-10">
                  <div className={`w-16 h-16 ${module.bgClass} ${module.textClass} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm border ${module.borderClass}`}>
                    {module.icon}
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors">{module.title}</h4>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    {module.desc}
                  </p>
                  
                  <div className={`inline-flex items-center text-sm font-semibold ${module.textClass} group-hover:translate-x-2 transition-transform duration-300 cursor-pointer`}>
                    Explore module <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modern CTA Section */}
      <div className="relative py-32 bg-slate-900 overflow-hidden">
        {/* Abstract Backgrounds */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1582967788606-a171c1080cb0?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/90 to-slate-900/50"></div>
        
        {/* Glows */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-blue-600/30 blur-[120px] rounded-full rotate-45 pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <Cpu className="w-12 h-12 text-cyan-400 mx-auto mb-6 animate-pulse" />
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Ready to upgrade your farm?
          </h2>
          <p className="text-xl text-blue-100/80 mb-10 max-w-2xl mx-auto font-light">
            Join the digital transformation. Optimize yields, reduce risks, and manage your aquaculture business with data-driven precision.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/register" className="px-8 py-4 text-lg font-bold text-slate-900 bg-white rounded-full hover:bg-cyan-50 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:scale-105 flex items-center justify-center">
              Create Free Account
            </Link>
            <button className="px-8 py-4 text-lg font-bold text-white bg-white/10 border border-white/20 rounded-full hover:bg-white/20 transition-all backdrop-blur-md flex items-center justify-center">
              Contact Sales
            </button>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-slate-950 py-16 border-t border-slate-900/50 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white">
                  <Droplets className="w-5 h-5" />
                </div>
                <span className="text-2xl font-bold text-white tracking-tight">SSFM</span>
              </div>
              <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                Empowering aquaculture farmers with modern management tools, AI insights, and real-time environmental monitoring.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li><a href="#" className="hover:text-blue-400 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Case Studies</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li><a href="#" className="hover:text-blue-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} Smart Shrimp Farm Management. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}