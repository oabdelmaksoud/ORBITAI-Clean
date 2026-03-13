/**
 * Comprehensive Model Registry
 * 
 * Contains hardcoded model information for all major AI providers.
 * This data is used as a fallback when API keys are not configured,
 * and is updated with live data when available.
 * 
 * Pricing is in USD per 1M tokens.
 * Last updated: December 2024
 */

export interface ModelRegistryEntry {
    id: string;
    name: string;
    provider: string;
    modelIdentifier: string;
    description?: string;
    contextWindow: number;
    maxOutputTokens: number;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    releaseDate?: string;
    isDeprecated: boolean;
    deprecationDate?: string;
    capabilities: {
        vision: boolean;
        functionCalling: boolean;
        streaming: boolean;
        jsonMode: boolean;
        codeGeneration: boolean;
        reasoning: boolean;
        longContext: boolean;
        fastResponse: boolean;
    };
}

export interface ProviderInfo {
    id: string;
    name: string;
    description: string;
    website: string;
    apiDocsUrl: string;
    models: ModelRegistryEntry[];
}

// OpenAI Models
const OPENAI_MODELS: ModelRegistryEntry[] = [
    {
        id: 'openai-gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        modelIdentifier: 'gpt-4o',
        description: 'Most capable GPT-4 model with vision and faster responses',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        inputPricePerMillion: 2.50,
        outputPricePerMillion: 10.00,
        releaseDate: '2024-05-13',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'openai-gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        modelIdentifier: 'gpt-4o-mini',
        description: 'Affordable and capable model for lightweight tasks',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        inputPricePerMillion: 0.15,
        outputPricePerMillion: 0.60,
        releaseDate: '2024-07-18',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'openai-o1',
        name: 'o1',
        provider: 'openai',
        modelIdentifier: 'o1',
        description: 'Advanced reasoning model for complex problems',
        contextWindow: 200000,
        maxOutputTokens: 100000,
        inputPricePerMillion: 15.00,
        outputPricePerMillion: 60.00,
        releaseDate: '2024-12-05',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    },
    {
        id: 'openai-o1-mini',
        name: 'o1-mini',
        provider: 'openai',
        modelIdentifier: 'o1-mini',
        description: 'Faster reasoning model for coding and STEM',
        contextWindow: 128000,
        maxOutputTokens: 65536,
        inputPricePerMillion: 3.00,
        outputPricePerMillion: 12.00,
        releaseDate: '2024-09-12',
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: false,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    },
    {
        id: 'openai-o3-mini',
        name: 'o3-mini',
        provider: 'openai',
        modelIdentifier: 'o3-mini',
        description: 'Latest mini reasoning model',
        contextWindow: 200000,
        maxOutputTokens: 100000,
        inputPricePerMillion: 1.10,
        outputPricePerMillion: 4.40,
        releaseDate: '2025-01-31',
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'openai-gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        modelIdentifier: 'gpt-4-turbo',
        description: 'GPT-4 Turbo with vision',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputPricePerMillion: 10.00,
        outputPricePerMillion: 30.00,
        releaseDate: '2024-04-09',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    }
];

// Anthropic Models
const ANTHROPIC_MODELS: ModelRegistryEntry[] = [
    {
        id: 'anthropic-claude-sonnet-4',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        modelIdentifier: 'claude-sonnet-4-20250514',
        description: 'Latest Claude Sonnet with improved coding and reasoning',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        inputPricePerMillion: 3.00,
        outputPricePerMillion: 15.00,
        releaseDate: '2025-05-14',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'anthropic-claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        modelIdentifier: 'claude-3-5-sonnet-20241022',
        description: 'Best balance of intelligence and speed',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 3.00,
        outputPricePerMillion: 15.00,
        releaseDate: '2024-10-22',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'anthropic-claude-3.5-haiku',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        modelIdentifier: 'claude-3-5-haiku-20241022',
        description: 'Fastest Claude model, great for simple tasks',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.80,
        outputPricePerMillion: 4.00,
        releaseDate: '2024-10-22',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'anthropic-claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        modelIdentifier: 'claude-3-opus-20240229',
        description: 'Most capable Claude 3 model for complex tasks',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        inputPricePerMillion: 15.00,
        outputPricePerMillion: 75.00,
        releaseDate: '2024-02-29',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    }
];

