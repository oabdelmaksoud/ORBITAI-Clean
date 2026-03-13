import React, { useState, useEffect } from 'react';
import { Timer, Users, Vote, Settings, Play, Pause, RotateCcw, CheckSquare } from 'lucide-react';

interface FacilitatorToolboxProps {
  roomId: string;
  facilitatorTools?: {
    timerActive?: boolean;
    timerDuration?: number;
    timerStartedAt?: Date;
    votingEnabled?: boolean;
    maxVotesPerUser?: number;
  };
  onUpdateTools?: (tools: any) => void;
  isFacilitator?: boolean;
}

const FacilitatorToolbox: React.FC<FacilitatorToolboxProps> = ({
  roomId,
  facilitatorTools,
  onUpdateTools,
  isFacilitator = false
}) => {
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [votingEnabled, setVotingEnabled] = useState(facilitatorTools?.votingEnabled || false);

  useEffect(() => {
    if (facilitatorTools?.timerActive && facilitatorTools?.timerStartedAt) {
      const startTime = new Date(facilitatorTools.timerStartedAt).getTime();
      const duration = facilitatorTools.timerDuration || 0;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimerSeconds(remaining);
      setIsTimerRunning(true);
    } else if (facilitatorTools?.timerDuration) {
      setTimerSeconds(facilitatorTools.timerDuration);
    }
  }, [facilitatorTools]);

  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      const interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (onUpdateTools) {
              onUpdateTools({
                ...facilitatorTools,
                timerActive: false
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isTimerRunning, timerSeconds]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = (duration: number) => {
    if (!isFacilitator) return;
    
    setTimerSeconds(duration);
    setIsTimerRunning(true);
    
    if (onUpdateTools) {
      onUpdateTools({
        ...facilitatorTools,
        timerActive: true,
        timerDuration: duration,
        timerStartedAt: new Date()
      });
    }
  };

  const handlePauseTimer = () => {
    if (!isFacilitator) return;
    setIsTimerRunning(false);
    if (onUpdateTools) {
      onUpdateTools({
        ...facilitatorTools,
        timerActive: false
      });
    }
  };

  const handleResetTimer = () => {
    if (!isFacilitator) return;
    setIsTimerRunning(false);
    setTimerSeconds(0);
    if (onUpdateTools) {
      onUpdateTools({
        ...facilitatorTools,
        timerActive: false,
        timerDuration: 0
      });
    }
  };

  const handleToggleVoting = () => {
    if (!isFacilitator) return;
    const newState = !votingEnabled;
    setVotingEnabled(newState);
    if (onUpdateTools) {
      onUpdateTools({
        ...facilitatorTools,
        votingEnabled: newState
      });
    }
  };

  if (!isFacilitator) {
    // View-only mode for non-facilitators
    return (
      <div className="bg-white border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Session Tools</h3>
        </div>
        
        {facilitatorTools?.timerActive && (
          <div className="flex items-center gap-2 text-sm">
            <Timer className="w-4 h-4 text-orange-500" />
            <span className="font-mono">{formatTime(timerSeconds)}</span>
          </div>
        )}
        
        {votingEnabled && (
          <div className="flex items-center gap-2 text-sm mt-2">
            <Vote className="w-4 h-4 text-green-500" />
            <span>Voting enabled</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Facilitator Tools
        </h3>
      </div>

      {/* Timer */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Session Timer
          </label>
          {isTimerRunning && (
            <span className="font-mono text-lg font-semibold text-orange-500">
              {formatTime(timerSeconds)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isTimerRunning ? (
            <>
              <button
                onClick={() => handleStartTimer(5 * 60)}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors"
              >
                5 min
              </button>
              <button
                onClick={() => handleStartTimer(10 * 60)}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors"
              >
                10 min
              </button>
              <button
                onClick={() => handleStartTimer(15 * 60)}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors"
              >
                15 min
              </button>
              <button
                onClick={() => handleStartTimer(30 * 60)}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors"
              >
                30 min
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePauseTimer}
                className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors flex items-center gap-1"
              >
                <Pause className="w-3 h-3" />
                Pause
              </button>
              <button
                onClick={handleResetTimer}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Voting */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <Vote className="w-4 h-4" />
          Enable Voting
        </label>
        <button
          onClick={handleToggleVoting}
          className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
            votingEnabled
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'border hover:bg-gray-50'
          }`}
        >
          <CheckSquare className="w-3 h-3" />
          {votingEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-500 mb-2">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors flex items-center gap-1">
            <Users className="w-3 h-3" />
            Manage Participants
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacilitatorToolbox;

