import React from 'react';
import { useNode } from '@craftjs/core';

interface HeadingProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  content?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
}

export function Heading({ level = 1, content = 'Heading', textAlign = 'left', color }: HeadingProps) {
  const { connectors: { connect, drag }, isActive, isHovered } = useNode((state) => ({
    isActive: state.events.selected,
    isHovered: state.events.hovered
  }));

  const textAlignMap = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <Tag
      ref={(ref) => connect(drag(ref))}
      className={`
        ${textAlignMap[textAlign]}
        ${isActive ? 'ring-2 ring-blue-500' : ''}
        ${isHovered ? 'ring-1 ring-slate-300' : ''}
        transition-all
      `}
      style={{ color }}
    >
      {content}
    </Tag>
  );
}

Heading.craft = {
  displayName: 'Heading',
  props: {
    level: 1,
    content: 'Heading',
    textAlign: 'left',
    color: 'inherit'
  }
};




