/**
 * Frontend Code Generator Service
 * Generates complete React/Vue/Angular/Svelte frontend applications
 * with components, pages, routing, state management, and styling
 */

import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface FrontendComponent {
  name: string;
  type: 'page' | 'component' | 'layout' | 'hook' | 'context' | 'util';
  description?: string;
  props?: Array<{
    name: string;
    type: string;
    required?: boolean;
    default?: any;
  }>;
  children?: boolean;
}

export interface FrontendRoute {
  path: string;
  component: string;
  name: string;
  protected?: boolean;
  layout?: string;
}

export interface FrontendGenerationRequest {
  projectName: string;
  description: string;
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'nextjs' | 'nuxt';
  styling: 'tailwind' | 'css-modules' | 'styled-components' | 'scss' | 'material-ui' | 'chakra-ui';
  stateManagement?: 'redux' | 'zustand' | 'jotai' | 'pinia' | 'ngrx' | 'context';
  components: FrontendComponent[];
  routes: FrontendRoute[];
  features?: string[];
  apiBaseUrl?: string;
  language?: 'typescript' | 'javascript';
}

export interface GeneratedFile {
  path: string;
  content: string;
  fileType: 'typescript' | 'javascript' | 'css' | 'scss' | 'json' | 'html' | 'yaml' | 'markdown';
}

export interface FrontendGenerationResult {
  projectId: string;
  projectName: string;
  framework: string;
  files: GeneratedFile[];
  statistics: {
    totalFiles: number;
    totalLines: number;
    components: number;
    pages: number;
  };
  success: boolean;
  generatedAt: number;
}

class FrontendCodeGeneratorService {
  /**
   * Main entry point for frontend code generation
   */
  async generateFrontendCode(request: FrontendGenerationRequest): Promise<FrontendGenerationResult> {
    const projectId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info(`🎨 Starting frontend generation for: ${request.projectName}`);
      logger.info(`   Framework: ${request.framework}, Styling: ${request.styling}`);

      const files: GeneratedFile[] = [];

      switch (request.framework) {
        case 'react':
        case 'nextjs':
          files.push(...await this.generateReactCode(request));
          break;
        case 'vue':
        case 'nuxt':
          files.push(...await this.generateVueCode(request));
          break;
        case 'angular':
          files.push(...await this.generateAngularCode(request));
          break;
        case 'svelte':
          files.push(...await this.generateSvelteCode(request));
          break;
        default:
          throw new Error(`Unsupported framework: ${request.framework}`);
      }

      // Generate common files
      files.push(...await this.generateCommonFiles(request));

      const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);
      const pageCount = request.components.filter(c => c.type === 'page').length;
      const componentCount = request.components.filter(c => c.type === 'component').length;

      logger.info(`✅ Frontend generation completed in ${Date.now() - startTime}ms`);

