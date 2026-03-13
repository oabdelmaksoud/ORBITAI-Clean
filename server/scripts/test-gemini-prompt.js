
import { GoogleGenAI } from '@google/genai';

// API Key from environment variable (set via Admin Console → Settings → API Keys)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'your-api-key-here';

async function testPrompt() {
    console.log('🚀 Starting Prompt Verification Test...');

    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Sample ideas effectively from the "Deepen Ideas X1" scenario
    const focusedIdeas = [
        { id: "id-1", label: "Real-time Traffic Analysis" },
        { id: "id-2", label: "Smart Traffic Lights" },
        { id: "id-3", label: "Emergency Vehicle Priority" },
        { id: "id-4", label: "Pedestrian Safety Zones" }
    ];

    const ideaSummary = focusedIdeas.map(i => `- ID: "${i.id}" Idea: "${i.label}"`).join('\n');

    // EXACT Prompt from NeuralStreamChat.tsx
    const deepenPrompt = `We have these Major Categories. Now, for EACH category, generate 4-5 SPECIFIC, actionable feature/concept ideas. \n\nCRITICAL: You MUST use the "ID" provided below as the "parentId" for your new ideas to nest them correctly.\n\nCategories:\n${ideaSummary}\n\nOutput using the same XML <idea> format.`;

    console.log('📝 Prompt Prepared (Length:', deepenPrompt.length, ')');
    console.log(deepenPrompt);

    try {
        console.log('⚡ Sending request to gemini-2.5-flash...');
        const model = "gemini-2.5-flash"; // Production model

        // We need to use the generative model directly similar to how the service does it,
        // although the service uses the newer @google/genai SDK differently.
        // Let's try the standard pattern for the new SDK if possible, or fallback.
        // Based on gemini.service.ts import { GoogleGenAI } from '@google/genai';

        const result = await genAI.models.generateContent({
            model: model,
            contents: deepenPrompt,
            config: {
                responseMimeType: 'application/json', // Attempting to force JSON structure if model supports it, though flash might not
            }
        });

        console.log('✅ Response Received');
        // Adjust for different SDK versions/response structures
        const text = typeof result.text === 'function' ? result.text() :
            (result.response && typeof result.response.text === 'function') ? result.response.text() :
                JSON.stringify(result);
        console.log('📄 Raw Text Output:');
        console.log(text.substring(0, 500) + '...'); // Log start

        console.log('\n--- Analysis ---');

        // Quick Regex check for parentId
        const parentIdMatches = text.match(/parentId/gi);
        console.log('🔍 "parentId" occurrences:', parentIdMatches ? parentIdMatches.length : 0);

        // Try to find if the specific IDs are used as values
        const id1Match = text.includes('id-1');
        console.log('🔍 "id-1" found in response:', id1Match);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testPrompt();
