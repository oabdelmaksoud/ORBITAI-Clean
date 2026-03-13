import React, { useState } from 'react';
import { Lightbulb, X, Plus } from 'lucide-react';
import { HMW_TEMPLATES } from '../Thinking/constants';

interface HMWTemplate {
  id: string;
  category: string;
  template: string;
  examples: string[];
}

interface HMWTemplateSelectorProps {
  onSelect: (question: string) => void;
  onClose: () => void;
  currentTopic?: string;
}

const HMWTemplateSelector: React.FC<HMWTemplateSelectorProps> = ({ onSelect, onClose, currentTopic }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [selectedExample, setSelectedExample] = useState<string | null>(null);

  const handleTemplateSelect = (template: HMWTemplate, example?: string) => {
    let question = example || template.template;
    
    // Replace placeholders with current topic if available
    if (currentTopic) {
      question = question.replace(/{subject}/g, currentTopic);
      question = question.replace(/{problem}/g, currentTopic);
      question = question.replace(/{metric}/g, currentTopic);
      question = question.replace(/{action}/g, currentTopic);
      question = question.replace(/{outcome}/g, currentTopic);
      question = question.replace(/{activity}/g, currentTopic);
      question = question.replace(/{audience}/g, 'users');
    }

    onSelect(question);
    onClose();
  };

  const handleCustomSubmit = () => {
    if (customQuestion.trim()) {
      onSelect(customQuestion.trim());
      onClose();
    }
  };

  const categories = Array.from(new Set(HMW_TEMPLATES.map(t => t.category)));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold">How Might We... Questions</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Category Filter */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div className="space-y-4">
            {HMW_TEMPLATES.filter(t => !selectedCategory || t.category === selectedCategory).map(template => (
              <div key={template.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{template.template}</h3>
                    <p className="text-xs text-gray-500 mt-1">{template.category}</p>
                  </div>
                  <button
                    onClick={() => handleTemplateSelect(template)}
                    className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
                  >
                    Use Template
                  </button>
                </div>
                
                {/* Examples */}
                <div className="mt-3">
                  <p className="text-xs text-gray-600 mb-2">Examples:</p>
                  <div className="flex flex-wrap gap-2">
                    {template.examples.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleTemplateSelect(template, example)}
                        className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                          selectedExample === example
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                        }`}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Question */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-medium mb-3">Or create your own:</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="How might we..."
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCustomSubmit()}
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customQuestion.trim()}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HMWTemplateSelector;

