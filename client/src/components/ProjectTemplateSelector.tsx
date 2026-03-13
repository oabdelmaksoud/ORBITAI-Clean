import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Folder, Trash2, Search, Sparkles, ShoppingCart, Layout, Gamepad2, Server, Smartphone, Bot, BarChart3, Coins, Code, Database, Music, Camera, BookOpen, Shield, Zap, Globe, Users, FileCode, Cpu, Network, MessageSquare, CreditCard, Palette, Rocket, Share2, Lock, AlertCircle } from 'lucide-react';
import { ProjectTemplate, ProjectState, Methodology } from '@orbitai/shared';
import { AGENTS, DEFAULT_MCP_SERVERS, QUALITY_STANDARDS, INITIAL_BUDGET } from '@orbitai/shared';
import { templatesApi } from '../services/templatesApi';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface ProjectTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ProjectTemplate) => void;
  onSaveAsTemplate: (template: Partial<ProjectTemplate>) => void;
  currentProject?: ProjectState;
}

const DEFAULT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'ecommerce',
    name: 'E-Commerce Platform',
    description: 'Build a modern e-commerce platform with React frontend, Node.js backend, and PostgreSQL database. Includes user authentication, product catalog, shopping cart, payment integration (Stripe), order management, inventory tracking, and admin dashboard. Perfect for online stores and marketplaces. This is a web application for e-commerce industry with payment processing, user data security, and PCI-DSS compliance requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'Web Application',
    methodology: 'Agile', // Research: Web apps benefit from iterative development and changing requirements
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['owasp', 'pci-dss', 'gdpr', 'wcag'], // Auto-assigned based on e-commerce requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 86400000,
    tags: ['ecommerce', 'web', 'react', 'node', 'postgresql', 'stripe', 'shopping']
  },
  {
    id: 'saas',
    name: 'SaaS Dashboard',
    description: 'Create a comprehensive B2B SaaS application with Next.js, TypeScript, and Tailwind CSS. Features include user management, subscription billing, analytics dashboard, API integration, role-based access control, data visualization, and multi-tenant architecture. Ideal for business software solutions. This is a cloud-based web application for SaaS industry with data privacy, security, and scalability requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'Web Application',
    methodology: 'Agile', // Research: SaaS apps need flexibility for evolving requirements and frequent releases
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['owasp', 'gdpr', 'iso27001', 'soc2', 'wcag'], // Auto-assigned based on SaaS requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 172800000,
    tags: ['saas', 'dashboard', 'analytics', 'nextjs', 'typescript', 'billing']
  },
  {
    id: 'game',
    name: 'Browser Game',
    description: 'Develop an interactive 2D browser game using HTML5 Canvas, JavaScript, and game physics. Includes sprite animation, collision detection, game loop, score system, levels, power-ups, sound effects, and responsive controls. Perfect for arcade-style or puzzle games. This is a web-based game application with interactive user experience and performance optimization requirements.',
    category: 'Game',
    methodology: 'Agile', // Research: Games benefit from iterative development and player feedback
    estimatedSprints: 7, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 259200000,
    tags: ['game', 'canvas', 'interactive', 'javascript', 'html5', 'physics']
  },
  {
    id: 'api',
    name: 'API Gateway',
    description: 'Design a scalable API Gateway service in Go or Rust with rate limiting, authentication (JWT), request/response logging, load balancing, caching, and monitoring. Includes API versioning, request transformation, and integration with microservices. Suitable for enterprise API management. This is a backend infrastructure service for enterprise with high security, reliability, and performance requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'Backend',
    methodology: 'V-Model', // Research: Infrastructure and security-critical systems require structured V-Model approach
    estimatedSprints: 13, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['owasp', 'iso27001', 'soc2'], // Auto-assigned based on API security requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 345600000,
    tags: ['api', 'backend', 'gateway', 'go', 'rust', 'microservices']
  },
  {
    id: 'mobile',
    name: 'Mobile App (PWA)',
    description: 'Build a Progressive Web App (PWA) with React, service workers, and offline capabilities. Features include push notifications, app-like experience, responsive design, touch gestures, camera access, geolocation, and app manifest. Works on iOS, Android, and desktop. This is a mobile web application with cross-platform compatibility, accessibility, and performance requirements.',
    category: 'Mobile',
    methodology: 'Agile', // Research: Mobile apps need iterative development and platform-specific adaptations
    estimatedSprints: 7, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 432000000,
    tags: ['pwa', 'mobile', 'react', 'service-worker', 'offline']
  },
  {
    id: 'ai-chatbot',
    name: 'AI Chatbot Platform',
    description: 'Create an AI-powered chatbot platform with LangChain, vector databases, and RAG (Retrieval Augmented Generation). Includes conversation management, knowledge base integration, multi-turn dialogues, sentiment analysis, and custom training. Perfect for customer support or virtual assistants. This is an AI/ML application with natural language processing, data privacy, and conversational AI requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'AI/ML',
    methodology: 'Agile', // Research: AI/ML projects benefit from iterative development, frequent testing, and adapting to user feedback
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['gdpr', 'owasp', 'iso27001', 'wcag'], // Auto-assigned based on AI/ML requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 518400000,
    tags: ['ai', 'chatbot', 'langchain', 'rag', 'nlp', 'vector-db']
  },
  {
    id: 'data-analytics',
    name: 'Data Analytics Dashboard',
    description: 'Develop a real-time data analytics dashboard with data visualization, charts, graphs, and interactive filters. Includes data ingestion, ETL pipelines, time-series analysis, export functionality, and customizable reports. Built with React, D3.js, and Python backend. This is a data analytics application with real-time processing, data privacy, and visualization requirements.',
    category: 'Analytics',
    methodology: 'Agile', // Research: Data dashboards need iterative refinement based on user feedback
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 604800000,
    tags: ['analytics', 'dashboard', 'data-viz', 'd3', 'python', 'etl']
  },
  {
    id: 'blockchain',
    name: 'Blockchain DApp',
    description: 'Build a decentralized application (DApp) with smart contracts, Web3 integration, and wallet connectivity. Features include token transactions, NFT marketplace, staking mechanisms, governance voting, and blockchain data visualization. Uses Solidity, Web3.js, and React. This is a blockchain application with smart contract security, financial transactions, and decentralized architecture requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'Blockchain',
    methodology: 'V-Model', // Research: Security-critical financial applications require structured V-Model with extensive testing
    estimatedSprints: 13, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['owasp', 'iso27001', 'pci-dss'], // Auto-assigned based on blockchain security requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 691200000,
    tags: ['blockchain', 'dapp', 'web3', 'solidity', 'nft', 'defi']
  },
  {
    id: 'social-media',
    name: 'Social Media Platform',
    description: 'Create a social networking platform with real-time messaging, feed algorithms, user profiles, content sharing, likes/comments, hashtags, and notifications. Built with React, Node.js, Socket.io, and Redis for real-time features. Includes moderation tools and analytics. This is a web application for social networking with real-time communication, user privacy, content moderation, and data protection requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'Web Application',
    methodology: 'Agile', // Research: Social platforms need rapid iteration and feature evolution based on user behavior
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['gdpr', 'owasp', 'wcag'], // Auto-assigned based on social media requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 777600000,
    tags: ['social', 'messaging', 'real-time', 'socket.io', 'redis']
  },
  {
    id: 'cms',
    name: 'Content Management System',
    description: 'Build a headless CMS with content modeling, rich text editor, media library, version control, and API endpoints. Features include multi-language support, workflow management, role-based permissions, and preview functionality. Uses Node.js, MongoDB, and GraphQL. This is a web application for content management with multi-language support, accessibility, and API security requirements.',
    category: 'Web Application',
    methodology: 'Agile', // Research: CMS needs iterative content feature development and content creator feedback
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 864000000,
    tags: ['cms', 'content', 'headless', 'graphql', 'mongodb']
  },
  {
    id: 'iot-dashboard',
    name: 'IoT Device Dashboard',
    description: 'Develop an IoT monitoring dashboard for connected devices with real-time data visualization, device management, alerts, and historical analytics. Includes MQTT integration, device provisioning, firmware updates, and geolocation tracking. Built with React and Python backend. This is an embedded/IoT system for device monitoring with real-time data processing, device security, and safety-critical requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'IoT',
    methodology: 'V-Model', // Research: Safety-critical IoT systems require structured V-Model with extensive validation
    estimatedSprints: 13, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['iso27001', 'owasp', 'iec62443'], // Auto-assigned based on IoT security requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 950400000,
    tags: ['iot', 'mqtt', 'devices', 'monitoring', 'real-time']
  },
  {
    id: 'video-platform',
    name: 'Video Streaming Platform',
    description: 'Create a video streaming platform with upload, encoding, playback, and live streaming capabilities. Features include video player with quality selection, playlists, comments, subscriptions, and recommendation engine. Uses React, Node.js, FFmpeg, and CDN integration. This is a media streaming web application with content delivery, user experience, and performance optimization requirements.',
    category: 'Media',
    methodology: 'Agile', // Research: Media platforms need iterative feature development and performance optimization
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 1036800000,
    tags: ['video', 'streaming', 'media', 'ffmpeg', 'cdn']
  },
  {
    id: 'fintech',
    name: 'FinTech Banking App',
    description: 'Build a secure banking application with account management, transactions, payments, budgeting tools, and financial analytics. Includes multi-factor authentication, encryption, compliance features, and integration with payment processors. Uses React, Node.js, and PostgreSQL. This is a financial application for banking industry with PCI-DSS compliance, financial security, data encryption, and regulatory requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'Finance',
    methodology: 'V-Model', // Research: Financial and regulated systems require structured V-Model with extensive compliance validation
    estimatedSprints: 13, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['pci-dss', 'iso27001', 'gdpr', 'owasp', 'soc2', 'basel-iii'], // Auto-assigned based on financial requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 1123200000,
    tags: ['fintech', 'banking', 'finance', 'security', 'payments']
  },
  {
    id: 'education',
    name: 'E-Learning Platform',
    description: 'Create an online learning management system with courses, video lessons, quizzes, assignments, progress tracking, and certificates. Features include student-teacher interactions, discussion forums, gradebook, and mobile app. Built with React, Node.js, and MongoDB. This is a web application for education industry with accessibility, user experience, and content management requirements.',
    category: 'Education',
    methodology: 'Agile', // Research: Educational platforms benefit from iterative development and educator feedback
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 1209600000,
    tags: ['education', 'lms', 'learning', 'courses', 'quizzes']
  },
  {
    id: 'healthcare',
    name: 'Healthcare Management System',
    description: 'Develop a HIPAA-compliant healthcare management system with patient records, appointments, prescriptions, billing, and telemedicine features. Includes secure messaging, document management, and integration with medical devices. Uses React, Node.js, and encrypted database. This is a healthcare application for medical industry with HIPAA compliance, patient data security, medical device integration, and safety-critical requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'Healthcare',
    methodology: 'V-Model', // Research: Healthcare and safety-critical systems require structured V-Model with extensive validation
    estimatedSprints: 13, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['hipaa', 'iec62304', 'iso13485', 'owasp', 'wcag'], // Auto-assigned based on healthcare requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 1296000000,
    tags: ['healthcare', 'hipaa', 'medical', 'telemedicine', 'compliance']
  },
  {
    id: 'real-estate',
    name: 'Real Estate Platform',
    description: 'Build a property listing platform with search filters, map integration, virtual tours, mortgage calculator, and agent matching. Features include saved searches, property comparisons, document management, and lead tracking. Uses React, Node.js, and geolocation APIs. This is a web application for real estate industry with geolocation services, user experience, and data privacy requirements.',
    category: 'Real Estate',
    methodology: 'Agile', // Research: Real estate platforms need iterative development for map and virtual tour features
    estimatedSprints: 7, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 1382400000,
    tags: ['real-estate', 'property', 'maps', 'virtual-tour', 'mortgage']
  },
  {
    id: 'music-streaming',
    name: 'Music Streaming Service',
    description: 'Create a music streaming platform with audio playback, playlists, recommendations, artist pages, and social features. Includes offline downloads, lyrics display, podcast support, and radio stations. Built with React, Node.js, and audio processing libraries. This is a media streaming web application with audio processing, user experience, and performance optimization requirements.',
    category: 'Media',
    methodology: 'Agile', // Research: Media platforms need iterative feature development and recommendation algorithm tuning
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 1468800000,
    tags: ['music', 'streaming', 'audio', 'playlists', 'podcasts']
  },
  {
    id: 'project-management',
    name: 'Project Management Tool',
    description: 'Develop a comprehensive project management platform with kanban boards, Gantt charts, time tracking, team collaboration, and reporting. Features include task dependencies, resource allocation, file sharing, and integrations. Uses React, Node.js, and real-time updates. This is a web application for productivity with real-time collaboration, user experience, and data management requirements.',
    category: 'Productivity',
    methodology: 'Agile', // Research: Project management tools benefit from iterative development and user workflow feedback
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 1555200000,
    tags: ['project-management', 'kanban', 'gantt', 'collaboration', 'tracking']
  },
  {
    id: 'marketplace',
    name: 'Multi-Vendor Marketplace',
    description: 'Build a marketplace platform connecting buyers and sellers with product listings, reviews, messaging, escrow payments, and dispute resolution. Includes vendor dashboards, commission management, and analytics. Uses React, Node.js, and payment gateway integration. This is a web application for e-commerce industry with payment processing, PCI-DSS compliance, user data security, and multi-vendor management requirements. Features enhanced prompt engineering for structured AI agent communication and online research capabilities.',
    category: 'E-Commerce',
    methodology: 'Agile', // Research: Marketplaces need iterative development for multi-vendor workflows and payment processing
    estimatedSprints: 12, // 🤖 AI-POWERED: Initial estimate - will be refined by AI analysis based on project description, complexity, and methodology when project is created
    selectedStandards: ['owasp', 'pci-dss', 'gdpr', 'wcag'], // Auto-assigned based on marketplace requirements
    agents: AGENTS,
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: 50.00, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    createdAt: Date.now() - 1641600000,
    tags: ['marketplace', 'multi-vendor', 'ecommerce', 'escrow', 'reviews']
  }
];

