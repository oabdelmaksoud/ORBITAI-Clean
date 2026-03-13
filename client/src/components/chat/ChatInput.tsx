import React, { useState, useRef, useEffect } from 'react';
import { parseMentions, checkIncompleteMention, completeMention } from '../../utils/mentionParser';

interface User {
  _id: string;
  name: string;
  username: string;
  avatar: string;
}

interface ChatInputProps {
  onSendMessage: (message: string, mentions: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  users?: User[];
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  placeholder = 'Type a message...',
  disabled = false,
  users = []
}) => {
  const [message, setMessage] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState(0);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Check for incomplete mention
    const incomplete = checkIncompleteMention(message.substring(0, cursorPosition));
    
    if (incomplete.hasIncompleteMention && incomplete.partialUsername !== undefined) {
      // Filter users by partial username
      const filtered = users.filter(user =>
        user.username.toLowerCase().includes(incomplete.partialUsername!.toLowerCase()) ||
        user.name.toLowerCase().includes(incomplete.partialUsername!.toLowerCase())
      );
      
      setFilteredUsers(filtered);
      setShowAutocomplete(filtered.length > 0);
      setAutocompletePosition(incomplete.startPosition || 0);
      setSelectedIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  }, [message, cursorPosition, users]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectUser(filteredUsers[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false);
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const selectUser = (user: User) => {
    const updatedMessage = completeMention(message, autocompletePosition, user.username);
    setMessage(updatedMessage);
    setShowAutocomplete(false);
    
    // Set cursor position after the mention
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = autocompletePosition + user.username.length + 2; // +2 for @ and space
        inputRef.current.setSelectionRange(newPosition, newPosition);
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      const mentions = parseMentions(message);
      const userIds = mentions.map(m => {
        const user = users.find(u => u.username === m.username);
        return user?._id;
      }).filter(Boolean) as string[];

      onSendMessage(message.trim(), userIds);
      setMessage('');
    }
  };

  const handleSelectionChange = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart);
    }
  };

  return (
    <div className="relative">
      {/* Input Container */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 focus-within:border-blue-500 transition-colors">
        <textarea
          ref={inputRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelectionChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className="w-full bg-transparent px-4 py-3 text-white placeholder-slate-400 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700">
          <div className="flex items-center space-x-2">
            {/* Attachment Button */}
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Attach file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {/* Emoji Button */}
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Add emoji"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">
              Press Enter to send, Shift+Enter for new line
            </span>
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || disabled}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Mention Autocomplete */}
      {showAutocomplete && (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-10">
          <div className="max-h-64 overflow-y-auto">
            {filteredUsers.map((user, index) => (
              <button
                key={user._id}
                onClick={() => selectUser(user)}
                className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${
                  index === selectedIndex ? 'bg-slate-700' : 'hover:bg-slate-700'
                }`}
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-white truncate">
                    {user.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    @{user.username}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInput;
