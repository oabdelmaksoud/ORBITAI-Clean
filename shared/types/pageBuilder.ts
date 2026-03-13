/**
 * Page Builder Type Definitions
 */

export type BlockType = 
  | 'Container'
  | 'Text'
  | 'Heading'
  | 'Image'
  | 'Button'
  | 'Hero'
  | 'Features'
  | 'Testimonials'
  | 'FAQ'
  | 'Pricing'
  | 'Stats'
  | 'Video'
  | 'Gallery'
  | 'Form'
  | 'Custom';

export type FieldType = 
  | 'text'
  | 'richText'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'color'
  | 'image'
  | 'url'
  | 'date'
  | 'array'
  | 'object';

export interface BlockFieldSchema {
  type: FieldType;
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: any;
  options?: string[]; // For select/multiselect
  min?: number; // For number
  max?: number; // For number
  placeholder?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    custom?: (value: any) => boolean | string;
  };
}

export interface BlockSchema {
  type: BlockType;
  category: 'Layout' | 'Content' | 'Media' | 'Sections' | 'Forms' | 'Custom';
  icon: string; // Icon name (lucide-react)
  label: string;
  description?: string;
  defaultProps: Record<string, any>;
  schema: Record<string, BlockFieldSchema>;
  allowedChildren?: BlockType[]; // For container blocks
  isContainer?: boolean;
  canNest?: boolean;
}

export interface BlockInstance {
  id: string;
  type: BlockType;
  props: Record<string, any>;
  children?: BlockInstance[];
  parentId?: string;
}

export interface PageBlocks {
  ROOT: {
    type: 'div';
    isCanvas: true;
    props: Record<string, any>;
    displayName: string;
    custom?: Record<string, any>;
    nodes: string[];
  };
  [blockId: string]: {
    type: string | BlockType;
    isCanvas?: boolean;
    props: Record<string, any>;
    displayName: string;
    custom?: Record<string, any>;
    nodes?: string[];
    parent?: string;
  };
}

export interface PageData {
  id?: string;
  pageKey: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  scheduledPublishAt?: Date;
  themeId?: string;
  templateId?: string;
  blocks: PageBlocks;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
    ogImage?: string;
  };
  settings?: {
    showHeader?: boolean;
    showFooter?: boolean;
    customCss?: string;
    customJs?: string;
  };
  metadata?: {
    createdBy?: string;
    lastEditedBy?: string;
    lastEditedAt?: Date;
    version?: number;
  };
}

export interface PageRevision {
  id: string;
  pageId: string;
  pageKey: string;
  revisionNumber: number;
  blocks: PageBlocks;
  status: 'draft' | 'published' | 'archived';
  title: string;
  slug: string;
  themeId?: string;
  templateId?: string;
  seo?: any;
  settings?: any;
  metadata: {
    createdBy: string;
    createdAt: Date;
    note?: string;
    isAutoSave?: boolean;
  };
  createdAt: Date;
}

export interface PageTheme {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isDefault: boolean;
  isSystem: boolean;
  designTokens: {
    colors: Record<string, string>;
    typography: Record<string, any>;
    spacing: Record<string, any>;
    borderRadius?: Record<string, string>;
    shadows?: Record<string, string>;
    [key: string]: any;
  };
  customCss?: string;
  metadata?: {
    createdBy?: string;
    lastEditedBy?: string;
    lastEditedAt?: Date;
  };
}

export interface PageTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: 'landing' | 'blog' | 'product' | 'portfolio' | 'ecommerce' | 'custom';
  thumbnail?: string;
  isPublic: boolean;
  isSystem: boolean;
  blocks: PageBlocks;
  themeId?: string;
  tags?: string[];
  metadata?: {
    createdBy?: string;
    lastEditedBy?: string;
    lastEditedAt?: Date;
    usageCount?: number;
  };
}




