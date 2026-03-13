/**
 * Preview Fallbacks - Fallback template generators
 * Used when LLM generation fails or times out
 */

/**
 * Generate a fallback game dashboard template
 * Provides basic game controls via PostMessage API
 */
export function generateFallbackDashboard(gameGoal: string): string {
    const sanitizedGoal = gameGoal.substring(0, 30).replace(/[<>]/g, '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game Dashboard - ${sanitizedGoal}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root { --primary: #6366f1; --secondary: #8b5cf6; --accent: #ec4899; }
    body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    .glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.1); }
  </style>
</head>
<body class="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 min-h-screen">
  <div id="root"></div>
  <script>
    // PostMessage communication with game iframe
    function sendGameUpdate(variable, value) {
      window.parent.postMessage({
        type: 'UPDATE_VAR',
        payload: { var: variable, value: value }
      }, '*');
      console.log('📤 Sent to game:', variable, '=', value);
    }

    function requestGameState() {
      window.parent.postMessage({ type: 'REQUEST_STATE' }, '*');
    }

    // Listen for state updates from game
    window.addEventListener('message', (e) => {
      if (e.data.type === 'STATE_UPDATE') {
        console.log('📥 Game state received:', e.data.payload);
        updateGameStats(e.data.payload);
      }
    });

    function updateGameStats(state) {
      const statsEl = document.getElementById('game-stats');
      if (statsEl && state) {
        statsEl.innerHTML = \`
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-indigo-500/20 p-2 rounded">
              <div class="text-xs text-indigo-300">Score</div>
              <div class="text-lg font-bold text-white">\${state.score || 0}</div>
            </div>
            <div class="bg-purple-500/20 p-2 rounded">
              <div class="text-xs text-purple-300">Level</div>
              <div class="text-lg font-bold text-white">\${state.level || 1}</div>
            </div>
            <div class="bg-pink-500/20 p-2 rounded">
              <div class="text-xs text-pink-300">Lives</div>
              <div class="text-lg font-bold text-white">\${state.lives || 3}</div>
            </div>
            <div class="bg-cyan-500/20 p-2 rounded">
              <div class="text-xs text-cyan-300">Health</div>
              <div class="text-lg font-bold text-white">\${state.health || 100}%</div>
            </div>
          </div>
        \`;
      }
    }

    // Request initial state
    setTimeout(() => requestGameState(), 500);
    setInterval(() => requestGameState(), 2000);

    // Render dashboard
    const app = \`
      <div class="container mx-auto p-6 max-w-4xl">
        <div class="bg-slate-800/60 backdrop-blur-lg rounded-2xl shadow-2xl border border-indigo-500/20 overflow-hidden">
          <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
            <h1 class="text-2xl font-bold text-white flex items-center gap-3">
              <i data-lucide="gamepad-2" class="w-8 h-8"></i>
              Game Dashboard
            </h1>
            <p class="text-indigo-100 text-sm mt-1">${sanitizedGoal}</p>
          </div>

          <div class="p-6 space-y-6">
            <div class="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
              <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <i data-lucide="sliders" class="w-5 h-5 text-indigo-400"></i>
                Game Controls
              </h2>
              
              <div class="mb-4">
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Player Speed: <span id="speed-value" class="text-indigo-400">300</span>
                </label>
                <input type="range" min="100" max="500" value="300" 
                  class="w-full h-2 bg-slate-600 rounded-lg cursor-pointer"
                  oninput="document.getElementById('speed-value').textContent = this.value; sendGameUpdate('player.speed', parseFloat(this.value))">
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Jump Height: <span id="jump-value" class="text-purple-400">400</span>
                </label>
                <input type="range" min="200" max="600" value="400"
                  class="w-full h-2 bg-slate-600 rounded-lg cursor-pointer"
                  oninput="document.getElementById('jump-value').textContent = this.value; sendGameUpdate('player.jumpHeight', parseFloat(this.value))">
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium text-slate-300 mb-2">Difficulty Level</label>
                <select class="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  onchange="sendGameUpdate('game.difficulty', this.value)">
                  <option value="easy">Easy</option>
                  <option value="normal" selected>Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <button onclick="sendGameUpdate('game.reset', true); alert('Game reset signal sent!');"
                class="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2">
                <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                Reset to Defaults
              </button>
            </div>

            <div class="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
              <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <i data-lucide="activity" class="w-5 h-5 text-cyan-400"></i>
                Live Game Stats
              </h2>
              <div id="game-stats" class="text-slate-400 text-sm">
                Waiting for game data...
              </div>
            </div>
          </div>
        </div>
      </div>
    \`;

    document.getElementById('root').innerHTML = app;
    if (window.lucide) window.lucide.createIcons();
    console.log('✅ Fallback game dashboard loaded');
  </script>
</body>
</html>`;
}

/**
 * Generate fallback admin console for business platforms
 */
export function generateFallbackAdminConsole(projectGoal: string, adminFeatures: string[]): string {
    const projectName = projectGoal.substring(0, 50).replace(/[<>]/g, '') || 'Admin Console';
    const featuresDesc = adminFeatures.length > 0
        ? adminFeatures.slice(0, 3).join(', ')
        : 'Management Dashboard';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Admin Console</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState } = React;

    function AdminConsole() {
      const [activeSection, setActiveSection] = useState('dashboard');
      
      const metrics = [
        { label: 'Total Items', value: '1,234', change: '+12%', icon: 'package' },
        { label: 'Active Users', value: '567', change: '+8%', icon: 'users' },
        { label: 'Revenue', value: '$12,345', change: '+15%', icon: 'dollar-sign' },
        { label: 'Pending', value: '23', change: '-5%', icon: 'clock' }
      ];

      const recentItems = [
        { id: '001', name: 'Sample Item 1', status: 'Active', date: '2024-01-15' },
        { id: '002', name: 'Sample Item 2', status: 'Pending', date: '2024-01-14' },
        { id: '003', name: 'Sample Item 3', status: 'Active', date: '2024-01-13' }
      ];

      return (
        <div className="flex h-screen bg-slate-50">
          <aside className="w-64 bg-slate-900 text-white flex flex-col">
            <div className="p-6 border-b border-slate-700">
              <h1 className="text-xl font-bold">${projectName}</h1>
              <p className="text-xs text-slate-400 mt-1">Admin Console</p>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
                { id: 'manage', label: 'Management', icon: 'settings' },
                { id: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
                { id: 'users', label: 'Users', icon: 'users' },
                { id: 'settings', label: 'Settings', icon: 'sliders' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={\`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors \${
                    activeSection === item.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }\`}
                >
                  <i data-lucide={item.icon} className="w-5 h-5"></i>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="flex-1 overflow-auto">
            <header className="bg-white border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">${featuresDesc}</p>
                </div>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                  <i data-lucide="plus" className="w-4 h-4"></i>
                  <span>New Item</span>
                </button>
              </div>
            </header>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((metric, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-600 font-medium">{metric.label}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">{metric.value}</p>
                        <p className={\`text-sm mt-2 \${
                          metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                        }\`}>{metric.change} from last month</p>
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-lg">
                        <i data-lucide={metric.icon} className="w-6 h-6 text-indigo-600"></i>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                  <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {recentItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-900">{item.id}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.name}</td>
                          <td className="px-6 py-4">
                            <span className={\`px-3 py-1 text-xs font-medium rounded-full \${
                              item.status === 'Active' ? 'bg-green-100 text-green-700' :
                              'bg-yellow-100 text-yellow-700'
                            }\`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      );
    }

    ReactDOM.render(<AdminConsole />, document.getElementById('root'));
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 100);
  </script>
</body>
</html>`;
}

/**
 * Simple wireframe fallback for any view type
 */
export function createSimpleWireframeFallback(viewType: string, userGoal: string): string {
    const sanitizedGoal = userGoal.substring(0, 100).replace(/[<>]/g, '');
    const isAdmin = viewType === 'adminConsole';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isAdmin ? 'Admin Console' : 'Preview'} - Wireframe</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, sans-serif; }
    body { background: #f5f5f5; min-height: 100vh; padding: 20px; }
    .wireframe-container { max-width: 1200px; margin: 0 auto; }
    .wireframe-box { background: white; border: 2px dashed #999; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .wireframe-header { background: #ddd; padding: 15px; border-radius: 4px; margin-bottom: 10px; }
    .wireframe-sidebar { background: #eee; padding: 15px; border-radius: 4px; min-height: 300px; }
    .wireframe-content { background: #f9f9f9; padding: 15px; border-radius: 4px; min-height: 400px; }
    .wireframe-text { color: #666; font-style: italic; }
    .wireframe-placeholder { background: #ddd; height: 40px; border-radius: 4px; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 250px 1fr; gap: 20px; }
  </style>
</head>
<body>
  <div class="wireframe-container">
    <div class="wireframe-box">
      <div class="wireframe-header">
        <h1 class="wireframe-text">${isAdmin ? 'Admin Console' : 'Application'} Wireframe</h1>
        <p class="wireframe-text">${sanitizedGoal}</p>
      </div>
    </div>
    
    <div class="grid">
      ${isAdmin ? `
      <div class="wireframe-box wireframe-sidebar">
        <p class="wireframe-text">Navigation</p>
        <div class="wireframe-placeholder"></div>
        <div class="wireframe-placeholder"></div>
        <div class="wireframe-placeholder"></div>
        <div class="wireframe-placeholder"></div>
      </div>
      ` : ''}
      
      <div class="wireframe-box wireframe-content">
        <p class="wireframe-text">Main Content Area</p>
        <div class="wireframe-placeholder" style="height: 100px;"></div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px;">
          <div class="wireframe-placeholder" style="height: 80px;"></div>
          <div class="wireframe-placeholder" style="height: 80px;"></div>
          <div class="wireframe-placeholder" style="height: 80px;"></div>
        </div>
        <div class="wireframe-placeholder" style="height: 200px; margin-top: 20px;"></div>
      </div>
    </div>
    
    <div class="wireframe-box" style="text-align: center; padding: 10px;">
      <p class="wireframe-text">This is a placeholder wireframe. Full preview generation is in progress...</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate generic fallback wireframe
 */
export function generateFallbackWireframe(projectGoal: string): string {
    return createSimpleWireframeFallback('endUser', projectGoal);
}
