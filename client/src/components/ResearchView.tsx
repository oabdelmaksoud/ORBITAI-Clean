import React from 'react';
import { Idea } from './OrbGraph';
import { ProjectResearch } from '../services/geminiService';
import {
    BookOpen, TrendingUp, AlertTriangle, Target, DollarSign, Activity, Lock, Users, Briefcase,
    PieChart, BarChart3, Clock, Zap, CheckCircle2, XCircle, FileText, Search, Database,
    Globe, Layers, ShoppingCart, TrendingDown, Lightbulb, Shield, ArrowUpRight, ArrowDownRight,
    CircleDot, Info, AlertCircle
} from 'lucide-react';

interface ResearchViewProps {
    topic: string;
    ideas: Idea[];
    researchData: ProjectResearch | null;
    isLoading: boolean;
    onGenerate: () => void;
}

// Score indicator component
const ScoreIndicator: React.FC<{ score?: number; label: string }> = ({ score, label }) => {
    if (score === undefined) return null;
    const color = score >= 70 ? 'emerald' : score >= 50 ? 'amber' : 'red';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className={`font-bold text-${color}-600`}>{score}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full bg-${color}-500 rounded-full transition-all duration-500`}
                        style={{ width: `${score}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

// Validation status badge
const ValidationBadge: React.FC<{ status: string }> = ({ status }) => {
    const config = {
        pass: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
        caution: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle },
        fail: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle }
    }[status] || { bg: 'bg-slate-100', text: 'text-slate-600', icon: Info };

    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            <Icon className="w-3 h-3" />
            {status.toUpperCase()}
        </span>
    );
};

// Format currency
const formatCurrency = (value?: number) => {
    if (!value) return 'N/A';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${value}`;
};

// Section wrapper component
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 ${className}`}>
        <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-slate-100 rounded-lg">{icon}</div>
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        </div>
        {children}
    </div>
);

