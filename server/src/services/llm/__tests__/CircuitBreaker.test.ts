/**
 * Circuit Breaker Unit Tests
 */
import { describe, it, expect, beforeEach} from 'vitest';
import { CircuitBreaker, CircuitState } from '../CircuitBreaker';

describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({
            failureThreshold: 3,
            successThreshold: 2,
            timeout: 1000,
            resetTimeout: 5000,
        });
    });

    describe('initial state', () => {
        it('should start in CLOSED state', () => {
            expect(breaker.getState('test-provider')).toBe(CircuitState.CLOSED);
        });

        it('should allow requests when closed', () => {
            expect(breaker.canRequest('test-provider')).toBe(true);
        });
    });

    describe('failure handling', () => {
        it('should open circuit after failure threshold', () => {
            const provider = 'failing-provider';

            breaker.recordFailure(provider);
            breaker.recordFailure(provider);
            expect(breaker.getState(provider)).toBe(CircuitState.CLOSED);

            breaker.recordFailure(provider);
            expect(breaker.getState(provider)).toBe(CircuitState.OPEN);
        });

        it('should block requests when open', () => {
            const provider = 'open-provider';

            for (let i = 0; i < 3; i++) {
                breaker.recordFailure(provider);
            }

            expect(breaker.canRequest(provider)).toBe(false);
        });
    });

    describe('recovery', () => {
        it('should transition to half-open after timeout', async () => {
            const provider = 'recovering-provider';

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                breaker.recordFailure(provider);
            }
            expect(breaker.getState(provider)).toBe(CircuitState.OPEN);

            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Should be allowed now (half-open)
            expect(breaker.canRequest(provider)).toBe(true);
            expect(breaker.getState(provider)).toBe(CircuitState.HALF_OPEN);
        });

        it('should close after success threshold in half-open', async () => {
            const provider = 'closing-provider';

            // Open and wait for half-open
            for (let i = 0; i < 3; i++) {
                breaker.recordFailure(provider);
            }
            await new Promise(resolve => setTimeout(resolve, 1100));
            breaker.canRequest(provider); // Triggers transition to half-open

            // Record successes
            breaker.recordSuccess(provider);
            breaker.recordSuccess(provider);

            expect(breaker.getState(provider)).toBe(CircuitState.CLOSED);
        });
    });

    describe('execute method', () => {
        it('should execute function when circuit closed', async () => {
            const result = await breaker.execute(
                'test-provider',
                async () => 'success'
            );

            expect(result).toBe('success');
        });

        it('should record success on successful execution', async () => {
            await breaker.execute('test-provider', async () => 'ok');

            const stats = breaker.getAllStats();
            expect(stats['test-provider'].successes).toBeGreaterThan(0);
        });

        it('should use fallback when circuit is open', async () => {
            const provider = 'fallback-test';

            // Open circuit
            for (let i = 0; i < 3; i++) {
                breaker.recordFailure(provider);
            }

            const result = await breaker.execute(
                provider,
                async () => 'primary',
                async () => 'fallback'
            );

            expect(result).toBe('fallback');
        });

        it('should throw if circuit open and no fallback', async () => {
            const provider = 'no-fallback-test';

            for (let i = 0; i < 3; i++) {
                breaker.recordFailure(provider);
            }

            await expect(
                breaker.execute(provider, async () => 'should-not-run')
            ).rejects.toThrow('Circuit breaker OPEN');
        });
    });

    describe('reset', () => {
        it('should reset single provider', () => {
            const provider = 'reset-test';

            for (let i = 0; i < 3; i++) {
                breaker.recordFailure(provider);
            }
            expect(breaker.getState(provider)).toBe(CircuitState.OPEN);

            breaker.reset(provider);
            expect(breaker.getState(provider)).toBe(CircuitState.CLOSED);
        });

        it('should reset all providers', () => {
            for (let i = 0; i < 3; i++) {
                breaker.recordFailure('provider-1');
                breaker.recordFailure('provider-2');
            }

            breaker.resetAll();

            expect(breaker.getState('provider-1')).toBe(CircuitState.CLOSED);
            expect(breaker.getState('provider-2')).toBe(CircuitState.CLOSED);
        });
    });
});
