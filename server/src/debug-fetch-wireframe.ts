import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function fetchLatestGameWireframe() {
    try {
        // Find the most recent game project
        const latestProject = await prisma.project.findFirst({
            where: {
                projectType: 'game'
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                projectPreview: true
            }
        });

        if (!latestProject) {
            console.log('No game projects found');
            return;
        }

        console.log(`Found project: ${latestProject.name}`);
        console.log(`Created at: ${latestProject.createdAt}`);
        console.log(`Project ID: ${latestProject.id}`);

        if (!latestProject.projectPreview) {
            console.log('No preview found for this project');
            return;
        }

        const preview = latestProject.projectPreview as any;

        // Extract wireframes
        const endUserWireframe = preview.views?.endUser?.wireframe;
        const adminWireframe = preview.views?.adminConsole?.wireframe;

        console.log(`\nEndUser wireframe exists: ${!!endUserWireframe}`);
        console.log(`Admin wireframe exists: ${!!adminWireframe}`);

        if (endUserWireframe) {
            const outputPath = path.join(__dirname, '../debug-wireframe-enduser.html');
            fs.writeFileSync(outputPath, endUserWireframe);
            console.log(`\nEndUser wireframe saved to: ${outputPath}`);
            console.log(`Size: ${endUserWireframe.length} characters`);

            // Check for key elements
            const hasCanvas = endUserWireframe.includes('<canvas');
            const hasReact = endUserWireframe.includes('React.') || endUserWireframe.includes('useState');
            const hasPlaceholder = endUserWireframe.includes('placehold.co');
            const hasTabs = endUserWireframe.match(/<button[^>]*>(Dashboard|Powers|Combat|Settings)/i);
            const buttonCount = (endUserWireframe.match(/<button/g) || []).length;

            console.log(`\n=== VALIDATION CHECK ===`);
            console.log(`Has <canvas>: ${hasCanvas}`);
            console.log(`Has React: ${hasReact}`);
            console.log(`Has placeholder images: ${hasPlaceholder}`);
            console.log(`Has tab buttons: ${!!hasTabs}`);
            console.log(`Button count: ${buttonCount}`);
        }

        if (adminWireframe) {
            const outputPath = path.join(__dirname, '../debug-wireframe-admin.html');
            fs.writeFileSync(outputPath, adminWireframe);
            console.log(`\nAdmin wireframe saved to: ${outputPath}`);
            console.log(`Size: ${adminWireframe.length} characters`);
        }

    } catch (error: unknown) {
        console.error('Error fetching wireframe:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fetchLatestGameWireframe();