const ResearchView: React.FC<ResearchViewProps> = ({ topic, ideas, researchData, isLoading, onGenerate }) => {
    if (isLoading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm">
                <div className="relative w-16 h-16 mb-4">
                    <BookOpen className="w-16 h-16 text-indigo-500 animate-pulse opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Conducting Comprehensive Research</h3>
                <p className="text-slate-500 max-w-md text-center">
                    Analyzing market data, competitors, trends, and opportunities for "{topic}"...
                </p>
            </div>
        );
    }

    if (!researchData) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg text-center border border-slate-100">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">Comprehensive Market Research</h2>
                    <p className="text-slate-600 mb-6 leading-relaxed text-sm">
                        Generate a professional research report with:
                    </p>
                    <div className="text-left bg-slate-50 p-4 rounded-xl mb-6 text-xs text-slate-600 space-y-1">
                        <div>✓ Executive Summary with Key Points</div>
                        <div>✓ Market Overview & Size Analysis</div>
                        <div>✓ Target Audience Segments & Personas</div>
                        <div>✓ Competitor Landscape with Pricing</div>
                        <div>✓ SWOT Analysis</div>
                        <div>✓ Key Insights & Validation Checklist</div>
                    </div>
                    <button
                        onClick={onGenerate}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 mx-auto w-full"
                    >
                        <Search className="w-5 h-5" />
                        Generate Research Report
                    </button>
                </div>
            </div>
        );
    }

    // Parse executive summary
    const execSummary = typeof researchData.executiveSummary === 'object'
        ? researchData.executiveSummary
        : { overview: researchData.executiveSummary, keyPoints: [] };

    return (
        <div className="w-full h-full overflow-y-auto bg-slate-50 pt-32 p-6 scroll-smooth">
            <div className="max-w-5xl mx-auto space-y-5 pb-20">

                {/* Header with Overall Score */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-2xl text-white">
                    <div className="flex items-start justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold">Research Report</span>
                                <span className="text-white/70 text-sm">{new Date().toLocaleDateString()}</span>
                            </div>
                            <h1 className="text-2xl font-bold mb-3">{topic}</h1>
                            <p className="text-white/90 text-sm leading-relaxed">{execSummary.overview}</p>
                        </div>
                        {researchData.overallScore !== undefined && (
                            <div className="flex-shrink-0 w-24 h-24 relative">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                                    <circle cx="48" cy="48" r="42" fill="none" stroke="#fff" strokeWidth="6"
                                        strokeDasharray={`${researchData.overallScore * 2.64} 264`} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-bold">{researchData.overallScore}</span>
                                    <span className="text-xs text-white/70">Score</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Key Points */}
                    {execSummary.keyPoints && execSummary.keyPoints.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                            <h3 className="text-sm font-semibold mb-2 text-white/80">Key Findings</h3>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {execSummary.keyPoints.map((point: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-white/90">
                                        <CircleDot className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/60" />
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Objectives & Methodology Row */}
                {(researchData.objectivesAndScope || researchData.methodology) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {researchData.objectivesAndScope && (
                            <Section title="Objectives & Scope" icon={<Target className="w-5 h-5 text-blue-600" />}>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <h4 className="font-semibold text-slate-800 mb-1">Research Questions</h4>
                                        <ul className="space-y-1">
                                            {researchData.objectivesAndScope.researchQuestions.map((q, i) => (
                                                <li key={i} className="flex items-start gap-2 text-slate-600">
                                                    <span className="text-blue-500">?</span> {q}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="p-2 bg-slate-50 rounded">
                                            <Globe className="w-3 h-3 text-slate-400 mb-1" />
                                            <span className="text-slate-600">{researchData.objectivesAndScope.geography}</span>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded">
                                            <Clock className="w-3 h-3 text-slate-400 mb-1" />
                                            <span className="text-slate-600">{researchData.objectivesAndScope.timeframe}</span>
                                        </div>
                                    </div>
                                </div>
                            </Section>
                        )}
                        {researchData.methodology && (
                            <Section title="Methodology" icon={<Database className="w-5 h-5 text-purple-600" />}>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <h4 className="font-semibold text-slate-800 mb-1">Data Sources</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {researchData.methodology.dataSources.map((src, i) => (
                                                <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">{src}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-amber-50 rounded text-xs text-amber-700">
                                        <AlertCircle className="w-3 h-3 inline mr-1" />
                                        {researchData.methodology.limitations}
                                    </div>
                                </div>
                            </Section>
                        )}
                    </div>
                )}

                {/* Market Overview */}
                {researchData.marketOverview && (
                    <Section title="Market Overview" icon={<PieChart className="w-5 h-5 text-emerald-600" />}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="p-3 bg-emerald-50 rounded-lg text-center">
                                <div className="text-xl font-bold text-emerald-700">{researchData.marketOverview.size}</div>
                                <div className="text-xs text-emerald-600">Market Size</div>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-lg text-center">
                                <div className="text-xl font-bold text-blue-700">{researchData.marketOverview.growthRate}</div>
                                <div className="text-xs text-blue-600">Growth Rate</div>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg text-center">
                                <div className="text-lg font-bold text-purple-700">{researchData.marketOverview.growthStage}</div>
                                <div className="text-xs text-purple-600">Stage</div>
                            </div>
                            <div className="p-3 bg-slate-100 rounded-lg text-center">
                                <div className="text-lg font-bold text-slate-700">{formatCurrency(researchData.marketOverview.sizeValue)}</div>
                                <div className="text-xs text-slate-600">TAM Value</div>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{researchData.marketOverview.definition}</p>
                        <div>
                            <h4 className="text-sm font-semibold text-slate-800 mb-2">Macro Trends</h4>
                            <div className="flex flex-wrap gap-2">
                                {researchData.marketOverview.macroTrends.map((trend, i) => (
                                    <span key={i} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                                        <TrendingUp className="w-3 h-3 text-emerald-500" /> {trend}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </Section>
                )}

                {/* Target Audience Segments */}
                {researchData.targetAudience && (
                    <Section title="Target Audience & Segments" icon={<Users className="w-5 h-5 text-blue-600" />}>
                        <p className="text-sm text-slate-600 mb-4">{researchData.targetAudience.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {researchData.targetAudience.segments.map((seg, i) => (
                                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-slate-800">{seg.name}</span>
                                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{seg.size}</span>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div><span className="font-medium text-slate-500">Needs:</span> <span className="text-slate-600">{seg.needs}</span></div>
                                        <div><span className="font-medium text-slate-500">Pains:</span> <span className="text-slate-600">{seg.pains}</span></div>
                                        <div className="flex items-center gap-1">
                                            <DollarSign className="w-3 h-3 text-slate-400" />
                                            <span className="text-slate-600">WTP: {seg.willingnessToPay}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Demand & Behavior */}
                {researchData.demandAndBehavior && (
                    <Section title="Demand & Behavior" icon={<Activity className="w-5 h-5 text-orange-600" />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 mb-2">Demand Evidence</h4>
                                <ul className="space-y-1">
                                    {researchData.demandAndBehavior.demandEvidence.map((ev, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> {ev}
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-3 p-2 bg-orange-50 rounded text-sm">
                                    <span className="font-medium text-orange-700">Search Interest:</span> {researchData.demandAndBehavior.searchInterest}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 mb-2">Adoption Barriers</h4>
                                <ul className="space-y-1">
                                    {researchData.demandAndBehavior.adoptionBarriers.map((b, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" /> {b}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-3 text-sm text-slate-600">
                                    <span className="font-medium">Buying Journey:</span> {researchData.demandAndBehavior.buyingJourney}
                                </p>
                            </div>
                        </div>
                    </Section>
                )}

                {/* Competitor Landscape */}
                {researchData.competitorLandscape && (
                    <Section title="Competitor Landscape" icon={<Briefcase className="w-5 h-5 text-slate-600" />}>
                        <div className="space-y-3">
                            {researchData.competitorLandscape.map((comp, i) => (
                                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-slate-800">{comp.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">{comp.pricing}</span>
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{comp.marketShare}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">{comp.offering}</p>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="p-2 bg-white rounded">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500 mb-1" />
                                            <span className="text-slate-600">{comp.strengths}</span>
                                        </div>
                                        <div className="p-2 bg-white rounded">
                                            <XCircle className="w-3 h-3 text-red-400 mb-1" />
                                            <span className="text-slate-600">{comp.weaknesses}</span>
                                        </div>
                                        <div className="p-2 bg-blue-50 rounded">
                                            <Zap className="w-3 h-3 text-blue-500 mb-1" />
                                            <span className="text-blue-700">{comp.differentiation}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Pricing & SWOT Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Pricing Snapshot */}
                    {researchData.pricingSnapshot && (
                        <Section title="Pricing Snapshot" icon={<DollarSign className="w-5 h-5 text-green-600" />}>
                            <div className="space-y-3 text-sm">
                                <div className="p-3 bg-green-50 rounded-lg text-center">
                                    <div className="text-xl font-bold text-green-700">{researchData.pricingSnapshot.typicalRange}</div>
                                    <div className="text-xs text-green-600">Typical Price Range</div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {researchData.pricingSnapshot.models.map((m, i) => (
                                        <span key={i} className="px-2 py-1 bg-slate-100 rounded text-xs">{m}</span>
                                    ))}
                                </div>
                                <p className="text-slate-600 text-xs">{researchData.pricingSnapshot.priceSensitivity}</p>
                                <div className="p-2 bg-blue-50 rounded text-xs text-blue-700">
                                    <Lightbulb className="w-3 h-3 inline mr-1" />
                                    <strong>Recommendation:</strong> {researchData.pricingSnapshot.recommendedStrategy}
                                </div>
                            </div>
                        </Section>
                    )}

                    {/* SWOT Analysis */}
                    {researchData.swotAnalysis && (
                        <Section title="SWOT Analysis" icon={<Layers className="w-5 h-5 text-indigo-600" />}>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 bg-emerald-50 rounded">
                                    <h5 className="font-semibold text-emerald-700 mb-1">Strengths</h5>
                                    <ul className="space-y-0.5 text-emerald-600">
                                        {researchData.swotAnalysis.strengths.map((s, i) => <li key={i}>+ {s}</li>)}
                                    </ul>
                                </div>
                                <div className="p-2 bg-red-50 rounded">
                                    <h5 className="font-semibold text-red-700 mb-1">Weaknesses</h5>
                                    <ul className="space-y-0.5 text-red-600">
                                        {researchData.swotAnalysis.weaknesses.map((w, i) => <li key={i}>- {w}</li>)}
                                    </ul>
                                </div>
                                <div className="p-2 bg-blue-50 rounded">
                                    <h5 className="font-semibold text-blue-700 mb-1">Opportunities</h5>
                                    <ul className="space-y-0.5 text-blue-600">
                                        {researchData.swotAnalysis.opportunities.map((o, i) => <li key={i}>↑ {o}</li>)}
                                    </ul>
                                </div>
                                <div className="p-2 bg-amber-50 rounded">
                                    <h5 className="font-semibold text-amber-700 mb-1">Threats</h5>
                                    <ul className="space-y-0.5 text-amber-600">
                                        {researchData.swotAnalysis.threats.map((t, i) => <li key={i}>! {t}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </Section>
                    )}
                </div>

                {/* Key Insights */}
                {researchData.keyInsights && (
                    <Section title="Key Insights & Patterns" icon={<Lightbulb className="w-5 h-5 text-amber-600" />}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4 text-red-500" /> Top Pains
                                </h4>
                                <ul className="space-y-1">
                                    {researchData.keyInsights.topPains.map((p, i) => (
                                        <li key={i} className="text-xs text-slate-600">• {p}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1">
                                    <Zap className="w-4 h-4 text-purple-500" /> Desired Features
                                </h4>
                                <ul className="space-y-1">
                                    {researchData.keyInsights.desiredFeatures.map((f, i) => (
                                        <li key={i} className="text-xs text-slate-600">• {f}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1">
                                    <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Trending Up
                                </h4>
                                <ul className="space-y-1">
                                    {researchData.keyInsights.trendingUp.map((t, i) => (
                                        <li key={i} className="text-xs text-emerald-600 flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" /> {t}
                                        </li>
                                    ))}
                                </ul>
                                {researchData.keyInsights.trendingDown.length > 0 && (
                                    <>
                                        <h4 className="text-sm font-semibold text-slate-800 mb-1 mt-3 flex items-center gap-1">
                                            <ArrowDownRight className="w-4 h-4 text-red-500" /> Trending Down
                                        </h4>
                                        <ul className="space-y-1">
                                            {researchData.keyInsights.trendingDown.map((t, i) => (
                                                <li key={i} className="text-xs text-red-600 flex items-center gap-1">
                                                    <TrendingDown className="w-3 h-3" /> {t}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        </div>
                        {researchData.keyInsights.surprisingFindings.length > 0 && (
                            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                                <h4 className="text-sm font-semibold text-purple-800 mb-2">💡 Surprising Findings</h4>
                                <ul className="space-y-1">
                                    {researchData.keyInsights.surprisingFindings.map((f, i) => (
                                        <li key={i} className="text-xs text-purple-700">→ {f}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Section>
                )}

                {/* Validation Checklist */}
                {researchData.validationChecklist && (
                    <Section title="Validation Checklist" icon={<Shield className="w-5 h-5 text-slate-600" />}>
                        <div className="space-y-2">
                            {Object.entries(researchData.validationChecklist).map(([key, val]) => (
                                <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                    <span className="text-sm font-medium text-slate-700 capitalize">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 max-w-xs truncate">{val.notes}</span>
                                        <ValidationBadge status={val.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Feasibility & Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Section title="Feasibility Analysis" icon={<Target className="w-5 h-5 text-emerald-600" />}>
                        <div className="space-y-3 mb-4">
                            <ScoreIndicator score={researchData.feasibility.technicalScore} label="Technical" />
                            <ScoreIndicator score={researchData.feasibility.financialScore} label="Financial" />
                            <ScoreIndicator score={researchData.feasibility.operationalScore} label="Operational" />
                        </div>
                        {researchData.feasibility.timeToMarket && (
                            <div className="p-2 bg-slate-50 rounded text-sm flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-500" />
                                <span>Time to Market: <strong>{researchData.feasibility.timeToMarket}</strong></span>
                            </div>
                        )}
                        {researchData.feasibility.estimatedCosts && (
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 bg-slate-100 rounded">
                                    <div className="text-sm font-bold text-slate-700">{formatCurrency(researchData.feasibility.estimatedCosts.development)}</div>
                                    <div className="text-xs text-slate-500">Dev</div>
                                </div>
                                <div className="p-2 bg-slate-100 rounded">
                                    <div className="text-sm font-bold text-slate-700">{formatCurrency(researchData.feasibility.estimatedCosts.marketing)}</div>
                                    <div className="text-xs text-slate-500">Marketing</div>
                                </div>
                                <div className="p-2 bg-slate-100 rounded">
                                    <div className="text-sm font-bold text-slate-700">{formatCurrency(researchData.feasibility.estimatedCosts.operationsPerYear)}</div>
                                    <div className="text-xs text-slate-500">Ops/yr</div>
                                </div>
                            </div>
                        )}
                    </Section>

                    {researchData.keyMetrics && (
                        <Section title="Key Business Metrics" icon={<BarChart3 className="w-5 h-5 text-blue-600" />}>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-blue-50 rounded-lg text-center">
                                    <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                                    <div className="text-xl font-bold text-blue-700">{researchData.keyMetrics.breakEvenMonths || 'N/A'}</div>
                                    <div className="text-xs text-blue-600">Months to Break-Even</div>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                                    <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                                    <div className="text-xl font-bold text-emerald-700">{researchData.keyMetrics.projectedROI || 'N/A'}</div>
                                    <div className="text-xs text-emerald-600">Projected ROI</div>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-lg text-center">
                                    <DollarSign className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                                    <div className="text-xl font-bold text-amber-700">${researchData.keyMetrics.customerAcquisitionCost || 'N/A'}</div>
                                    <div className="text-xs text-amber-600">CAC</div>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-lg text-center">
                                    <Users className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                                    <div className="text-xl font-bold text-purple-700">${researchData.keyMetrics.lifetimeValue || 'N/A'}</div>
                                    <div className="text-xs text-purple-600">LTV</div>
                                </div>
                            </div>
                        </Section>
                    )}
                </div>

                {/* Recommendations */}
                {researchData.recommendations && researchData.recommendations.length > 0 && (
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-2xl text-white">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5" /> Strategic Recommendations
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {researchData.recommendations.map((rec: string, i: number) => (
                                <div key={i} className="p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                                    <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold mb-2">{i + 1}</div>
                                    <p className="text-sm text-white/90">{rec}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default React.memo(ResearchView);
