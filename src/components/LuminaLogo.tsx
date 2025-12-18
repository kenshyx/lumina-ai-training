import React from 'react';

interface LuminaLogoProps {
    className?: string;
}

export const LuminaLogo: React.FC<LuminaLogoProps> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
              </feMerge>
          </filter>
      </defs>
      <path
        d="M50 5 L85 25 V75 L50 95 L15 75 V25 L50 5Z"
        stroke="url(#logo-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-40"
      />
      <path d="M50 5 V35 M85 25 L50 35 M15 25 L50 35" stroke="white" strokeWidth="1" className="opacity-20" />
      <circle cx="50" cy="55" r="12" fill="url(#logo-grad)" filter="url(#glow)" />
      <circle cx="50" cy="55" r="4" fill="white" className="animate-pulse" />
  </svg>
);

