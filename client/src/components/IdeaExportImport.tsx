import React, { useState } from 'react';
import { Download, Upload, FileJson, FileText, Image as ImageIcon, X } from 'lucide-react';
import { Idea } from './OrbGraph';

interface IdeaExportImportProps {
  ideas: Idea[];
  onImport?: (ideas: Idea[]) => void;
  roomName?: string;
}

const IdeaExportImport: React.FC<IdeaExportImportProps> = ({
  ideas,
  onImport,
  roomName = 'brainstorming-session'
}) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const exportToJSON = () => {
    const dataStr = JSON.stringify(ideas, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${roomName}-ideas-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Label', 'Description', 'Category', 'Priority', 'State', 'Tags', 'Parent ID'];
    const rows = ideas.map(idea => [
      idea.id,
      idea.label,
      idea.description || '',
      idea.category || '',
      idea.priority?.toString() || '',
      idea.state || '',
      idea.tags?.join('; ') || '',
      idea.parentId || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${roomName}-ideas-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToText = () => {
    const textContent = ideas.map((idea, index) => {
      let text = `${index + 1}. ${idea.label}`;
      if (idea.description) text += `\n   ${idea.description}`;
      if (idea.category) text += `\n   Category: ${idea.category}`;
      if (idea.priority) text += `\n   Priority: ${idea.priority}/5`;
      if (idea.tags && idea.tags.length > 0) text += `\n   Tags: ${idea.tags.join(', ')}`;
      return text;
    }).join('\n\n');

    const dataBlob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${roomName}-ideas-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let importedIdeas: Idea[] = [];

        if (file.name.endsWith('.json')) {
          importedIdeas = JSON.parse(content);
        } else if (file.name.endsWith('.csv')) {
          // Simple CSV parser
          const lines = content.split('\n');
          const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
          importedIdeas = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
              const values = line.split(',').map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
              return {
                id: values[0] || `imported-${Date.now()}-${Math.random()}`,
                label: values[1] || '',
                description: values[2] || '',
                category: values[3] as any || 'idea',
                priority: values[4] ? parseInt(values[4]) : undefined,
                state: values[5] as any || 'new',
                tags: values[6] ? values[6].split(';').map(t => t.trim()) : [],
                parentId: values[7] || null
              };
            });
        }

        if (Array.isArray(importedIdeas) && importedIdeas.length > 0) {
          setImportError(null);
          if (onImport) {
            onImport(importedIdeas);
          }
          setShowImportModal(false);
        } else {
          setImportError('Invalid file format or empty file');
        }
      } catch (error: any) {
        setImportError(error.message || 'Failed to parse file');
      }
    };

    if (file.name.endsWith('.json') || file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      setImportError('Unsupported file format. Please use JSON or CSV.');
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative group">
          <button
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
            onClick={() => {
              // Show dropdown menu
            }}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[150px]">
            <button
              onClick={exportToJSON}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <FileJson className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={exportToText}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              Text
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowImportModal(true)}
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Import Ideas</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Import ideas from a JSON or CSV file. The file should contain an array of ideas.
              </p>

              {importError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {importError}
                </div>
              )}

              <label className="block">
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileImport}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IdeaExportImport;

