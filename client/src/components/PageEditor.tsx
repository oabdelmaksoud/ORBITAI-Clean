import React, { useState, useEffect, useMemo } from 'react';
import {
  Edit, Save, Eye, X, Plus, Trash2, Copy, ChevronDown, ChevronUp,
  Type, Image, Video, Link, Palette, Layout, Loader2, AlertCircle,
  CheckCircle, Maximize2, Minimize2, RefreshCw, Quote, DollarSign, TrendingUp,
  GripVertical, Monitor, Tablet, Smartphone
} from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { showAlert, showConfirm } from '../utils/browserUtils';
import {
  getPageContent,
  getPageSection,
  savePageSection,
  updatePageSection,
  deletePageSection,
  getPublicPageContent,
  PageSection,
  PageContent
} from '../services/pageContentApi';

interface PageEditorProps {
  token: string;
  pageKey?: string;
}

type SectionType = 'hero' | 'features' | 'testimonials' | 'faq' | 'pricing' | 'stats' | 'custom';

const DEFAULT_SECTIONS: Record<SectionType, Partial<PageSection>> = {
  hero: {
    pageKey: 'home',
    sectionKey: 'hero',
    content: {
      title: 'The Autonomous Software Architect.',
      subtitle: 'V-Model SDLC Engine Active',
      description: 'Stop coding blindly. OrbitAI orchestrates a swarm of agents to plan, verify, and build your software with strict adherence to Risk Assessment and Scope Control.',
      ctaText: 'Start Building Free',
      ctaLink: '#signup',
      buttons: [
        { text: 'Start Building Free', link: '#signup', variant: 'primary' },
        { text: 'Launch Console', link: '#launch', variant: 'secondary' }
      ]
    }
  },
  features: {
    pageKey: 'home',
    sectionKey: 'features',
    content: {
      title: 'Platform Features',
      description: 'Everything you need to build better software',
      features: []
    }
  },
  testimonials: {
    pageKey: 'home',
    sectionKey: 'testimonials',
    content: {
      title: 'What Our Users Say',
      testimonials: []
    }
  },
  faq: {
    pageKey: 'home',
    sectionKey: 'faq',
    content: {
      title: 'Frequently Asked Questions',
      faqs: []
    }
  },
  pricing: {
    pageKey: 'home',
    sectionKey: 'pricing',
    content: {
      plansHeading: 'Choose Your Plan',
      plansSubheading: 'Select the perfect plan for your needs'
    }
  },
  stats: {
    pageKey: 'home',
    sectionKey: 'stats',
    content: {
      title: 'Our Impact',
      stats: []
    }
  },
  custom: {
    pageKey: 'home',
    sectionKey: 'custom',
    content: {
      title: 'Custom Section',
      text: '',
      html: ''
    }
  }
};

// Add Section Dropdown Component
interface AddSectionDropdownProps {
  onSelect: (type: SectionType) => void;
}

