import React, { useState, useRef, useEffect } from 'react';
import { Agent, ChatMessage } from '@orbitai/shared';
import { Send, X, Bot, User, Sparkles, Paperclip, Loader2, Minimize2, Maximize2, Wand2, MessageSquare, Smile } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import JSZip from 'jszip';
// @ts-ignore
import remarkGfm from 'remark-gfm';
import { enhanceUserPrompt } from '../services/geminiService';

interface AgentChatProps {
  agent: Agent;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
  isThinking: boolean;
}

const AgentChat: React.FC<AgentChatProps> = ({ agent, messages, onSendMessage, onClose, isThinking }) => {
  const [input, setInput] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Common emojis organized by category
  const emojiCategories = {
    'Frequently Used': ['😀', '😊', '👍', '❤️', '🎉', '🔥', '✨', '💯', '🚀', '⭐'],
    'Smileys & People': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'],
    'Gestures': ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃'],
    'Objects & Symbols': ['💎', '🔮', '💍', '🎯', '🎲', '🎮', '🎸', '🎹', '🎺', '🎻', '🥁', '🎤', '🎧', '📱', '💻', '⌚', '📷', '📹', '🎥', '📺', '📻', '🔊', '🔉', '🔈', '📢', '📣', '📯', '🔔', '🔕', '📻', '📡', '💡', '🔦', '🕯️', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🛠️', '🔨', '⚒️', '🛠️', '🔧', '🔩', '⚙️', '🗜️', '⚡', '🔥', '💧', '🌊'],
    'Nature': ['🌱', '🌲', '🌳', '🌴', '🌵', '🌷', '🌹', '🌺', '🌻', '🌼', '🌸', '🌾', '🌿', '🍀', '🍁', '🍂', '🍃', '🍄', '🌰', '🦀', '🦞', '🦐', '🦑', '🐙', '🦎', '🐍', '🦖', '🦕', '🐢', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻'],
    'Food & Drink': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🍾', '🧃', '🧉', '🧊'],
    'Activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🏏', '🥍', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🏋️', '🤼', '🤸', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
    'Travel & Places': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🚁', '🚟', '🚠', '🚡', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁'],
    'Flags': ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇳', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🎌', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇰', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇬🇸', '🇸🇧', '🇸🇴', '🇿🇦', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼']
  };

  const handleEmojiClick = (emoji: string) => {
    const cursorPosition = inputRef.current?.selectionStart || input.length;
    const newInput = input.slice(0, cursorPosition) + emoji + input.slice(cursorPosition);
    setInput(newInput);
    setShowEmojiPicker(false);
    // Focus back on input and set cursor position after emoji
    setTimeout(() => {
      inputRef.current?.focus();
      const newPosition = cursorPosition + emoji.length;
      inputRef.current?.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node) && 
          !(event.target as HTMLElement).closest('button[data-emoji-button]')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // OPTIMIZATION: Enhance agent messages with relevant emojis
  const enhanceMessageWithEmojis = (text: string, sender: string): string => {
    // Only enhance agent messages, not user messages
    if (sender !== 'agent' && sender !== 'system') {
      return text;
    }

    // Don't enhance if message already contains emojis (avoid duplication)
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(text)) {
      return text; // Already has emojis
    }

    const lowerText = text.toLowerCase();
    let enhancedText = text;
    const emojiMap: { [key: string]: string } = {
      // Success/Completion
      'completed': '✅', 'done': '✅', 'finished': '✅', 'success': '✅', 'successful': '✅',
      'ready': '✅', 'all set': '✅', 'complete': '✅',
      
      // Errors/Issues
      'error': '❌', 'failed': '❌', 'failure': '❌', 'issue': '⚠️', 'problem': '⚠️',
      'warning': '⚠️', 'alert': '⚠️', 'critical': '🔴', 'bug': '🐛',
      
      // Information/Details
      'note': '📝', 'info': 'ℹ️', 'information': 'ℹ️', 'details': '📋', 'summary': '📊',
      'report': '📄', 'documentation': '📚', 'guide': '📖',
      
      // Progress/Working
      'processing': '⚙️', 'working': '⚙️', 'analyzing': '🔍', 'checking': '🔍',
      'reviewing': '👀', 'examining': '🔬', 'investigating': '🔎',
      
      // Code/Technical
      'code': '💻', 'function': '⚡', 'method': '⚡', 'class': '🏗️', 'module': '📦',
      'api': '🔌', 'endpoint': '🔗', 'database': '🗄️', 'server': '🖥️',
      'javascript': '📜', 'typescript': '📘', 'python': '🐍', 'react': '⚛️',
      'node': '🟢', 'html': '🌐', 'css': '🎨',
      
      // Tasks/Actions
      'task': '📌', 'todo': '📝', 'action': '🎯', 'implement': '🔨', 'create': '✨',
      'build': '🏗️', 'deploy': '🚀', 'update': '🔄', 'fix': '🔧', 'refactor': '♻️',
      'test': '🧪', 'debug': '🐛', 'optimize': '⚡',
      
      // Questions/Help
      'question': '❓', 'help': '💡', 'suggest': '💡', 'recommend': '💡',
      'advice': '💭', 'tip': '💡', 'hint': '💡',
      
      // Positive/Encouragement
      'great': '🎉', 'excellent': '🌟', 'awesome': '🔥', 'perfect': '✨',
      'good': '👍', 'nice': '👌', 'well done': '👏', 'congratulations': '🎊',
      
      // Security/Safety
      'security': '🔒', 'secure': '🔒', 'safe': '🛡️', 'protected': '🛡️',
      'encryption': '🔐', 'authentication': '🔑', 'authorization': '🔐',
      
      // Data/Storage
      'data': '💾', 'save': '💾', 'storage': '💾', 'file': '📁', 'folder': '📂',
      'download': '⬇️', 'upload': '⬆️', 'export': '📤', 'import': '📥',
      
      // Network/Connection
      'network': '🌐', 'connection': '🔗', 'connect': '🔗', 'disconnect': '🔌',
      'online': '🟢', 'offline': '🔴', 'sync': '🔄',
      
      // Time/Status
      'wait': '⏳', 'loading': '⏳', 'pending': '⏸️', 'in progress': '🔄',
      'soon': '⏰', 'schedule': '📅', 'deadline': '⏰',
      
      // Architecture/Design
      'architecture': '🏛️', 'design': '🎨', 'structure': '🏗️', 'framework': '📐',
      'pattern': '🔷', 'component': '🧩', 'system': '⚙️',
      
      // Quality/Standards
      'quality': '⭐', 'standard': '📏', 'compliance': '✅', 'audit': '🔍',
      'review': '👀', 'validation': '✔️',
      
      // Project/Planning
      'project': '📁', 'plan': '📋', 'roadmap': '🗺️', 'milestone': '🎯',
      'sprint': '🏃', 'phase': '📊', 'iteration': '🔄',
    };

    // Check for keywords and add emojis at the beginning of relevant sentences
    const sentences = enhancedText.split(/([.!?]\s+)/);
    let hasEmoji = false;
    const addedEmojis = new Set<string>(); // Track added emojis to avoid duplicates

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i];
      if (!sentence || sentence.trim().length < 3) continue;

      const lowerSentence = sentence.toLowerCase();
      
      // Find matching keywords (prioritize more specific matches)
      const sortedKeywords = Object.entries(emojiMap).sort((a, b) => b[0].length - a[0].length);
      
      for (const [keyword, emoji] of sortedKeywords) {
        // Use word boundaries for better matching
        const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (keywordRegex.test(lowerSentence) && !sentence.trim().startsWith(emoji) && !addedEmojis.has(emoji)) {
          // Add emoji at the start of the sentence
          sentences[i] = emoji + ' ' + sentence.trim();
          hasEmoji = true;
          addedEmojis.add(emoji);
          break; // Only add one emoji per sentence
        }
      }
    }

    // If no emojis were added, add a context-appropriate one at the start
    if (!hasEmoji && enhancedText.length > 20) {
      // Determine context-based emoji (check for multiple contexts)
      if (lowerText.includes('error') || lowerText.includes('fail') || lowerText.includes('exception')) {
        enhancedText = '⚠️ ' + enhancedText;
      } else if (lowerText.includes('success') || lowerText.includes('complete') || lowerText.includes('finished')) {
        enhancedText = '✅ ' + enhancedText;
      } else if (lowerText.includes('code') || lowerText.includes('implement') || lowerText.includes('function') || lowerText.includes('class')) {
        enhancedText = '💻 ' + enhancedText;
      } else if (lowerText.includes('analyze') || lowerText.includes('review') || lowerText.includes('examine')) {
        enhancedText = '🔍 ' + enhancedText;
      } else if (lowerText.includes('help') || lowerText.includes('question') || lowerText.includes('suggest')) {
        enhancedText = '💡 ' + enhancedText;
      } else if (lowerText.includes('task') || lowerText.includes('todo') || lowerText.includes('action')) {
        enhancedText = '📌 ' + enhancedText;
      } else if (lowerText.includes('test') || lowerText.includes('testing') || lowerText.includes('tested')) {
        enhancedText = '🧪 ' + enhancedText;
      } else if (lowerText.includes('deploy') || lowerText.includes('release') || lowerText.includes('launch')) {
        enhancedText = '🚀 ' + enhancedText;
      } else {
        // Default friendly emoji for agent responses
        enhancedText = '🤖 ' + enhancedText;
      }
    } else {
      enhancedText = sentences.join('');
    }

    return enhancedText;
  };

  // Role-based quick prompts
  const getQuickPrompts = () => {
     switch(agent.role.toLowerCase()) {
         case 'orchestrator': return ['Project Status', 'List Pending Tasks', 'Identify Risks'];
         case 'requirements agent': return ['Clarify Scope', 'List Functional Reqs', 'Check Constraints'];
         case 'implementation agent': return ['Explain Code', 'Refactor Suggestions', 'Tech Stack Details'];
         case 'qa/audit agent': return ['Run Audit', 'Check Compliance', 'List Defects'];
         default: return ['Status Report', 'Explain Output', 'Next Steps'];
     }
  };

  useEffect(() => {
    if (inputRef.current && !isMinimized) {
        inputRef.current.focus();
    }
  }, [isMinimized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, isMinimized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isThinking) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleEnhance = async () => {
      if (!input.trim()) return;
      setIsEnhancing(true);
      try {
          const enhanced = await enhanceUserPrompt(input);
          setInput(enhanced);
      } catch (err) {
          console.error("Enhance failed", err);
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Handle ZIP files in chat
    if (file.name.endsWith('.zip')) {
        setIsProcessingFile(true);
        try {
            const zip = await JSZip.loadAsync(file);
            let combinedContext = `\n\n[USER UPLOADED ARCHIVE: ${file.name}]\n`;
            let fileCount = 0;
            
            const promises: Promise<void>[] = [];
            zip.forEach((relativePath: string, zipEntry: any) => {
                if (zipEntry.dir || relativePath.startsWith('__MACOSX') || relativePath.includes('.DS_Store')) return;
                
                // Skip binary/image files for text chat context to avoid garbage
                if (relativePath.match(/\.(png|jpg|jpeg|gif|ico|pdf|exe|dll|bin)$/i)) return;

                const p = (async () => {
                    const text = await zipEntry.async('string');
                    // Limit individual file size to avoid exploding context
                    const truncated = text.length > 8000 ? text.substring(0, 8000) + "\n...(truncated)" : text;
                    combinedContext += `\n--- FILE: ${relativePath} ---\n\`\`\`\n${truncated}\n\`\`\`\n`;
                    fileCount++;
                })();
                promises.push(p);
            });

            await Promise.all(promises);
            
            if (fileCount === 0) {
                combinedContext += "(No readable text files found in archive)";
            } else {
                combinedContext += `\n[END ARCHIVE - ${fileCount} files extracted]`;
            }

            setInput(prev => prev + combinedContext);

        } catch (err) {
            console.error("Zip error", err);
            setInput(prev => prev + `\n[Error reading ZIP file: ${file.name}]`);
        } finally {
            setIsProcessingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
        return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
        const result = ev.target?.result as string;
        
        let fileContext = "";
        if (file.type.startsWith('image/')) {
            fileContext = `\n\n[USER UPLOADED IMAGE: ${file.name}]\n(Image content attached to context)`;
        } else {
            // Truncate huge files for chat context to prevent token overflow in UI
            const truncatedContent = result.length > 5000 ? result.substring(0, 5000) + "...(truncated)" : result;
            fileContext = `\n\n[USER UPLOADED FILE: ${file.name}]\n\`\`\`\n${truncatedContent}\n\`\`\``;
        }

        setInput(prev => prev + fileContext);
    };

    if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
    
    // Reset
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Minimized State (Chat Head)
  if (isMinimized) {
      return (
          <div 
            onClick={() => setIsMinimized(false)}
            className="absolute bottom-4 right-4 z-50 cursor-pointer animate-in zoom-in duration-300 group"
          >
              <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-white border-2 border-primary shadow-lg flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                      <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full border-2 border-white flex items-center justify-center">
                      <MessageSquare size={10} className="text-white fill-current" />
                  </div>
                  {isThinking && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-500 border border-slate-200 shadow-sm whitespace-nowrap">
                          Typing...
                      </div>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="absolute top-4 right-4 bottom-4 w-[400px] bg-white/95 border border-slate-200 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-right-10 duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
            <div className="relative">
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    {agent.name} 
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] rounded uppercase font-mono tracking-wider">Online</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">{agent.role}</p>
            </div>
        </div>
        <div className="flex items-center gap-1">
            <button 
                onClick={() => setIsMinimized(true)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                title="Minimize"
            >
                <Minimize2 size={16} />
            </button>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                title="Close"
            >
                <X size={16} />
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 opacity-60">
                <Sparkles size={32} />
                <p className="text-xs font-mono text-center text-slate-500">Neural Link Established.<br/>Ask me anything about the project.</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-[80%]">
                    {getQuickPrompts().map(prompt => (
                        <button 
                            key={prompt}
                            onClick={() => setInput(prompt)}
                            className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded-full hover:border-primary hover:text-primary text-slate-500 transition-colors"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            </div>
        )}
        
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                msg.sender === 'user' 
                ? 'bg-primary/10 border-primary/20' 
                : 'bg-white border-primary/20 shadow-sm'
            }`}>
               {msg.sender === 'user' ? <User size={14} className="text-primary" /> : <Bot size={14} className="text-primary" />}
            </div>
            
            <div className={`
                max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed overflow-hidden shadow-sm
                ${msg.sender === 'user' 
                  ? 'bg-primary text-white rounded-tr-none' 
                  : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}
            `}>
                {msg.sender === 'agent' ? (
                     <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-600 prose-pre:p-2 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-primary prose-a:text-primary prose-headings:text-slate-800 prose-strong:text-slate-900 prose-ul:list-disc prose-ul:pl-4 prose-ol:list-decimal prose-ol:pl-4 prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-slate-50 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-lg prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-2 prose-td:p-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{enhanceMessageWithEmojis(msg.text, msg.sender)}</ReactMarkdown>
                     </div>
                ) : (
                    <div className={`whitespace-pre-wrap ${msg.sender === 'user' ? 'text-white' : 'text-slate-700'}`}>{msg.text}</div>
                )}
            </div>
          </div>
        ))}

        {isThinking && (
           <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={14} className="text-primary" />
              </div>
              <div className="bg-white border border-primary/10 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1 shadow-sm">
                 <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileSelect}
            />
            <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 hover:bg-slate-50 rounded-lg transition-colors ${isProcessingFile ? 'text-primary animate-pulse' : 'text-slate-400 hover:text-primary'}`}
                title="Attach File"
                disabled={isThinking || isProcessingFile}
            >
                {isProcessingFile ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            
            {/* Prompt Enhancer */}
            <button 
                type="button"
                onClick={handleEnhance}
                className={`p-2 hover:bg-slate-50 rounded-lg transition-colors ${isEnhancing ? 'text-primary animate-pulse' : 'text-slate-400 hover:text-primary'}`}
                title="Enhance Prompt"
                disabled={isThinking || isProcessingFile || !input.trim()}
            >
                {isEnhancing ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
            </button>

            {/* Emoji Picker Button */}
            <div className="relative">
              <button 
                  type="button"
                  data-emoji-button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2 hover:bg-slate-50 rounded-lg transition-colors ${showEmojiPicker ? 'text-primary bg-slate-100' : 'text-slate-400 hover:text-primary'}`}
                  title="Add Emoji"
                  disabled={isThinking || isProcessingFile}
              >
                  <Smile size={18} />
              </button>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div 
                  ref={emojiPickerRef}
                  className="absolute bottom-full right-0 mb-2 w-[320px] h-[400px] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
                >
                  <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700">Emoji</h4>
                    <button
                      onClick={() => setShowEmojiPicker(false)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {Object.entries(emojiCategories).map(([category, emojis]) => (
                      <div key={category} className="mb-4">
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1">
                          {category}
                        </h5>
                        <div className="grid grid-cols-8 gap-1">
                          {emojis.map((emoji, idx) => (
                            <button
                              key={`${category}-${idx}`}
                              onClick={() => handleEmojiClick(emoji)}
                              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 rounded-lg transition-colors active:scale-90"
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative flex-1">
                <input 
                    ref={inputRef}
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isThinking ? "Agent is processing..." : isProcessingFile ? "Reading archive..." : "Transmit message..."}
                    disabled={isThinking || isProcessingFile}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-700 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder-slate-400 disabled:opacity-50"
                />
                <button 
                    type="submit"
                    disabled={!input.trim() || isThinking || isProcessingFile}
                    className="absolute right-2 top-2 p-1.5 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
                >
                    <Send size={16} />
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AgentChat;