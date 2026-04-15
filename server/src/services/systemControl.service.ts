import { exec } from 'child_process';
import { promisify } from 'util';
import { AppError } from '../middleware/errorHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { redisService } from './redis.service.js';
import { logger } from '../utils/logger.js';
import os from 'os';

const execAsync = promisify(exec);

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  command: string;
}

interface SystemHealth {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  uptime: number;
  nodeVersion: string;
  platform: string;
}

/**
 * System Control Service
 * Provides system-level control operations for admin console
 */
export class SystemControlService {
  private maintenanceModeEnabled = false;
  private restartScheduled = false;

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      // Calculate CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      return {
        cpu: {
          usage: cpuPercent,
          cores: cpus.length
        },
        memory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          percentage: (usedMem / totalMem) * 100
        },
        uptime: os.uptime(),
        nodeVersion: process.version,
        platform: os.platform()
      };
    } catch (error: unknown) {
      throw new AppError(`Failed to get system health: ${(error instanceof Error ? error.message : String(error))}`, 500);
    }
  }

  /**
   * Get running processes (Node.js processes)
   */
  async getProcesses(): Promise<ProcessInfo[]> {
    try {
      const platform = os.platform();
      let command: string;

      if (platform === 'win32') {
        command = 'tasklist /FO CSV';
      } else {
        command = 'ps aux';
      }

      const { stdout } = await execAsync(command);
      const processes: ProcessInfo[] = [];

      if (platform === 'win32') {
        // Parse Windows tasklist output
        const lines = stdout.split('\n').slice(1); // Skip header
        for (const line of lines) {
          if (line.trim()) {
            const parts = line.split('","');
            if (parts.length >= 2) {
              const pid = parseInt(parts[1].replace(/"/g, ''));
              const name = parts[0].replace(/"/g, '');
              if (!isNaN(pid) && name.toLowerCase().includes('node')) {
                processes.push({
                  pid,
                  name,
                  cpu: 0,
                  memory: 0,
                  command: name
                });
              }
            }
          }
        }
      } else {
        // Parse Unix ps output
        const lines = stdout.split('\n').slice(1); // Skip header
        for (const line of lines) {
          if (line.trim()) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 11 && parts[10] && parts[10].includes('node')) {
              processes.push({
                pid: parseInt(parts[1]),
                name: parts[10],
                cpu: parseFloat(parts[2]) || 0,
                memory: parseFloat(parts[3]) || 0,
                command: parts.slice(10).join(' ')
              });
            }
          }
        }
      }

      return processes;
    } catch (error: unknown) {
      logger.error('Failed to get processes:', error);
      // Return current process if command fails
      return [{
        pid: process.pid,
        name: 'node',
        cpu: 0,
        memory: 0,
        command: process.argv.join(' ')
      }];
    }
  }

  /**
   * Kill a process
   */
  async killProcess(pid: number, adminId: string): Promise<void> {
    try {
      // Prevent killing the current process
      if (pid === process.pid) {
        throw new AppError('Cannot kill the current server process', 400);
      }

      const platform = os.platform();
      const command = platform === 'win32' ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`;

      await execAsync(command);

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: 'system_kill_process',
        entityType: 'process',
        details: {
          pid,
          command
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true
      });
    } catch (error: unknown) {
      // Log failed kill
      await AuditLog.create({
        userId: adminId,
        action: 'system_kill_process',
        entityType: 'process',
        details: {
          pid,
          error: (error instanceof Error ? error.message : String(error))
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: false
      }).catch(() => {});

      throw new AppError(`Failed to kill process: ${(error instanceof Error ? error.message : String(error))}`, 500);
    }
  }

  /**
   * Enable/disable maintenance mode
   */
  async setMaintenanceMode(enabled: boolean, adminId: string): Promise<void> {
    try {
      this.maintenanceModeEnabled = enabled;

      // Store in Redis if available
      if (redisService.isConnected()) {
        await redisService.set('maintenance_mode', enabled ? 'true' : 'false', 0);
      }

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: enabled ? 'system_enable_maintenance' : 'system_disable_maintenance',
        entityType: 'system',
        details: {
          enabled
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true
      });
    } catch (error: unknown) {
      throw new AppError(`Failed to set maintenance mode: ${(error instanceof Error ? error.message : String(error))}`, 500);
    }
  }

  /**
   * Check if maintenance mode is enabled
   */
  async isMaintenanceModeEnabled(): Promise<boolean> {
    if (redisService.isConnected()) {
      const value = await redisService.get('maintenance_mode');
      return value === 'true';
    }
    return this.maintenanceModeEnabled;
  }

  /**
   * Clear cache
   */
  async clearCache(cacheType?: string, adminId?: string): Promise<any> {
    try {
      const results: any = {
        cleared: [],
        errors: []
      };

      if (!cacheType || cacheType === 'redis') {
        try {
          if (redisService.isConnected()) {
            await (redisService as any).flushAll();
            results.cleared.push('redis');
          }
        } catch (error: unknown) {
          results.errors.push({ type: 'redis', error: (error instanceof Error ? error.message : String(error)) });
        }
      }

      if (!cacheType || cacheType === 'memory') {
        try {
          // Clear Node.js cache (be careful with this)
          if (global.gc) {
            global.gc();
            results.cleared.push('memory');
          }
        } catch (error: unknown) {
          results.errors.push({ type: 'memory', error: (error instanceof Error ? error.message : String(error)) });
        }
      }

      // Log audit
      if (adminId) {
        await AuditLog.create({
          userId: adminId,
          action: 'system_clear_cache',
          entityType: 'cache',
          details: {
            cacheType: cacheType || 'all',
            cleared: results.cleared
          },
          ipAddress: 'admin-console',
          userAgent: 'admin-console',
          success: results.errors.length === 0
        });
      }

      return results;
    } catch (error: unknown) {
      throw new AppError(`Failed to clear cache: ${(error instanceof Error ? error.message : String(error))}`, 500);
    }
  }

  /**
   * Schedule server restart
   */
  async scheduleRestart(delaySeconds: number, adminId: string): Promise<void> {
    try {
      if (this.restartScheduled) {
        throw new AppError('Restart already scheduled', 400);
      }

      this.restartScheduled = true;

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: 'system_schedule_restart',
        entityType: 'system',
        details: {
          delaySeconds,
          scheduledAt: new Date().toISOString()
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true
      });

      // Schedule restart
      setTimeout(() => {
        logger.warn('Server restart initiated by admin');
        process.exit(0);
      }, delaySeconds * 1000);
    } catch (error: unknown) {
      throw new AppError(`Failed to schedule restart: ${(error instanceof Error ? error.message : String(error))}`, 500);
    }
  }

  /**
   * Force garbage collection (if available)
   */
  async forceGarbageCollection(adminId: string): Promise<void> {
    try {
      if (global.gc) {
        global.gc();
        
        // Log audit
        await AuditLog.create({
          userId: adminId,
          action: 'system_gc',
          entityType: 'system',
          details: {},
          ipAddress: 'admin-console',
          userAgent: 'admin-console',
          success: true
        });
      } else {
        throw new AppError('Garbage collection not available (run Node with --expose-gc)', 400);
      }
    } catch (error: unknown) {
      throw new AppError(`Failed to force GC: ${(error instanceof Error ? error.message : String(error))}`, 500);
    }
  }
}

export const systemControlService = new SystemControlService();




