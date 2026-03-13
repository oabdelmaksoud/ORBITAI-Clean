import React, { useState, useEffect, useMemo } from 'react';
import {
  Edit, Save, Eye, X, Plus, Trash2, Copy, ChevronDown, ChevronUp,
  Type, Image, Video, Link, Palette, Layout, Loader2, AlertCircle,
  CheckCircle, Maximize2, Minimize2, RefreshCw, Quote, DollarSign, 
  TrendingUp, GripVertical, Move, Monitor, Tablet, Smartphone
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

// Sortable Section Item Component
interface SortableSectionItemProps {
  sectionKey: string;
  section: PageSection;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const SortableSectionItem: React.FC<SortableSectionItemProps> = ({
  sectionKey,
  section,
  isSelected,
  onSelect,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
        isSelected
          ? 'bg-blue-50 border border-blue-200'
          : 'hover:bg-slate-50 border border-transparent'
      } ${isDragging ? 'shadow-lg' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
          >
            <GripVertical size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-slate-800 truncate">{sectionKey}</div>
            <div className="text-xs text-slate-500 truncate">
              {section.content?.title || 'No title'}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// Preview Device Component
interface PreviewDeviceProps {
  device: 'desktop' | 'tablet' | 'mobile';
  isActive: boolean;
  onClick: () => void;
}

const PreviewDevice: React.FC<PreviewDeviceProps> = ({ device, isActive, onClick }) => {
  const icons = {
    desktop: Monitor,
    tablet: Tablet,
    mobile: Smartphone,
  };
  const Icon = icons[device];
  
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
      title={device.charAt(0).toUpperCase() + device.slice(1)}
    >
      <Icon size={16} />
    </button>
  );
};

const PageEditorEnhanced: React.FC<PageEditorProps> = ({ token, pageKey = 'home' }) => {
  const [sections, setSections] = useState<Record<string, PageSection>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showRichTextEditor, setShowRichTextEditor] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load page content
  useEffect(() => {
    loadPageContent();
  }, [token, pageKey]);

  const loadPageContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPageContent(token, pageKey);
      
      // Convert sections to PageSection format
      const sectionsMap: Record<string, PageSection> = {};
      const order: string[] = [];
      
      // Sort by sortOrder if available
      const sortedEntries = Object.entries(data.sections).sort(([, a], [, b]) => {
        // If sections have sortOrder, use it; otherwise maintain order
        return 0; // We'll use the order from API or maintain insertion order
      });
      
      sortedEntries.forEach(([key, section]) => {
        sectionsMap[key] = {
          pageKey,
          sectionKey: key,
          content: section.content,
          isActive: true,
          sortOrder: section.sortOrder || 0
        };
        order.push(key);
      });
      
      setSections(sectionsMap);
      setSectionOrder(order.length > 0 ? order : Object.keys(sectionsMap));
      
      // If sections exist, select first one
      if (order.length > 0 && !selectedSection) {
        setSelectedSection(order[0]);
        setEditingContent(sectionsMap[order[0]].content || {});
      }
    } catch (err: any) {
      console.error('Failed to load page content:', err);
      setError(err.message || 'Failed to load page content');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update sortOrder for each section
        newOrder.forEach((key, index) => {
          if (sections[key]) {
            updatePageSection(token, pageKey, key, {
              sortOrder: index
            }).catch(err => console.error('Failed to update sort order:', err));
          }
        });
        
        return newOrder;
      });
    }
  };

  const selectSection = async (sectionKey: string) => {
    try {
      if (sections[sectionKey]) {
        setSelectedSection(sectionKey);
        setEditingContent(sections[sectionKey].content || {});
      } else {
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
    setSectionOrder(prev => [...prev, newSectionKey]);
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
        sortOrder: sectionOrder.indexOf(selectedSection)
      };

      let savedSection: PageSection;
      if (sections[selectedSection]?.id) {
        const result = await updatePageSection(token, pageKey, selectedSection, {
          content: editingContent,
          sortOrder: sectionData.sortOrder
        });
        savedSection = result.section;
      } else {
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
      setSectionOrder(prev => prev.filter(key => key !== sectionKey));
      
      if (selectedSection === sectionKey) {
        const remainingKeys = sectionOrder.filter(key => key !== sectionKey);
        if (remainingKeys.length > 0) {
          setSelectedSection(remainingKeys[0]);
          setEditingContent(sections[remainingKeys[0]].content || {});
        } else {
          setSelectedSection(null);
          setEditingContent({});
        }
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

  // Rich text editor modules
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'image'],
      ['clean']
    ],
  }), []);

  // Render preview based on selected device
  const previewWidths = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
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
            Enhanced Page Editor: {pageKey}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Edit your home page content with drag-and-drop & rich text</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPageContent}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {previewMode && (
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
              <PreviewDevice device="desktop" isActive={previewDevice === 'desktop'} onClick={() => setPreviewDevice('desktop')} />
              <PreviewDevice device="tablet" isActive={previewDevice === 'tablet'} onClick={() => setPreviewDevice('tablet')} />
              <PreviewDevice device="mobile" isActive={previewDevice === 'mobile'} onClick={() => setPreviewDevice('mobile')} />
            </div>
          )}
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
        {/* Sidebar - Section List with Drag and Drop */}
        <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Sections</h3>
              <AddSectionDropdown onSelect={createNewSection} />
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sectionOrder}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {sectionOrder.map((sectionKey) => {
                    const section = sections[sectionKey];
                    if (!section) return null;
                    
                    return (
                      <SortableSectionItem
                        key={sectionKey}
                        sectionKey={sectionKey}
                        section={section}
                        isSelected={selectedSection === sectionKey}
                        onSelect={() => selectSection(sectionKey)}
                        onDelete={() => handleDelete(sectionKey)}
                      />
                    );
                  })}
                  
                  {sectionOrder.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      No sections yet. Create one to get started!
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex overflow-hidden">
          {selectedSection ? (
            <div className="flex-1 flex flex-col">
              {previewMode ? (
                // Preview Mode
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                  <div className="max-w-7xl mx-auto">
                    <div
                      className="bg-white rounded-lg shadow-xl mx-auto transition-all duration-300"
                      style={{
                        width: previewWidths[previewDevice],
                        maxWidth: '100%',
                      }}
                    >
                      {/* Preview content will be rendered here */}
                      <div className="p-8">
                        <h1 className="text-4xl font-bold mb-4">{editingContent.title || 'Preview'}</h1>
                        <div 
                          className="prose max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: editingContent.description || editingContent.html || 'No content' 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Editor Mode
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                        <Edit size={18} />
                        Edit: {selectedSection}
                      </h3>

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
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-slate-700">
                              Description
                            </label>
                            <button
                              onClick={() => setShowRichTextEditor(!showRichTextEditor)}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              {showRichTextEditor ? 'Switch to Plain Text' : 'Switch to Rich Text'}
                            </button>
                          </div>
                          {showRichTextEditor ? (
                            <div className="border border-slate-300 rounded-lg overflow-hidden">
                              <ReactQuill
                                theme="snow"
                                value={editingContent.description || editingContent.html || ''}
                                onChange={(value) => {
                                  updateContentField('description', value);
                                  updateContentField('html', value);
                                }}
                                modules={quillModules}
                                placeholder="Enter description (rich text)"
                              />
                            </div>
                          ) : (
                            <textarea
                              value={editingContent.description || ''}
                              onChange={(e) => updateContentField('description', e.target.value)}
                              rows={4}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter description"
                            />
                          )}
                        </div>

                        {/* Features, Testimonials, FAQ editors would go here - same as before */}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              {!previewMode && (
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
              )}
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

// Add Section Dropdown Component (same as before)
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

export default PageEditorEnhanced;

