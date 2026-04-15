
export interface PreviewTemplate {
  id: string;
  name: string;
  projectType: string;
  architecture: string;
  wireframe: string;
  techStack: string[];
  description: string;
}

/**
 * Template system for common project patterns
 * Provides pre-built templates that can be customized with user requirements
 */
export class PreviewTemplatesService {
  private templates: Map<string, PreviewTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize built-in templates
   */
  private initializeTemplates() {
    // E-commerce template
    this.templates.set('ecommerce', {
      id: 'ecommerce',
      name: 'E-commerce Store',
      projectType: 'web',
      architecture: `graph TB
    A[Frontend - React] --> B[API Gateway]
    B --> C[Product Service]
    B --> D[Cart Service]
    B --> E[Order Service]
    C --> F[(Product DB)]
    D --> G[(Cart DB)]
    E --> H[(Order DB)]
    B --> I[Payment Gateway]
    B --> J[Auth Service]`,
      wireframe: `<!DOCTYPE html>
<html>
<head>
  <title>E-commerce Store</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    // Basic e-commerce structure - will be customized by AI
    const { createElement: h, useState, useEffect } = React;
    // Template code will be enhanced by AI generation
  </script>
</body>
</html>`,
      techStack: ['React', 'Node.js', 'PostgreSQL', 'Stripe', 'Redis'],
      description: 'Full-featured e-commerce platform with product catalog, shopping cart, and checkout'
    });

    // Dashboard template
    this.templates.set('dashboard', {
      id: 'dashboard',
      name: 'Analytics Dashboard',
      projectType: 'web',
      architecture: `graph TB
    A[React Dashboard] --> B[API Backend]
    B --> C[Analytics Service]
    B --> D[Data Processing]
    C --> E[(Metrics DB)]
    D --> F[(Raw Data DB)]
    B --> G[Authentication]`,
      wireframe: `<!DOCTYPE html>
<html>
<head>
  <title>Analytics Dashboard</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    // Dashboard structure - will be customized by AI
  </script>
</body>
</html>`,
      techStack: ['React', 'Node.js', 'PostgreSQL', 'Chart.js', 'WebSocket'],
      description: 'Real-time analytics dashboard with charts, metrics, and data visualization'
    });

    // Blog template
    this.templates.set('blog', {
      id: 'blog',
      name: 'Blog/CMS Platform',
      projectType: 'web',
      architecture: `graph TB
    A[React Frontend] --> B[Content API]
    B --> C[Content Service]
    B --> D[User Service]
    C --> E[(Content DB)]
    D --> F[(User DB)]
    B --> G[Search Service]`,
      wireframe: `<!DOCTYPE html>
<html>
<head>
  <title>Blog Platform</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    // Blog structure - will be customized by AI
  </script>
</body>
</html>`,
      techStack: ['React', 'Node.js', 'MongoDB', 'Elasticsearch', 'Markdown'],
      description: 'Modern blog platform with rich content editor and SEO optimization'
    });

    // Social media template
    this.templates.set('social', {
      id: 'social',
      name: 'Social Media Platform',
      projectType: 'web',
      architecture: `graph TB
    A[React App] --> B[Social API]
    B --> C[Feed Service]
    B --> D[Messaging Service]
    B --> E[Notification Service]
    C --> F[(Post DB)]
    D --> G[(Message DB)]
    E --> H[(Notification Queue)]`,
      wireframe: `<!DOCTYPE html>
<html>
<head>
  <title>Social Platform</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    // Social media structure - will be customized by AI
  </script>
</body>
</html>`,
      techStack: ['React', 'Node.js', 'MongoDB', 'WebSocket', 'Redis'],
      description: 'Social networking platform with feeds, messaging, and real-time updates'
    });

    // Portfolio template
    this.templates.set('portfolio', {
      id: 'portfolio',
      name: 'Portfolio Website',
      projectType: 'web',
      architecture: `graph TB
    A[React Portfolio] --> B[Static API]
    B --> C[Project Data]
    B --> D[Content Service]`,
      wireframe: `<!DOCTYPE html>
<html>
<head>
  <title>Portfolio</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    // Portfolio structure - will be customized by AI
  </script>
</body>
</html>`,
      techStack: ['React', 'Next.js', 'MDX', 'Framer Motion'],
      description: 'Professional portfolio website with project showcases and animations'
    });

    // Game template
    this.templates.set('game', {
      id: 'game',
      name: 'Web Game',
      projectType: 'game',
      architecture: `graph TB
    A[Game Client] --> B[Game Server]
    B --> C[Game Logic]
    B --> D[Player State]
    C --> E[(Game DB)]
    D --> F[(Player DB)]`,
      wireframe: `<!DOCTYPE html>
<html>
<head>
  <title>Web Game</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <script>
    // Game structure - will be customized by AI
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    // Game code will be generated by AI
  </script>
</body>
</html>`,
      techStack: ['HTML5 Canvas', 'JavaScript', 'Web Audio API', 'WebSocket'],
      description: 'Interactive web game with Canvas rendering and audio'
    });
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): PreviewTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Match template based on user goal
   */
  matchTemplate(userGoal: string, projectType: string): PreviewTemplate | null {
    const goalLower = userGoal.toLowerCase();
    
    // E-commerce
    if (goalLower.includes('shop') || goalLower.includes('store') || goalLower.includes('ecommerce') || 
        goalLower.includes('e-commerce') || goalLower.includes('marketplace')) {
      return this.templates.get('ecommerce') || null;
    }
    
    // Dashboard
    if (goalLower.includes('dashboard') || goalLower.includes('analytics') || goalLower.includes('metrics')) {
      return this.templates.get('dashboard') || null;
    }
    
    // Blog
    if (goalLower.includes('blog') || goalLower.includes('cms') || goalLower.includes('article')) {
      return this.templates.get('blog') || null;
    }
    
    // Social
    if (goalLower.includes('social') || goalLower.includes('feed') || goalLower.includes('facebook') ||
        goalLower.includes('twitter') || goalLower.includes('instagram')) {
      return this.templates.get('social') || null;
    }
    
    // Portfolio
    if (goalLower.includes('portfolio') || goalLower.includes('showcase') || goalLower.includes('gallery')) {
      return this.templates.get('portfolio') || null;
    }
    
    // Game
    if (goalLower.includes('game') || goalLower.includes('gaming') || projectType === 'game') {
      return this.templates.get('game') || null;
    }
    
    return null;
  }

  /**
   * Customize template with user requirements
   */
  customizeTemplate(
    template: PreviewTemplate,
    userGoal: string,
    _requirements: { requirements: string[]; features: string[]; constraints: string[] },
    techStack: string[]
  ): PreviewTemplate {
    // Return template as-is - AI generation will customize it
    // This is just a placeholder for future template customization logic
    return {
      ...template,
      techStack: techStack.length > 0 ? techStack : template.techStack,
      description: `${template.description}. Customized for: ${userGoal.substring(0, 100)}`
    };
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): PreviewTemplate[] {
    return Array.from(this.templates.values());
  }
}

export const previewTemplatesService = new PreviewTemplatesService();