// Google Gemini Models
const GEMINI_MODELS: ModelRegistryEntry[] = [
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'gemini',
        modelIdentifier: 'gemini-2.5-pro-preview-06-05',
        description: 'Most capable Gemini with deep thinking',
        contextWindow: 1000000,
        maxOutputTokens: 65536,
        inputPricePerMillion: 1.25,
        outputPricePerMillion: 10.00,
        releaseDate: '2025-06-05',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        modelIdentifier: 'gemini-2.5-flash-preview-05-20',
        description: 'Fastest Gemini with thinking capabilities',
        contextWindow: 1000000,
        maxOutputTokens: 65536,
        inputPricePerMillion: 0.15,
        outputPricePerMillion: 0.60,
        releaseDate: '2025-05-20',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'gemini',
        modelIdentifier: 'gemini-2.0-flash',
        description: 'Fast and capable multimodal model',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.10,
        outputPricePerMillion: 0.40,
        releaseDate: '2024-12-11',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        modelIdentifier: 'gemini-1.5-pro',
        description: 'Balanced Gemini for complex tasks',
        contextWindow: 2000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 1.25,
        outputPricePerMillion: 5.00,
        releaseDate: '2024-02-15',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    },
    {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        modelIdentifier: 'gemini-1.5-flash',
        description: 'Fast and efficient for lightweight tasks',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.075,
        outputPricePerMillion: 0.30,
        releaseDate: '2024-05-14',
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    }
];

// Groq Models
const GROQ_MODELS: ModelRegistryEntry[] = [
    {
        id: 'groq-llama-3.3-70b',
        name: 'Llama 3.3 70B',
        provider: 'groq',
        modelIdentifier: 'llama-3.3-70b-versatile',
        description: 'Fast inference of Llama 3.3 70B',
        contextWindow: 128000,
        maxOutputTokens: 32768,
        inputPricePerMillion: 0.59,
        outputPricePerMillion: 0.79,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'groq-llama-3.1-8b',
        name: 'Llama 3.1 8B Instant',
        provider: 'groq',
        modelIdentifier: 'llama-3.1-8b-instant',
        description: 'Ultra-fast small model',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.05,
        outputPricePerMillion: 0.08,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'groq-mixtral-8x7b',
        name: 'Mixtral 8x7B',
        provider: 'groq',
        modelIdentifier: 'mixtral-8x7b-32768',
        description: 'Fast Mixtral inference',
        contextWindow: 32768,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.24,
        outputPricePerMillion: 0.24,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: false,
            fastResponse: true
        }
    }
];

// Mistral Models
const MISTRAL_MODELS: ModelRegistryEntry[] = [
    {
        id: 'mistral-large',
        name: 'Mistral Large',
        provider: 'mistral',
        modelIdentifier: 'mistral-large-latest',
        description: 'Most capable Mistral model',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 2.00,
        outputPricePerMillion: 6.00,
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    },
    {
        id: 'mistral-small',
        name: 'Mistral Small',
        provider: 'mistral',
        modelIdentifier: 'mistral-small-latest',
        description: 'Fast and efficient Mistral model',
        contextWindow: 32000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.20,
        outputPricePerMillion: 0.60,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: false,
            fastResponse: true
        }
    },
    {
        id: 'mistral-codestral',
        name: 'Codestral',
        provider: 'mistral',
        modelIdentifier: 'codestral-latest',
        description: 'Specialized coding model',
        contextWindow: 32000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.20,
        outputPricePerMillion: 0.60,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: false,
            fastResponse: true
        }
    }
];

// DeepSeek Models
const DEEPSEEK_MODELS: ModelRegistryEntry[] = [
    {
        id: 'deepseek-v3',
        name: 'DeepSeek V3',
        provider: 'deepseek',
        modelIdentifier: 'deepseek-chat',
        description: 'Latest DeepSeek model, competitive with GPT-4',
        contextWindow: 64000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.14,
        outputPricePerMillion: 0.28,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        provider: 'deepseek',
        modelIdentifier: 'deepseek-coder',
        description: 'Specialized for coding tasks',
        contextWindow: 64000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.14,
        outputPricePerMillion: 0.28,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    },
    {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner (R1)',
        provider: 'deepseek',
        modelIdentifier: 'deepseek-reasoner',
        description: 'Advanced reasoning model',
        contextWindow: 64000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.55,
        outputPricePerMillion: 2.19,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: false,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    }
];

// Cohere Models
const COHERE_MODELS: ModelRegistryEntry[] = [
    {
        id: 'cohere-command-r-plus',
        name: 'Command R+',
        provider: 'cohere',
        modelIdentifier: 'command-r-plus',
        description: 'Most capable Command model for complex RAG',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputPricePerMillion: 2.50,
        outputPricePerMillion: 10.00,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    },
    {
        id: 'cohere-command-r',
        name: 'Command R',
        provider: 'cohere',
        modelIdentifier: 'command-r',
        description: 'Balanced model for RAG and tool use',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputPricePerMillion: 0.15,
        outputPricePerMillion: 0.60,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    }
];

