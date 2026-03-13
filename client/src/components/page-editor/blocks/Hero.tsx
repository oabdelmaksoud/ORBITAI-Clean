import React from 'react';
import { useNode } from '@craftjs/core';
import { Button } from './Button';

interface HeroProps {
  title?: string;
  subtitle?: string;
  description?: string;
  backgroundImage?: string;
  ctaText?: string;
  ctaLink?: string;
  alignment?: 'left' | 'center' | 'right';
}

export function Hero({
  title = 'Hero Title',
  subtitle = 'Hero subtitle',
  description = 'Hero description',
  backgroundImage = '',
  ctaText = 'Get Started',
  ctaLink = '#',
  alignment = 'center'
}: HeroProps) {
  const { connectors: { connect, drag }, isActive, isHovered } = useNode((state) => ({
    isActive: state.events.selected,
    isHovered: state.events.hovered
  }));

  const alignmentMap = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end'
  };

  return (
    <section
      ref={(ref) => connect(drag(ref))}
      className={`
        relative py-20 px-4
        ${isActive ? 'ring-2 ring-blue-500' : ''}
        ${isHovered ? 'ring-1 ring-slate-300' : ''}
        transition-all
      `}
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {backgroundImage && (
        <div className="absolute inset-0 bg-black/40" />
      )}
      <div className={`relative max-w-4xl mx-auto flex flex-col gap-4 ${alignmentMap[alignment]}`}>
        {subtitle && (
          <p className="text-lg text-white/90 font-medium">{subtitle}</p>
        )}
        <h1 className="text-4xl md:text-5xl font-bold text-white">{title}</h1>
        {description && (
          <p className="text-xl text-white/90 max-w-2xl">{description}</p>
        )}
        {ctaText && (
          <div className="mt-4">
            <a
              href={ctaLink}
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              onClick={(e) => {
                if (ctaLink === '#') {
                  e.preventDefault();
                }
              }}
            >
              {ctaText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

Hero.craft = {
  displayName: 'Hero',
  props: {
    title: 'Hero Title',
    subtitle: 'Hero subtitle',
    description: 'Hero description',
    backgroundImage: '',
    ctaText: 'Get Started',
    ctaLink: '#',
    alignment: 'center'
  }
};




