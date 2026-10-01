
const statsData = [
  { value: '+35%', label: 'Tối ưu chi phí thức\năn & điện' },
  { value: '99.8%', label: 'Độ chính xác cảnh\nbáo AI' },
  { value: '500+', label: 'Hộ nuôi công nghệ\ncao tin dùng' }
];

export default function StatsMarquee() {
  return (
    <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)] py-3">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12)_0%,transparent_75%)] pointer-events-none"></div>
      <style>
        {`
          @keyframes horizontalMarquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-horizontal-marquee {
            animation: horizontalMarquee 25s linear infinite;
            will-change: transform;
          }
          .animate-horizontal-marquee:hover {
            animation-play-state: paused;
          }
        `}
      </style>
      <div className="flex w-max animate-horizontal-marquee gap-4 md:gap-6 py-2">
        {[1, 2, 3, 4].map((set) => (
          <div key={set} className="flex gap-4 md:gap-6 shrink-0 w-max">
            {statsData.map((stat, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 w-[300px] flex items-center justify-center gap-4 shadow-xl shadow-cyan-900/10 hover:bg-white/20 transition-colors">
                <span className="text-2xl font-black text-cyan-300 drop-shadow-md">{stat.value}</span>
                <span className="text-xs text-left text-white font-medium leading-tight whitespace-pre-line">{stat.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
