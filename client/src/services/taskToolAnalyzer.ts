/**
 * Task Tool Analyzer
 * Analyzes tasks to determine what tools are needed automatically
 */

export interface ToolRequirements {
  needsInternet: boolean;
  needsFileAccess: boolean;
  needsCommandExecution: boolean;
  reasoning: string;
}

/**
 * Analyzes a task description to determine if tools are needed
 */
export function analyzeTaskToolRequirements(
  taskDescription: string,
  taskTitle: string = ''
): ToolRequirements {
  const fullText = `${taskTitle} ${taskDescription}`.toLowerCase();
  
  // Keywords that indicate internet search is needed
  const internetKeywords = [
    'search', 'find', 'look up', 'lookup', 'research', 'investigate',
    'latest', 'current', 'recent', 'newest', 'up-to-date', 'up to date',
    'best practice', 'best practices', 'documentation', 'docs',
    'tutorial', 'guide', 'how to', 'api', 'npm package', 'library',
    'framework', 'stackoverflow', 'github', 'stack exchange',
    'what is', 'how does', 'compare', 'alternative', 'options',
    'trending', 'popular', 'recommended', 'standard', 'convention'
  ];
  
  // Keywords that indicate file operations are needed
  const fileKeywords = [
    'read file', 'write file', 'update file', 'modify file', 'edit file',
    'create file', 'delete file', 'open file', 'save file',
    'config.json', 'package.json', '.env', 'read config', 'write config',
    'update config', 'modify config', 'edit config',
    'file system', 'filesystem', 'read from', 'write to',
    'parse file', 'load file', 'import from file', 'export to file'
  ];
  
  // Keywords that indicate command execution is needed
  const commandKeywords = [
    'run command', 'execute command', 'run', 'execute', 'install',
    'npm install', 'npm run', 'yarn', 'build', 'compile', 'test',
    'deploy', 'migrate', 'seed', 'setup', 'initialize', 'init',
    'start server', 'stop server', 'restart', 'kill process'
  ];
  
  // Analyze for internet search needs
  const needsInternet = internetKeywords.some(keyword => 
    fullText.includes(keyword)
  );
  
  // Analyze for file access needs
  const needsFileAccess = fileKeywords.some(keyword => 
    fullText.includes(keyword)
  );
  
  // Analyze for command execution needs
  const needsCommandExecution = commandKeywords.some(keyword => 
    fullText.includes(keyword)
  );
  
  // Build reasoning
  const reasons: string[] = [];
  if (needsInternet) {
    reasons.push('Task requires internet search for current information');
  }
  if (needsFileAccess) {
    reasons.push('Task requires file system access');
  }
  if (needsCommandExecution) {
    reasons.push('Task requires command execution');
  }
  if (reasons.length === 0) {
    reasons.push('Task can be completed with basic text generation');
  }
  
  return {
    needsInternet,
    needsFileAccess,
    needsCommandExecution,
    reasoning: reasons.join('; ')
  };
}

/**
 * Determines if any tools are needed based on task analysis
 */
export function taskNeedsTools(
  taskDescription: string,
  taskTitle: string = ''
): boolean {
  const requirements = analyzeTaskToolRequirements(taskDescription, taskTitle);
  return requirements.needsInternet || 
         requirements.needsFileAccess || 
         requirements.needsCommandExecution;
}
















