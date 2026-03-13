/**
 * Test script to verify game prototype generation produces playable canvas games
 */
import { EnhancedPreviewGenerator } from './src/services/enhancedPreviewGenerator.service';
import { logger } from './src/utils/logger';

async function testGameGeneration() {
    const generator = new EnhancedPreviewGenerator();

    // Test case 1: Superman 3D game
    const testRequirements = {
        requirements: [
            'Must have flying controls',
            'Should include enemy AI',
            'Needs power-up system'
        ],
        features: [
            'Flying mechanics with WASD controls',
            'Heat vision power',
            'Super strength ability',
            'Enemy spawning system',
            'Score tracking',
            'Health system'
        ],
        constraints: [],
        preferences: ['Neon cyberpunk theme', '3D perspective'],
        targetPlatforms: ['Web'],
        projectType: 'game' as const
    };

    const brainstormingContext = {
        ideas: [
            { label: 'Flight System', description: 'Superman can fly in all directions with smooth acceleration' },
            { label: 'Heat Vision', description: 'Hold SPACE to fire heat vision at enemies' },
            { label: 'Enemy Waves', description: 'Enemies spawn in increasing waves' }
        ]
    };

    logger.info('🧪 Testing Superman 3D Game prototype generation...');

    try {
        const wireframe = await generator.generateWireframe(
            'Superman 3D game with flying, heat vision, and enemy combat',
            testRequirements,
            ['HTML5 Canvas', 'JavaScript'],
            'Game architecture with canvas rendering',
            'Full prompt',
            false,
            brainstormingContext
        );

        // Validation checks
        const validationResults = {
            hasCanvas: wireframe.includes('<canvas'),
            hasGameLoop: wireframe.includes('requestAnimationFrame'),
            hasKeyboardControls: wireframe.includes('keydown') || wireframe.includes('addEventListener'),
            hasDoctypeHtml: wireframe.toLowerCase().includes('<!doctype html'),
            hasGameState: wireframe.includes('PLAYING') || wireframe.includes('game.state'),
            hasPlayerMovement: wireframe.includes('player.x') || wireframe.includes('player.y'),
            notMenuDriven: !wireframe.includes('button grid') && !wireframe.includes('settings menu'),
            length: wireframe.length
        };

        logger.info('✅ Game prototype validation results:', validationResults);

        // Check if all critical elements are present
        const allChecksPassed =
            validationResults.hasCanvas &&
            validationResults.hasGameLoop &&
            validationResults.hasKeyboardControls &&
            validationResults.hasDoctypeHtml &&
            validationResults.hasGameState;

        if (allChecksPassed) {
            console.log('\n✅ ✅ ✅ ALL VALIDATION CHECKS PASSED! ✅ ✅ ✅');
            console.log('The generated game prototype includes:');
            console.log('  ✓ Canvas element for rendering');
            console.log('  ✓ RequestAnimationFrame game loop');
            console.log('  ✓ Keyboard event listeners');
            console.log('  ✓ Valid HTML structure');
            console.log('  ✓ Game state management');
            console.log(`\nGenerated HTML length: ${validationResults.length} characters`);

            // Save to file for manual inspection
            const fs = require('fs');
            const outputPath = '/Users/omarabdelmaksoud/Downloads/ORBITAI-Clean/server/test-superman-game.html';
            fs.writeFileSync(outputPath, wireframe);
            console.log(`\n📄 Saved prototype to: ${outputPath}`);
            console.log('Open this file in a browser to test playability!');

            return true;
        } else {
            console.log('\n❌ VALIDATION FAILED - Missing critical elements:');
            if (!validationResults.hasCanvas) console.log('  ✗ Canvas element');
            if (!validationResults.hasGameLoop) console.log('  ✗ RequestAnimationFrame game loop');
            if (!validationResults.hasKeyboardControls) console.log('  ✗ Keyboard controls');
            if (!validationResults.hasDoctypeHtml) console.log('  ✗ Valid HTML structure');
            if (!validationResults.hasGameState) console.log('  ✗ Game state management');
            return false;
        }

    } catch (error: any) {
        logger.error('❌ Test failed with error:', error.message);
        console.error(error);
        return false;
    }
}

// Run the test
testGameGeneration()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Test execution failed:', err);
        process.exit(1);
    });
