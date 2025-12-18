import React from 'react';
import { NavItemProps } from '../types';

export const NavItem: React.FC<NavItemProps> = ({ id, icon: Icon, label, activeTab, setActiveTab }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300 cursor-pointer group ${
          isActive
            ? 'text-blue-400'
            : 'text-white/30 hover:text-white/60 hover:bg-white/5 active:scale-90 active:bg-white/10'
        }`}
      >
          <Icon
            size={24}
            className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : ''}`}
          />
          <span className={`text-[9px] font-bold uppercase tracking-[0.15em] transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 scale-90 group-hover:opacity-40 group-hover:scale-100'}`}>
        {label}
      </span>
          {isActive && (
            <div className="absolute -top-1 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,1)] animate-pulse" />
          )}
      </button>
    );
};

