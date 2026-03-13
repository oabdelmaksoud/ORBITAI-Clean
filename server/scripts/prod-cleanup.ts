#!/usr/bin/env node
/**
 * Production Cleanup Script
 * 
 * This script identifies console.log statements that should be replaced
 * with the logger service for production.
 * 
 * Run: npx ts-node scripts/prod-cleanup.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const COLORS = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
};

function log(color: string, message: string) {
    console.log(`${color}${message}${COLORS.RESET}`);
}

function main() {
    log(COLORS.BLUE, '\n🔍 Production Cleanup Scanner\n');
    log(COLORS.BLUE, '='.repeat(50) + '\n');

    // Find console statements
    try {
        const result = execSync(
            `grep -rn "console\\.(log|warn|error)" src --include="*.ts" | grep -v "__tests__"`,
            { cwd: process.cwd(), encoding: 'utf8' }
        );

        const lines = result.trim().split('\n').filter(Boolean);

        log(COLORS.YELLOW, `Found ${lines.length} console statements:\n`);

        // Group by file
        const byFile: Record<string, string[]> = {};
        lines.forEach(line => {
            const match = line.match(/^([^:]+):(\d+):/);
            if (match) {
                const file = match[1];
                if (!byFile[file]) byFile[file] = [];
                byFile[file].push(line);
            }
        });

        // Display grouped results
        Object.entries(byFile).forEach(([file, occurrences]) => {
            log(COLORS.RED, `\n📄 ${file} (${occurrences.length} occurrences)`);
            occurrences.slice(0, 3).forEach(occ => {
                const lineMatch = occ.match(/:(\d+):/);
                const lineNum = lineMatch ? lineMatch[1] : '?';
                console.log(`   Line ${lineNum}`);
            });
            if (occurrences.length > 3) {
                console.log(`   ... and ${occurrences.length - 3} more`);
            }
        });

        log(COLORS.GREEN, '\n' + '='.repeat(50));
        log(COLORS.GREEN, '\n✅ Recommended Actions:\n');
        console.log('1. Replace console.log with logger.info');
        console.log('2. Replace console.warn with logger.warn');
        console.log('3. Replace console.error with logger.error');
        console.log('4. Remove DEBUG statements entirely');
        console.log('\nExample:');
        console.log('  import { logger } from "../utils/logger";');
        console.log('  logger.info("Message", { data: value });');
        console.log('');

    } catch (error) {
        log(COLORS.GREEN, '✅ No console statements found! Ready for production.');
    }
}

main();
