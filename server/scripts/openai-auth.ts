import { loginOpenAICodex } from '@mariozechner/pi-ai/oauth';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

// Fallback logic to open URL in browser depending on OS
async function openUrl(url: string) {
  const { execSync } = await import('child_process');
  try {
    switch (process.platform) {
      case 'darwin':
        execSync(`open "${url}"`);
        break;
      case 'win32':
        execSync(`start "${url}"`);
        break;
      default:
        execSync(`xdg-open "${url}"`);
        break;
    }
  } catch (e) {
    // Ignore errors opening browser
  }
}

async function run() {
  console.log('=================================');
  console.log('🤖 OpenAI Codex Auth Configuration');
  console.log('=================================\n');

  try {
    const creds = await loginOpenAICodex({
      onAuth: async ({ url }: { url: string }) => {
        console.log('Opening browser for authentication...');
        console.log(`If your browser didn't open automatically, please click this URL:`);
        console.log(`\n👉 ${url}\n`);
        
        // Open the URL manually just in case
        await openUrl(url);
      },
      onPrompt: async ({ message }: { message: string, placeholder?: string }) => {
        console.log(`\n${message}`);
        const result = await question('Paste the final redirect URL (or just press Enter if it completes automatically): ');
        return result.trim();
      },
      onProgress: (msg) => {
        console.log(`[Status] ${msg}`);
      }
    });

    if (creds && creds.access) {
      console.log('\n✅ Successfully authenticated with OpenAI Codex!');
      
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Automatically update or add OPENAI_API_KEY
      if (envContent.includes('OPENAI_API_KEY=')) {
        envContent = envContent.replace(/OPENAI_API_KEY=.*/, `OPENAI_API_KEY="${creds.access}"`);
      } else {
        envContent += `\nOPENAI_API_KEY="${creds.access}"\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log(`\n🔑 Successfully saved API Key to server/.env under OPENAI_API_KEY.`);
      console.log(`⚠️ Please restart your backend server if it's currently running.`);
    } else {
      console.log('\n❌ Authentication failed or was cancelled.');
    }
  } catch (err: any) {
    if (err?.message?.includes('TLS')) {
        console.log(`\n❌ Environment preflight failed. Please make sure your machine trusts the certificate.`);
    }
    console.error('\nAn error occurred during authentication:', err);
  } finally {
    rl.close();
  }
}

run();
