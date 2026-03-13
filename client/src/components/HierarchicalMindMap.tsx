import React, { useMemo } from 'react';
import {
  Globe, Smartphone, Monitor, Server, Code, Lightbulb, Users, Target,
  Calendar, Clock, Bell, Moon, Puzzle, Building, GraduationCap, Columns,
  Heart, Sparkles, Zap, Shield, Rocket, Settings, Database, Cloud, Lock
} from 'lucide-react';

interface Idea {
  id: string;
  label: string;
  description?: string;
  parentId?: string | null;
  category?: string;
  tags?: string[];
  priority?: number;
}

interface HierarchicalMindMapProps {
  topic: string;
  ideas: Idea[];
  onIdeaClick?: (ideaId: string) => void;
  selectedIdeaId?: string | null;
  className?: string;
}

type ViewMode = 'bubble' | 'mindmap';

// Category color mappings
const categoryColors: Record<string, string> = {
  'webapp': 'bg-blue-500',
  'mobile-app': 'bg-purple-500',
  'website': 'bg-green-500',
  'api': 'bg-orange-500',
  'desktop-app': 'bg-indigo-500',
  'infrastructure': 'bg-slate-500',
  'security': 'bg-red-500',
  'ui/ux': 'bg-pink-500',
  'database': 'bg-cyan-500',
  'cloud': 'bg-sky-500',
  'other': 'bg-gray-500',
};

// Icon mappings
const getIconForCategory = (category?: string, label?: string): React.ComponentType<{ className?: string }> => {
  const lowerLabel = (label || '').toLowerCase();
  const lowerCategory = (category || '').toLowerCase();

  if (lowerCategory.includes('webapp') || lowerLabel.includes('web app')) return Globe;
  if (lowerCategory.includes('mobile') || lowerLabel.includes('mobile')) return Smartphone;
  if (lowerCategory.includes('desktop') || lowerLabel.includes('desktop')) return Monitor;
  if (lowerCategory.includes('api') || lowerLabel.includes('api')) return Server;
  if (lowerCategory.includes('website') || lowerLabel.includes('website')) return Globe;
  if (lowerCategory.includes('database') || lowerLabel.includes('database')) return Database;
  if (lowerCategory.includes('cloud') || lowerLabel.includes('cloud')) return Cloud;
  if (lowerCategory.includes('security') || lowerLabel.includes('security')) return Lock;
  if (lowerCategory.includes('ui') || lowerLabel.includes('ui') || lowerLabel.includes('design')) return Sparkles;
  
  // Default icons based on keywords
  if (lowerLabel.includes('time') || lowerLabel.includes('schedule')) return Clock;
  if (lowerLabel.includes('notification') || lowerLabel.includes('alert')) return Bell;
  if (lowerLabel.includes('social') || lowerLabel.includes('community')) return Users;
  if (lowerLabel.includes('policy') || lowerLabel.includes('regulation')) return Columns;
  if (lowerLabel.includes('education') || lowerLabel.includes('school')) return GraduationCap;
  if (lowerLabel.includes('work') || lowerLabel.includes('office')) return Building;
  if (lowerLabel.includes('mindful') || lowerLabel.includes('awareness')) return Heart;
  if (lowerLabel.includes('feature') || lowerLabel.includes('function')) return Zap;
  
  return Lightbulb;
};

interface CategoryGroup {
  id: string;
  name: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  ideas: Idea[];
  subCategories: Map<string, Idea[]>;
}

