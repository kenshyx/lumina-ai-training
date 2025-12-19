import React from 'react';
import { ProgressBarProps } from '../types';

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color = "bg-blue-500" }) => {
  // Ensure progress is between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300 ease-out`}
        style={{ width: `${clampedProgress}%`, minWidth: clampedProgress > 0 ? '2px' : '0px' }}
      />
    </div>
  );
};

