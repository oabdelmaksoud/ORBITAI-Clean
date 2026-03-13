import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.ts'],
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'components/**/*.{test,spec}.{ts,tsx}',
            'hooks/**/*.{test,spec}.{ts,tsx}',
            'services/**/*.{test,spec}.{ts,tsx}',
        ],
        exclude: [
            'node_modules/',
            'dist/',
            'server/',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage',
            exclude: [
                'node_modules/',
                'dist/',
                'server/',
                '**/*.config.{ts,js}',
                '**/*.d.ts',
                '**/types.ts',
                '**/types/**',
                '**/constants.ts',
                'src/__tests__/**',
                'coverage/**',
                '.github/**',
            ],
            // Coverage thresholds
            thresholds: {
                // Start with low thresholds and gradually increase
                lines: 30,
                functions: 30,
                branches: 20,
                statements: 30,
            },
        },
        testTimeout: 10000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
            '@src': path.resolve(__dirname, './src'),
        },
    },
});
