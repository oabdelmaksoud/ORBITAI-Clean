import React from 'react';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { usePageBuilder } from '@src/contexts/PageBuilderContext';

export function DevicePreview() {
  const { previewMode, setPreviewMode } = usePageBuilder();

  const devices: Array<{ mode: 'desktop' | 'tablet' | 'mobile'; icon: typeof Monitor; label: string }> = [
    { mode: 'desktop', icon: Monitor, label: 'Desktop' },
    { mode: 'tablet', icon: Tablet, label: 'Tablet' },
    { mode: 'mobile', icon: Smartphone, label: 'Mobile' }
  ];

  const getPreviewWidth = () => {
    switch (previewMode) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      case 'desktop':
      default:
        return '100%';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-2 p-2 bg-slate-100 border-b border-slate-200">
        {devices.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => setPreviewMode(mode)}
            className={`p-2 rounded-lg transition-colors ${
              previewMode === mode
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title={label}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <div
        className="flex-1 overflow-auto bg-slate-200"
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: previewMode !== 'desktop' ? '20px' : '0'
        }}
      >
        <div
          className="bg-white shadow-lg"
          style={{
            width: getPreviewWidth(),
            minHeight: '100%',
            transition: 'width 0.3s ease'
          }}
        >
          {/* Preview content will be rendered here */}
        </div>
      </div>
    </div>
  );
}




