import React from 'react';
import { ProgressBarProps } from '../types';

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color = "bg-blue-500" }) => (
  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-700 ease-out`}
        style={{ width: `${progress}%` }}
      />
  </div>
);