      return {
        projectId,
        projectName: request.projectName,
        framework: request.framework,
        files,
        statistics: {
          totalFiles: files.length,
          totalLines,
          components: componentCount,
          pages: pageCount,
        },
        success: true,
        generatedAt: Date.now(),
      };
    } catch (error: unknown) {
      logger.error(`❌ Frontend generation failed: ${(error instanceof Error ? error.message : String(error))}`);
      return {
        projectId,
        projectName: request.projectName,
        framework: request.framework,
        files: [],
        statistics: { totalFiles: 0, totalLines: 0, components: 0, pages: 0 },
        success: false,
        generatedAt: Date.now(),
      };
    }
  }

  /**
   * Generate React/Next.js code
   */
  private async generateReactCode(request: FrontendGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const isNextJs = request.framework === 'nextjs';
    const isTs = request.language !== 'javascript';
    const ext = isTs ? 'tsx' : 'jsx';
    const extPlain = isTs ? 'ts' : 'js';

    // Main entry point
    if (!isNextJs) {
      files.push({
        path: `src/main.${ext}`,
        content: this.generateReactMain(request),
        fileType: isTs ? 'typescript' : 'javascript',
      });
    }

    // App component
    files.push({
      path: isNextJs ? `app/layout.${ext}` : `src/App.${ext}`,
      content: isNextJs ? this.generateNextLayout(request) : this.generateReactApp(request),
      fileType: isTs ? 'typescript' : 'javascript',
    });

    // Generate components
    for (const component of request.components) {
      const folder = component.type === 'page' 
        ? (isNextJs ? 'app' : 'src/pages')
        : `src/components/${component.name}`;
      
      const fileName = isNextJs && component.type === 'page'
        ? `${component.name.toLowerCase()}/page.${ext}`
        : `${component.name}.${ext}`;

      files.push({
        path: `${folder}/${fileName}`,
        content: this.generateReactComponent(component, request),
        fileType: isTs ? 'typescript' : 'javascript',
      });

      // Component styles if using CSS modules
      if (request.styling === 'css-modules') {
        files.push({
          path: `${folder}/${component.name}.module.css`,
          content: this.generateCSSModule(component),
          fileType: 'css',
        });
      }
    }

    // Router (React only, Next.js has file-based routing)
    if (!isNextJs) {
      files.push({
        path: `src/router/index.${ext}`,
        content: this.generateReactRouter(request),
        fileType: isTs ? 'typescript' : 'javascript',
      });
    }

    // State management
    if (request.stateManagement) {
      files.push(...this.generateReactStateManagement(request));
    }

    // API service
    files.push({
      path: `src/services/api.${extPlain}`,
      content: this.generateApiService(request),
      fileType: isTs ? 'typescript' : 'javascript',
    });

    // Types (TypeScript only)
    if (isTs) {
      files.push({
        path: 'src/types/index.ts',
        content: this.generateTypeDefinitions(request),
        fileType: 'typescript',
      });
    }

    // Hooks
    files.push({
      path: `src/hooks/useApi.${extPlain}`,
      content: this.generateUseApiHook(request),
      fileType: isTs ? 'typescript' : 'javascript',
    });

    // Config files
    files.push({
      path: 'package.json',
      content: this.generateReactPackageJson(request),
      fileType: 'json',
    });

    if (isTs) {
      files.push({
        path: 'tsconfig.json',
        content: this.generateTsConfig(request),
        fileType: 'json',
      });
    }

    // Tailwind config if using Tailwind
    if (request.styling === 'tailwind') {
      files.push({
        path: 'tailwind.config.js',
        content: this.generateTailwindConfig(request),
        fileType: 'javascript',
      });

      files.push({
        path: 'postcss.config.js',
        content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,
        fileType: 'javascript',
      });
    }

    // Vite config (React only)
    if (!isNextJs) {
      files.push({
        path: 'vite.config.ts',
        content: this.generateViteConfig(request),
        fileType: 'typescript',
      });
    }

    return files;
  }

  /**
   * Generate Vue/Nuxt code
   */
  private async generateVueCode(request: FrontendGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const isNuxt = request.framework === 'nuxt';
    // const _isTs = request.language !== 'javascript';

    // Main entry
    files.push({
      path: isNuxt ? 'app.vue' : 'src/App.vue',
      content: this.generateVueApp(request),
      fileType: 'typescript',
    });

    // Components
    for (const component of request.components) {
      const folder = component.type === 'page'
        ? (isNuxt ? 'pages' : 'src/views')
        : (isNuxt ? 'components' : 'src/components');

      files.push({
        path: `${folder}/${component.name}.vue`,
        content: this.generateVueComponent(component, request),
        fileType: 'typescript',
      });
    }

    // Router (Vue only)
    if (!isNuxt) {
      files.push({
        path: 'src/router/index.ts',
        content: this.generateVueRouter(request),
        fileType: 'typescript',
      });
    }

    // State management
    if (request.stateManagement === 'pinia') {
      files.push({
        path: 'src/stores/main.ts',
        content: this.generatePiniaStore(request),
        fileType: 'typescript',
      });
    }

    // Package.json
    files.push({
      path: 'package.json',
      content: this.generateVuePackageJson(request),
      fileType: 'json',
    });

    return files;
  }

  /**
   * Generate Angular code
   */
  private async generateAngularCode(request: FrontendGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Main module
    files.push({
      path: 'src/app/app.module.ts',
      content: this.generateAngularModule(request),
      fileType: 'typescript',
    });

    // App component
    files.push({
      path: 'src/app/app.component.ts',
      content: this.generateAngularAppComponent(request),
      fileType: 'typescript',
    });

    files.push({
      path: 'src/app/app.component.html',
      content: this.generateAngularAppTemplate(request),
      fileType: 'html',
    });

    // Components
    for (const component of request.components) {
      const folder = `src/app/${component.type === 'page' ? 'pages' : 'components'}/${component.name.toLowerCase()}`;
      
      files.push({
        path: `${folder}/${component.name.toLowerCase()}.component.ts`,
        content: this.generateAngularComponent(component, request),
        fileType: 'typescript',
      });

      files.push({
        path: `${folder}/${component.name.toLowerCase()}.component.html`,
        content: this.generateAngularComponentTemplate(component, request),
        fileType: 'html',
      });

      if (request.styling === 'scss') {
        files.push({
          path: `${folder}/${component.name.toLowerCase()}.component.scss`,
          content: this.generateScssStyles(component),
          fileType: 'scss',
        });
      }
    }

    // Routing module
    files.push({
      path: 'src/app/app-routing.module.ts',
      content: this.generateAngularRouting(request),
      fileType: 'typescript',
    });

    // Services
    files.push({
      path: 'src/app/services/api.service.ts',
      content: this.generateAngularApiService(request),
      fileType: 'typescript',
    });

    // Package.json
    files.push({
      path: 'package.json',
      content: this.generateAngularPackageJson(request),
      fileType: 'json',
    });

    return files;
  }

  /**
   * Generate Svelte code
   */
  private async generateSvelteCode(request: FrontendGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Main app
    files.push({
      path: 'src/App.svelte',
      content: this.generateSvelteApp(request),
      fileType: 'typescript',
    });

    // Components
    for (const component of request.components) {
      const folder = component.type === 'page' ? 'src/routes' : 'src/lib/components';
      
      files.push({
        path: `${folder}/${component.name}.svelte`,
        content: this.generateSvelteComponent(component, request),
        fileType: 'typescript',
      });
    }

    // Stores
    files.push({
      path: 'src/lib/stores.ts',
      content: this.generateSvelteStores(request),
      fileType: 'typescript',
    });

    // Package.json
    files.push({
      path: 'package.json',
      content: this.generateSveltePackageJson(request),
      fileType: 'json',
    });

    return files;
  }

  /**
   * Generate common files (README, Docker, etc.)
   */
  private async generateCommonFiles(request: FrontendGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme(request),
      fileType: 'markdown',
    });

    // Dockerfile
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile(request),
      fileType: 'yaml',
    });

    // .env.example
    files.push({
      path: '.env.example',
      content: this.generateEnvExample(request),
      fileType: 'yaml',
    });

    // .gitignore
    files.push({
      path: '.gitignore',
      content: this.generateGitignore(),
      fileType: 'yaml',
    });

    // Global styles
    if (request.styling === 'tailwind') {
      files.push({
        path: 'src/styles/globals.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom global styles */
body {
  @apply bg-gray-50 text-gray-900;
}
`,
        fileType: 'css',
      });
    }

    return files;
  }

  // ============ Template Generators ============

  private generateReactMain(request: FrontendGenerationRequest): string {
    const isTs = request.language !== 'javascript';
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
${request.styling === 'tailwind' ? "import './styles/globals.css';" : ''}

ReactDOM.createRoot(document.getElementById('root')${isTs ? '!' : ''}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  }

  private generateReactApp(request: FrontendGenerationRequest): string {
    const isTs = request.language !== 'javascript';
    return `import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
${request.stateManagement === 'redux' ? "import { Provider } from 'react-redux';\nimport { store } from './store';" : ''}

function App()${isTs ? ': React.FC' : ''} {
  return (
    ${request.stateManagement === 'redux' ? '<Provider store={store}>' : ''}
    <BrowserRouter>
      <div className="${request.styling === 'tailwind' ? 'min-h-screen bg-gray-50' : 'app'}">
        <AppRouter />
      </div>
    </BrowserRouter>
    ${request.stateManagement === 'redux' ? '</Provider>' : ''}
  );
}

export default App;
`;
  }

  private generateNextLayout(request: FrontendGenerationRequest): string {
    return `import type { Metadata } from 'next';
${request.styling === 'tailwind' ? "import './globals.css';" : ''}

export const metadata: Metadata = {
  title: '${request.projectName}',
  description: '${request.description || 'Generated by OrbitAI'}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="${request.styling === 'tailwind' ? 'min-h-screen bg-gray-50' : ''}">{children}</body>
    </html>
  );
}
`;
  }

  private generateReactComponent(component: FrontendComponent, request: FrontendGenerationRequest): string {
    const isTs = request.language !== 'javascript';
    const propsInterface = component.props && component.props.length > 0
      ? `interface ${component.name}Props {
${component.props.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}
}`
      : '';

    const propsType = component.props && component.props.length > 0
      ? `${component.name}Props`
      : isTs ? 'React.FC' : '';

    const styling = request.styling === 'tailwind'
      ? 'className="p-4 bg-white rounded-lg shadow"'
      : request.styling === 'css-modules'
      ? `className={styles.container}`
      : 'className="container"';

    return `import React${component.props?.some(p => !p.required) ? ', { useState }' : ''} from 'react';
${request.styling === 'css-modules' ? `import styles from './${component.name}.module.css';` : ''}

${isTs && propsInterface ? propsInterface + '\n' : ''}
${component.type === 'page' ? '// Page Component' : '// Reusable Component'}
export ${component.type === 'page' ? 'default ' : ''}function ${component.name}(${
  component.props && component.props.length > 0 
    ? `{ ${component.props.map(p => p.name).join(', ')} }${isTs ? `: ${propsType}` : ''}`
    : ''
})${isTs && !propsType ? ': React.FC' : ''} {
  return (
    <div ${styling}>
      <h${component.type === 'page' ? '1' : '2'} className="${request.styling === 'tailwind' ? 'text-xl font-bold mb-4' : 'title'}">
        ${component.name}
      </h${component.type === 'page' ? '1' : '2'}>
      ${component.description ? `<p className="${request.styling === 'tailwind' ? 'text-gray-600' : 'description'}">${component.description}</p>` : ''}
      ${component.children ? '{children}' : ''}
    </div>
  );
}

${component.type !== 'page' ? `export { ${component.name} };` : ''}
`;
  }

  private generateReactRouter(request: FrontendGenerationRequest): string {
    const isTs = request.language !== 'javascript';
    const pages = request.components.filter(c => c.type === 'page');
    
    return `import { Routes, Route } from 'react-router-dom';
${pages.map(p => `import ${p.name} from '../pages/${p.name}';`).join('\n')}

export function AppRouter()${isTs ? ': React.FC' : ''} {
  return (
    <Routes>
${request.routes.map(r => `      <Route path="${r.path}" element={<${r.component} />} />`).join('\n')}
    </Routes>
  );
}
`;
  }

  private generateReactStateManagement(request: FrontendGenerationRequest): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const isTs = request.language !== 'javascript';
    const ext = isTs ? 'ts' : 'js';

    switch (request.stateManagement) {
      case 'redux':
        files.push({
          path: `src/store/index.${ext}`,
          content: `import { configureStore } from '@reduxjs/toolkit';
import appReducer from './slices/appSlice';

export const store = configureStore({
  reducer: {
    app: appReducer,
  },
});

${isTs ? `export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;` : ''}
`,
          fileType: isTs ? 'typescript' : 'javascript',
        });

        files.push({
          path: `src/store/slices/appSlice.${ext}`,
          content: `import { createSlice${isTs ? ', PayloadAction' : ''} } from '@reduxjs/toolkit';

${isTs ? `interface AppState {
  loading: boolean;
  error: string | null;
  data: any[];
}

const initialState: AppState = {` : 'const initialState = {'}
  loading: false,
  error: null,
  data: [],
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setLoading: (state, action${isTs ? ': PayloadAction<boolean>' : ''}) => {
      state.loading = action.payload;
    },
    setError: (state, action${isTs ? ': PayloadAction<string | null>' : ''}) => {
      state.error = action.payload;
    },
    setData: (state, action${isTs ? ': PayloadAction<any[]>' : ''}) => {
      state.data = action.payload;
    },
  },
});

