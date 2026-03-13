import React from 'react';
import { useEditor } from '@craftjs/core';
import { BLOCK_REGISTRY, getBlocksByCategory } from './blocks/registry';
import { BlockType } from '@orbitai/shared';
import {
  Layout, Type, Heading, Image, MousePointer, Star,
  CheckCircle, Quote, HelpCircle, DollarSign, TrendingUp,
  Video, Images, FileText, Code
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<any>> = {
  Layout,
  Type,
  Heading,
  Image,
  MousePointer,
  Star,
  CheckCircle,
  Quote,
  HelpCircle,
  DollarSign,
  TrendingUp,
  Video,
  Images,
  FileText,
  Code
};

interface BlockPaletteProps {
  onBlockSelect?: (blockType: BlockType) => void;
}

export function BlockPalette({ onBlockSelect }: BlockPaletteProps) {
  const { connectors } = useEditor();

  const categories: Array<{ name: string; blocks: typeof BLOCK_REGISTRY[BlockType][] }> = [
    { name: 'Layout', blocks: getBlocksByCategory('Layout') },
    { name: 'Content', blocks: getBlocksByCategory('Content') },
    { name: 'Media', blocks: getBlocksByCategory('Media') },
    { name: 'Sections', blocks: getBlocksByCategory('Sections') },
    { name: 'Forms', blocks: getBlocksByCategory('Forms') },
    { name: 'Custom', blocks: getBlocksByCategory('Custom') }
  ];

  const handleBlockDrag = (blockType: BlockType, blockSchema: typeof BLOCK_REGISTRY[BlockType]) => {
    return (ref: HTMLElement | null) => {
      if (ref) {
        connectors.create(ref, blockSchema.type as any, {
          ...blockSchema.defaultProps
        });
      }
    };
  };

  return (
    <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
      <div className="p-4">
        <h3 className="font-bold text-slate-800 mb-4">Blocks</h3>
        <div className="space-y-6">
          {categories.map(category => (
            <div key={category.name}>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                {category.name}
              </h4>
              <div className="space-y-1">
                {category.blocks.map(block => {
                  const Icon = iconMap[block.icon] || Layout;
                  return (
                    <div
                      key={block.type}
                      ref={handleBlockDrag(block.type, block)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-move transition-colors"
                      onClick={() => onBlockSelect?.(block.type)}
                    >
                      <Icon size={16} className="text-slate-500" />
                      <span className="text-sm text-slate-700">{block.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

