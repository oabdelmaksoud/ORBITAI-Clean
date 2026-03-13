
import React, { useState } from 'react';
import {
    ChevronLeft, ChevronRight, ChevronDown, Plus, Folder,
    Edit2, Trash2, Smartphone, Monitor, Server, Code
} from 'lucide-react';
import { ChatMessage, ProjectFolder } from '@orbitai/shared';
import { SavedConversation } from '../hooks/useNeuralStreamState';

interface SystemMessage {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
}

interface ChatHistorySidebarProps {
    showChatHistorySidebar: boolean;
    setShowChatHistorySidebar: (show: boolean) => void;
    systemMessages: SystemMessage[];
    setSystemMessages: React.Dispatch<React.SetStateAction<SystemMessage[]>>;
    startNewConversation: () => void;

    // Folders
    projectFolders: ProjectFolder[];
    savedConversations: SavedConversation[];
    setFolderManagerMode: (mode: 'create' | 'edit') => void;
    setEditingFolder: (folder: any) => void;
    setShowFolderManager: (show: boolean) => void;

    // Folder State
    expandedFolders: Set<string>;
    setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
    editingFolderId: string | null;
    setEditingFolderId: (id: string | null) => void;
    editingFolderName: string;
    setEditingFolderName: (name: string) => void;

    // Handlers
    handleSaveRename: () => void;
    handleStartRename: (folder: ProjectFolder) => void;
    handleDeleteWorkspace: (id: string, name: string, count: number) => void;

