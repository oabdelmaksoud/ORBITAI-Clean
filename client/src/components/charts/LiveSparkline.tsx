/**
 * Live Sparkline Chart Component
 * Small SVG-based sparkline for showing trends over time
 */

import React from 'react';

interface LiveSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showArea?: boolean;
}

export const LiveSparkline: React.FC<LiveSparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color = '#3b82f6',
  strokeWidth = 2,
  showArea = false
}) => {
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} className="text-slate-300">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = [
    `${padding},${height - padding}`,
    ...points.split(' '),
    `${width - padding},${height - padding}`
  ].join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      {showArea && (
        <polygon
          points={areaPoints}
          fill={color}
          fillOpacity="0.1"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};




