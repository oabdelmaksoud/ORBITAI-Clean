import { FileSystemTree } from '@webcontainer/api';

class FileMountService {
    /**
     * Converts a single code string (e.g. wireframe HTML) into a complete
     * WebContainer file system tree with necessary config files.
     */
    public createTreeFromCode(code: string, filename: string = 'index.html'): FileSystemTree {
        const tree: FileSystemTree = {
            [filename]: {
                file: {
                    contents: code
                }
            },
            // Built-in Node.js HTTP server - no npm install required!
            'server.js': {
                file: {
                    contents: `const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let filePath = '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routing
        fs.readFile('./index.html', (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log('\\n🚀 Prototype server running at http://localhost:' + PORT);
  console.log('   Press Ctrl+C to stop\\n');
});
`
                }
            },
            'package.json': {
                file: {
                    contents: JSON.stringify({
                        name: 'orbit-prototype',
                        type: 'commonjs',
                        scripts: {
                            "start": "node server.js"
                        }
                        // No dependencies - using Node.js built-in modules!
                    }, null, 2)
                }
            }
        };

        return tree;
    }

    /**
     * Creates a tree from a deeper project structure (for future use)
     */
    public createTreeFromProjectFiles(files: Record<string, string>): FileSystemTree {
        const tree: FileSystemTree = {};

        // Simple flat mapping for now, can be expanded to nested recursion
        // if files keys are paths like 'src/index.js'
        for (const [path, content] of Object.entries(files)) {
            // TODO: Handle nested paths properly
            tree[path] = {
                file: {
                    contents: content
                }
            };
        }

        // Ensure package.json exists
        if (!tree['package.json']) {
            tree['package.json'] = {
                file: {
                    contents: JSON.stringify({
                        name: 'orbit-project',
                        type: 'commonjs',
                        scripts: {
                            "start": "node server.js"
                        }
                        // No dependencies - using Node.js built-in modules!
                    }, null, 2)
                }
            };
        }

        return tree;
    }
}

export const fileMountService = new FileMountService();
