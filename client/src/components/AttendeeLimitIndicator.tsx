import React from 'react';
import { Users, Crown, AlertCircle } from 'lucide-react';

interface AttendeeLimitIndicatorProps {
  currentCount: number;
  maxCount?: number | null; // null = unlimited
  onUpgrade?: () => void;
}

const AttendeeLimitIndicator: React.FC<AttendeeLimitIndicatorProps> = ({
  currentCount,
  maxCount,
  onUpgrade
}) => {
  if (maxCount === null || maxCount === undefined) {
    // Unlimited
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Users className="w-4 h-4" />
        <span>{currentCount} attendees</span>
        <span className="text-xs text-green-600">(Unlimited)</span>
      </div>
    );
  }

  const percentage = (currentCount / maxCount) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = currentCount >= maxCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Users className={`w-4 h-4 ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-orange-500' : 'text-gray-500'}`} />
          <span className={isAtLimit ? 'text-red-600 font-medium' : ''}>
            {currentCount} / {maxCount} attendees
          </span>
        </div>
        {isAtLimit && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded hover:from-purple-600 hover:to-blue-600 transition-colors"
          >
            <Crown className="w-3 h-3" />
            Upgrade
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            isAtLimit
              ? 'bg-red-500'
              : isNearLimit
              ? 'bg-orange-500'
              : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Warning Messages */}
      {isAtLimit && (
        <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Attendee limit reached</p>
            <p>Upgrade your plan to allow more participants in brainstorming sessions.</p>
          </div>
        </div>
      )}

      {isNearLimit && !isAtLimit && (
        <div className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Approaching attendee limit</p>
            <p>{maxCount - currentCount} spots remaining.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendeeLimitIndicator;

