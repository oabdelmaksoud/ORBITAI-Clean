import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../services/toastService';
import { Mic, Paperclip, Square, X } from 'lucide-react';

interface OrbitAIControlBarProps {
  input: string;
  setInput: (input: string) => void;
  onSendMessage: (message: string, attachments?: Array<{ name: string; type: string; content: string }>) => void;
  isProcessing?: boolean;
  attachedFiles?: Array<{ name: string; type: string; content: string }>; // Currently attached files
  onFilesChange?: (files: Array<{ name: string; type: string; content: string }>) => void; // Callback when files change
  // Voice controls
  onVoiceToggle?: () => void;
  voiceState?: 'disconnected' | 'connecting' | 'connected' | 'error';
  showVoiceToggle?: boolean;
  isVoiceDisabled?: boolean; // New prop to explicitly disable voice start
  onInterrupt?: () => void;
  isAISpeaking?: boolean;
  // Get Agents Involved
  showGetAgentsInvolved?: boolean;
  onGetAgentsInvolved?: () => void;
  isGettingAgentsInvolved?: boolean;
  hasUserMessage?: boolean; // Track if user has sent a message (for validation)
  // Prototyping Controls
  onReadyToGo?: () => void;
  readyCheck?: { canProceed: boolean; reason?: string; score?: number };
  showReadyToGo?: boolean;
  prototypingStage?: 'ideation' | 'prototyping'; // Current stage - button hidden in 'prototyping'
  // Deepen Ideas - re-run brainstorming for more detail
  onDeepenIdeas?: () => void;
  deepenLevel?: number; // 0 = not used, 1 = X1, 2 = X2 (max)
  isDeepeningIdeas?: boolean;
  deepeningProgress?: number;
  hasIdeas?: boolean; // True when there are ideas to deepen
  // Layout mode - controls Enter key behavior
  layoutMode?: 'rest' | 'chat';
  scopeBadge?: React.ReactNode;
  children?: React.ReactNode;
}

