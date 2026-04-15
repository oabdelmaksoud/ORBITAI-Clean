/**
 * Game Mechanics Service - Test Suite
 * Validates the mechanics generation using vitest
 */

import { describe, it, expect } from 'vitest';
import gameMechanicsService from '../services/gameMechanicsService.js';

const testCases = [
    {
        name: 'Unity 2D Platformer',
        request: {
            gameDescription: '2D platformer',
            targetEngine: 'unity' as const,
            complexity: 'standard' as const
        },
        expectedFiles: ['PlayerController.cs'],
        expectedMechanics: { movement: true, combat: false }
    },
    {
        name: 'Unity Platformer with Combat',
        request: {
            gameDescription: '2D platformer with enemies and combat',
            targetEngine: 'unity' as const
        },
        expectedFiles: ['PlayerController.cs', 'CombatSystem.cs'],
        expectedMechanics: { movement: true, combat: true }
    },
    {
        name: 'Godot Platformer',
        request: {
            gameDescription: ' platformer game',
            targetEngine: 'godot' as const
        },
        expectedFiles: ['player_controller.gd'],
        expectedMechanics: { movement: true, combat: false }
    },
    {
        name: 'Phaser Web Game',
        request: {
            gameDescription: 'web platformer',
            targetEngine: 'phaser' as const
        },
        expectedFiles: ['PlayerController.js'],
        expectedMechanics: { movement: true, combat: false }
    },
    {
        name: 'Double Jump Customization',
        request: {
            gameDescription: '2D platformer',
            targetEngine: 'unity' as const,
            customization: ['double jump']
        },
        expectedFiles: ['PlayerController.cs'],
        expectedVariableValue: { MAX_JUMPS: 2 }
    }
];

describe('Game Mechanics Service', () => {
    describe('generateMechanics', () => {
        for (const testCase of testCases) {
            it(`should generate mechanics for ${testCase.name}`, async () => {
                const result = await gameMechanicsService.generateMechanics(testCase.request);

                // Validate files
                const fileNames = result.files.map(f => f.filename);
                for (const expectedFile of testCase.expectedFiles) {
                    expect(fileNames).toContain(expectedFile);
                }

                // Validate mechanics
                if (testCase.expectedMechanics) {
                    expect(result.mechanics.movement).toBe(testCase.expectedMechanics.movement);
                    expect(result.mechanics.combat).toBe(testCase.expectedMechanics.combat);
                }

                // Validate variable values (if specified)
                if (testCase.expectedVariableValue) {
                    const firstFile = result.files[0];
                    for (const [, expectedValue] of Object.entries(testCase.expectedVariableValue)) {
                        expect(firstFile.content).toContain(String(expectedValue));
                    }
                }

                expect(result.mechanicsId).toBeDefined();
                expect(result.files.length).toBeGreaterThan(0);
            });
        }
    });

    describe('getAvailableTemplates', () => {
        it('should return available templates', () => {
            const templates = gameMechanicsService.getAvailableTemplates();
            expect(templates.length).toBeGreaterThan(0);

            for (const template of templates) {
                expect(template.id).toBeDefined();
                expect(template.name).toBeDefined();
                expect(template.engine).toBeDefined();
                expect(template.category).toBeDefined();
                expect(template.code.length).toBeGreaterThan(0);
            }
        });
    });
});