// xAI Grok Models
const GROK_MODELS: ModelRegistryEntry[] = [
    {
        id: 'grok-2',
        name: 'Grok 2',
        provider: 'grok',
        modelIdentifier: 'grok-2-latest',
        description: 'Latest Grok model with advanced reasoning',
        contextWindow: 131072,
        maxOutputTokens: 8192,
        inputPricePerMillion: 2.00,
        outputPricePerMillion: 10.00,
        isDeprecated: false,
        capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: true,
            fastResponse: false
        }
    },
    {
        id: 'grok-2-mini',
        name: 'Grok 2 Mini',
        provider: 'grok',
        modelIdentifier: 'grok-2-mini',
        description: 'Faster version of Grok 2',
        contextWindow: 131072,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.30,
        outputPricePerMillion: 0.50,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    }
];

// Qwen Models
const QWEN_MODELS: ModelRegistryEntry[] = [
    {
        id: 'qwen-max',
        name: 'Qwen Max',
        provider: 'qwen',
        modelIdentifier: 'qwen-max',
        description: 'Most capable Qwen model',
        contextWindow: 32000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.40,
        outputPricePerMillion: 1.20,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: true,
            longContext: false,
            fastResponse: false
        }
    },
    {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
        provider: 'qwen',
        modelIdentifier: 'qwen-turbo',
        description: 'Fast and efficient Qwen model',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.05,
        outputPricePerMillion: 0.20,
        isDeprecated: false,
        capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
            jsonMode: true,
            codeGeneration: true,
            reasoning: false,
            longContext: true,
            fastResponse: true
        }
    }
];

// Provider Information Registry
export const PROVIDER_REGISTRY: ProviderInfo[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'Leading AI research company, creators of GPT-4 and ChatGPT',
        website: 'https://openai.com',
        apiDocsUrl: 'https://platform.openai.com/docs',
        models: OPENAI_MODELS
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'AI safety company, creators of Claude',
        website: 'https://anthropic.com',
        apiDocsUrl: 'https://docs.anthropic.com',
        models: ANTHROPIC_MODELS
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Google DeepMind\'s multimodal AI models',
        website: 'https://ai.google.dev',
        apiDocsUrl: 'https://ai.google.dev/docs',
        models: GEMINI_MODELS
    },
    {
        id: 'groq',
        name: 'Groq',
        description: 'Ultra-fast AI inference platform',
        website: 'https://groq.com',
        apiDocsUrl: 'https://console.groq.com/docs',
        models: GROQ_MODELS
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        description: 'European AI company with efficient open models',
        website: 'https://mistral.ai',
        apiDocsUrl: 'https://docs.mistral.ai',
        models: MISTRAL_MODELS
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'Advanced AI models with competitive pricing',
        website: 'https://deepseek.com',
        apiDocsUrl: 'https://platform.deepseek.com/docs',
        models: DEEPSEEK_MODELS
    },
    {
        id: 'cohere',
        name: 'Cohere',
        description: 'Enterprise AI platform specializing in RAG',
        website: 'https://cohere.com',
        apiDocsUrl: 'https://docs.cohere.com',
        models: COHERE_MODELS
    },
    {
        id: 'grok',
        name: 'xAI (Grok)',
        description: 'Elon Musk\'s AI company with Grok models',
        website: 'https://x.ai',
        apiDocsUrl: 'https://docs.x.ai',
        models: GROK_MODELS
    },
    {
        id: 'qwen',
        name: 'Alibaba Qwen',
        description: 'Alibaba\'s multilingual AI models',
        website: 'https://qwen.alibaba.com',
        apiDocsUrl: 'https://help.aliyun.com/document_detail/2400395.html',
        models: QWEN_MODELS
    }
];

// Helper functions
export function getAllModels(): ModelRegistryEntry[] {
    return PROVIDER_REGISTRY.flatMap(p => p.models);
}

export function getModelsByProvider(providerId: string): ModelRegistryEntry[] {
    const provider = PROVIDER_REGISTRY.find(p => p.id === providerId);
    return provider?.models || [];
}

export function getProviderInfo(providerId: string): ProviderInfo | undefined {
    return PROVIDER_REGISTRY.find(p => p.id === providerId);
}

export function getAllProviderIds(): string[] {
    return PROVIDER_REGISTRY.map(p => p.id);
}

export function getModelById(modelId: string): ModelRegistryEntry | undefined {
    return getAllModels().find(m => m.id === modelId || m.modelIdentifier === modelId);
}
