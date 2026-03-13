import React, { useState } from 'react';

interface User {
  _id: string;
  name: string;
  avatar: string;
}

interface Reaction {
  user: User;
  type: 'thumbs_up' | 'thumbs_down' | 'heart' | 'fire' | 'rocket' | 'eyes';
  createdAt: string;
}

interface Comment {
  _id: string;
  author: User;
  content: string;
  reactions: Reaction[];
  isResolved: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  parentComment?: string;
}

interface CommentThreadProps {
  comment: Comment;
  replies?: Comment[];
  onReply?: (commentId: string, content: string) => void;
  onReact?: (commentId: string, type: Reaction['type']) => void;
  onResolve?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  depth?: number;
}

const REACTION_EMOJIS = {
  thumbs_up: '👍',
  thumbs_down: '👎',
  heart: '❤️',
  fire: '🔥',
  rocket: '🚀',
  eyes: '👀'
};

const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  replies = [],
  onReply,
  onReact,
  onResolve,
  onDelete,
  depth = 0
}) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReactions, setShowReactions] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleReplySubmit = () => {
    if (replyContent.trim() && onReply) {
      onReply(comment._id, replyContent);
      setReplyContent('');
      setShowReplyInput(false);
    }
  };

  const handleReactionClick = (type: Reaction['type']) => {
    if (onReact) {
      onReact(comment._id, type);
    }
    setShowReactions(false);
  };

  const getReactionCount = (type: Reaction['type']) => {
    return comment.reactions.filter(r => r.type === type).length;
  };

  const hasReactions = comment.reactions.length > 0;

  if (comment.isDeleted) {
    return (
      <div className="py-4 px-4 bg-slate-50 rounded-lg text-slate-400 text-sm italic">
        This comment has been deleted
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? 'ml-12 mt-4' : ''}`}>
      {/* Comment */}
      <div className={`flex space-x-3 ${comment.isResolved ? 'opacity-60' : ''}`}>
        {/* Avatar */}
        <img
          src={comment.author.avatar}
          alt={comment.author.name}
          className="w-10 h-10 rounded-full flex-shrink-0"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-semibold text-white">{comment.author.name}</span>
            <span className="text-xs text-slate-400">{formatDate(comment.createdAt)}</span>
            {comment.isEdited && (
              <span className="text-xs text-slate-500">(edited)</span>
            )}
            {comment.isResolved && (
              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                Resolved
              </span>
            )}
          </div>

          {/* Body */}
          <div className="text-slate-200 text-sm whitespace-pre-wrap mb-2">
            {comment.content}
          </div>

          {/* Reactions */}
          {hasReactions && (
            <div className="flex items-center space-x-2 mb-2">
              {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => {
                const count = getReactionCount(type as Reaction['type']);
                if (count === 0) return null;
                
                return (
                  <button
                    key={type}
                    className="flex items-center space-x-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-full text-xs"
                    onClick={() => handleReactionClick(type as Reaction['type'])}
                  >
                    <span>{emoji}</span>
                    <span className="text-slate-300">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            {/* Reaction Button */}
            <div className="relative">
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="hover:text-white transition-colors"
              >
                React
              </button>
              
              {showReactions && (
                <div className="absolute bottom-full mb-2 left-0 flex space-x-1 bg-slate-800 rounded-full p-1 shadow-xl border border-slate-700">
                  {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                    <button
                      key={type}
                      onClick={() => handleReactionClick(type as Reaction['type'])}
                      className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-full transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reply Button */}
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="hover:text-white transition-colors"
            >
              Reply
            </button>

            {/* Resolve Button */}
            {onResolve && (
              <button
                onClick={() => onResolve(comment._id)}
                className="hover:text-white transition-colors"
              >
                {comment.isResolved ? 'Unresolve' : 'Resolve'}
              </button>
            )}

            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={() => onDelete(comment._id)}
                className="hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className="mt-3 flex space-x-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleReplySubmit()}
              />
              <button
                onClick={handleReplySubmit}
                disabled={!replyContent.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
              >
                Reply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentThread
              key={reply._id}
              comment={reply}
              onReply={onReply}
              onReact={onReact}
              onResolve={onResolve}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentThread;
