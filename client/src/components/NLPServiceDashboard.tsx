import React, { useState } from 'react';
import { Brain, FileText, Hash, Users, Smile, Sparkles, Loader2, Copy, Check } from 'lucide-react';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface NLPServiceDashboardProps {
  token: string;
}

interface AnalysisResult {
  summary?: string;
  keywords?: string[];
  entities?: Array<{ type: string; value: string; confidence?: number }>;
  sentiment?: { label: string; score: number };
  analysis?: {
    summary: string;
    keywords: string[];
    entities: Array<{ type: string; value: string }>;
    sentiment: { label: string; score: number };
  };
}

const NLPServiceDashboard: React.FC<NLPServiceDashboardProps> = ({ token }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'analyze' | 'summarize' | 'keywords' | 'entities' | 'sentiment'>('analyze');
  const [copied, setCopied] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  const handleAnalyze = async (endpoint: string, data: any) => {
    setLoading(true);
    setResults(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/nlp/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze: ${response.statusText}`);
      }

      const result = await response.json();
      setResults(result.data);
    } catch (error: any) {
      console.error('NLP analysis error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleComprehensiveAnalysis = () => {
    if (!content.trim()) {
      showAlert('Please enter some content to analyze');
      return;
    }
    handleAnalyze('analyze', { content });
  };

  const handleSummarize = () => {
    if (!content.trim()) {
      alert('Please enter some content to summarize');
      return;
    }
    handleAnalyze('summarize', { content, maxLength: 200 });
  };

  const handleExtractKeywords = () => {
    if (!content.trim()) {
      alert('Please enter some content to extract keywords from');
      return;
    }
    handleAnalyze('keywords', { content, maxKeywords: 10 });
  };

  const handleExtractEntities = () => {
    if (!content.trim()) {
      alert('Please enter some content to extract entities from');
      return;
    }
    handleAnalyze('entities', { content });
  };

  const handleAnalyzeSentiment = () => {
    if (!content.trim()) {
      alert('Please enter some content to analyze sentiment');
      return;
    }
    handleAnalyze('sentiment', { content });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">NLP Service Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Natural Language Processing and content analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Content Input</h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter text to analyze, summarize, extract keywords, entities, or analyze sentiment..."
            className="w-full h-64 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleComprehensiveAnalysis}
              disabled={loading || !content.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Sparkles size={16} />
              Comprehensive Analysis
            </button>
            <button
              onClick={handleSummarize}
              disabled={loading || !content.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FileText size={16} />
              Summarize
            </button>
            <button
              onClick={handleExtractKeywords}
              disabled={loading || !content.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Hash size={16} />
              Keywords
            </button>
            <button
              onClick={handleExtractEntities}
              disabled={loading || !content.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Users size={16} />
              Entities
            </button>
            <button
              onClick={handleAnalyzeSentiment}
              disabled={loading || !content.trim()}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Smile size={16} />
              Sentiment
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Analysis Results</h3>
          
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {!loading && !results && (
            <div className="text-center py-12 text-slate-500">
              <Brain className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Enter content and select an analysis option to see results</p>
            </div>
          )}

          {!loading && results && (
            <div className="space-y-4">
              {/* Summary */}
              {(results.summary || results.analysis?.summary) && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                      <FileText size={16} />
                      Summary
                    </h4>
                    <button
                      onClick={() => copyToClipboard(results.summary || results.analysis?.summary || '', 'summary')}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      {copied === 'summary' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-slate-600">{results.summary || results.analysis?.summary}</p>
                </div>
              )}

              {/* Keywords */}
              {(results.keywords || results.analysis?.keywords) && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                      <Hash size={16} />
                      Keywords
                    </h4>
                    <button
                      onClick={() => copyToClipboard((results.keywords || results.analysis?.keywords || []).join(', '), 'keywords')}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      {copied === 'keywords' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(results.keywords || results.analysis?.keywords || []).map((keyword, idx) => (
                      <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Entities */}
              {(results.entities || results.analysis?.entities) && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                      <Users size={16} />
                      Entities
                    </h4>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(results.entities || results.analysis?.entities || [], null, 2), 'entities', 'warning')}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      {copied === 'entities' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(results.entities || results.analysis?.entities || []).map((entity, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span className="font-medium text-slate-700">{entity.value}</span>
                        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                          {entity.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sentiment */}
              {(results.sentiment || results.analysis?.sentiment) && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <Smile size={16} />
                    Sentiment
                  </h4>
                  <div className="flex items-center gap-4">
                    <span className={`text-lg font-bold ${
                      (results.sentiment || results.analysis?.sentiment)?.label === 'positive' ? 'text-green-600' :
                      (results.sentiment || results.analysis?.sentiment)?.label === 'negative' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {(results.sentiment || results.analysis?.sentiment)?.label || 'neutral'}
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          (results.sentiment || results.analysis?.sentiment)?.label === 'positive' ? 'bg-green-500' :
                          (results.sentiment || results.analysis?.sentiment)?.label === 'negative' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}
                        style={{
                          width: `${Math.abs((results.sentiment || results.analysis?.sentiment)?.score || 0) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-sm text-slate-500">
                      {((results.sentiment || results.analysis?.sentiment)?.score || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NLPServiceDashboard;













