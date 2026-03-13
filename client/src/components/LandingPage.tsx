
import React, { useEffect, useState } from 'react';
import { ChevronRight, Zap, Shield, Globe, Cpu, Layers, Play, CheckCircle2, Hexagon, ArrowRight, Star, Terminal, Box, Activity, Code, Workflow, Rocket, Users, Lock, Sparkles, ShieldCheck, AlertTriangle, TrendingUp, Search, AlertCircle, BarChart3, Layout, Loader2, Quote, ChevronDown, X, Check, Minus } from 'lucide-react';
import { getPublicPackages, PublicPackage } from '../services/publicPackagesApi';
import { getPublicPageContent, PageContent } from '../services/pageContentApi';
import Logo from './Logo';
import { useAuth } from '../contexts/AuthContext';

interface LandingPageProps {
  onLaunch: () => void;
  onLaunchDemo?: () => void;
  onSignup: (preSelectedPackage?: any) => void;
}

// Icon mapping for packages
const iconMap: Record<string, any> = {
  'Layout': Layout,
  'Zap': Zap,
  'Shield': Shield,
  'starter': Layout,
  'pro': Zap,
  'enterprise': Shield
};

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch, onLaunchDemo, onSignup }) => {
  const { loginAsGuest } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [loadingPageContent, setLoadingPageContent] = useState(true);

  // Handle guest login - logs in as guest and navigates directly to setup
  // Uses onLaunchDemo prop to properly set viewMode AND hash together
  const handleGuestLogin = () => {
    loginAsGuest();
    // Use onLaunchDemo to properly navigate - it sets both viewMode and hash
    if (onLaunchDemo) {
      onLaunchDemo();
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  // Smooth scroll handler for navigation links using scrollIntoView
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const element = document.getElementById(targetId);
    if (!element) {
      console.warn(`Element with id "${targetId}" not found`);
      return;
    }

    // Get navbar height for offset
    const navbar = document.querySelector('nav');
    const navbarHeight = navbar ? navbar.offsetHeight : 100;

    // Set scroll margin to account for fixed navbar
    element.style.scrollMarginTop = `${navbarHeight}px`;

    // Use scrollIntoView with smooth behavior
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    });

    // Update URL hash without triggering navigation
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', `#${targetId}`);
    }
  };

  useEffect(() => {
    // Fetch packages from backend
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        const fetchedPackages = await getPublicPackages();
        setPackages(fetchedPackages);
      } catch (error) {
        // Silently handle API errors - backend may not be running
        // Use fallback packages if API fails
        const fallbackPackages: PublicPackage[] = [
          {
            id: 'starter',
            name: 'Starter',
            displayName: 'Starter',
            price: 0,
            billingCycle: 'monthly',
            features: [
              'Up to 3 projects',
              'Basic AI agents',
              'Community support',
              'Local storage only'
            ],
            metadata: { highlight: false, icon: 'starter' }
          },
          {
            id: 'pro',
            name: 'Pro',
            displayName: 'Pro',
            price: 29,
            billingCycle: 'monthly',
            features: [
              'Unlimited projects',
              'Advanced AI agents',
              'Priority support',
              'Cloud sync',
              'Advanced analytics'
            ],
            metadata: { highlight: true, icon: 'pro' }
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            displayName: 'Enterprise',
            price: 99,
            billingCycle: 'monthly',
            features: [
              'Everything in Pro',
              'Custom agent configurations',
              'Dedicated support',
              'SLA guarantee',
              'Custom integrations'
            ],
            metadata: { highlight: false, icon: 'enterprise' }
          }
        ];
        setPackages(fallbackPackages);
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, []);

  // Fetch page content from backend
  useEffect(() => {
    const fetchPageContent = async () => {
      try {
        setLoadingPageContent(true);
        const content = await getPublicPageContent('home');
        setPageContent(content);
      } catch (error) {
        // Silently handle API errors - backend may not be running
        // Will fallback to hardcoded content
        console.warn('Failed to fetch page content, using defaults:', error);
        setPageContent(null);
      } finally {
        setLoadingPageContent(false);
      }
    };

    fetchPageContent();
  }, []);

  return (
    <div className="w-full bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative scroll-smooth">

      {/* Custom Styles for Animations */}
      <style>{`
        html {
          scroll-behavior: smooth;
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.3); }
          50% { box-shadow: 0 0 40px rgba(37, 99, 235, 0.6); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animate-spin-slow-reverse {
          animation: spin-slow 15s linear infinite reverse;
        }
        @keyframes flare-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1) rotate(0deg); }
          50% { opacity: 0.7; transform: scale(1.2) rotate(180deg); }
        }
        @keyframes flare-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes flare-drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }
        .animate-flare-pulse {
          animation: flare-pulse 4s ease-in-out infinite;
        }
        .animate-flare-rotate {
          animation: flare-rotate 15s linear infinite;
        }
        .animate-flare-drift {
          animation: flare-drift 8s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0) translate(0, 0); }
          50% { opacity: 1; transform: scale(1) translate(var(--tx), var(--ty)); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite;
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 8s ease infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-3000 {
          animation-delay: 3s;
        }
        .glass-effect {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .glass-dark {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .hover-lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .hover-lift:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      {/* Simple Clean Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-white" />
      </div>

      {/* Minimal Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-sm py-3 shadow-sm border-b border-slate-100' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Logo size="md" animated={true} showText={true} className="group-hover:scale-105 transition-transform duration-300" />
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a
              href="#risk-control"
              onClick={(e) => handleSmoothScroll(e, 'risk-control')}
              className="hover:text-primary transition-all relative group cursor-pointer"
            >
              Risk Engine
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </a>
            <a
              href="#features"
              onClick={(e) => handleSmoothScroll(e, 'features')}
              className="hover:text-primary transition-all relative group cursor-pointer"
            >
              Platform
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </a>
            <a
              href="#workflow"
              onClick={(e) => handleSmoothScroll(e, 'workflow')}
              className="hover:text-primary transition-all relative group cursor-pointer"
            >
              Workflow
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </a>
            <a
              href="#testimonials"
              onClick={(e) => handleSmoothScroll(e, 'testimonials')}
              className="hover:text-primary transition-all relative group cursor-pointer"
            >
              Testimonials
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </a>
            <a
              href="#pricing"
              onClick={(e) => handleSmoothScroll(e, 'pricing')}
              className="hover:text-primary transition-all relative group cursor-pointer"
            >
              Pricing
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onSignup}
              className="hidden md:block text-sm font-bold text-slate-600 hover:text-primary transition-all hover:scale-105"
            >
              Sign Up
            </button>
            <button
              onClick={onLaunch}
              className="group relative px-5 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-full text-xs font-bold uppercase tracking-wider overflow-hidden hover:shadow-2xl hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center gap-2 group-hover:gap-3 transition-all">
                Sign In to Launch <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center relative z-20">
          {/* Hero Badge - from PageContent or fallback */}
          {(() => {
            const heroSection = pageContent?.sections?.hero;
            const badgeText = heroSection?.content?.subtitle || 'Neural Stream Chat • AI Brainstorming • Live Preview';

            return (
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-sm`}>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> {badgeText}
              </div>
            );
          })()}

          {/* Hero Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tight mb-8 leading-[1.1]">
            {(() => {
              const heroSection = pageContent?.sections?.hero;
              const title = heroSection?.content?.title || 'Build Software. Intelligently.';

              // Split title if it contains a period
              if (title.includes('.')) {
                const parts = title.split('.');
                return (
                  <>
                    {parts[0]} <br />
                    <span className="relative inline-block">
                      <span className="text-blue-600">{parts[1] || ''}.</span>

                    </span>
                  </>
                );
              }

              return (
                <>
                  {title.split(' ').slice(0, 2).join(' ')} <br />
                  <span className="relative inline-block">
                    <span className="text-blue-600">{title.split(' ').slice(2).join(' ')}</span>

                  </span>
                </>
              );
            })()}
          </h1>

          {/* Hero Description */}
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            {(() => {
              const heroSection = pageContent?.sections?.hero;
              const description = heroSection?.content?.description || 'Describe your idea, brainstorm with AI, preview your prototype, and generate production-ready code. OrbitAI combines <strong>Neural Stream Chat</strong>, <strong>Visual Mind Maps</strong>, and <strong>Multi-LLM Routing</strong> for intelligent software creation.';

              // If description contains HTML, render it safely
              if (description.includes('<')) {
                return <span dangerouslySetInnerHTML={{ __html: description }} />;
              }

              return description;
            })()}
          </p>

          {/* Hero Buttons */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            {(() => {
              const heroSection = pageContent?.sections?.hero;
              const buttons = heroSection?.content?.buttons || [
                { text: 'Start Building Free', link: '#signup', variant: 'primary' },
                { text: 'Launch Console Demo', link: '#launch', variant: 'secondary' }
              ];

              return buttons.map((button: any, index: number) => {
                if (button.variant === 'primary') {
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (button.link === '#signup' || button.link?.includes('signup')) {
                          onSignup();
                        } else if (button.link === '#launch' || button.link?.includes('launch')) {
                          onLaunchDemo?.() || onLaunch();
                        } else {
                          window.location.href = button.link || '#';
                        }
                      }}
                      className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold text-sm transition-colors w-full md:w-auto"
                    >
                      {button.text || 'Start Building Free'}
                    </button>
                  );
                } else {
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (button.link === '#signup' || button.link?.includes('signup')) {
                          onSignup();
                        } else if (button.link === '#launch' || button.link?.includes('launch')) {
                          onLaunchDemo?.() || onLaunch();
                        } else {
                          window.location.href = button.link || '#';
                        }
                      }}
                      className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full font-semibold text-sm transition-colors w-full md:w-auto flex items-center justify-center gap-2"
                    >
                      <Play size={16} className="fill-current" /> {button.text || 'Launch Console Demo'}
                    </button>
                  );
                }
              });
            })()}
          </div>

          {/* Continue as Guest Button */}
          <div className="mt-4">
            <button
              onClick={handleGuestLogin}
              className="text-sm text-slate-500 hover:text-blue-600 transition-colors underline underline-offset-4 decoration-dotted hover:decoration-solid"
            >
              or continue as guest →
            </button>
          </div>
        </div>

        {/* Hero Visual Mockup */}
        <div className="mt-20 relative max-w-5xl mx-auto">
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            {/* Simple Window Chrome */}
            <div className="h-12 border-b border-slate-100 bg-slate-50 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="ml-4 flex-1 flex justify-center">
                <div className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-500 flex items-center gap-2">
                  <Lock size={10} className="text-green-500" />
                  <span>orbit-ai.cloud/workspace</span>
                </div>
              </div>
            </div>

            {/* Abstract UI Representation */}
            <div className="aspect-[16/9] bg-slate-50 relative p-6 grid grid-cols-12 gap-6 overflow-hidden">
              {/* Sidebar */}
              <div className="col-span-3 space-y-3 hidden sm:block">
                <div className="h-8 w-24 bg-slate-200 rounded-lg mb-6 animate-pulse"></div>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-10 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center px-3 gap-2">
                    <div className="w-6 h-6 rounded bg-slate-100"></div>
                    <div className="h-2 w-16 bg-slate-100 rounded"></div>
                  </div>
                ))}
              </div>

              {/* Main Canvas */}
              <div className="col-span-12 sm:col-span-9 flex flex-col gap-4">
                <div className="flex gap-4 mb-2">
                  <div className="h-24 flex-1 rounded-xl bg-white border border-slate-200 shadow-sm p-4 relative overflow-hidden group/card">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <div className="h-2 w-20 bg-slate-200 rounded mb-2"></div>
                    <div className="h-8 w-12 bg-blue-50 rounded mb-2"></div>
                    <Activity className="absolute bottom-2 right-2 text-blue-100 group-hover/card:text-blue-500 transition-colors" size={40} />
                  </div>
                  <div className="h-24 flex-1 rounded-xl bg-white border border-slate-200 shadow-sm p-4 relative overflow-hidden hidden sm:block">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <div className="h-2 w-20 bg-slate-200 rounded mb-2"></div>
                    <div className="h-8 w-12 bg-purple-50 rounded mb-2"></div>
                  </div>
                  <div className="h-24 flex-1 rounded-xl bg-white border border-slate-200 shadow-sm p-4 relative overflow-hidden hidden sm:block">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                    <div className="h-2 w-20 bg-slate-200 rounded mb-2"></div>
                    <div className="h-8 w-12 bg-green-50 rounded mb-2"></div>
                  </div>
                </div>

                <div className="flex-1 rounded-xl bg-slate-900 border border-slate-800 p-6 font-mono text-[10px] text-slate-300 relative overflow-hidden shadow-inner">
                  <div className="absolute top-2 right-2 flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-green-400">$ Starting Neural Stream Chat...</p>
                    <p>{'>'} What would you like to build?</p>
                    <p className="text-blue-400">{'>'} "I want a task management app"</p>
                    <p>{'>'} 🧠 Generating mind map with 12 ideas...</p>
                    <p>{'>'} 📊 Scope: MVP selected</p>
                    <p className="text-blue-400">{'>'} 🎨 Creating prototype preview...</p>
                    <p>{'>'} ✅ Preview ready in both User & Admin views</p>
                    <p>{'>'} 📁 Generating multi-file codebase... <span className="text-green-400">DONE</span></p>
                    <p className="animate-pulse">_</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RISK & SCOPE CONTROL SECTION */}
      <section id="risk-control" className="py-24 bg-white relative border-y border-slate-200 overflow-hidden scroll-mt-24">
        {/* Diagonal Background */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-50 skew-x-12 translate-x-20 -z-10"></div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider mb-6 border border-red-100">
              <AlertTriangle size={12} /> The Industry Problem
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Projects fail due to <span className="text-red-500 relative inline-block">Risk & Scope Creep.<svg className="absolute w-full h-2 -bottom-1 left-0 text-red-200" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" /></svg></span>
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed mb-8">
              Traditional AI coding assistants generate code blindly. They don't track requirements, ignore safety standards, and let features bloat uncontrollably.
            </p>

            <div className="space-y-6">
              <div className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <Activity size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">Unchecked Scope Creep</h4>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    Features expanding beyond the original vision destroy budgets. OrbitAI's <strong>Orchestrator</strong> enforces strict phase gates, rejecting unauthorized additions.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">Hidden Technical Risk</h4>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    Security flaws and architectural debt accumulate unnoticed. Our <strong>QA Swarm</strong> runs continuous risk assessments against ISO/OWASP standards before deployment.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Demo of Risk Engine */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-1000"></div>
            <div className="bg-slate-900 rounded-2xl p-8 text-white relative shadow-2xl border border-slate-700">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]"></div>
                  <span className="font-mono text-sm text-red-400 font-bold tracking-tight">ALERT: High Risk Detected</span>
                </div>
                <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded text-slate-300 uppercase tracking-wider">System Monitor</span>
              </div>

              <div className="space-y-4 font-mono text-xs">
                <div className="flex gap-4 opacity-50">
                  <span className="text-slate-500">09:14:22</span>
                  <span>Scanning codebase for vulnerabilities...</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-blue-400">09:14:25</span>
                  <span>{'>'} Risk Assessment Module: <span className="text-green-400 font-bold">ACTIVE</span></span>
                </div>
                <div className="flex gap-4">
                  <span className="text-blue-400">09:14:28</span>
                  <span>{'>'} Detecting Scope Drift in Sprint 2...</span>
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 animate-pulse">
                  <p className="font-bold mb-1 flex items-center gap-2"><AlertCircle size={12} /> Critical Issue Found</p>
                  <p>Proposed feature "Social Graph" exceeds Sprint 2 budget by 40%.</p>
                  <p className="mt-2 text-white font-bold">Action: <span className="underline decoration-red-500 underline-offset-4 cursor-pointer hover:text-red-400">Reject</span> or <span className="underline decoration-slate-500 underline-offset-4 cursor-pointer hover:text-slate-300">Reschedule</span></p>
                </div>
                <div className="flex gap-4 pt-2">
                  <span className="text-blue-400">09:15:01</span>
                  <span className="text-green-400">Orchestrator auto-corrected timeline.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-32 px-6 relative z-10 bg-slate-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
              An intelligent platform for <br /><span className="text-primary">end-to-end software creation.</span>
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">
              From conversational ideation to deployed code. Neural Stream Chat, AI Brainstorming, Live Prototypes, and Multi-LLM intelligence in one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Feature 1 - Enhanced */}
            <div className="col-span-1 md:col-span-2 glass-effect rounded-3xl p-8 border border-slate-200/50 hover:border-blue-300/50 transition-all hover:shadow-2xl group relative overflow-hidden hover-lift">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full blur-[100px] opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm mb-6 text-blue-600">
                  <Users size={24} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">Neural Stream Chat</h3>
                <p className="text-slate-600 mb-8 max-w-md leading-relaxed">
                  Describe your ideas naturally. The Orchestrator agent guides you through definition, brainstorming, and implementation with real-time streaming, voice input, and intelligent follow-ups.
                </p>

                <div className="flex gap-3 flex-wrap">
                  {['Raed (Orchestrator)', 'Voice Input', 'Streaming', 'Context-Aware'].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700">
                      <div className={`w-2 h-2 rounded-full ${['bg-yellow-400', 'bg-purple-400', 'bg-blue-400', 'bg-green-400'][i]}`} />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature 2 - Enhanced */}
            <div className="glass-dark text-white rounded-3xl p-8 border border-slate-700/50 shadow-2xl relative overflow-hidden group hover-lift">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.3),transparent_60%)]" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center mb-6 text-white backdrop-blur-sm">
                  <Terminal size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">AI Brainstorming & Mind Maps</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Generate ideas visually with interactive mind maps. The AI suggests features, architectures, and approaches while you explore and refine your vision.
                </p>
                <div className="bg-black/50 rounded-lg p-3 font-mono text-[10px] text-green-400 border border-white/10">
                  <p>{'>'} 🧠 12 ideas generated</p>
                  <p>{'>'} 📊 Categories: Core, UI, Backend</p>
                  <p className="text-white">{'>'} Mind map ready to explore</p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:border-slate-300 transition-all hover:shadow-lg">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-6 text-purple-600">
                <Layers size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Live Prototype Preview</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Preview your app before a single line of code is written. Dual-view shows both User-facing and Admin Console interfaces in real-time.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="col-span-1 md:col-span-2 bg-white rounded-2xl p-8 border border-slate-200 hover:border-slate-300 transition-all hover:shadow-lg">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-6 text-green-600">
                    <Shield size={24} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">Multi-LLM Router</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Intelligent routing between 15+ AI models (GPT-4, Claude, Gemini, etc.) with cost optimization, auto-fallback, and performance tracking. Get the best model for each task automatically.
                  </p>
                </div>
                <div className="flex-1 w-full">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-2">
                      <span className="text-slate-500">Model Router</span>
                      <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">ACTIVE</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> GPT-4o</span>
                      <span>Fast</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Claude-3.5</span>
                      <span>Complex</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Gemini-2.5</span>
                      <span>Creative</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          {[
            { label: "LLM Models", value: "15+", icon: Cpu },
            { label: "Project Templates", value: "50+", icon: Box },
            { label: "Specialized Agents", value: "10+", icon: Users },
            { label: "Code Generation", value: "∞", icon: Code },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <stat.icon className="text-blue-600" size={24} />
              </div>
              <div className="text-4xl md:text-5xl font-bold text-slate-900 mb-2 tracking-tight">{stat.value}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-32 px-6 bg-slate-50 scroll-mt-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">How OrbitAI Works</h2>
            <p className="text-slate-500 mt-2">From prompt to production in minutes.</p>
          </div>

          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute left-[28px] top-0 bottom-0 w-0.5 bg-slate-200 md:left-1/2 md:-ml-px"></div>

            {[
              { title: "Chat & Define", desc: "Describe your project in natural language. The Neural Stream Chat understands your vision and asks clarifying questions.", icon: Rocket },
              { title: "AI Brainstorming", desc: "Explore ideas visually with interactive mind maps. The AI generates features, architectures, and approaches for you to refine.", icon: Layers },
              { title: "Scope & Preview", desc: "Select your scope level (MVP, Simple, Standard, Full) and preview your prototype in both User and Admin views before any code is written.", icon: Terminal },
              { title: "Code Generation", desc: "The multi-agent swarm generates production-ready code, tests, and documentation with full traceability.", icon: ShieldCheck }
            ].map((step, i) => (
              <div key={i} className={`relative flex items-center gap-8 mb-12 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                <div className={`flex-1 hidden md:block text-${i % 2 === 0 ? 'right' : 'left'}`}>
                  <h3 className="text-xl font-bold text-slate-900">{step.title}</h3>
                  <p className="text-slate-600 text-sm mt-2 leading-relaxed">{step.desc}</p>
                </div>

                <div className="relative z-10 w-14 h-14 rounded-full bg-white border-4 border-slate-100 flex items-center justify-center shadow-lg shrink-0">
                  <step.icon size={24} className="text-primary" />
                </div>

                <div className="flex-1 md:hidden">
                  <h3 className="text-xl font-bold text-slate-900">{step.title}</h3>
                  <p className="text-slate-600 text-sm mt-2 leading-relaxed">{step.desc}</p>
                </div>

                <div className="flex-1 hidden md:block"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-32 px-6 bg-white relative overflow-hidden scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-6 border border-blue-100">
              <Star size={12} className="fill-current" /> Trusted by Developers
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
              Loved by teams building <br /><span className="text-primary">the future</span>
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">
              See what developers and teams are saying about OrbitAI
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Chen",
                role: "CTO at TechFlow",
                image: "👩‍💻",
                rating: 5,
                text: "OrbitAI transformed our development process. The risk assessment engine caught critical issues before they became problems. We shipped 3x faster with zero security incidents."
              },
              {
                name: "Marcus Rodriguez",
                role: "Lead Developer",
                image: "👨‍💻",
                rating: 5,
                text: "The multi-agent system is incredible. Watching agents collaborate in real-time feels like having a world-class team working 24/7. The V-Model traceability gives us complete confidence in our codebase."
              },
              {
                name: "Emily Watson",
                role: "Product Manager",
                image: "👩‍💼",
                rating: 5,
                text: "Scope creep was killing our projects. OrbitAI's orchestrator enforces discipline we never had. Features get built on time, on budget, and with full compliance. Game changer."
              }
            ].map((testimonial, i) => (
              <div
                key={i}
                className="glass-effect rounded-2xl p-8 border border-slate-200/50 hover:border-blue-300/50 transition-all hover:shadow-2xl group relative overflow-hidden hover-lift"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full blur-[80px] opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, j) => (
                      <Star key={j} size={16} className="text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <Quote className="text-blue-200 mb-4" size={32} />
                  <p className="text-slate-700 mb-6 leading-relaxed font-medium">
                    "{testimonial.text}"
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      {testimonial.image}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-primary transition-colors">{testimonial.name}</div>
                      <div className="text-sm text-slate-500">{testimonial.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="py-32 px-6 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
              OrbitAI vs. Traditional Tools
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">
              See how OrbitAI compares to traditional development workflows
            </p>
          </div>

          <div className="glass-effect rounded-2xl border border-slate-200/50 shadow-2xl overflow-hidden hover:shadow-blue-500/5 transition-all">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200">
                    <th className="text-left p-6 font-bold text-slate-900">Feature</th>
                    <th className="text-center p-6 font-bold text-slate-900">Traditional Tools</th>
                    <th className="text-center p-6 font-bold text-primary bg-gradient-to-r from-blue-50 to-indigo-50">OrbitAI</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Conversational Input", traditional: "Text prompts only", orbitai: "Neural Stream Chat with voice" },
                    { feature: "Ideation & Brainstorming", traditional: "External tools", orbitai: "AI-powered mind maps" },
                    { feature: "Prototype Preview", traditional: "Build then view", orbitai: "Instant dual-view preview" },
                    { feature: "LLM Selection", traditional: "Single model", orbitai: "15+ models with auto-routing" },
                    { feature: "Scope Management", traditional: "Manual tracking", orbitai: "4-level scope selector" },
                    { feature: "Code Generation", traditional: "Single-file snippets", orbitai: "Multi-file project generation" },
                    { feature: "Agent Collaboration", traditional: "N/A", orbitai: "10+ specialized AI agents" },
                    { feature: "Time to Prototype", traditional: "Days to weeks", orbitai: "Minutes" }
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/20 transition-all group">
                      <td className="p-6 font-semibold text-slate-900 group-hover:text-primary transition-colors">{row.feature}</td>
                      <td className="p-6 text-center text-slate-600">
                        <div className="flex items-center justify-center gap-2">
                          <Minus size={16} className="text-slate-400" />
                          <span>{row.traditional}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center bg-gradient-to-r from-blue-50/50 to-indigo-50/30 group-hover:from-blue-50 group-hover:to-indigo-50 transition-all">
                        <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                          <Check size={16} className="text-green-500 group-hover:scale-110 transition-transform" />
                          <span>{row.orbitai}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-32 px-6 bg-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-500 text-lg">
              Everything you need to know about OrbitAI
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "How does OrbitAI differ from other AI coding assistants?",
                answer: "OrbitAI uses a multi-agent swarm architecture where specialized AI agents (Product Manager, Architect, Developer, QA) collaborate in parallel. Unlike single-assistant tools, OrbitAI enforces strict risk assessment, scope control, and compliance checking throughout the development lifecycle. Every line of code is traceable back to requirements using V-Model methodology."
              },
              {
                question: "What is the V-Model SDLC and why does it matter?",
                answer: "The V-Model is a rigorous software development methodology that ensures every requirement has a corresponding test case. OrbitAI implements this at scale, automatically linking code to requirements and tests. This provides complete traceability, reduces bugs, and ensures compliance with automotive and aerospace-grade standards."
              },
              {
                question: "How does the risk assessment engine work?",
                answer: "Our Risk Engine continuously monitors your project for scope creep, security vulnerabilities, and architectural debt. It runs automated checks against OWASP, ISO, and GDPR standards. If a proposed feature exceeds budget or introduces risk, the Orchestrator agent can reject or reschedule it automatically, preventing project failures before they happen."
              },
              {
                question: "Can I use OrbitAI for existing projects?",
                answer: "Yes! OrbitAI can analyze existing codebases, generate requirements documentation, create test cases, and help refactor code. The agents can work with your current tech stack and gradually improve code quality while maintaining backward compatibility."
              },
              {
                question: "What programming languages and frameworks are supported?",
                answer: "OrbitAI supports all major languages (JavaScript/TypeScript, Python, Java, Go, Rust, etc.) and frameworks. The agents adapt to your project's tech stack and can work with React, Vue, Next.js, Django, FastAPI, and many others. The E2B sandbox environment supports any Linux-based development workflow."
              },
              {
                question: "Is my code secure when using OrbitAI?",
                answer: "Absolutely. All code execution happens in isolated E2B sandboxes that are destroyed after use. Your code never leaves your control, and we use enterprise-grade encryption. The compliance engine ensures your code meets security standards before deployment."
              },
              {
                question: "How much does OrbitAI cost?",
                answer: "We offer a free tier to get started, with paid plans starting at $29/month. Enterprise plans include custom agent configurations, dedicated support, and advanced compliance features. See our pricing section for detailed plans."
              },
              {
                question: "Can I customize the AI agents?",
                answer: "Yes! You can configure agent personalities, expertise levels, and collaboration patterns. Enterprise plans allow full customization of agent roles, decision-making rules, and integration with your existing tools and workflows."
              }
            ].map((faq, i) => (
              <div
                key={i}
                className="glass-effect rounded-xl border border-slate-200/50 overflow-hidden transition-all hover:border-blue-300/50 hover:shadow-lg group"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-6 flex items-center justify-between text-left group-hover:bg-white/50 transition-all"
                >
                  <span className="font-bold text-slate-900 text-lg pr-8 group-hover:text-primary transition-colors">
                    {faq.question}
                  </span>
                  <div className="shrink-0">
                    {openFaq === i ? (
                      <X size={20} className="text-primary rotate-90 transition-all" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all" />
                    )}
                  </div>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-slate-600 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300 border-t border-slate-100 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 px-6 bg-white relative overflow-hidden scroll-mt-24">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
        <div className="max-w-6xl mx-auto relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4 text-slate-900">Pricing that scales.</h2>
          <p className="text-center text-slate-500 mb-16 text-lg">Start for free, upgrade when you need autonomous powers.</p>

          {loadingPackages ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 items-center`}>
              {packages.map((pkg, index) => {
                const isHighlighted = pkg.metadata?.highlight || index === 1;
                const bgClass = isHighlighted ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-slate-50 border border-slate-200';
                const textClass = isHighlighted ? 'text-white' : 'text-slate-900';
                const iconName = pkg.metadata?.icon || pkg.name.toLowerCase();
                const Icon = iconMap[iconName] || Layout;
                const priceText = pkg.price === 0 ? 'Free' : `$${pkg.price}`;
                const billingText = pkg.billingCycle === 'monthly' ? '/mo' : pkg.billingCycle === 'yearly' ? '/yr' : '';
                const features = pkg.features?.map(f => typeof f === 'object' ? f.label : f) || [];

                return (
                  <div
                    key={pkg.id}
                    className={`${bgClass} rounded-3xl p-8 relative ${isHighlighted ? 'shadow-2xl scale-105 z-10 ring-2 ring-blue-500/20' : 'hover:border-slate-300 transition-all hover:-translate-y-2 hover:shadow-xl'} hover-lift overflow-hidden`}
                  >
                    {isHighlighted && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg animate-pulse-glow">
                        Most Popular
                      </div>
                    )}
                    {isHighlighted && (
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    )}
                    <div className={`${isHighlighted ? 'text-blue-400' : 'text-slate-500'} font-bold uppercase tracking-wider text-xs mb-4 flex items-center gap-2`}>
                      <Icon size={14} className={isHighlighted ? 'fill-current' : ''} /> {pkg.displayName}
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className={`text-4xl font-bold ${textClass}`}>{priceText}</span>
                      {pkg.price > 0 && <span className={`${isHighlighted ? 'text-slate-400' : 'text-slate-500'} text-sm font-medium`}>{billingText}</span>}
                    </div>
                    <div className={`text-sm ${isHighlighted ? 'text-slate-400' : 'text-slate-500'} mb-6`}>
                      {pkg.price === 0 ? 'Forever free' : 'Per user'}
                    </div>
                    <ul className={`space-y-4 mb-8 text-sm ${isHighlighted ? 'text-slate-300' : 'text-slate-600'}`}>
                      {features.slice(0, 5).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-3">
                          <CheckCircle2
                            size={16}
                            className={isHighlighted ? 'text-blue-500' : index === 2 ? 'text-purple-500' : 'text-slate-400'}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Get Pro button clicked', pkg);
                        if (pkg.price > 0 && pkg.name !== 'Enterprise') {
                          onSignup(pkg);
                        } else {
                          onSignup();
                        }
                      }}
                      className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all relative z-10 ${isHighlighted
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40'
                        : 'border border-slate-200 hover:bg-white hover:border-slate-300 text-slate-700 bg-white shadow-sm'
                        }`}
                    >
                      {pkg.price === 0 ? 'Start Free' : pkg.name === 'Enterprise' ? 'Contact Sales' : `Get ${pkg.displayName}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section >

      {/* Enhanced CTA Footer */}
      < footer className="py-20 px-6 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-center relative overflow-hidden" >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.15),transparent_70%)]"></div>
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        ></div>
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Ready to build the future?</h2>
          <p className="text-slate-300 mb-10 max-w-xl mx-auto text-lg">Join thousands of developers using OrbitAI to ship software faster and more reliably.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onSignup}
              className="group relative px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-sm uppercase tracking-wider hover:bg-blue-50 transition-all shadow-lg hover:scale-105 overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10 flex items-center gap-2">
                Get Started Now <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button
              onClick={onLaunch}
              className="group relative px-8 py-4 glass-dark text-white border border-white/20 rounded-full font-bold text-sm uppercase tracking-wider hover:bg-white/10 transition-all overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10">Sign In to Launch</span>
            </button>
          </div>

          <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-slate-500 text-xs font-medium">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Logo size="sm" animated={false} showText={false} />
              <span className="text-slate-400">OrbitAI Inc. &copy; 2024</span>
            </div>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer >

    </div >
  );
};

export default LandingPage;
