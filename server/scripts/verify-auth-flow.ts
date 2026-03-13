
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3002';
const EMAIL = 'superadmin@orbitai.com';
const PASSWORD = 'OrbitAI123!';

async function testAuthFlow() {
    console.log('🧪 Testing Authentication Flow...');

    try {
        // 1. Login
        console.log(`\n1. Attempting login for ${EMAIL}...`);
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });

        if (!loginRes.ok) {
            const text = await loginRes.text();
            throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText} - ${text}`);
        }

        const loginData = await loginRes.json();
        console.log('✅ Login successful!');

        if (!loginData.success || !loginData.data?.token) {
            throw new Error('Login response missing token');
        }

        const token = loginData.data.token;
        console.log(`🔑 Token received: ${token.substring(0, 20)}...`);

        // 2. Verify /me endpoint
        console.log('\n2. Verifying /api/auth/me with token...');
        const meRes = await fetch(`${API_URL}/api/auth/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!meRes.ok) {
            const text = await meRes.text();
            throw new Error(`/me request failed: ${meRes.status} ${meRes.statusText} - ${text}`);
        }

        const meData = await meRes.json();
        console.log('✅ /me verified successfully!');
        console.log('👤 User:', meData.data.user.email, `(${meData.data.user.role})`);

        console.log('\n✅ AUTHENTICATION SYSTEM IS WORKING CORRECTLY.');

    } catch (error: any) {
        console.error('\n❌ AUTHENTICATION TEST FAILED:');
        console.error(error.message);
        process.exit(1);
    }
}

testAuthFlow();
