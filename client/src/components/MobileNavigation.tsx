import React, { useState } from 'react';
import { Menu, X, Home, LayoutGrid, Settings, LogOut, User } from 'lucide-react';

interface MobileNavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout?: () => void;
  user?: { name: string; email: string; avatar?: string } | null;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  currentView,
  onNavigate,
  onLogout,
  user
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const navigationItems = [
    { id: 'workspace', label: 'Workspace', icon: LayoutGrid },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white rounded-lg shadow-lg border border-slate-200 touch-manipulation"
        style={{ minWidth: '44px', minHeight: '44px' }}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="lg:hidden fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out"
            style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800">Menu</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 -mr-2 touch-manipulation"
                    style={{ minWidth: '44px', minHeight: '44px' }}
                    aria-label="Close menu"
                  >
                    <X size={20} />
                  </button>
                </div>
                {user && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Items */}
              <div className="flex-1 overflow-y-auto py-4">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors touch-manipulation ${isActive
                          ? 'bg-primary/10 text-primary border-l-4 border-primary'
                          : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      style={{ minHeight: '44px' }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              {onLogout && (
                <div className="p-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      onLogout();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-4 text-left text-red-600 hover:bg-red-50 transition-colors touch-manipulation"
                    style={{ minHeight: '44px' }}
                  >
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
};






