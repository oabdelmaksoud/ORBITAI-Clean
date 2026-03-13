import React from 'react';
import { useNode } from '@craftjs/core';

interface TextProps {
  content?: string;
  fontSize?: 'small' | 'medium' | 'large' | 'xl' | '2xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
}

export function Text({ content = 'Enter text here', fontSize = 'medium', fontWeight = 'normal', textAlign = 'left', color }: TextProps) {
  const { connectors: { connect, drag }, isActive, isHovered } = useNode((state) => ({
    isActive: state.events.selected,
    isHovered: state.events.hovered
  }));

  const fontSizeMap = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl'
  };

  const fontWeightMap = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  };

  const textAlignMap = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  };

  return (
    <p
      ref={(ref) => connect(drag(ref))}
      className={`
        ${fontSizeMap[fontSize]}
        ${fontWeightMap[fontWeight]}
        ${textAlignMap[textAlign]}
        ${isActive ? 'ring-2 ring-blue-500' : ''}
        ${isHovered ? 'ring-1 ring-slate-300' : ''}
        transition-all
        min-h-[1.5em]
      `}
      style={{ color }}
    >
      {content}
    </p>
  );
}

Text.craft = {
  displayName: 'Text',
  props: {
    content: 'Enter text here',
    fontSize: 'medium',
    fontWeight: 'normal',
    textAlign: 'left',
    color: 'inherit'
  }
};