const AddSectionDropdown: React.FC<AddSectionDropdownProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const sectionTypes: Array<{ type: SectionType; label: string; icon: any }> = [
    { type: 'hero', label: 'Hero Section', icon: Layout },
    { type: 'features', label: 'Features', icon: CheckCircle },
    { type: 'testimonials', label: 'Testimonials', icon: Quote },
    { type: 'faq', label: 'FAQ', icon: ChevronDown },
    { type: 'pricing', label: 'Pricing', icon: DollarSign },
    { type: 'stats', label: 'Statistics', icon: TrendingUp },
    { type: 'custom', label: 'Custom', icon: Type }
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        title="Add Section"
      >
        <Plus size={16} />
      </button>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50 min-w-[180px]">
            {sectionTypes.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => {
                  onSelect(type);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded text-sm flex items-center gap-2 transition-colors"
              >
                <Icon size={14} className="text-slate-500" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const PageEditor: React.FC<PageEditorProps> = ({ token, pageKey = 'home' }) => {
  const [sections, setSections] = useState<Record<string, PageSection>>({});
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Load page content
  useEffect(() => {
    loadPageContent();
  }, [token, pageKey]);

  const loadPageContent = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data: PageContent | null = null;
      let loadedFrom = '';
      
      // First try to load from admin endpoint (saved content)
      try {
        data = await getPageContent(token, pageKey);
        loadedFrom = 'admin';
        console.log('✅ Loaded content from admin endpoint');
      } catch (adminErr: any) {
        console.log('⚠️ Admin content not found, trying public endpoint...');
        // If admin endpoint fails, try public endpoint (current homepage)
        try {
          data = await getPublicPageContent(pageKey);
          loadedFrom = 'public';
          console.log('✅ Loaded content from public endpoint');
        } catch (publicErr: any) {
          console.error('❌ Failed to load from public endpoint:', publicErr);
          // If both fail, use empty data
          data = { pageKey, sections: {} };
          loadedFrom = 'empty';
        }
      }
      
      if (!data) {
        data = { pageKey, sections: {} };
      }
      
      // Convert sections to PageSection format
      const sectionsMap: Record<string, PageSection> = {};
      Object.entries(data.sections || {}).forEach(([key, section]) => {
        sectionsMap[key] = {
          pageKey,
          sectionKey: key,
          content: section.content,
          isActive: true
        };
      });
      
      console.log(`📊 Loaded ${Object.keys(sectionsMap).length} sections from ${loadedFrom}`);
      
      // If no sections found and we're on the home page, try loading from public endpoint again
      if (Object.keys(sectionsMap).length === 0 && pageKey === 'home') {
        console.log('🔄 No sections found, trying public endpoint for home page...');
        try {
          const publicData = await getPublicPageContent('home');
          Object.entries(publicData.sections || {}).forEach(([key, section]) => {
            sectionsMap[key] = {
              pageKey,
              sectionKey: key,
              content: section.content,
              isActive: true
            };
          });
          console.log(`✅ Loaded ${Object.keys(sectionsMap).length} sections from public endpoint`);
        } catch (publicErr: any) {
          console.error('❌ Failed to load public homepage content:', publicErr);
          setError(`No homepage content found. Please run: npm run seed-homepage in the server directory`);
        }
      }
      
      setSections(sectionsMap);
      
      // If sections exist, select first one
      const sectionKeys = Object.keys(sectionsMap);
      if (sectionKeys.length > 0 && !selectedSection) {
        setSelectedSection(sectionKeys[0]);
        setEditingContent(sectionsMap[sectionKeys[0]].content);
      } else if (sectionKeys.length === 0) {
        setError(`No content found for page "${pageKey}". Run the seed script to populate homepage content.`);
      }
    } catch (err: any) {
      console.error('❌ Failed to load page content:', err);
      setError(err.message || 'Failed to load page content. Make sure the backend is running and homepage content is seeded.');
    } finally {
      setLoading(false);
    }
  };

  const selectSection = async (sectionKey: string) => {
    try {
      if (sections[sectionKey]) {
        setSelectedSection(sectionKey);
        setEditingContent(sections[sectionKey].content || {});
      } else {
        // Load section if not in cache
        const { section } = await getPageSection(token, pageKey, sectionKey);
        setSections(prev => ({ ...prev, [sectionKey]: section }));
        setSelectedSection(sectionKey);
        setEditingContent(section.content || {});
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load section');
    }
  };

  const createNewSection = (type: SectionType) => {
    const defaultSection = DEFAULT_SECTIONS[type];
    const newSectionKey = `${type}_${Date.now()}`;
    const newSection: PageSection = {
      ...defaultSection,
      pageKey,
      sectionKey: newSectionKey,
      content: defaultSection.content || {}
    } as PageSection;
    
    setSections(prev => ({ ...prev, [newSectionKey]: newSection }));
    setSelectedSection(newSectionKey);
    setEditingContent(newSection.content || {});
  };

  const handleSave = async () => {
    if (!selectedSection) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const sectionData = {
        pageKey,
        sectionKey: selectedSection,
        content: editingContent,
        isActive: true,
        sortOrder: 0
      };

      let savedSection: PageSection;
      if (sections[selectedSection]?.id) {
        // Update existing
        const result = await updatePageSection(token, pageKey, selectedSection, {
          content: editingContent
        });
        savedSection = result.section;
      } else {
        // Create new
        const result = await savePageSection(token, sectionData);
        savedSection = result.section;
      }

      setSections(prev => ({ ...prev, [selectedSection]: savedSection }));
      setSuccess('Section saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to save section:', err);
      setError(err.message || 'Failed to save section');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sectionKey: string) => {
    if (!(await showConfirm(`Are you sure you want to delete section "${sectionKey}"?`))) return;

    try {
      await deletePageSection(token, pageKey, sectionKey);
      setSections(prev => {
        const updated = { ...prev };
        delete updated[sectionKey];
        return updated;
      });
      
      if (selectedSection === sectionKey) {
        setSelectedSection(null);
        setEditingContent({});
      }
      
      setSuccess('Section deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete section');
      setTimeout(() => setError(null), 5000);
    }
  };

  const updateContentField = (path: string, value: any) => {
    const keys = path.split('.');
    setEditingContent((prev: any) => {
      const updated = { ...prev };
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return { ...updated };
    });
  };

  const addArrayItem = (path: string, defaultItem: any) => {
    const keys = path.split('.');
    setEditingContent((prev: any) => {
      const updated = { ...prev };
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      const array = current[keys[keys.length - 1]] || [];
      array.push(defaultItem);
      current[keys[keys.length - 1]] = array;
      
      return { ...updated };
    });
  };

  const removeArrayItem = (path: string, index: number) => {
    const keys = path.split('.');
    setEditingContent((prev: any) => {
      const updated = { ...prev };
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) return prev;
        current = current[keys[i]];
      }
      
      const array = current[keys[keys.length - 1]] || [];
      array.splice(index, 1);
      current[keys[keys.length - 1]] = array;
      
      return { ...updated };
    });
  };

  const toggleExpand = (sectionKey: string) => {
    setExpandedSections(prev => {
      const updated = new Set(prev);
      if (updated.has(sectionKey)) {
        updated.delete(sectionKey);
      } else {
        updated.add(sectionKey);
      }
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layout size={24} />
            Page Editor: {pageKey}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Edit your home page content visually</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPageContent}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {previewMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {previewMode ? 'Exit Preview' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 p-4 flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Section List */}
        <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Sections</h3>
              <AddSectionDropdown onSelect={createNewSection} />
            </div>

            <div className="space-y-1">
              {Object.keys(sections).map((sectionKey) => (
                <div
                  key={sectionKey}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedSection === sectionKey
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-slate-50'
                  }`}
                  onClick={() => selectSection(sectionKey)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-slate-800">{sectionKey}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {sections[sectionKey].content?.title || 'No title'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(sectionKey);
                      }}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              
              {Object.keys(sections).length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No sections yet. Create one to get started!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex overflow-hidden">
          {selectedSection ? (
            <div className="flex-1 flex flex-col">
              {/* Section Editor */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                      <Edit size={18} />
                      Edit: {selectedSection}
                    </h3>

                    {/* Basic Fields */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editingContent.title || ''}
                          onChange={(e) => updateContentField('title', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter title"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={editingContent.subtitle || ''}
                          onChange={(e) => updateContentField('subtitle', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter subtitle"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={editingContent.description || ''}
                          onChange={(e) => updateContentField('description', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter description"
                        />
                      </div>

                      {/* Features Editor */}
                      {selectedSection.includes('features') && (
                        <FeaturesEditor
                          features={editingContent.features || []}
                          onAdd={() => addArrayItem('features', { title: '', description: '', icon: '', color: '' })}
                          onRemove={(index) => removeArrayItem('features', index)}
                          onUpdate={(index, field, value) => {
                            const updated = [...(editingContent.features || [])];
                            updated[index] = { ...updated[index], [field]: value };
                            updateContentField('features', updated);
                          }}
                        />
                      )}

                      {/* Testimonials Editor */}
                      {selectedSection.includes('testimonials') && (
                        <TestimonialsEditor
                          testimonials={editingContent.testimonials || []}
                          onAdd={() => addArrayItem('testimonials', {
                            name: '',
                            role: '',
                            company: '',
                            avatar: '',
                            content: '',
                            rating: 5
                          })}
                          onRemove={(index) => removeArrayItem('testimonials', index)}
                          onUpdate={(index, field, value) => {
                            const updated = [...(editingContent.testimonials || [])];
                            updated[index] = { ...updated[index], [field]: value };
                            updateContentField('testimonials', updated);
                          }}
                        />
                      )}

                      {/* FAQ Editor */}
                      {selectedSection.includes('faq') && (
                        <FAQEditor
                          faqs={editingContent.faqs || []}
                          onAdd={() => addArrayItem('faqs', { question: '', answer: '' })}
                          onRemove={(index) => removeArrayItem('faqs', index)}
                          onUpdate={(index, field, value) => {
                            const updated = [...(editingContent.faqs || [])];
                            updated[index] = { ...updated[index], [field]: value };
                            updateContentField('faqs', updated);
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="bg-white border-t border-slate-200 p-4 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Section
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Select a section to start editing
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-components for editing arrays

interface FeaturesEditorProps {
  features: Array<{ title: string; description: string; icon?: string; color?: string }>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

const FeaturesEditor: React.FC<FeaturesEditorProps> = ({ features, onAdd, onRemove, onUpdate }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <label className="block text-sm font-medium text-slate-700">Features</label>
      <button
        onClick={onAdd}
        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-1"
      >
        <Plus size={14} /> Add
      </button>
    </div>
    {features.map((feature, index) => (
      <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Feature {index + 1}</span>
          <button
            onClick={() => onRemove(index)}
            className="p-1 text-red-400 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <input
          type="text"
          value={feature.title || ''}
          onChange={(e) => onUpdate(index, 'title', e.target.value)}
          placeholder="Feature title"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <textarea
          value={feature.description || ''}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
          placeholder="Feature description"
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>
    ))}
  </div>
);

interface TestimonialsEditorProps {
  testimonials: Array<{
    name: string;
    role: string;
    company: string;
    avatar: string;
    content: string;
    rating?: number;
  }>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

const TestimonialsEditor: React.FC<TestimonialsEditorProps> = ({ testimonials, onAdd, onRemove, onUpdate }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <label className="block text-sm font-medium text-slate-700">Testimonials</label>
      <button
        onClick={onAdd}
        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-1"
      >
        <Plus size={14} /> Add
      </button>
    </div>
    {testimonials.map((testimonial, index) => (
      <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Testimonial {index + 1}</span>
          <button onClick={() => onRemove(index)} className="p-1 text-red-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
        <input
          type="text"
          value={testimonial.name || ''}
          onChange={(e) => onUpdate(index, 'name', e.target.value)}
          placeholder="Name"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <input
          type="text"
          value={testimonial.role || ''}
          onChange={(e) => onUpdate(index, 'role', e.target.value)}
          placeholder="Role"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <textarea
          value={testimonial.content || ''}
          onChange={(e) => onUpdate(index, 'content', e.target.value)}
          placeholder="Testimonial content"
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>
    ))}
  </div>
);

interface FAQEditorProps {
  faqs: Array<{ question: string; answer: string }>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: any) => void;
}

const FAQEditor: React.FC<FAQEditorProps> = ({ faqs, onAdd, onRemove, onUpdate }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <label className="block text-sm font-medium text-slate-700">FAQs</label>
      <button
        onClick={onAdd}
        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-1"
      >
        <Plus size={14} /> Add
      </button>
    </div>
    {faqs.map((faq, index) => (
      <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">FAQ {index + 1}</span>
          <button onClick={() => onRemove(index)} className="p-1 text-red-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
        <input
          type="text"
          value={faq.question || ''}
          onChange={(e) => onUpdate(index, 'question', e.target.value)}
          placeholder="Question"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <textarea
          value={faq.answer || ''}
          onChange={(e) => onUpdate(index, 'answer', e.target.value)}
          placeholder="Answer"
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>
    ))}
  </div>
);

export default PageEditor;

