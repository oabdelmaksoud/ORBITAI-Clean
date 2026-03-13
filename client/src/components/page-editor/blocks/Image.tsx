import React from 'react';
import { useNode } from '@craftjs/core';

interface ImageProps {
  src?: string;
  alt?: string;
  width?: string;
  height?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

export function Image({ src = '', alt = '', width = '100%', height = 'auto', objectFit = 'cover' }: ImageProps) {
  const { connectors: { connect, drag }, isActive, isHovered } = useNode((state) => ({
    isActive: state.events.selected,
    isHovered: state.events.hovered
  }));

  if (!src) {
    return (
      <div
        ref={(ref) => connect(drag(ref))}
        className={`
          flex items-center justify-center
          bg-slate-100 border-2 border-dashed border-slate-300
          ${isActive ? 'ring-2 ring-blue-500' : ''}
          ${isHovered ? 'ring-1 ring-slate-300' : ''}
          transition-all
          min-h-[200px]
        `}
        style={{ width, height }}
      >
        <span className="text-slate-400 text-sm">No image selected</span>
      </div>
    );
  }

  return (
    <img
      ref={(ref) => connect(drag(ref))}
      src={src}
      alt={alt}
      className={`
        ${isActive ? 'ring-2 ring-blue-500' : ''}
        ${isHovered ? 'ring-1 ring-slate-300' : ''}
        transition-all
      `}
      style={{ width, height, objectFit }}
    />
  );
}

Image.craft = {
  displayName: 'Image',
  props: {
    src: '',
    alt: '',
    width: '100%',
    height: 'auto',
    objectFit: 'cover'
  }
};