    // Conversations
    currentConversationId: string | null;
    loadConversation: (id: string) => void;
    handleDeleteConversation: (id: string) => void;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
    showChatHistorySidebar,
    setShowChatHistorySidebar,
    systemMessages,
    setSystemMessages,
    startNewConversation,
    projectFolders,
    savedConversations,
    setFolderManagerMode,
    setEditingFolder,
    setShowFolderManager,
    expandedFolders,
    setExpandedFolders,
    editingFolderId,
    setEditingFolderId,
    editingFolderName,
    setEditingFolderName,
    handleSaveRename,
    handleStartRename,
    handleDeleteWorkspace,
    currentConversationId,
    loadConversation,
    handleDeleteConversation
}) => {
    const [showInbox, setShowInbox] = useState(true);

    // Group conversations logic
    const conversationsByFolder = new Map<string, SavedConversation[]>();
    const unorganizedFolder = projectFolders.find(f => f.name === 'Unorganized');

    savedConversations.forEach(conv => {
        const folderId = conv.folderId || unorganizedFolder?.id || null;
        if (folderId) {
            if (!conversationsByFolder.has(folderId)) {
                conversationsByFolder.set(folderId, []);
            }
            conversationsByFolder.get(folderId)!.push(conv);
        }
    });

    const sortedFolders = [...projectFolders].sort((a, b) => {
        if (a.name === 'Unorganized') return 1;
        if (b.name === 'Unorganized') return -1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className={`relative h-full bg-slate-50 border-r border-slate-200 transition-all duration-300 ${showChatHistorySidebar ? 'w-[280px]' : 'w-0 overflow-hidden'}`}>
            <div className="h-full flex flex-col">

                {/* Sidebar Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-800">Orbit<span className="text-rose-500">AI</span></h3>
                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Preview</span>
                    </div>
                    <button
                        onClick={() => setShowChatHistorySidebar(false)}
                        className="p-1.5 hover:bg-slate-200 rounded-md transition-colors"
                        title="Close sidebar"
                    >
                        <ChevronLeft size={16} className="text-slate-500" />
                    </button>
                </div>

                {/* Main Content - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* Inbox Section */}
                    <div className="px-2 pt-3">
                        <button
                            onClick={() => setShowInbox(!showInbox)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors group"
                        >
                            <div className="relative">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 group-hover:text-slate-800">
                                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                                </svg>
                                {systemMessages.filter(m => !m.read).length > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-rose-500 rounded-full flex items-center justify-center">
                                        <span className="text-[9px] font-bold text-white">{systemMessages.filter(m => !m.read).length}</span>
                                    </span>
                                )}
                            </div>
                            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Inbox</span>
                            {showInbox ? (
                                <ChevronDown size={14} className="ml-auto text-slate-400" />
                            ) : (
                                <ChevronRight size={14} className="ml-auto text-slate-400" />
                            )}
                        </button>

                        {/* Inbox Messages List */}
                        {showInbox && (
                            <div className="mt-1 space-y-1 ml-2">
                                {systemMessages.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-slate-400 italic">
                                        No messages
                                    </div>
                                ) : (
                                    <>
                                        {systemMessages.map(msg => (
                                            <button
                                                key={msg.id}
                                                onClick={() => {
                                                    // Mark as read
                                                    setSystemMessages(prev =>
                                                        prev.map(m => m.id === msg.id ? { ...m, read: true } : m)
                                                    );
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${msg.read
                                                    ? 'bg-slate-50 hover:bg-slate-100'
                                                    : 'bg-blue-50 hover:bg-blue-100 border-l-2 border-blue-500'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <span className="text-sm mt-0.5">
                                                        {msg.type === 'info' && '💡'}
                                                        {msg.type === 'success' && '✅'}
                                                        {msg.type === 'warning' && '⚠️'}
                                                        {msg.type === 'error' && '❌'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-xs font-medium truncate ${msg.read ? 'text-slate-600' : 'text-slate-800'}`}>
                                                            {msg.title}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                                                            {msg.message}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 mt-1">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                        {/* Mark all as read */}
                                        {systemMessages.some(m => !m.read) && (
                                            <button
                                                onClick={() => setSystemMessages(prev => prev.map(m => ({ ...m, read: true })))}
                                                className="w-full px-3 py-1.5 text-[10px] text-primary hover:text-primary/80 font-medium"
                                            >
                                                Mark all as read
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Start Conversation */}
                    <div className="px-2 py-1">
                        <button
                            onClick={startNewConversation}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-800"
                        >
                            <Plus size={18} />
                            <span className="text-sm font-medium">Start conversation</span>
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="mx-4 my-2 border-t border-slate-200"></div>

                    {/* Workspaces Section */}
                    <div className="px-2">
                        <div className="px-3 py-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Workspaces</span>
                            <button
                                onClick={() => {
                                    setFolderManagerMode('create');
                                    setEditingFolder(null);
                                    setShowFolderManager(true);
                                }}
                                className="p-1 hover:bg-slate-200 rounded transition-opacity"
                                title="Create workspace"
                            >
                                <Plus size={14} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Workspace Items */}
                        <div className="space-y-1">
                            {projectFolders.length === 0 && savedConversations.length === 0 ? (
                                // Empty state - no workspaces yet
                                <div className="px-3 py-4 text-center">
                                    <div className="text-slate-400 mb-2">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-50">
                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-2">No workspaces yet</p>
                                    <p className="text-[10px] text-slate-400">Start a conversation to create your first workspace</p>
                                </div>
                            ) : (
                                // Render actual workspaces from projectFolders
                                sortedFolders
                                    .filter(folder => {
                                        if (folder.name === 'Unorganized') {
                                            const folderConversations = conversationsByFolder.get(folder.id) || [];
                                            return folderConversations.length > 0;
                                        }
                                        return true;
                                    })
                                    .map(folder => {
                                        const folderConversations = conversationsByFolder.get(folder.id) || [];
                                        const isExpanded = expandedFolders.has(folder.id);
                                        const isUnorganized = folder.name === 'Unorganized';

                                        return (
                                            <div key={folder.id} className="rounded-lg">
                                                <div className="w-full flex items-center gap-1 group/folder hover:bg-slate-100 rounded-lg pr-2 transition-colors">
                                                    <button
                                                        onClick={() => {
                                                            setExpandedFolders(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(folder.id)) {
                                                                    next.delete(folder.id);
                                                                } else {
                                                                    next.add(folder.id);
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                        className="flex-1 flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                                        ) : (
                                                            <ChevronRight size={14} className="text-slate-400 shrink-0" />
                                                        )}
                                                        <Folder size={16} className={isUnorganized ? 'text-slate-400' : 'text-amber-500'} />
                                                        {editingFolderId === folder.id ? (
                                                            <input
                                                                value={editingFolderName}
                                                                onChange={e => setEditingFolderName(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleSaveRename();
                                                                    if (e.key === 'Escape') setEditingFolderId(null);
                                                                    e.stopPropagation();
                                                                }}
                                                                onBlur={handleSaveRename}
                                                                onClick={e => e.stopPropagation()}
                                                                autoFocus
                                                                className="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 py-0.5 text-sm outline-none shadow-sm"
                                                            />
                                                        ) : (
                                                            <span className={`text-sm font-medium truncate flex-1 ${isUnorganized ? 'text-slate-500' : 'text-slate-700'}`}>
                                                                {folder.name}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-slate-400">
                                                            {folderConversations.length}
                                                        </span>
                                                    </button>

                                                    {!isUnorganized && (
                                                        <div className="flex items-center opacity-0 group-hover/folder:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStartRename(folder);
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-200 rounded transition-all"
                                                                title="Rename Workspace"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteWorkspace(folder.id, folder.name, folderConversations.length);
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 rounded transition-all"
                                                                title="Delete Workspace (Permanent)"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Conversations in workspace */}
                                                {isExpanded && (
                                                    <div className="ml-6 space-y-0.5 mt-1">
                                                        {folderConversations.length === 0 ? (
                                                            <p className="text-xs text-slate-400 px-2 py-1 italic">No conversations yet</p>
                                                        ) : (
                                                            <>
                                                                {folderConversations
                                                                    .sort((a, b) => b.timestamp - a.timestamp)
                                                                    .slice(0, 5)
                                                                    .map(conv => (
                                                                        <div key={conv.id} className="relative group/conv">
                                                                            <button
                                                                                onClick={() => loadConversation(conv.id)}
                                                                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate pr-6 ${currentConversationId === conv.id
                                                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                                    : 'text-slate-600 hover:bg-slate-100'
                                                                                    }`}
                                                                            >
                                                                                {conv.title}
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteConversation(conv.id);
                                                                                }}
                                                                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover/conv:opacity-100 transition-opacity"
                                                                            >
                                                                                <X size={10} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                {folderConversations.length > 5 && (
                                                                    <button className="w-full text-left px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600">
                                                                        See all ({folderConversations.length})
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="mx-4 my-3 border-t border-slate-200"></div>

                    {/* Playground Section */}
                    <div className="px-2 opacity-60">
                        <div className="px-3 py-2 flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Playground</span>
                            <span className="text-[8px] bg-slate-200 text-slate-400 px-1.5 py-0.5 rounded-full">Coming Soon</span>
                        </div>
                        <div className="px-3 py-2 text-xs text-slate-400 italic">
                            Experimental features coming soon...
                        </div>
                    </div>
                </div>

                {/* Footer Section - Sticky at bottom */}
                <div className="shrink-0 border-t border-slate-200 p-2 space-y-0.5">
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-800">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        <span className="text-sm">Knowledge</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-800">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        <span className="text-sm">Browser</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-800">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        <span className="text-sm">Settings</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-800">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span className="text-sm">Provide Feedback</span>
                    </button>
                </div>
            </div >
        </div >
    );
};
