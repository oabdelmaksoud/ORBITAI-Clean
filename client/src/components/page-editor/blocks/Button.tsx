import React from 'react';
import { useNode } from '@craftjs/core';

interface ButtonProps {
  text?: string;
  link?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
}

export function Button({ text = 'Click me', link = '#', variant = 'primary', size = 'medium' }: ButtonProps) {
  const { connectors: { connect, drag }, isActive, isHovered } = useNode((state) => ({
    isActive: state.events.selected,
    isHovered: state.events.hovered
  }));

  const variantMap = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-600 hover:bg-slate-700 text-white',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
    ghost: 'text-blue-600 hover:bg-blue-50'
  };

  const sizeMap = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  };

  return (
    <a
      href={link}
      ref={(ref) => connect(drag(ref))}
      className={`
        inline-block rounded-lg font-medium transition-colors
        ${variantMap[variant]}
        ${sizeMap[size]}
        ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        ${isHovered ? 'ring-1 ring-slate-300' : ''}
      `}
      onClick={(e) => {
        if (link === '#') {
          e.preventDefault();
        }
      }}
    >
      {text}
    </a>
  );
}

Button.craft = {
  displayName: 'Button',
  props: {
    text: 'Click me',
    link: '#',
    variant: 'primary',
    size: 'medium'
  }
};




