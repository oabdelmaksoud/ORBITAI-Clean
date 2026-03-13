import React from 'react';
import { Home, LayoutGrid, Settings, User } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate
}) => {
  const navItems = [
    { id: 'workspace', label: 'Workspace', icon: LayoutGrid },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40 safe-area-inset-bottom"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full touch-manipulation transition-colors ${isActive ? 'text-primary' : 'text-slate-500'
                }`}
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};