// Animated Thumbnail Component
interface AnimatedThumbnailProps {
  templateId: string;
  className?: string;
}

const AnimatedThumbnail: React.FC<AnimatedThumbnailProps> = ({ templateId, className = '' }) => {
  const iconMap: { [key: string]: React.ElementType } = {
    'ecommerce': ShoppingCart,
    'saas': Layout,
    'game': Gamepad2,
    'api': Server,
    'mobile': Smartphone,
    'ai-chatbot': Bot,
    'data-analytics': BarChart3,
    'blockchain': Coins,
    'social-media': Users,
    'cms': FileCode,
    'iot-dashboard': Network,
    'video-platform': Camera,
    'fintech': CreditCard,
    'education': BookOpen,
    'healthcare': Shield,
    'real-estate': Globe,
    'music-streaming': Music,
    'project-management': Zap,
    'marketplace': ShoppingCart,
  };

  const Icon = iconMap[templateId] || Sparkles;

  const getAnimationClass = (id: string) => {
    const animations: { [key: string]: string } = {
      'ecommerce': 'animate-bounce',
      'saas': 'animate-pulse',
      'game': 'animate-spin',
      'api': 'animate-ping',
      'mobile': 'animate-bounce',
      'ai-chatbot': 'animate-pulse',
      'data-analytics': 'animate-pulse',
      'blockchain': 'animate-spin',
      'social-media': 'animate-bounce',
      'cms': 'animate-pulse',
      'iot-dashboard': 'animate-ping',
      'video-platform': 'animate-pulse',
      'fintech': 'animate-bounce',
      'education': 'animate-pulse',
      'healthcare': 'animate-ping',
      'real-estate': 'animate-bounce',
      'music-streaming': 'animate-pulse',
      'project-management': 'animate-spin',
      'marketplace': 'animate-bounce',
    };
    return animations[id] || 'animate-pulse';
  };

  // Custom animation styles for smoother effects
  const getAnimationStyle = (id: string) => {
    const styles: { [key: string]: React.CSSProperties } = {
      'ecommerce': { animationDuration: '2s', animationTimingFunction: 'ease-in-out' },
      'saas': { animationDuration: '2.5s', animationTimingFunction: 'ease-in-out' },
      'game': { animationDuration: '3s', animationTimingFunction: 'linear' },
      'api': { animationDuration: '2s', animationTimingFunction: 'ease-out' },
      'mobile': { animationDuration: '2s', animationTimingFunction: 'ease-in-out' },
      'ai-chatbot': { animationDuration: '2.5s', animationTimingFunction: 'ease-in-out' },
      'data-analytics': { animationDuration: '2s', animationTimingFunction: 'ease-in-out' },
      'blockchain': { animationDuration: '4s', animationTimingFunction: 'linear' },
      'social-media': { animationDuration: '2s', animationTimingFunction: 'ease-in-out' },
      'cms': { animationDuration: '2.5s', animationTimingFunction: 'ease-in-out' },
      'iot-dashboard': { animationDuration: '2s', animationTimingFunction: 'ease-out' },
      'video-platform': { animationDuration: '2.5s', animationTimingFunction: 'ease-in-out' },
      'fintech': { animationDuration: '2s', animationTimingFunction: 'ease-in-out' },
      'education': { animationDuration: '2.5s', animationTimingFunction: 'ease-in-out' },
      'healthcare': { animationDuration: '2s', animationTimingFunction: 'ease-out' },
      'real-estate': { animationDuration: '2s', animationTimingFunction: 'ease-in-out' },
      'music-streaming': { animationDuration: '2.5s', animationTimingFunction: 'ease-in-out' },
      'project-management': { animationDuration: '3s', animationTimingFunction: 'linear' },
      'marketplace': { animationDuration: '2s', animationTimingFunction: 'ease-in-out' },
    };
    return styles[id] || { animationDuration: '2s', animationTimingFunction: 'ease-in-out' };
  };

  const getGradientClass = (id: string) => {
    const gradients: { [key: string]: string } = {
      'ecommerce': 'from-orange-400/30 to-pink-400/30',
      'saas': 'from-blue-400/30 to-indigo-400/30',
      'game': 'from-purple-400/30 to-pink-400/30',
      'api': 'from-green-400/30 to-emerald-400/30',
      'mobile': 'from-cyan-400/30 to-blue-400/30',
      'ai-chatbot': 'from-violet-400/30 to-purple-400/30',
      'data-analytics': 'from-yellow-400/30 to-orange-400/30',
      'blockchain': 'from-amber-400/30 to-yellow-400/30',
      'social-media': 'from-blue-400/30 to-cyan-400/30',
      'cms': 'from-slate-400/30 to-gray-400/30',
      'iot-dashboard': 'from-teal-400/30 to-green-400/30',
      'video-platform': 'from-red-400/30 to-rose-400/30',
      'fintech': 'from-emerald-400/30 to-green-400/30',
      'education': 'from-indigo-400/30 to-blue-400/30',
      'healthcare': 'from-red-400/30 to-pink-400/30',
      'real-estate': 'from-blue-400/30 to-indigo-400/30',
      'music-streaming': 'from-purple-400/30 to-pink-400/30',
      'project-management': 'from-orange-400/30 to-red-400/30',
      'marketplace': 'from-green-400/30 to-emerald-400/30',
    };
    return gradients[id] || 'from-primary/30 to-blue-400/30';
  };

  return (
    <div className={`relative ${className}`}>
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getGradientClass(templateId)} flex items-center justify-center border border-primary/20 group-hover:border-primary/40 transition-all duration-300 group-hover:scale-110 shadow-sm group-hover:shadow-lg`}>
        <Icon size={24} className={`text-primary ${getAnimationClass(templateId)}`} style={getAnimationStyle(templateId)} />
      </div>
      {/* Animated background glow */}
      <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${getGradientClass(templateId)} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300 ${getAnimationClass(templateId)}`} style={{ animationDuration: '3s' }} />
      {/* Pulsing ring effect */}
      <div className={`absolute inset-0 rounded-xl border-2 border-primary/30 opacity-0 group-hover:opacity-100 ${getAnimationClass(templateId)}`} style={{ animationDuration: '2s' }} />
    </div>
  );
};