const HierarchicalMindMap: React.FC<HierarchicalMindMapProps> = ({
  topic,
  ideas,
  onIdeaClick,
  selectedIdeaId,
  className = ''
}) => {
  // Organize ideas into hierarchical categories
  const organizedStructure = useMemo(() => {
    // Separate root-level ideas (no parent or parent is CENTER/null)
    const rootIdeas = ideas.filter(idea => !idea.parentId || idea.parentId === 'CENTER');
    const childIdeas = ideas.filter(idea => idea.parentId && idea.parentId !== 'CENTER');

    // Group root ideas by category or detect categories from labels
    const categoryMap = new Map<string, CategoryGroup>();

    rootIdeas.forEach(idea => {
      // Detect category from idea label/description or use tags
      let category = idea.category || idea.tags?.[0] || 'other';
      const lowerLabel = idea.label.toLowerCase();
      const lowerDesc = (idea.description || '').toLowerCase();

      // Auto-detect category from keywords
      if (lowerLabel.includes('web app') || lowerLabel.includes('webapp') || lowerLabel.includes('web application')) {
        category = 'webapp';
      } else if (lowerLabel.includes('mobile') || lowerLabel.includes('ios') || lowerLabel.includes('android')) {
        category = 'mobile-app';
      } else if (lowerLabel.includes('website') || lowerLabel.includes('site')) {
        category = 'website';
      } else if (lowerLabel.includes('api') || lowerLabel.includes('backend')) {
        category = 'api';
      } else if (lowerLabel.includes('desktop') || lowerLabel.includes('windows') || lowerLabel.includes('mac')) {
        category = 'desktop-app';
      } else if (lowerLabel.includes('database') || lowerLabel.includes('data storage')) {
        category = 'database';
      } else if (lowerLabel.includes('cloud') || lowerLabel.includes('aws') || lowerLabel.includes('azure')) {
        category = 'cloud';
      } else if (lowerLabel.includes('security') || lowerLabel.includes('auth')) {
        category = 'security';
      } else if (lowerLabel.includes('ui') || lowerLabel.includes('design') || lowerLabel.includes('interface')) {
        category = 'ui/ux';
      } else if (lowerLabel.includes('infrastructure') || lowerLabel.includes('devops')) {
        category = 'infrastructure';
      }

      if (!categoryMap.has(category)) {
        const Icon = getIconForCategory(category, idea.label);
        categoryMap.set(category, {
          id: category,
          name: category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          color: categoryColors[category] || categoryColors['other'],
          icon: Icon,
          ideas: [],
          subCategories: new Map()
        });
      }

      const categoryGroup = categoryMap.get(category)!;
      categoryGroup.ideas.push(idea);

      // Find child ideas for this root idea
      const children = childIdeas.filter(child => child.parentId === idea.id);
      if (children.length > 0) {
        categoryGroup.subCategories.set(idea.id, children);
      }
    });

    return Array.from(categoryMap.values());
  }, [ideas]);

  const handleIdeaClick = (ideaId: string) => {
    if (onIdeaClick) {
      onIdeaClick(ideaId);
    }
  };

  return (
    <div className={`w-full h-full overflow-auto p-8 bg-gradient-to-br from-slate-50 to-blue-50 ${className}`}>
      {/* Central Topic */}
      <div className="flex justify-center mb-12">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl px-8 py-4 shadow-xl border-4 border-white">
          <h1 className="text-2xl font-bold text-center">{topic}</h1>
        </div>
      </div>

      {/* Category Branches */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {organizedStructure.map((category) => {
          const Icon = category.icon;
          return (
            <div
              key={category.id}
              className="relative"
            >
              {/* Main Category Card */}
              <div
                className={`${category.color} text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:scale-105 border-4 border-white`}
                onClick={() => category.ideas[0] && handleIdeaClick(category.ideas[0].id)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Icon className="w-6 h-6" />
                  <h2 className="font-bold text-lg">{category.name}</h2>
                </div>
                <p className="text-sm opacity-90">{category.ideas.length} idea{category.ideas.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Child Ideas */}
              <div className="mt-4 space-y-2 ml-4">
                {category.ideas.slice(0, 5).map((idea) => {
                  const isSelected = selectedIdeaId === idea.id;
                  const children = category.subCategories.get(idea.id) || [];
                  
                  return (
                    <div key={idea.id} className="relative">
                      {/* Idea Card */}
                      <div
                        className={`bg-white rounded-lg p-3 shadow-md hover:shadow-lg transition-all cursor-pointer border-2 ${
                          isSelected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-slate-200'
                        }`}
                        onClick={() => handleIdeaClick(idea.id)}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-2 ${category.color}`} />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-slate-800 truncate">{idea.label}</h3>
                            {idea.description && (
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{idea.description}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sub-ideas (children) */}
                      {children.length > 0 && (
                        <div className="mt-2 ml-4 space-y-1">
                          {children.slice(0, 3).map((child) => (
                            <div
                              key={child.id}
                              className={`bg-slate-50 rounded px-3 py-2 text-xs cursor-pointer hover:bg-slate-100 transition-colors border ${
                                selectedIdeaId === child.id ? 'border-purple-400 bg-purple-50' : 'border-slate-200'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIdeaClick(child.id);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${category.color}`} />
                                <span className="text-slate-700 truncate">{child.label}</span>
                              </div>
                            </div>
                          ))}
                          {children.length > 3 && (
                            <div className="text-xs text-slate-400 px-3">
                              +{children.length - 3} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {category.ideas.length > 5 && (
                  <div className="text-xs text-slate-400 ml-4 px-3">
                    +{category.ideas.length - 5} more ideas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {organizedStructure.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Lightbulb className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">No ideas yet. Start brainstorming to see your mind map!</p>
        </div>
      )}
    </div>
  );
};

export default HierarchicalMindMap;
export type { ViewMode };


