/**
 * Circuit Breaker Pattern for LLM Providers
 * Prevents cascading failures by temporarily blocking requests to failing providers
 */

export enum CircuitState {
    CLOSED = 'CLOSED',     // Normal operation
    OPEN = 'OPEN',         // Blocking requests
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

interface CircuitBreakerConfig {
    failureThreshold: number;    // Failures before opening circuit
    successThreshold: number;    // Successes in half-open to close
    timeout: number;             // MS before trying again after open
    resetTimeout: number;        // MS to reset failure count
}

interface CircuitStats {
    failures: number;
    successes: number;
    lastFailure: number;
    lastSuccess: number;
    state: CircuitState;
    openedAt: number | null;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,      // 30 seconds
    resetTimeout: 60000, // 1 minute
};

export class CircuitBreaker {
    private circuits: Map<string, CircuitStats> = new Map();
    private config: CircuitBreakerConfig;

    constructor(config: Partial<CircuitBreakerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get or create circuit stats for a provider
     */
    private getCircuit(provider: string): CircuitStats {
        if (!this.circuits.has(provider)) {
            this.circuits.set(provider, {
                failures: 0,
                successes: 0,
                lastFailure: 0,
                lastSuccess: 0,
                state: CircuitState.CLOSED,
                openedAt: null,
            });
        }
        return this.circuits.get(provider)!;
    }

    /**
     * Check if requests should be allowed to the provider
     */
    canRequest(provider: string): boolean {
        const circuit = this.getCircuit(provider);
        const now = Date.now();

        // Check if we should reset failure count
        if (circuit.lastFailure && now - circuit.lastFailure > this.config.resetTimeout) {
            circuit.failures = 0;
        }

        switch (circuit.state) {
            case CircuitState.CLOSED:
                return true;

            case CircuitState.OPEN:
                // Check if timeout has passed
                if (circuit.openedAt && now - circuit.openedAt > this.config.timeout) {
                    circuit.state = CircuitState.HALF_OPEN;
                    circuit.successes = 0;
                    return true;
                }
                return false;

            case CircuitState.HALF_OPEN:
                return true;

            default:
                return true;
        }
    }

    /**
     * Record a successful request
     */
    recordSuccess(provider: string): void {
        const circuit = this.getCircuit(provider);
        circuit.lastSuccess = Date.now();
        circuit.successes++;

        if (circuit.state === CircuitState.HALF_OPEN) {
            if (circuit.successes >= this.config.successThreshold) {
                circuit.state = CircuitState.CLOSED;
                circuit.failures = 0;
                circuit.openedAt = null;
            }
        } else {
            // Reset failures on success in closed state
            circuit.failures = 0;
        }
    }

    /**
     * Record a failed request
     */
    recordFailure(provider: string, _error?: Error): void {
        const circuit = this.getCircuit(provider);
        const now = Date.now();

        circuit.failures++;
        circuit.lastFailure = now;

        if (circuit.state === CircuitState.HALF_OPEN) {
            // Any failure in half-open immediately opens circuit
            circuit.state = CircuitState.OPEN;
            circuit.openedAt = now;
        } else if (circuit.failures >= this.config.failureThreshold) {
            circuit.state = CircuitState.OPEN;
            circuit.openedAt = now;
        }
    }

    /**
     * Get current state of a provider's circuit
     */
    getState(provider: string): CircuitState {
        return this.getCircuit(provider).state;
    }

    /**
     * Get all provider stats
     */
    getAllStats(): Record<string, CircuitStats> {
        const stats: Record<string, CircuitStats> = {};
        this.circuits.forEach((value, key) => {
            stats[key] = { ...value };
        });
        return stats;
    }

    /**
     * Force reset a provider's circuit
     */
    reset(provider: string): void {
        this.circuits.delete(provider);
    }

    /**
     * Reset all circuits
     */
    resetAll(): void {
        this.circuits.clear();
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute<T>(
        provider: string,
        fn: () => Promise<T>,
        fallback?: () => Promise<T>
    ): Promise<T> {
        if (!this.canRequest(provider)) {
            if (fallback) {
                return fallback();
            }
            throw new Error(`Circuit breaker OPEN for provider: ${provider}`);
        }

        try {
            const result = await fn();
            this.recordSuccess(provider);
            return result;
        } catch (error: unknown) {
            this.recordFailure(provider, error instanceof Error ? error : undefined);

            if (fallback && this.getState(provider) === CircuitState.OPEN) {
                return fallback();
            }
            throw error;
        }
    }
}

// Singleton instance for LLM providers
export const llmCircuitBreaker = new CircuitBreaker({
    failureThreshold: 3,    // Open after 3 failures
    successThreshold: 2,    // Close after 2 successes
    timeout: 30000,         // 30 seconds before retry
    resetTimeout: 120000,   // 2 minutes to reset failure count
});
