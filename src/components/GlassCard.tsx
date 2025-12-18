import React from 'react';
import { GlassCardProps } from '../types';

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "" }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl transition-all duration-300 ${className}`}>
      {children}
  </div>
);

