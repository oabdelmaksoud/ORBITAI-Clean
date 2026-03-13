'use client';

import React, { useState, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Sun,
  Moon,
  Globe,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';

export interface Schedule {
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  startHour: number;
  endHour: number;
  timezone: string;
}

interface RoutingScheduleProps {
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern (US)' },
  { value: 'America/Chicago', label: 'Central (US)' },
  { value: 'America/Denver', label: 'Mountain (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

const PRESETS = [
  { name: 'Business Hours', days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
  { name: 'Weekdays', days: [1, 2, 3, 4, 5], startHour: 0, endHour: 24 },
  { name: 'Weekends', days: [0, 6], startHour: 0, endHour: 24 },
  { name: 'Night Shift', days: [0, 1, 2, 3, 4, 5, 6], startHour: 22, endHour: 6 },
  { name: 'Always', days: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 },
];

export default function RoutingSchedule({
  schedule,
  onChange,
  disabled = false,
  label = 'Schedule',
  description,
}: RoutingScheduleProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);

  const toggleDay = (day: number) => {
    if (disabled) return;
    
    const newDays = schedule.daysOfWeek.includes(day)
      ? schedule.daysOfWeek.filter(d => d !== day)
      : [...schedule.daysOfWeek, day].sort();
    
    onChange({ ...schedule, daysOfWeek: newDays });
  };

  const selectAllDays = () => {
    if (disabled) return;
    onChange({ ...schedule, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  };

  const clearAllDays = () => {
    if (disabled) return;
    onChange({ ...schedule, daysOfWeek: [] });
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    if (disabled) return;
    onChange({
      ...schedule,
      daysOfWeek: preset.days,
      startHour: preset.startHour,
      endHour: preset.endHour,
    });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 24) return '12 AM';
    return `${hour - 12} PM`;
  };

  const getTimeRangeLabel = () => {
    if (schedule.startHour === 0 && schedule.endHour === 24) {
      return 'All day';
    }
    return `${formatHour(schedule.startHour)} - ${formatHour(schedule.endHour)}`;
  };

  const isOvernight = schedule.startHour > schedule.endHour && schedule.endHour !== 24;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">{label}</h3>
        </div>
        {schedule.daysOfWeek.length > 0 && (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
            Active
          </span>
        )}
      </div>

      {description && (
        <p className="text-sm text-slate-500">{description}</p>
      )}

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => applyPreset(preset)}
            disabled={disabled}
            className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Day selector */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-700">Days</span>
          <div className="flex gap-2">
            <button
              onClick={selectAllDays}
              disabled={disabled}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={clearAllDays}
              disabled={disabled}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((day, idx) => {
            const isSelected = schedule.daysOfWeek.includes(idx);
            return (
              <button
                key={day}
                onClick={() => toggleDay(idx)}
                disabled={disabled}
                className={`
                  flex flex-col items-center justify-center p-3 rounded-lg font-medium transition-all
                  ${isSelected
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span className="text-xs">{day}</span>
                {isSelected && <Check className="w-3 h-3 mt-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time range */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-700">Time Range</span>
          <span className="text-sm text-slate-500">{getTimeRangeLabel()}</span>
        </div>

        {isOvernight && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-yellow-50 rounded-lg">
            <Moon className="w-4 h-4 text-yellow-600" />
            <span className="text-xs text-yellow-700">Overnight schedule (spans midnight)</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1 text-xs text-slate-500 mb-1">
              <Sun className="w-3 h-3" />
              Start Time
            </label>
            <select
              value={schedule.startHour}
              onChange={(e) => onChange({ ...schedule, startHour: parseInt(e.target.value) })}
              disabled={disabled}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{formatHour(i)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs text-slate-500 mb-1">
              <Moon className="w-3 h-3" />
              End Time
            </label>
            <select
              value={schedule.endHour}
              onChange={(e) => onChange({ ...schedule, endHour: parseInt(e.target.value) })}
              disabled={disabled}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 25 }, (_, i) => (
                <option key={i} value={i}>{i === 24 ? '12 AM (next day)' : formatHour(i)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual time bar */}
        <div className="mt-4">
          <div className="relative h-8 bg-slate-200 rounded-full overflow-hidden">
            {/* Active time range */}
            {schedule.startHour < schedule.endHour ? (
              <div
                className="absolute h-full bg-blue-500"
                style={{
                  left: `${(schedule.startHour / 24) * 100}%`,
                  width: `${((schedule.endHour - schedule.startHour) / 24) * 100}%`,
                }}
              />
            ) : schedule.startHour > schedule.endHour ? (
              <>
                <div
                  className="absolute h-full bg-blue-500"
                  style={{
                    left: `${(schedule.startHour / 24) * 100}%`,
                    width: `${((24 - schedule.startHour) / 24) * 100}%`,
                  }}
                />
                <div
                  className="absolute h-full bg-blue-500"
                  style={{
                    left: '0%',
                    width: `${(schedule.endHour / 24) * 100}%`,
                  }}
                />
              </>
            ) : null}

            {/* Hour markers */}
            {[0, 6, 12, 18, 24].map(hour => (
              <div
                key={hour}
                className="absolute top-0 bottom-0 w-px bg-slate-300"
                style={{ left: `${(hour / 24) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>12 AM</span>
          </div>
        </div>
      </div>

      {/* Timezone */}
      <div className="bg-slate-50 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
          <Globe className="w-4 h-4" />
          Timezone
        </label>
        <select
          value={schedule.timezone}
          onChange={(e) => onChange({ ...schedule, timezone: e.target.value })}
          disabled={disabled}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Schedule Summary</h4>
        {schedule.daysOfWeek.length === 0 ? (
          <p className="text-sm text-blue-600">No days selected - rule will never be active</p>
        ) : (
          <p className="text-sm text-blue-600">
            Active on{' '}
            <span className="font-medium">
              {schedule.daysOfWeek.length === 7
                ? 'every day'
                : schedule.daysOfWeek.map(d => FULL_DAYS[d]).join(', ')}
            </span>
            {' '}from{' '}
            <span className="font-medium">{formatHour(schedule.startHour)}</span>
            {' '}to{' '}
            <span className="font-medium">
              {schedule.endHour === 24 ? '12 AM (next day)' : formatHour(schedule.endHour)}
            </span>
            {' '}({schedule.timezone})
          </p>
        )}
      </div>
    </div>
  );
}

