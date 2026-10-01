import React from 'react';

type Props = {
  src: string;
  className?: string;
};

export default function AnimatedImageBg({ src, className = '' }: Props) {
  return (
    <div className={`overflow-hidden relative ${className}`}>
      <style>
        {`
          @keyframes cinematicMotion {
            0% {
              transform: scale(1.15) translate3d(0%, 0%, 0);
            }
            25% {
              transform: scale(1.35) translate3d(-6%, -3%, 0);
            }
            50% {
              transform: scale(1.5) translate3d(5%, -4%, 0);
            }
            75% {
              transform: scale(1.35) translate3d(6%, 4%, 0);
            }
            100% {
              transform: scale(1.15) translate3d(0%, 0%, 0);
            }
          }
          .cinematic-bg-img {
            animation: cinematicMotion 45s ease-in-out infinite;
            will-change: transform;
          }
        `}
      </style>
      <img
        src={src}
        alt="Background"
        className="cinematic-bg-img absolute inset-0 w-full h-full object-cover"
        style={{ transformOrigin: 'center center' }}
      />
    </div>
  );
}
