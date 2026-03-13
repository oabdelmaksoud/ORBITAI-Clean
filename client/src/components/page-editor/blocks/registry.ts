import { BlockSchema, BlockType } from '@orbitai/shared';

/**
 * Block Registry - Defines all available blocks and their schemas
 * This should match the backend registry endpoint
 */
export const BLOCK_REGISTRY: Record<BlockType, BlockSchema> = {
  Container: {
    type: 'Container',
    category: 'Layout',
    icon: 'Layout',
    label: 'Container',
    description: 'A flexible container for organizing content',
    defaultProps: {
      padding: 'medium',
      backgroundColor: 'transparent',
      maxWidth: 'full',
      display: 'block'
    },
    schema: {
      padding: {
        type: 'select',
        label: 'Padding',
        options: ['none', 'small', 'medium', 'large', 'xl'],
        defaultValue: 'medium'
      },
      backgroundColor: {
        type: 'color',
        label: 'Background Color',
        defaultValue: 'transparent'
      },
      maxWidth: {
        type: 'select',
        label: 'Max Width',
        options: ['full', 'sm', 'md', 'lg', 'xl', '2xl'],
        defaultValue: 'full'
      },
      display: {
        type: 'select',
        label: 'Display',
        options: ['block', 'flex', 'grid'],
        defaultValue: 'block'
      }
    },
    isContainer: true,
    canNest: true,
    allowedChildren: ['Container', 'Text', 'Heading', 'Image', 'Button', 'Hero', 'Features', 'Testimonials', 'FAQ', 'Pricing', 'Stats', 'Video', 'Gallery', 'Form']
  },
  Text: {
    type: 'Text',
    category: 'Content',
    icon: 'Type',
    label: 'Text',
    description: 'Rich text content block',
    defaultProps: {
      content: 'Enter text here',
      fontSize: 'medium',
      fontWeight: 'normal',
      textAlign: 'left',
      color: 'inherit'
    },
    schema: {
      content: {
        type: 'richText',
        label: 'Content',
        required: true,
        defaultValue: 'Enter text here'
      },
      fontSize: {
        type: 'select',
        label: 'Font Size',
        options: ['small', 'medium', 'large', 'xl', '2xl'],
        defaultValue: 'medium'
      },
      fontWeight: {
        type: 'select',
        label: 'Font Weight',
        options: ['normal', 'medium', 'semibold', 'bold'],
        defaultValue: 'normal'
      },
      textAlign: {
        type: 'select',
        label: 'Text Align',
        options: ['left', 'center', 'right', 'justify'],
        defaultValue: 'left'
      },
      color: {
        type: 'color',
        label: 'Text Color',
        defaultValue: 'inherit'
      }
    },
    isContainer: false
  },
  Heading: {
    type: 'Heading',
    category: 'Content',
    icon: 'Heading',
    label: 'Heading',
    description: 'Heading block (H1-H6)',
    defaultProps: {
      level: 1,
      content: 'Heading',
      textAlign: 'left',
      color: 'inherit'
    },
    schema: {
      level: {
        type: 'number',
        label: 'Heading Level',
        min: 1,
        max: 6,
        defaultValue: 1
      },
      content: {
        type: 'text',
        label: 'Heading Text',
        required: true,
        defaultValue: 'Heading'
      },
      textAlign: {
        type: 'select',
        label: 'Text Align',
        options: ['left', 'center', 'right'],
        defaultValue: 'left'
      },
      color: {
        type: 'color',
        label: 'Text Color',
        defaultValue: 'inherit'
      }
    },
    isContainer: false
  },
  Image: {
    type: 'Image',
    category: 'Media',
    icon: 'Image',
    label: 'Image',
    description: 'Image block with alt text and sizing',
    defaultProps: {
      src: '',
      alt: '',
      width: '100%',
      height: 'auto',
      objectFit: 'cover'
    },
    schema: {
      src: {
        type: 'image',
        label: 'Image URL',
        required: true,
        defaultValue: ''
      },
      alt: {
        type: 'text',
        label: 'Alt Text',
        defaultValue: ''
      },
      width: {
        type: 'text',
        label: 'Width',
        defaultValue: '100%'
      },
      height: {
        type: 'text',
        label: 'Height',
        defaultValue: 'auto'
      },
      objectFit: {
        type: 'select',
        label: 'Object Fit',
        options: ['cover', 'contain', 'fill', 'none', 'scale-down'],
        defaultValue: 'cover'
      }
    },
    isContainer: false
  },
  Button: {
    type: 'Button',
    category: 'Content',
    icon: 'MousePointer',
    label: 'Button',
    description: 'Call-to-action button',
    defaultProps: {
      text: 'Click me',
      link: '#',
      variant: 'primary',
      size: 'medium'
    },
    schema: {
      text: {
        type: 'text',
        label: 'Button Text',
        required: true,
        defaultValue: 'Click me'
      },
      link: {
        type: 'url',
        label: 'Link URL',
        defaultValue: '#'
      },
      variant: {
        type: 'select',
        label: 'Variant',
        options: ['primary', 'secondary', 'outline', 'ghost'],
        defaultValue: 'primary'
      },
      size: {
        type: 'select',
        label: 'Size',
        options: ['small', 'medium', 'large'],
        defaultValue: 'medium'
      }
    },
    isContainer: false
  },
  Hero: {
    type: 'Hero',
    category: 'Sections',
    icon: 'Star',
    label: 'Hero Section',
    description: 'Hero section with title, subtitle, and CTA',
    defaultProps: {
      title: 'Hero Title',
      subtitle: 'Hero subtitle',
      description: 'Hero description',
      backgroundImage: '',
      ctaText: 'Get Started',
      ctaLink: '#',
      alignment: 'center'
    },
    schema: {
      title: {
        type: 'text',
        label: 'Title',
        required: true,
        defaultValue: 'Hero Title'
      },
      subtitle: {
        type: 'text',
        label: 'Subtitle',
        defaultValue: 'Hero subtitle'
      },
      description: {
        type: 'richText',
        label: 'Description',
        defaultValue: 'Hero description'
      },
      backgroundImage: {
        type: 'image',
        label: 'Background Image',
        defaultValue: ''
      },
      ctaText: {
        type: 'text',
        label: 'CTA Text',
        defaultValue: 'Get Started'
      },
      ctaLink: {
        type: 'url',
        label: 'CTA Link',
        defaultValue: '#'
      },
      alignment: {
        type: 'select',
        label: 'Alignment',
        options: ['left', 'center', 'right'],
        defaultValue: 'center'
      }
    },
    isContainer: false
  },
  Features: {
    type: 'Features',
    category: 'Sections',
    icon: 'CheckCircle',
    label: 'Features Section',
    description: 'Features grid section',
    defaultProps: {
      title: 'Features',
      description: 'Feature description',
      features: []
    },
    schema: {
      title: {
        type: 'text',
        label: 'Section Title',
        defaultValue: 'Features'
      },
      description: {
        type: 'richText',
        label: 'Description',
        defaultValue: ''
      },
      features: {
        type: 'array',
        label: 'Features',
        defaultValue: []
      }
    },
    isContainer: false
  },
  Testimonials: {
    type: 'Testimonials',
    category: 'Sections',
    icon: 'Quote',
    label: 'Testimonials',
    description: 'Testimonials carousel section',
    defaultProps: {
      title: 'Testimonials',
      testimonials: []
    },
    schema: {
      title: {
        type: 'text',
        label: 'Section Title',
        defaultValue: 'Testimonials'
      },
      testimonials: {
        type: 'array',
        label: 'Testimonials',
        defaultValue: []
      }
    },
    isContainer: false
  },
  FAQ: {
    type: 'FAQ',
    category: 'Sections',
    icon: 'HelpCircle',
    label: 'FAQ Section',
    description: 'Frequently asked questions',
    defaultProps: {
      title: 'Frequently Asked Questions',
      faqs: []
    },
    schema: {
      title: {
        type: 'text',
        label: 'Section Title',
        defaultValue: 'Frequently Asked Questions'
      },
      faqs: {
        type: 'array',
        label: 'FAQs',
        defaultValue: []
      }
    },
    isContainer: false
  },
  Pricing: {
    type: 'Pricing',
    category: 'Sections',
    icon: 'DollarSign',
    label: 'Pricing Section',
    description: 'Pricing plans section',
    defaultProps: {
      title: 'Pricing Plans',
      plans: []
    },
    schema: {
      title: {
        type: 'text',
        label: 'Section Title',
        defaultValue: 'Pricing Plans'
      },
      plans: {
        type: 'array',
        label: 'Plans',
        defaultValue: []
      }
    },
    isContainer: false
  },
  Stats: {
    type: 'Stats',
    category: 'Sections',
    icon: 'TrendingUp',
    label: 'Stats Section',
    description: 'Statistics/metrics section',
    defaultProps: {
      title: 'Our Impact',
      stats: []
    },
    schema: {
      title: {
        type: 'text',
        label: 'Section Title',
        defaultValue: 'Our Impact'
      },
      stats: {
        type: 'array',
        label: 'Statistics',
        defaultValue: []
      }
    },
    isContainer: false
  },
  Video: {
    type: 'Video',
    category: 'Media',
    icon: 'Video',
    label: 'Video',
    description: 'Video embed block',
    defaultProps: {
      src: '',
      autoplay: false,
      controls: true,
      loop: false
    },
    schema: {
      src: {
        type: 'url',
        label: 'Video URL',
        required: true,
        defaultValue: ''
      },
      autoplay: {
        type: 'boolean',
        label: 'Autoplay',
        defaultValue: false
      },
      controls: {
        type: 'boolean',
        label: 'Show Controls',
        defaultValue: true
      },
      loop: {
        type: 'boolean',
        label: 'Loop',
        defaultValue: false
      }
    },
    isContainer: false
  },
  Gallery: {
    type: 'Gallery',
    category: 'Media',
    icon: 'Images',
    label: 'Gallery',
    description: 'Image gallery grid',
    defaultProps: {
      images: [],
      columns: 3,
      gap: 'medium'
    },
    schema: {
      images: {
        type: 'array',
        label: 'Images',
        defaultValue: []
      },
      columns: {
        type: 'number',
        label: 'Columns',
        min: 1,
        max: 6,
        defaultValue: 3
      },
      gap: {
        type: 'select',
        label: 'Gap',
        options: ['none', 'small', 'medium', 'large'],
        defaultValue: 'medium'
      }
    },
    isContainer: false
  },
  Form: {
    type: 'Form',
    category: 'Forms',
    icon: 'FileText',
    label: 'Form',
    description: 'Contact or signup form',
    defaultProps: {
      title: 'Contact Us',
      fields: [],
      submitText: 'Submit'
    },
    schema: {
      title: {
        type: 'text',
        label: 'Form Title',
        defaultValue: 'Contact Us'
      },
      fields: {
        type: 'array',
        label: 'Form Fields',
        defaultValue: []
      },
      submitText: {
        type: 'text',
        label: 'Submit Button Text',
        defaultValue: 'Submit'
      }
    },
    isContainer: false
  },
  Custom: {
    type: 'Custom',
    category: 'Custom',
    icon: 'Code',
    label: 'Custom Block',
    description: 'Custom HTML/JSX block',
    defaultProps: {
      html: '',
      css: ''
    },
    schema: {
      html: {
        type: 'richText',
        label: 'HTML/JSX',
        defaultValue: ''
      },
      css: {
        type: 'text',
        label: 'Custom CSS',
        defaultValue: ''
      }
    },
    isContainer: false
  }
};

/**
 * Get block schema by type
 */
export function getBlockSchema(type: BlockType): BlockSchema | undefined {
  return BLOCK_REGISTRY[type];
}

/**
 * Get all blocks by category
 */
export function getBlocksByCategory(category: BlockSchema['category']): BlockSchema[] {
  return Object.values(BLOCK_REGISTRY).filter(block => block.category === category);
}

/**
 * Get all available block types
 */
export function getAllBlockTypes(): BlockType[] {
  return Object.keys(BLOCK_REGISTRY) as BlockType[];
}




