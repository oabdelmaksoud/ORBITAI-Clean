/**
 * Stacked Bar Chart Component
 * SVG-based stacked bar chart for comparing multiple series
 */

import React from 'react';

export interface StackedBarSeries {
  label: string;
  value: number;
  color: string;
}

interface StackedBarProps {
  data: StackedBarSeries[];
  width?: number;
  height?: number;
  maxValue?: number;
  showLabels?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export const StackedBar: React.FC<StackedBarProps> = ({
  data,
  width = 300,
  height = 200,
  maxValue,
  showLabels = true,
  orientation = 'vertical'
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        No data available
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const max = maxValue || Math.max(...data.map(d => d.value), total);
  const barHeight = orientation === 'vertical' ? height / data.length - 4 : height;
  const barWidth = orientation === 'vertical' ? width - 80 : width;

  if (orientation === 'horizontal') {
    return (
      <div className="space-y-2">
        {data.map((item, index) => {
          const percentage = max > 0 ? (item.value / max) * 100 : 0;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className="w-24 text-xs font-medium text-slate-700 truncate">
                {item.label}
              </div>
              <div className="flex-1 relative">
                <div className="h-6 bg-slate-200 rounded overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
                {showLabels && (
                  <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-slate-800">
                    {item.value.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      {data.map((item, index) => {
        const percentage = max > 0 ? (item.value / max) * 100 : 0;
        const y = index * (height / data.length);
        const barHeight = height / data.length - 4;
        const barWidth = (percentage / 100) * (width - 80);

        return (
          <g key={index}>
            <rect
              x={0}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={item.color}
              rx={4}
              className="transition-all duration-300"
            />
            {showLabels && (
              <>
                <text
                  x={barWidth + 8}
                  y={y + barHeight / 2}
                  dominantBaseline="middle"
                  className="text-xs font-medium fill-slate-700"
                >
                  {item.label}
                </text>
                <text
                  x={barWidth + 8}
                  y={y + barHeight / 2 + 12}
                  dominantBaseline="middle"
                  className="text-xs fill-slate-500"
                >
                  {item.value.toLocaleString()}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
};