export const { setLoading, setError, setData } = appSlice.actions;
export default appSlice.reducer;
`,
          fileType: isTs ? 'typescript' : 'javascript',
        });
        break;

      case 'zustand':
        files.push({
          path: `src/store/useStore.${ext}`,
          content: `import { create } from 'zustand';

${isTs ? `interface AppStore {
  loading: boolean;
  error: string | null;
  data: any[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setData: (data: any[]) => void;
}

export const useStore = create<AppStore>((set) => ({` : 'export const useStore = create((set) => ({'}
  loading: false,
  error: null,
  data: [],
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setData: (data) => set({ data }),
}));
`,
          fileType: isTs ? 'typescript' : 'javascript',
        });
        break;
    }

    return files;
  }

  private generateApiService(request: FrontendGenerationRequest): string {
    const isTs = request.language !== 'javascript';
    return `const API_BASE_URL = import.meta.env.VITE_API_URL || '${request.apiBaseUrl || 'http://localhost:3000/api'}';

${isTs ? `interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

` : ''}class ApiService {
  private baseUrl${isTs ? ': string' : ''};

  constructor(baseUrl${isTs ? ': string' : ''}) {
    this.baseUrl = baseUrl;
  }

  private async request${isTs ? '<T>' : ''}(
    endpoint${isTs ? ': string' : ''},
    options${isTs ? '?: RequestInit' : ''}
  )${isTs ? ': Promise<ApiResponse<T>>' : ''} {
    try {
      const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return { success: true, data };
    } catch (error${isTs ? ': any' : ''}) {
      return { success: false, error: error.message };
    }
  }

  async get${isTs ? '<T>' : ''}(endpoint${isTs ? ': string' : ''})${isTs ? ': Promise<ApiResponse<T>>' : ''} {
    return this.request${isTs ? '<T>' : ''}(endpoint);
  }

  async post${isTs ? '<T>' : ''}(endpoint${isTs ? ': string' : ''}, data${isTs ? ': any' : ''})${isTs ? ': Promise<ApiResponse<T>>' : ''} {
    return this.request${isTs ? '<T>' : ''}(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put${isTs ? '<T>' : ''}(endpoint${isTs ? ': string' : ''}, data${isTs ? ': any' : ''})${isTs ? ': Promise<ApiResponse<T>>' : ''} {
    return this.request${isTs ? '<T>' : ''}(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete${isTs ? '<T>' : ''}(endpoint${isTs ? ': string' : ''})${isTs ? ': Promise<ApiResponse<T>>' : ''} {
    return this.request${isTs ? '<T>' : ''}(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService(API_BASE_URL);
`;
  }

  private generateUseApiHook(request: FrontendGenerationRequest): string {
    const isTs = request.language !== 'javascript';
    return `import { useState, useCallback } from 'react';
import { api } from '../services/api';

${isTs ? `interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

` : ''}export function useApi${isTs ? '<T>' : ''}() {
  const [state, setState] = useState${isTs ? '<UseApiState<T>>' : ''}({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (
    method${isTs ? ": 'get' | 'post' | 'put' | 'delete'" : ''},
    endpoint${isTs ? ': string' : ''},
    body${isTs ? '?: any' : ''}
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let result;
      switch (method) {
        case 'get':
          result = await api.get${isTs ? '<T>' : ''}(endpoint);
          break;
        case 'post':
          result = await api.post${isTs ? '<T>' : ''}(endpoint, body);
          break;
        case 'put':
          result = await api.put${isTs ? '<T>' : ''}(endpoint, body);
          break;
        case 'delete':
          result = await api.delete${isTs ? '<T>' : ''}(endpoint);
          break;
      }

      if (result.success) {
        setState({ data: result.data${isTs ? ' as T' : ''}, loading: false, error: null });
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (error${isTs ? ': any' : ''}) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, []);

  return { ...state, execute };
}
`;
  }

  private generateTypeDefinitions(request: FrontendGenerationRequest): string {
    return `// Common type definitions

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface ApiError {
  message: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Component prop types
${request.components.filter(c => c.props && c.props.length > 0).map(c => `
export interface ${c.name}Props {
${c.props!.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}
}`).join('\n')}
`;
  }

  private generateCSSModule(_component: FrontendComponent): string {
    return `.container {
  padding: 1rem;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.description {
  color: #666;
}
`;
  }

  private generateReactPackageJson(request: FrontendGenerationRequest): string {
    const isNextJs = request.framework === 'nextjs';
    const isTs = request.language !== 'javascript';
    
    const deps: Record<string, string> = {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    };

    if (isNextJs) {
      deps['next'] = '^14.0.0';
    } else {
      deps['react-router-dom'] = '^6.20.0';
    }

    if (request.stateManagement === 'redux') {
      deps['@reduxjs/toolkit'] = '^2.0.0';
      deps['react-redux'] = '^9.0.0';
    } else if (request.stateManagement === 'zustand') {
      deps['zustand'] = '^4.4.0';
    }

    const devDeps: Record<string, string> = {
      vite: '^5.0.0',
      '@vitejs/plugin-react': '^4.2.0',
    };

    if (isTs) {
      devDeps['typescript'] = '^5.3.0';
      devDeps['@types/react'] = '^18.2.0';
      devDeps['@types/react-dom'] = '^18.2.0';
    }

    if (request.styling === 'tailwind') {
      devDeps['tailwindcss'] = '^3.4.0';
      devDeps['postcss'] = '^8.4.0';
      devDeps['autoprefixer'] = '^10.4.0';
    }

    return JSON.stringify({
      name: request.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      scripts: isNextJs ? {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      } : {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: deps,
      devDependencies: devDeps,
    }, null, 2);
  }

  private generateTsConfig(_request: FrontendGenerationRequest): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*'],
        },
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    }, null, 2);
  }

  private generateTailwindConfig(request: FrontendGenerationRequest): string {
    return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    ${request.framework === 'nextjs' ? "'./app/**/*.{js,ts,jsx,tsx}'," : ''}
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
    },
  },
  plugins: [],
};
`;
  }

  private generateViteConfig(request: FrontendGenerationRequest): string {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: '${request.apiBaseUrl || 'http://localhost:3000'}',
        changeOrigin: true,
      },
    },
  },
});
`;
  }

  private generateVueApp(request: FrontendGenerationRequest): string {
    return `<template>
  <div id="app" class="${request.styling === 'tailwind' ? 'min-h-screen bg-gray-50' : 'app'}">
    <router-view />
  </div>
</template>

<script setup lang="ts">
// App setup
</script>

<style>
${request.styling === 'tailwind' ? '@import "./styles/globals.css";' : `
.app {
  min-height: 100vh;
}
`}
</style>
`;
  }

  private generateVueComponent(component: FrontendComponent, request: FrontendGenerationRequest): string {
    const propsDefinition = component.props
      ? component.props.map(p => `  ${p.name}: { type: ${this.getPropType(p.type)}, required: ${p.required || false} }`).join(',\n')
      : '';

    return `<template>
  <div class="${request.styling === 'tailwind' ? 'p-4 bg-white rounded-lg shadow' : 'container'}">
    <h${component.type === 'page' ? '1' : '2'} class="${request.styling === 'tailwind' ? 'text-xl font-bold mb-4' : 'title'}">
      ${component.name}
    </h${component.type === 'page' ? '1' : '2'}>
    ${component.description ? `<p class="${request.styling === 'tailwind' ? 'text-gray-600' : 'description'}">${component.description}</p>` : ''}
    <slot v-if="${component.children}" />
  </div>
</template>

<script setup lang="ts">
${component.props && component.props.length > 0 ? `
defineProps({
${propsDefinition}
});
` : ''}
</script>

<style scoped>
${request.styling !== 'tailwind' ? `.container {
  padding: 1rem;
}

.title {
  font-size: 1.25rem;
  font-weight: bold;
}` : ''}
</style>
`;
  }

  private generateVueRouter(request: FrontendGenerationRequest): string {
    const pages = request.components.filter(c => c.type === 'page');
    return `import { createRouter, createWebHistory } from 'vue-router';
${pages.map(p => `import ${p.name} from '../views/${p.name}.vue';`).join('\n')}

const routes = [
${request.routes.map(r => `  { path: '${r.path}', name: '${r.name}', component: ${r.component} },`).join('\n')}
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
`;
  }

  private generatePiniaStore(_request: FrontendGenerationRequest): string {
    return `import { defineStore } from 'pinia';

export const useMainStore = defineStore('main', {
  state: () => ({
    loading: false,
    error: null as string | null,
    data: [] as any[],
  }),
  
  getters: {
    isLoading: (state) => state.loading,
    hasError: (state) => state.error !== null,
  },
  
  actions: {
    setLoading(loading: boolean) {
      this.loading = loading;
    },
    setError(error: string | null) {
      this.error = error;
    },
    setData(data: any[]) {
      this.data = data;
    },
  },
});
`;
  }

  private generateVuePackageJson(request: FrontendGenerationRequest): string {
    const isNuxt = request.framework === 'nuxt';
    
    return JSON.stringify({
      name: request.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      scripts: isNuxt ? {
        dev: 'nuxt dev',
        build: 'nuxt build',
        generate: 'nuxt generate',
        preview: 'nuxt preview',
      } : {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        vue: '^3.4.0',
        'vue-router': '^4.2.0',
        pinia: '^2.1.0',
        ...(isNuxt ? { nuxt: '^3.9.0' } : {}),
      },
      devDependencies: {
        vite: '^5.0.0',
        '@vitejs/plugin-vue': '^4.5.0',
        typescript: '^5.3.0',
        ...(request.styling === 'tailwind' ? {
          tailwindcss: '^3.4.0',
          postcss: '^8.4.0',
          autoprefixer: '^10.4.0',
        } : {}),
      },
    }, null, 2);
  }

  private generateAngularModule(request: FrontendGenerationRequest): string {
    const components = request.components;
    return `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
${components.map(c => `import { ${c.name}Component } from './${c.type === 'page' ? 'pages' : 'components'}/${c.name.toLowerCase()}/${c.name.toLowerCase()}.component';`).join('\n')}

@NgModule({
  declarations: [
    AppComponent,
${components.map(c => `    ${c.name}Component,`).join('\n')}
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
`;
  }

  private generateAngularAppComponent(request: FrontendGenerationRequest): string {
    return `import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.${request.styling === 'scss' ? 'scss' : 'css'}'],
})
export class AppComponent {
  title = '${request.projectName}';
}
`;
  }

  private generateAngularAppTemplate(request: FrontendGenerationRequest): string {
    return `<div class="${request.styling === 'tailwind' ? 'min-h-screen bg-gray-50' : 'app-container'}">
  <router-outlet></router-outlet>
</div>
`;
  }

  private generateAngularComponent(component: FrontendComponent, request: FrontendGenerationRequest): string {
    const inputs = component.props
      ? component.props.map(p => `  @Input() ${p.name}${p.required ? '!' : '?'}: ${p.type};`).join('\n')
      : '';

    return `import { Component${component.props ? ', Input' : ''} } from '@angular/core';

@Component({
  selector: 'app-${component.name.toLowerCase()}',
  templateUrl: './${component.name.toLowerCase()}.component.html',
  styleUrls: ['./${component.name.toLowerCase()}.component.${request.styling === 'scss' ? 'scss' : 'css'}'],
})
export class ${component.name}Component {
${inputs}
}
`;
  }

  private generateAngularComponentTemplate(component: FrontendComponent, request: FrontendGenerationRequest): string {
    return `<div class="${request.styling === 'tailwind' ? 'p-4 bg-white rounded-lg shadow' : 'container'}">
  <h${component.type === 'page' ? '1' : '2'} class="${request.styling === 'tailwind' ? 'text-xl font-bold mb-4' : 'title'}">
    ${component.name}
  </h${component.type === 'page' ? '1' : '2'}>
  ${component.description ? `<p class="${request.styling === 'tailwind' ? 'text-gray-600' : 'description'}">${component.description}</p>` : ''}
  <ng-content *ngIf="${component.children}"></ng-content>
</div>
`;
  }

  private generateAngularRouting(request: FrontendGenerationRequest): string {
    const pages = request.components.filter(c => c.type === 'page');
    return `import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
${pages.map(p => `import { ${p.name}Component } from './pages/${p.name.toLowerCase()}/${p.name.toLowerCase()}.component';`).join('\n')}

const routes: Routes = [
${request.routes.map(r => `  { path: '${r.path.replace(/^\//, '')}', component: ${r.component}Component },`).join('\n')}
  { path: '', redirectTo: '/${request.routes[0]?.path.replace(/^\//, '') || ''}', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
`;
  }

  private generateAngularApiService(request: FrontendGenerationRequest): string {
    return `import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = environment.apiUrl || '${request.apiBaseUrl || 'http://localhost:3000/api'}';

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = error.error?.message || \`Error Code: \${error.status}\`;
    }
    return throwError(() => new Error(errorMessage));
  }

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(\`\${this.baseUrl}\${endpoint}\`).pipe(
      catchError(this.handleError)
    );
  }

  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(\`\${this.baseUrl}\${endpoint}\`, data).pipe(
      catchError(this.handleError)
    );
  }

  put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<T>(\`\${this.baseUrl}\${endpoint}\`, data).pipe(
      catchError(this.handleError)
    );
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(\`\${this.baseUrl}\${endpoint}\`).pipe(
      catchError(this.handleError)
    );
  }
}
`;
  }

  private generateAngularPackageJson(request: FrontendGenerationRequest): string {
    return JSON.stringify({
      name: request.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      scripts: {
        ng: 'ng',
        start: 'ng serve',
        build: 'ng build',
        test: 'ng test',
        lint: 'ng lint',
      },
      dependencies: {
        '@angular/animations': '^17.0.0',
        '@angular/common': '^17.0.0',
        '@angular/compiler': '^17.0.0',
        '@angular/core': '^17.0.0',
        '@angular/forms': '^17.0.0',
        '@angular/platform-browser': '^17.0.0',
        '@angular/platform-browser-dynamic': '^17.0.0',
        '@angular/router': '^17.0.0',
        rxjs: '~7.8.0',
        tslib: '^2.6.0',
        'zone.js': '~0.14.0',
      },
      devDependencies: {
        '@angular-devkit/build-angular': '^17.0.0',
        '@angular/cli': '^17.0.0',
        '@angular/compiler-cli': '^17.0.0',
        typescript: '~5.2.0',
      },
    }, null, 2);
  }

  private generateSvelteApp(request: FrontendGenerationRequest): string {
    return `<script>
  import { Router } from 'svelte-routing';
</script>

<Router>
  <main class="${request.styling === 'tailwind' ? 'min-h-screen bg-gray-50' : ''}">
    <slot />
  </main>
</Router>

<style>
${request.styling === 'tailwind' ? '@import "./styles/globals.css";' : `
main {
  min-height: 100vh;
}
`}
</style>
`;
  }

  private generateSvelteComponent(component: FrontendComponent, request: FrontendGenerationRequest): string {
    const props = component.props
      ? component.props.map(p => `  export let ${p.name}${p.required ? '' : ' = undefined'};`).join('\n')
      : '';

    return `<script lang="ts">
${props}
</script>

<div class="${request.styling === 'tailwind' ? 'p-4 bg-white rounded-lg shadow' : 'container'}">
  <h${component.type === 'page' ? '1' : '2'} class="${request.styling === 'tailwind' ? 'text-xl font-bold mb-4' : 'title'}">
    ${component.name}
  </h${component.type === 'page' ? '1' : '2'}>
  ${component.description ? `<p class="${request.styling === 'tailwind' ? 'text-gray-600' : 'description'}">${component.description}</p>` : ''}
  ${component.children ? '<slot />' : ''}
</div>

<style>
${request.styling !== 'tailwind' ? `  .container {
    padding: 1rem;
  }

  .title {
    font-size: 1.25rem;
    font-weight: bold;
  }` : ''}
</style>
`;
  }

  private generateSvelteStores(_request: FrontendGenerationRequest): string {
    return `import { writable, derived } from 'svelte/store';

// Loading state
export const loading = writable(false);

// Error state
export const error = writable<string | null>(null);

// Data store
export const data = writable<any[]>([]);

// Derived store example
export const hasData = derived(data, ($data) => $data.length > 0);

// Actions
export function setLoading(value: boolean) {
  loading.set(value);
}

export function setError(message: string | null) {
  error.set(message);
}

export function setData(items: any[]) {
  data.set(items);
}
`;
  }

  private generateSveltePackageJson(request: FrontendGenerationRequest): string {
    return JSON.stringify({
      name: request.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'vite dev',
        build: 'vite build',
        preview: 'vite preview',
      },
      devDependencies: {
        '@sveltejs/vite-plugin-svelte': '^3.0.0',
        svelte: '^4.2.0',
        'svelte-check': '^3.6.0',
        'svelte-routing': '^2.6.0',
        typescript: '^5.3.0',
        vite: '^5.0.0',
        ...(request.styling === 'tailwind' ? {
          tailwindcss: '^3.4.0',
          postcss: '^8.4.0',
          autoprefixer: '^10.4.0',
        } : {}),
      },
    }, null, 2);
  }

  private generateScssStyles(_component: FrontendComponent): string {
    return `.container {
  padding: 1rem;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  .title {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1rem;
  }

  .description {
    color: #666;
  }
}
`;
  }

  private generateReadme(request: FrontendGenerationRequest): string {
    return `# ${request.projectName}

${request.description || 'Frontend application generated by OrbitAI.'}

## Tech Stack

- **Framework:** ${request.framework}
- **Styling:** ${request.styling}
${request.stateManagement ? `- **State Management:** ${request.stateManagement}` : ''}
- **Language:** ${request.language || 'TypeScript'}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\`

## Project Structure

\`\`\`
src/
├── components/     # Reusable components
├── ${request.framework === 'nextjs' ? 'app/' : 'pages/'}           # Page components
├── hooks/          # Custom React hooks
├── services/       # API services
├── ${request.stateManagement === 'redux' ? 'store/' : 'stores/'}          # State management
├── types/          # TypeScript types
└── styles/         # Global styles
\`\`\`

## Components

${request.components.map(c => `- **${c.name}** (${c.type}): ${c.description || 'No description'}`).join('\n')}

## Routes

${request.routes.map(r => `- \`${r.path}\`: ${r.name}`).join('\n')}

## Environment Variables

Copy \`.env.example\` to \`.env.local\` and configure:

\`\`\`
VITE_API_URL=${request.apiBaseUrl || 'http://localhost:3000/api'}
\`\`\`

---

Generated by OrbitAI
`;
  }

  private generateDockerfile(request: FrontendGenerationRequest): string {
    const isNextJs = request.framework === 'nextjs';
    
    return `FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

${isNextJs ? `
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
` : `
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
`}`;
  }

  private generateEnvExample(request: FrontendGenerationRequest): string {
    return `# API Configuration
VITE_API_URL=${request.apiBaseUrl || 'http://localhost:3000/api'}

# App Configuration
VITE_APP_NAME=${request.projectName}
VITE_APP_VERSION=0.1.0

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=false
`;
  }

  private generateGitignore(): string {
    return `# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/
.nuxt/
.output/
.svelte-kit/

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Misc
*.tsbuildinfo
`;
  }

  private getPropType(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'String',
      number: 'Number',
      boolean: 'Boolean',
      array: 'Array',
      object: 'Object',
      function: 'Function',
    };
    return typeMap[type.toLowerCase()] || 'String';
  }
}

export const frontendCodeGeneratorService = new FrontendCodeGeneratorService();
