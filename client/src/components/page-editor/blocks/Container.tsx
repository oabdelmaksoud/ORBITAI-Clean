import React from 'react';
import { useNode } from '@craftjs/core';

interface ContainerProps {
  padding?: 'none' | 'small' | 'medium' | 'large' | 'xl';
  backgroundColor?: string;
  maxWidth?: 'full' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  display?: 'block' | 'flex' | 'grid';
  children?: React.ReactNode;
}

export function Container({ padding = 'medium', backgroundColor = 'transparent', maxWidth = 'full', display = 'block', children }: ContainerProps) {
  const { connectors: { connect, drag }, isActive, isHovered } = useNode((state) => ({
    isActive: state.events.selected,
    isHovered: state.events.hovered
  }));

  const paddingMap = {
    none: 'p-0',
    small: 'p-2',
    medium: 'p-4',
    large: 'p-6',
    xl: 'p-8'
  };

  const maxWidthMap = {
    full: 'max-w-full',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <div
      ref={(ref) => connect(drag(ref))}
      className={`
        ${paddingMap[padding]}
        ${maxWidthMap[maxWidth]}
        ${display === 'flex' ? 'flex' : display === 'grid' ? 'grid' : 'block'}
        ${isActive ? 'ring-2 ring-blue-500' : ''}
        ${isHovered ? 'ring-1 ring-slate-300' : ''}
        transition-all
      `}
      style={{ backgroundColor }}
    >
      {children}
    </div>
  );
}

Container.craft = {
  displayName: 'Container',
  props: {
    padding: 'medium',
    backgroundColor: 'transparent',
    maxWidth: 'full',
    display: 'block'
  },
  rules: {
    canMoveIn: () => true,
    canMoveOut: () => true
  }
};




