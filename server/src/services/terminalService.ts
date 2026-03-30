import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

// Security: Command whitelist - only allow safe commands
const ALLOWED_COMMANDS = [
  'ls', 'pwd', 'whoami', 'date', 'echo', 'cat', 'head', 'tail', 'grep',
  'find', 'wc', 'sort', 'uniq', 'diff', 'mkdir', 'touch', 'rm', 'cp', 'mv',
  'chmod', 'chown', 'df', 'du', 'ps', 'top', 'free', 'uptime', 'uname',
  'git', 'npm', 'node', 'python', 'python3', 'pip', 'pip3',
  'curl', 'wget', 'tar', 'zip', 'unzip', 'gzip', 'gunzip',
  'cd', 'env', 'export', 'printenv', 'history', 'clear'
];

// Security: Command blacklist - block dangerous commands
const BLOCKED_COMMANDS = [
  'rm -rf', 'rm -r', 'rm -f', 'rm -rf /', 'rm -rf /*',
  'dd', 'mkfs', 'fdisk', 'format', 'del', 'deltree',
  'shutdown', 'reboot', 'halt', 'poweroff', 'init',
  'sudo', 'su', 'passwd', 'chpasswd', 'useradd', 'userdel',
  'killall', 'kill -9', 'pkill', 'xkill',
  '> /dev/', '> /proc/', '> /sys/', '> /etc/',
  '&&', '||', ';', '|', '<', '>', '`', '$(',
  'nc', 'netcat', 'telnet', 'ssh', 'scp', 'rsync',
  'wget', 'curl', 'bash', 'sh', 'zsh', 'csh', 'ksh'
];

// Security: Blocked patterns
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /rm\s+-r/i,
  /rm\s+-f/i,
  /sudo\s+/i,
  /su\s+/i,
  />\s*\/dev/i,
  />\s*\/proc/i,
  />\s*\/sys/i,
  />\s*\/etc/i,
  /&&/,
  /\|\|/,
  /;/,
  /\|/,
  /`/,
  /\$\(/,
  /<.*>/,
];

export interface TerminalCommand {
  command: string;
  cwd?: string;
  timeout?: number;
  maxOutputSize?: number;
}

export interface TerminalResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  executionTime: number;
}

/**
 * Validate command for security
 */
function validateCommand(command: string): { valid: boolean; reason?: string } {
  const trimmed = command.trim();
  
  // Check for empty command
  if (!trimmed) {
    return { valid: false, reason: 'Empty command' };
  }

  // Check against blacklist patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'Command contains blocked pattern' };
    }
  }

  // Check against blocked commands
  for (const blocked of BLOCKED_COMMANDS) {
    if (trimmed.toLowerCase().includes(blocked.toLowerCase())) {
      return { valid: false, reason: `Command "${blocked}" is blocked` };
    }
  }

  // Extract base command (first word)
  const baseCommand = trimmed.split(/\s+/)[0].toLowerCase();
  
  // Check if command is in whitelist
  const isAllowed = ALLOWED_COMMANDS.some(allowed => 
    baseCommand === allowed || baseCommand.startsWith(allowed + '/')
  );

  // Special handling for some commands
  if (baseCommand === 'cd' || baseCommand === 'export' || baseCommand === 'env') {
    return { valid: true }; // These are handled specially
  }

  if (!isAllowed) {
    return { valid: false, reason: `Command "${baseCommand}" is not in whitelist` };
  }

  return { valid: true };
}

/**
 * Execute command in sandboxed environment
 */
export async function executeCommand(
  cmd: TerminalCommand,
  userId: string
): Promise<TerminalResult> {
  const startTime = Date.now();
  
  // Validate command
  const validation = validateCommand(cmd.command);
  if (!validation.valid) {
    return {
      success: false,
      output: '',
      error: `Security validation failed: ${validation.reason}`,
      executionTime: Date.now() - startTime,
    };
  }

  // Set defaults
  const timeout = cmd.timeout || 30000; // 30 seconds default
  const maxOutputSize = cmd.maxOutputSize || 1024 * 1024; // 1MB default
  const cwd = cmd.cwd || process.cwd();

  // Security: Restrict working directory to project directory or temp
  const safeCwd = cwd.startsWith('/tmp') || cwd.includes('orbitai') 
    ? cwd 
    : '/tmp';

  return new Promise((resolve) => {
    let output = '';
    let errorOutput = '';
    let outputSize = 0;

    // Use exec for simple commands (safer than spawn for our use case)
    const child = exec(cmd.command, {
      cwd: safeCwd,
      timeout,
      maxBuffer: maxOutputSize,
      env: {
        ...process.env,
        PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
        HOME: '/tmp',
        USER: userId,
      },
    }, (error, stdout, stderr) => {
      const executionTime = Date.now() - startTime;
      
      if (error) {
        resolve({
          success: false,
          output: stdout.substring(0, maxOutputSize),
          error: stderr || error.message,
          exitCode: error.code || 1,
          executionTime,
        });
      } else {
        resolve({
          success: true,
          output: stdout.substring(0, maxOutputSize),
          error: stderr || undefined,
          exitCode: 0,
          executionTime,
        });
      }
    });

    // Handle output streaming (for future WebSocket support)
    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        if (outputSize < maxOutputSize) {
          output += chunk;
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        if (outputSize < maxOutputSize) {
          errorOutput += chunk;
        }
      });
    }

    // Handle timeout
    const timeoutId = setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        output: output.substring(0, maxOutputSize),
        error: `Command timed out after ${timeout}ms`,
        executionTime: Date.now() - startTime,
      });
    }, timeout);

    child.on('exit', () => {
      clearTimeout(timeoutId);
    });
  });
}

/**
 * Get terminal environment info
 */
export async function getTerminalInfo(): Promise<{
  platform: string;
  cwd: string;
  user: string;
  shell: string;
}> {
  try {
    const platform = process.platform;
    const cwd = process.cwd();
    const user = process.env.USER || 'user';
    const shell = process.env.SHELL || '/bin/sh';

    return {
      platform,
      cwd,
      user,
      shell,
    };
  } catch (error: any) {
    logger.error('Error getting terminal info:', error);
    return {
      platform: 'unknown',
      cwd: '/tmp',
      user: 'user',
      shell: '/bin/sh',
    };
  }
}




