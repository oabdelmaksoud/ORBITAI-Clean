// Preview Generator Fallback Templates
// Extracted from enhancedPreviewGenerator.service.ts

/**
 * Fallback Admin Console when generation fails
 */
export function getFallbackAdminConsole(userGoal: string): string {
    const projectName = userGoal.substring(0, 30).replace(/[<>"']/g, '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Admin Console</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="flex">
    <!-- Sidebar -->
    <aside class="w-64 bg-slate-800 min-h-screen p-4">
      <div class="text-white font-bold text-xl mb-8">Admin Console</div>
      <nav class="space-y-2">
        <a href="#" class="flex items-center gap-3 text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-700">
          <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
          Dashboard
        </a>
        <a href="#" class="flex items-center gap-3 text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-700">
          <i data-lucide="users" class="w-5 h-5"></i>
          Users
        </a>
        <a href="#" class="flex items-center gap-3 text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-700">
          <i data-lucide="database" class="w-5 h-5"></i>
          Data
        </a>
        <a href="#" class="flex items-center gap-3 text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-700">
          <i data-lucide="settings" class="w-5 h-5"></i>
          Settings
        </a>
      </nav>
    </aside>
    
    <!-- Main Content -->
    <main class="flex-1 p-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">${projectName} Dashboard</h1>
      
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-xl p-6 shadow-sm">
          <div class="text-gray-500 text-sm">Total Users</div>
          <div class="text-3xl font-bold text-gray-800">1,234</div>
          <div class="text-green-500 text-sm">+12% from last month</div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm">
          <div class="text-gray-500 text-sm">Revenue</div>
          <div class="text-3xl font-bold text-gray-800">$45,678</div>
          <div class="text-green-500 text-sm">+8% from last month</div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm">
          <div class="text-gray-500 text-sm">Active Sessions</div>
          <div class="text-3xl font-bold text-gray-800">342</div>
          <div class="text-blue-500 text-sm">Live now</div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm">
          <div class="text-gray-500 text-sm">System Health</div>
          <div class="text-3xl font-bold text-green-500">98%</div>
          <div class="text-gray-500 text-sm">All systems operational</div>
        </div>
      </div>
      
      <!-- Data Table -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h2 class="text-lg font-semibold mb-4">Recent Activity</h2>
        <table class="w-full">
          <thead>
            <tr class="text-left text-gray-500 text-sm">
              <th class="pb-4">User</th>
              <th class="pb-4">Action</th>
              <th class="pb-4">Status</th>
              <th class="pb-4">Time</th>
            </tr>
          </thead>
          <tbody class="text-gray-700">
            <tr class="border-t">
              <td class="py-4">John Doe</td>
              <td>Created new record</td>
              <td><span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">Success</span></td>
              <td>2 min ago</td>
            </tr>
            <tr class="border-t">
              <td class="py-4">Jane Smith</td>
              <td>Updated settings</td>
              <td><span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">Pending</span></td>
              <td>5 min ago</td>
            </tr>
            <tr class="border-t">
              <td class="py-4">Bob Wilson</td>
              <td>Deleted item</td>
              <td><span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm">Warning</span></td>
              <td>10 min ago</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
  <script>lucide.createIcons();</script>
</body>
</html>`;
}

/**
 * Simple wireframe fallback
 */
export function createSimpleWireframeFallback(viewType: string, userGoal: string): string {
    const projectName = userGoal.substring(0, 30).replace(/[<>"']/g, '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - ${viewType === 'adminConsole' ? 'Admin' : 'User'} Wireframe</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; }
    .wireframe { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .box { background: white; border: 2px dashed #ccc; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .box-header { font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 10px; }
    .placeholder { background: #e0e0e0; height: 40px; border-radius: 4px; margin: 10px 0; }
    .placeholder.small { width: 100px; display: inline-block; }
    .placeholder.medium { width: 200px; }
    .placeholder.large { width: 100%; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .annotation { font-size: 11px; color: #666; font-style: italic; }
  </style>
</head>
<body>
  <div class="wireframe">
    <div class="box">
      <div class="box-header">Header / Navigation</div>
      <div class="placeholder small"></div>
      <div class="placeholder medium"></div>
      <div class="annotation">→ Logo and main navigation links</div>
    </div>
    
    <div class="box">
      <div class="box-header">Main Content Area</div>
      <div class="placeholder large"></div>
      <div class="placeholder large"></div>
      <div class="annotation">→ Primary content for ${viewType === 'adminConsole' ? 'admin dashboard' : 'user interface'}</div>
    </div>
    
    <div class="grid">
      <div class="box">
        <div class="box-header">Widget 1</div>
        <div class="placeholder large"></div>
        <div class="annotation">→ Data display</div>
      </div>
      <div class="box">
        <div class="box-header">Widget 2</div>
        <div class="placeholder large"></div>
        <div class="annotation">→ Actions</div>
      </div>
      <div class="box">
        <div class="box-header">Widget 3</div>
        <div class="placeholder large"></div>
        <div class="annotation">→ Status</div>
      </div>
    </div>
    
    <div class="box">
      <div class="box-header">Footer</div>
      <div class="placeholder medium"></div>
      <div class="annotation">→ Copyright and links</div>
    </div>
  </div>
</body>
</html>`;
}

export default {
    getFallbackAdminConsole,
    createSimpleWireframeFallback,
};
