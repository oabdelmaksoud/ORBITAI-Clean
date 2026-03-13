import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Force API URL to use port 3002
  // Force API URL to be empty to enable relative paths (proxied to backend)
  // This allows the app to work both locally (localhost) and remotely (tunnel)
  const apiUrl = 'http://localhost:3002';
  const normalizedApiUrl = apiUrl;
  console.log('🔧 Vite Config - Using API URL:', normalizedApiUrl);

  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '.loca.lt', // Allow all localtunnel subdomains
        '.ngrok-free.app',
        '.ngrok.io'
      ],
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
        clientPort: 5173
      },
      // Proxy API requests to backend server
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, res) => {
              // Ensure errors return JSON, not HTML
              if (res && !res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: { message: 'Proxy error: ' + err.message }
                }));
              }
            });
          }
        },
        '/health': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, res) => {
              // Ensure errors return JSON, not HTML
              if (res && !res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: { message: 'Proxy error: ' + err.message }
                }));
              }
            });
          }
        },
        '/projects': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false
        },
        // Socket.io WebSocket proxy for CUA live streaming
        '/socket.io': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          ws: true,
          secure: false
        }
      },
      // Force cache clearing headers
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        // Critical for WebContainers (SharedArrayBuffer)
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin'
      },
      // Ensure proper MIME types
      fs: {
        strict: false
      },
      // Don't serve index.html for API routes
      middlewareMode: false
    },
    // Ensure CSS is processed correctly with proper MIME types
    css: {
      devSourcemap: true,
      modules: {
        localsConvention: 'camelCase'
      }
    },
    plugins: [
      react({
        // Use automatic JSX runtime (default)
        jsxRuntime: 'automatic',
        // Enable fast refresh
        fastRefresh: true,
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Force API URL at build time - this overrides import.meta.env.VITE_API_URL
      'import.meta.env.VITE_API_URL': JSON.stringify(normalizedApiUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@src': path.resolve(__dirname, 'src'),
        '@orbitai/shared': path.resolve(__dirname, '../shared/index.ts'),
        // Don't alias React - let Vite resolve it normally but exclude from optimization
      },
      // CRITICAL: Deduplicate React to prevent multiple instances
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      // Force resolution to single React instance
      preserveSymlinks: false,
      // Ensure consistent module resolution
      conditions: ['import', 'module', 'browser', 'default'],
      // Prevent React from being resolved from multiple locations
      mainFields: ['browser', 'module', 'main'],
    },
    build: {
      // Increase chunk size warning limit (monaco editor is large)
      chunkSizeWarningLimit: 1500,
      // Enable minification
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
      // Enable code splitting for better caching
      rollupOptions: {
        output: {
          // Ensure React is in a single chunk - CRITICAL for preventing multiple instances
          manualChunks: (id) => {
            // React and React DOM - MUST be in same chunk to prevent multiple instances
            // Check for exact matches first to avoid false positives
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            // React JSX runtime must also be in react-vendor
            if (id.includes('react/jsx-runtime') || id.includes('react/jsx-dev-runtime')) {
              return 'react-vendor';
            }
            // UI libraries - bundle lucide-react with react-vendor to avoid export issues
            if (id.includes('lucide-react')) {
              return 'react-vendor';
            }
            // Markdown
            if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('remark') || id.includes('rehype')) {
              return 'markdown-vendor';
            }
            // Editor - split monaco editor into separate chunk as it's very large
            if (id.includes('monaco-editor')) {
              return 'monaco-editor';
            }
            if (id.includes('react-quill') || id.includes('quill')) {
              return 'editor-vendor';
            }
            // Three.js and 3D libraries
            if (id.includes('three') || id.includes('@react-three')) {
              return 'three-vendor';
            }
            // Socket.io and real-time libraries
            if (id.includes('socket.io')) {
              return 'socket-vendor';
            }
            // Large component chunks - split workspace components
            if (id.includes('components/AdminDashboard')) {
              return 'admin-dashboard';
            }
            if (id.includes('components/LandingPage')) {
              return 'landing-page';
            }
            // Workspace components that are always loaded together
            if (id.includes('views/WorkspaceView') ||
              id.includes('components/VModelVisualizer') ||
              id.includes('components/MilestoneTracker') ||
              id.includes('components/NetworkVisualizer') ||
              id.includes('components/RequirementsDashboard') ||
              id.includes('components/KnowledgeBase') ||
              id.includes('components/ComplianceDashboard') ||
              id.includes('components/CostEstimator') ||
              id.includes('components/PreviewFrame')) {
              return 'workspace-components';
            }
            if (id.includes('components/CodeEditor') || id.includes('components/ArtifactViewer')) {
              return 'editor-components';
            }
            // Other node modules
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
      // Don't fail on missing optional dependencies
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      // Enable source maps for production debugging
      sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    },
    optimizeDeps: {
      // Let Vite optimize React but configure it properly
      exclude: [
        '@sentry/react'
      ],
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react'
      ],
      // Don't force re-optimization in dev for faster HMR
      force: false,
      // Configure esbuild to preserve all exports
      esbuildOptions: {
        // Preserve all named exports
        keepNames: true,
        // Don't minify to preserve exports
        minify: false,
        // Preserve CommonJS exports when converting
        format: 'esm',
      },
    },
  };
});
