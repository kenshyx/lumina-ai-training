import React from 'react';
import { Activity, Database, Settings, Search } from 'lucide-react';
import { TabType } from '../types';
import { GlassCard } from './GlassCard';
import { NavItem } from './NavItem';

interface NavigationProps {
    activeTab: TabType;
    setActiveTab: (id: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => (
  <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg">
      <GlassCard className="flex items-center justify-around p-2 !rounded-[2.5rem] border-white/5 shadow-2xl">
          <NavItem id="dashboard" icon={Activity} label="Dash" activeTab={activeTab} setActiveTab={setActiveTab} />
          <NavItem id="data" icon={Database} label="Data" activeTab={activeTab} setActiveTab={setActiveTab} />
          <NavItem id="rag" icon={Search} label="Search" activeTab={activeTab} setActiveTab={setActiveTab} />
          <NavItem id="settings" icon={Settings} label="Setup" activeTab={activeTab} setActiveTab={setActiveTab} />
      </GlassCard>
  </nav>
);

