import React, { useState, useEffect } from 'react';
import { FileText, Download, Plus, X, Loader2, RefreshCw, Settings, BarChart3 } from 'lucide-react';
import { getReportTemplates, generateReport, ReportTemplate, ReportConfig } from '../services/reportBuilderApi';

interface CustomReportBuilderProps {
  token: string;
}

const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({ token }) => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    dataSource: 'users',
    metrics: [],
    format: 'json'
  });
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [token]);

  const loadTemplates = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getReportTemplates(token);
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load report templates');
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = (template: ReportTemplate) => {
    setReportConfig({
      name: template.name,
      dataSource: template.dataSource as any,
      metrics: template.metrics,
      groupBy: template.defaultGroupBy,
      dateRange: {
        start: new Date(Date.now() - template.defaultDateRange.days * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      format: 'json'
    });
    setShowBuilder(true);
  };

  const handleGenerateReport = async () => {
    if (!token) return;
    setGenerating(true);
    setError(null);
    try {
      const report = await generateReport(token, reportConfig);
      if (reportConfig.format === 'csv' && report instanceof Blob) {
        // Download CSV
        const url = window.URL.createObjectURL(report);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportConfig.name || 'report'}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setGenerating(false);
      } else {
        setGeneratedReport(report);
        setGenerating(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
      console.error('Failed to generate report:', err);
      setGenerating(false);
    }
  };

  const toggleMetric = (metric: string) => {
    setReportConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric]
    }));
  };

  const availableMetrics: Record<string, string[]> = {
    users: ['signups', 'activeUsers', 'byPlan', 'byRole', 'churn'],
    projects: ['created', 'active', 'byPhase', 'byMethodology'],
    activity: ['actionCount', 'byType', 'byUser', 'loginCount'],
    audit: ['actionCount', 'byType', 'byUser', 'byStatus']
  };

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading report templates...</p>
        </div>
      </div>
    );
  }

  if (error && !showBuilder) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-semibold">{error}</p>
        <button
          onClick={loadTemplates}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!showBuilder ? (
        <>
          {/* Templates */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Report Templates</h2>
            <button
              onClick={() => setShowBuilder(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Create Custom Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 mb-1">{template.name}</h3>
                    <p className="text-sm text-slate-500">{template.description}</p>
                  </div>
                  <FileText className="text-blue-600" size={24} />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold">Data Source:</span>
                    <span className="capitalize">{template.dataSource}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold">Metrics:</span>
                    <span>{template.metrics.join(', ')}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Report Builder */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">Custom Report Builder</h2>
              <button
                onClick={() => {
                  setShowBuilder(false);
                  setGeneratedReport(null);
                }}
                className="p-2 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Report Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Report Name</label>
                <input
                  type="text"
                  value={reportConfig.name || ''}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter report name"
                />
              </div>

              {/* Data Source */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Data Source</label>
                <select
                  value={reportConfig.dataSource}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, dataSource: e.target.value as any, metrics: [] }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="users">Users</option>
                  <option value="projects">Projects</option>
                  <option value="activity">Activity</option>
                  <option value="audit">Audit Logs</option>
                </select>
              </div>

              {/* Metrics */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Metrics</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availableMetrics[reportConfig.dataSource]?.map((metric) => (
                    <label key={metric} className="flex items-center gap-2 p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={reportConfig.metrics.includes(metric)}
                        onChange={() => toggleMetric(metric)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Group By */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Group By</label>
                <select
                  value={reportConfig.groupBy || ''}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, groupBy: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None</option>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  {reportConfig.dataSource === 'users' && <option value="plan">Plan</option>}
                  {reportConfig.dataSource === 'users' && <option value="role">Role</option>}
                  {reportConfig.dataSource === 'projects' && <option value="phase">Phase</option>}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={reportConfig.dateRange?.start?.substring(0, 10) || ''}
                    onChange={(e) => setReportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: new Date(e.target.value).toISOString() } as any
                    }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={reportConfig.dateRange?.end?.substring(0, 10) || ''}
                    onChange={(e) => setReportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: new Date(e.target.value).toISOString() } as any
                    }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Export Format</label>
                <select
                  value={reportConfig.format}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, format: e.target.value as 'json' | 'csv' }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateReport}
                disabled={generating || reportConfig.metrics.length === 0}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating...
                  </>
                ) : (
                  <>
                    <BarChart3 size={20} />
                    Generate Report
                  </>
                )}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Generated Report */}
          {generatedReport && reportConfig.format === 'json' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Generated Report</h3>
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(generatedReport, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = window.URL.createObjectURL(dataBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${reportConfig.name || 'report'}-${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                >
                  <Download size={16} />
                  Download JSON
                </button>
              </div>
              <pre className="bg-slate-50 p-4 rounded-lg overflow-auto text-xs max-h-96">
                {JSON.stringify(generatedReport, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomReportBuilder;
















