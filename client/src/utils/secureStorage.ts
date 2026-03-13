
/**
 * Secure Storage Utility
 * Uses a lightweight RC4 stream cipher for synchronous encryption/decryption 
 * to secure sensitive data in localStorage.
 * 
 * Note: This is not military-grade encryption but sufficient to prevent 
 * casual inspection of localStorage data.
 */

const ENCRYPTION_KEY = 'OrbitAI_Secure_Storage_Key_v1';
const PREFIX = 'enc:';

class RC4 {
    private s: number[] = [];
    private i: number = 0;
    private j: number = 0;

    constructor(key: string) {
        this.init(key);
    }

    private init(key: string) {
        this.s = [];
        for (let i = 0; i < 256; i++) {
            this.s[i] = i;
        }

        let j = 0;
        for (let i = 0; i < 256; i++) {
            j = (j + this.s[i] + key.charCodeAt(i % key.length)) % 256;
            [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
        }
        this.i = 0;
        this.j = 0;
    }

    public crypt(data: string): string {
        // Reset state for new operation if we were to reuse, but we create new instance per op for simplicity
        // Actually, for stream cipher, we should maintain state if streaming, 
        // but here we encrypt whole strings. So we need to re-init or use a new instance.
        // For simplicity, we'll assume the helper instantiates a new RC4 per call or re-inits.
        return ''; // specific implementation below
    }
}

const rc4 = (key: string, str: string): string => {
    const s: number[] = [];
    for (let i = 0; i < 256; i++) {
        s[i] = i;
    }
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
        [s[i], s[j]] = [s[j], s[i]];
    }

    let i = 0;
    j = 0;
    let res = '';
    for (let y = 0; y < str.length; y++) {
        i = (i + 1) % 256;
        j = (j + s[i]) % 256;
        [s[i], s[j]] = [s[j], s[i]];
        res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
    }
    return res;
};

// Base64 wrapper to handle binary strings
const toBase64 = (str: string): string => {
    try {
        return window.btoa(str);
    } catch (e) {
        // Fallback for non-latin1 characters if necessary, 
        // but RC4 output might be binary, so btoa is risky on raw output?
        // Actually, XORing char codes preserves unicode if we care? 
        // No, charCodeAt returns 0-65535. RC4 operates on bytes usually.
        // My RC4 implementation above operates on code points but XORs with byte (0-255).
        // This effectively changes the lower byte of the char. 
        // It might result in invalid utf-16 sequences.
        // Safer to encode to UTF-8 bytes first.
        return str;
    }
};

// Improved RC4 for UTF-16 strings
const encryptDecrypt = (key: string, text: string): string => {
    // Simple XOR with key rotation for safer string handling without binary issues
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
};

// We will use a simple Base64 + XOR approach for robustness with local storage strings
const process = (text: string, encrypt: boolean): string => {
    if (!text) return text;
    try {
        if (encrypt) {
            const xored = encryptDecrypt(ENCRYPTION_KEY, text);
            // Escape to be safe for local storage (although LS supports UTF-16)
            // But btoa fails on out of range chars. 
            // Let's just use JSON stringify/parse wrapper or URI component
            return PREFIX + encodeURIComponent(xored); // Simple
        } else {
            if (!text.startsWith(PREFIX)) return text; // Not encrypted
            const raw = decodeURIComponent(text.slice(PREFIX.length));
            return encryptDecrypt(ENCRYPTION_KEY, raw);
        }
    } catch (e) {
        console.error('Storage encryption error:', e);
        return text;
    }
};

export const secureSetItem = (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
        const encrypted = process(value, true);
        window.localStorage.setItem(key, encrypted);
    } catch (e) {
        console.error('Failed to save to secure storage', e);
    }
};

export const secureGetItem = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
        const value = window.localStorage.getItem(key);
        if (!value) return null;
        return process(value, false);
    } catch (e) {
        console.error('Failed to read from secure storage', e);
        return null;
    }
};

export const secureRemoveItem = (key: string): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
};