const ProjectTemplateSelector: React.FC<ProjectTemplateSelectorProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onSaveAsTemplate,
  currentProject
}) => {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Get user role from localStorage
  const currentUser = JSON.parse(localStorage.getItem('orbitai_user') || '{}');
  const userRole = currentUser?.role || 'user';
  
  // Feature flag checks
  const canUseTemplates = useFeatureAccess('template_use', userRole);
  const canCreateTemplates = useFeatureAccess('template_creation', userRole);
  const canShareTemplates = useFeatureAccess('template_sharing', userRole);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      // Load default templates (hardcoded)
      const defaultTemplates = DEFAULT_TEMPLATES;
      
      // Load user templates from database
      try {
        const userTemplates = await templatesApi.getAll();
        // Merge default and user templates
        setTemplates([...defaultTemplates, ...userTemplates]);
      } catch (apiError: any) {
        // If API fails (e.g., not authenticated), just use defaults
        if (apiError.message?.includes('Authentication')) {
          console.warn('User not authenticated, showing default templates only');
          setTemplates(defaultTemplates);
        } else {
          console.error('Failed to load templates from database:', apiError);
          setTemplates(defaultTemplates);
        }
      }
    } catch (e) {
      console.error('Failed to load templates', e);
      setTemplates(DEFAULT_TEMPLATES);
    }
  };

  const handleSaveTemplate = async () => {
    if (!canCreateTemplates.enabled) {
      showAlert('Template creation is not enabled for your role');
      return;
    }
    
    if (!templateName.trim() || !currentProject) return;

    const newTemplate: Omit<ProjectTemplate, 'id' | 'createdAt'> = {
      name: templateName,
      description: templateDescription || currentProject.description,
      methodology: currentProject.methodology,
      estimatedSprints: currentProject.estimatedSprints,
      agents: currentProject.agents,
      selectedStandards: currentProject.selectedStandards || [],
      mcpServers: currentProject.mcpServers,
      budget: currentProject.budget,
      tags: [],
      isPublic: false // Default to private
    };

    try {
      const created = await templatesApi.create(newTemplate);
      await loadTemplates();
      setShowSaveModal(false);
      setTemplateName('');
      setTemplateDescription('');
      onSaveAsTemplate(created);
    } catch (e: any) {
      console.error('Failed to save template', e);
      alert(`Failed to save template: ${e.message || 'Unknown error'}`);
    }
  };

  const handleShareTemplate = async (templateId: string, isPublic: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!canShareTemplates.enabled) {
      alert('Template sharing is not enabled for your role');
      return;
    }

    try {
      await templatesApi.share(templateId, isPublic);
      await loadTemplates();
    } catch (e: any) {
      console.error('Failed to share template', e);
      alert(`Failed to ${isPublic ? 'share' : 'unshare'} template: ${e.message || 'Unknown error'}`);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (await showConfirm('Delete this template?')) {
      try {
        // Check if it's a default template (can't delete)
        const isDefault = DEFAULT_TEMPLATES.some(t => t.id === id);
        if (isDefault) {
          alert('Cannot delete default templates');
          return;
        }
        
        await templatesApi.delete(id);
        await loadTemplates();
      } catch (e: any) {
        console.error('Failed to delete template', e);
        alert(`Failed to delete template: ${e.message || 'Unknown error'}`);
      }
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
        <div 
          className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 m-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between shrink-0">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Folder size={20} className="text-primary" /> Project Templates
              </h2>
              <p className="text-xs text-slate-500 mt-1">Select a template to start or save your current project as a template</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded">
              <X size={20} />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
              ))}
            </select>
            {currentProject && (
              <button
                onClick={() => setShowSaveModal(true)}
                className="px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Save size={16} /> Save Current
              </button>
            )}
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <Folder size={48} className="mb-4 opacity-50" />
                <p className="text-sm font-medium">No templates found</p>
                <p className="text-xs mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => {
                      onSelectTemplate(template);
                      onClose();
                    }}
                    className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-primary hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
                  >
                    {template.id.startsWith('user_', 'error') && (
                      <button
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        className="absolute top-2 right-2 p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <div className="flex items-start gap-3 mb-3">
                      <AnimatedThumbnail templateId={template.id} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-800 mb-1 group-hover:text-primary transition-colors">{template.name}</h3>
                        {template.category && (
                          <span className="inline-block text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-full">{template.category}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4 min-h-[60px]">{template.description}</p>
                    {template.isPublic && (
                      <div className="mb-2 flex items-center gap-1 text-xs text-blue-600">
                        <Share2 size={12} />
                        <span className="font-medium">Public Template</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {template.methodology && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20" title={`SDLC Methodology: ${template.methodology}`}>{template.methodology}</span>
                      )}
                      {!template.methodology && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">System Determined</span>
                      )}
                      {template.estimatedSprints && (
                        <span className="text-[10px] font-bold text-slate-600 bg-blue-50 px-2 py-1 rounded border border-blue-200" title={`Estimated Sprints: ${template.estimatedSprints}`}>
                          ~{template.estimatedSprints} sprints
                        </span>
                      )}
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {template.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="text-[9px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                              {tag}
                            </span>
                          ))}
                          {template.tags.length > 3 && (
                            <span className="text-[9px] text-slate-400">+{template.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{template.agents.length} agents configured</span>
                      <span className="text-primary font-bold group-hover:text-blue-600 transition-colors">Use Template →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSaveModal(false)}>
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-4">Save as Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="My Project Template"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Description (Optional)</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Describe what this template is for..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className="flex-1 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectTemplateSelector;