const OrbitAIControlBar: React.FC<OrbitAIControlBarProps> = ({
  input,
  setInput,
  onSendMessage,
  isProcessing = false,
  attachedFiles = [],
  onFilesChange,
  onVoiceToggle,
  voiceState = 'inactive',
  showVoiceToggle = true,
  isVoiceDisabled = false,
  onInterrupt, // Callback to interrupt AI
  isAISpeaking = false, // Track if AI is currently speaking
  showGetAgentsInvolved = false,
  onGetAgentsInvolved,
  isGettingAgentsInvolved = false,
  hasUserMessage = false,
  onReadyToGo,
  readyCheck,
  showReadyToGo = false,
  prototypingStage = 'ideation',
  onDeepenIdeas,
  deepenLevel = 0,
  isDeepeningIdeas = false,
  hasIdeas = false,
  layoutMode = 'rest',
  scopeBadge,
  children
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [localAttachedFiles, setLocalAttachedFiles] = useState<Array<{ name: string; type: string; content: string }>>(attachedFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [skipWarningShown, setSkipWarningShown] = useState(false); // Track if user was warned about skipping
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`; // Cap at 120px
    }
  }, [input]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // In 'rest' layout (front page): Enter triggers AI Brainstorming
      // In 'chat' layout (after conversation started): Enter just sends message
      if (layoutMode === 'rest' && onGetAgentsInvolved && !showReadyToGo) {
        // AI Brainstorming on front page
        onGetAgentsInvolved();
      } else {
        // Standard message send in chat layout or fallback
        handleSubmit(e as any);
      }

      // Reset height instantly after submit
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Sync with parent's attachedFiles prop
  useEffect(() => {
    setLocalAttachedFiles(attachedFiles);
  }, [attachedFiles]);

  const processFile = async (file: File) => {
    setIsProcessingFile(true);

    try {
      const reader = new FileReader();

      reader.onload = (ev) => {
        const result = ev.target?.result as string;

        const newFile = {
          name: file.name,
          type: file.type,
          content: result
        };

        const updatedFiles = [...localAttachedFiles, newFile];
        setLocalAttachedFiles(updatedFiles);

        if (onFilesChange) {
          onFilesChange(updatedFiles);
        }

        toast.success(`File "${file.name}" attached`);
      };

      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    } catch (err) {
      console.error("File read error", err);
      toast.error(`Failed to read file: ${file.name}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Process all dropped files
    for (const file of files) {
      await processFile(file);
    }
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = localAttachedFiles.filter((_, i) => i !== index);
    setLocalAttachedFiles(updatedFiles);
    if (onFilesChange) {
      onFilesChange(updatedFiles);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || localAttachedFiles.length > 0) && !isLoading && !isProcessing) {
      setIsLoading(true);
      try {
        onSendMessage(input.trim() || '', localAttachedFiles.length > 0 ? localAttachedFiles : undefined);
        setInput("");
        setLocalAttachedFiles([]);
        if (onFilesChange) {
          onFilesChange([]);
        }
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Blueprint Phase Custom UI
  if (prototypingStage === 'prototyping') {
    return (
      <div
        ref={dropZoneRef}
        className={`relative w-full max-w-4xl mx-auto px-4 transition-all ${isDragging ? 'scale-105' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 rounded-2xl bg-blue-500/10 backdrop-blur-sm border-2 border-dashed border-blue-400 flex items-center justify-center">
            <p className="text-blue-600 font-semibold">Drop files to attach</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border border-neutral-200/50 shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-neutral-300/50 group"
        >
          {/* File input hidden */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.xml,.yaml,.yml,.csv"
          />

          {/* Attached Files Preview */}
          {localAttachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {localAttachedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-neutral-100 px-3 py-1.5 rounded-full text-xs text-neutral-700 border border-neutral-200">
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col p-4 gap-2">
            {/* Main Input Area */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isLoading || isProcessing}
              rows={1}
              className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-neutral-900 placeholder:text-neutral-400 text-lg resize-none overflow-y-auto max-h-[200px] min-h-[28px] py-0 leading-relaxed font-light"
            />

            {/* Bottom Controls */}
            <div className="flex items-center justify-between mt-2">
              {/* Left Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-all border border-transparent"
                  title="Attach file"
                >
                  <span className="text-lg leading-none mb-0.5">+</span>
                </button>

                <div className="px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-200 flex items-center gap-2 text-neutral-500 text-xs font-medium cursor-help hover:text-neutral-700 transition-colors">
                  <span className="w-3 h-3 border border-current rounded-sm border-dashed"></span>
                  Visual edits
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={true} // Placeholder functionality
                  className="px-4 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 text-xs font-medium transition-all border border-transparent flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Chat
                </button>

                {showVoiceToggle && onVoiceToggle && (
                  <button
                    type="button"
                    onClick={onVoiceToggle}
                    disabled={isProcessing || isVoiceDisabled}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${voiceState === 'connected'
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'
                      }`}
                  >
                    {voiceState === 'connected' ? (
                      <div className="flex items-center gap-0.5">
                        <div className="w-0.5 h-2 bg-white animate-[bounce_1s_infinite_100ms]"></div>
                        <div className="w-0.5 h-3 bg-white animate-[bounce_1s_infinite_200ms]"></div>
                        <div className="w-0.5 h-2 bg-white animate-[bounce_1s_infinite_300ms]"></div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 opacity-60">
                        <div className="w-0.5 h-2 bg-current"></div>
                        <div className="w-0.5 h-3 bg-current"></div>
                        <div className="w-0.5 h-2 bg-current"></div>
                      </div>
                    )}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!input.trim() && localAttachedFiles.length === 0}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${input.trim() || localAttachedFiles.length > 0
                    ? 'bg-neutral-900 text-white hover:scale-105 hover:shadow-lg shadow-neutral-500/20'
                    : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </form>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={dropZoneRef}
      className={`relative w-full max-w-3xl px-4 flex flex-col gap-2 transition-all ${isDragging ? 'bg-blue-50/50 rounded-2xl p-2 border-2 border-dashed border-blue-400' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm rounded-2xl border-2 border-dashed border-blue-400 pointer-events-none">
          <div className="text-center text-blue-600">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-semibold">Drop files here to attach</p>
          </div>
        </div>
      )}

      {/* Main Control Bar */}
      <div className="flex items-center gap-3 w-full">

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.xml,.yaml,.yml,.csv"
        />

        {/* Voice Toggle Button with Audio Visualization */}
        {showVoiceToggle && onVoiceToggle && (
          <div className="relative">
            <button
              type="button"
              onClick={onVoiceToggle}
              disabled={isProcessing || isVoiceDisabled}
              className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed relative ${voiceState === 'connected'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : voiceState === 'connecting'
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : voiceState === 'error'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                } ${voiceState === 'connected' && isAISpeaking ? 'animate-pulse ring-2 ring-purple-400 ring-offset-2' : ''}`}
              title={
                voiceState === 'connected'
                  ? 'Stop Voice Conversation'
                  : voiceState === 'connecting'
                    ? 'Connecting...'
                    : voiceState === 'error'
                      ? 'Voice Error - Click to Retry'
                      : isVoiceDisabled
                        ? 'Please send a text message to enable voice chat'
                        : 'Start Voice Conversation'
              }
            >
              {voiceState === 'connected' ? (
                // Animated listening icon - pulsing microphone with sound waves (slower motion)
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <Mic className="w-5 h-5 absolute z-10 animate-[pulse_3s_ease-in-out_infinite]" />
                  {/* Animated sound waves around the mic - slower ping animation */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute w-8 h-8 border-2 border-white/60 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ animationDelay: '0ms' }}></div>
                    <div className="absolute w-10 h-10 border-2 border-white/40 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ animationDelay: '1000ms' }}></div>
                    <div className="absolute w-12 h-12 border-2 border-white/20 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ animationDelay: '2000ms' }}></div>
                  </div>
                </div>
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Interrupt Button - Only visible when AI is speaking */}
            {voiceState === 'connected' && isAISpeaking && onInterrupt && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInterrupt();
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-900 hover:scale-110 transition-all z-20"
                title="Stop Speaking"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            )}
          </div>
        )}

        {/* File Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || isProcessingFile}
          className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md bg-slate-500 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Attach File"
        >
          {isProcessingFile ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        {/* Text Input */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-2" style={{ minWidth: '550px' }}>
          {/* Attached Files Preview */}
          {localAttachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2">
              {localAttachedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg text-xs">
                  {file.type.startsWith('image/') ? (
                    <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <span className="text-slate-700 max-w-[120px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title="Remove file"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-slate-100 rounded-2xl px-4 py-3 min-h-[3rem] border border-slate-200 focus-within:bg-white focus-within:border-slate-200 focus-within:outline-none focus-within:ring-0 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={localAttachedFiles.length > 0 ? "Add a message (optional)..." : "Type your ideas here..."}
              disabled={isLoading || isProcessing || isGettingAgentsInvolved}
              rows={1}
              className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-slate-800 placeholder:text-slate-400 text-sm resize-none overflow-y-auto max-h-[120px] py-0 leading-relaxed"
              style={{ paddingBottom: '2px' }}
            />





          </div>

          {/* Render children (e.g., suggestions) aligned with input */}
          {children}
        </form>

        {/* Visual Indicator */}
        <div className="w-8 flex justify-center">
          {isProcessing ? (
            <div className="flex gap-0.5 items-center h-4">
              <div className="w-1 h-2 bg-rose-500 rounded-full animate-[bounce_1s_infinite_100ms]"></div>
              <div className="w-1 h-3 bg-rose-500 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
              <div className="w-1 h-2 bg-rose-500 rounded-full animate-[bounce_1s_infinite_300ms]"></div>
            </div>
          ) : (
            <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm transition-colors duration-500 bg-slate-300`}></div>
          )}
        </div>

        {/* Stacked Brainstorming Buttons - Only show in rest layout */}
        {layoutMode !== 'chat' && (
          <div className="flex flex-col gap-2 shrink-0 items-center">
            {/* Scope Badge (if provided) */}
            {scopeBadge && (
              <div className="mb-1">
                {scopeBadge}
              </div>
            )}

            {/* Manual Brainstorm Button - Now on top */}
            {((input || localAttachedFiles.length > 0) || isLoading || isProcessing) && !showReadyToGo && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e as any)}
                disabled={isLoading || isProcessing || isGettingAgentsInvolved || (!input.trim() && localAttachedFiles.length === 0)}
                className="w-full px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md bg-indigo-500 text-white hover:bg-indigo-600"
                title="Manual Brainstorm - Proceed without AI Agents"
              >
                {isLoading || isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                  </svg>
                )}
                <span className="text-sm font-medium">Manual Brainstorm</span>
              </button>
            )}

            {/* AI Brainstorming Button - Now below */}
            {showGetAgentsInvolved && onGetAgentsInvolved && !showReadyToGo && (
              <button
                type="button"
                onClick={onGetAgentsInvolved}
                disabled={isLoading || isProcessing || isGettingAgentsInvolved || (!input.trim() && localAttachedFiles.length === 0)}
                className={`w-full px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md ${isGettingAgentsInvolved
                  ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                  : (input.trim() || localAttachedFiles.length > 0)
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                title={isGettingAgentsInvolved
                  ? 'Getting agents involved...'
                  : (!input.trim() && localAttachedFiles.length === 0)
                    ? 'Type a message to enable agents'
                    : 'Get Agents Involved - Invite AI agents to collaborate'}
              >
                {isGettingAgentsInvolved ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-sm font-medium">Loading...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="text-sm font-medium">AI Brainstorming ✦</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Prototype Button - Only visible after user has submitted an idea */}
        {onReadyToGo && prototypingStage === 'ideation' && hasUserMessage && (
          <button
            type="button"
            onClick={() => {
              // Priority 1: If ready, proceed immediately regardless of background noise
              if (readyCheck?.canProceed) {
                onReadyToGo();
                return;
              }

              // Priority 2: Check if analysis is still running (only block if NOT ready)
              if (isProcessing || isLoading) {
                toast.info(`🔄 Analysis in progress... Current maturity: ${readyCheck?.score || 0}%. Please wait for it to complete.`);
                return;
              }

              if (skipWarningShown) {
                // User already saw warning, proceed now
                toast.info(`Proceeding with ${readyCheck?.score || 0}% maturity. Click Prototype button to start!`);
                setSkipWarningShown(false); // Reset for next time
                onReadyToGo();
              } else {
                // First click - show warning, don't proceed yet
                toast.warning(
                  `⚠️ Project is at ${readyCheck?.score || 0}% maturity. Click again to skip and proceed anyway!`
                );
                setSkipWarningShown(true);
                // Reset after 5 seconds if they don't click again
                setTimeout(() => setSkipWarningShown(false), 5000);
              }
            }}
            disabled={false}
            className={`shrink-0 px-4 py-2 rounded-xl transition-all disabled:cursor-not-allowed flex items-center gap-2 shadow-md ${readyCheck?.canProceed
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 animate-pulse'
              : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600'
              }`}
            title={readyCheck?.canProceed ? "Start Prototyping!" : `Skip to prototype with ${readyCheck?.score || 0}% maturity`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
            <span className="text-sm font-bold">Prototype {readyCheck?.score !== undefined ? `(${readyCheck.score}%)` : ''} 🚀</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default OrbitAIControlBar;
