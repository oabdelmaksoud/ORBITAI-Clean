import { describe, it, expect } from 'vitest';
import { pickFallbackModel, pickFallbackChain } from '../fallbackSelector.js';

const M = (provider: string, name = 'm') => ({ provider, name, modelIdentifier: `${provider}-id` });

describe('pickFallbackModel (resilience, dim 12)', () => {
  it('returns null for empty or invalid input', () => {
    expect(pickFallbackModel([])).toBeNull();
    expect(pickFallbackModel(undefined as any)).toBeNull();
  });

  it('prefers the configured default provider', () => {
    const r = pickFallbackModel([M('openai'), M('gemini'), M('anthropic')], {
      defaultProvider: 'anthropic',
    });
    expect(r?.provider).toBe('anthropic');
  });

  it('excludes the provider that just failed (real failover)', () => {
    const r = pickFallbackModel([M('openai'), M('gemini')], {
      defaultProvider: 'openai',
      excludeProvider: 'openai',
    });
    expect(r?.provider).toBe('gemini'); // openai excluded despite being the default
  });

  it('falls back to gemini, then first available, when default is unavailable', () => {
    expect(
      pickFallbackModel([M('grok'), M('gemini')], { defaultProvider: 'mistral' })?.provider
    ).toBe('gemini');
    expect(pickFallbackModel([M('grok'), M('mistral')], { defaultProvider: 'x' })?.provider).toBe(
      'grok'
    );
  });

  it('returns from the full list if excluding the failed provider leaves nothing', () => {
    const r = pickFallbackModel([M('openai')], { excludeProvider: 'openai' });
    expect(r?.provider).toBe('openai');
  });

  it('pickFallbackChain builds a deduped chain ordered default → gemini → rest', () => {
    const chain = pickFallbackChain([M('openai'), M('gemini'), M('anthropic'), M('openai')], {
      defaultProvider: 'anthropic',
    });
    expect(chain.map(m => m.provider)).toEqual(['anthropic', 'gemini', 'openai']);
  });

  it('pickFallbackChain excludes the failed provider and caps length', () => {
    const chain = pickFallbackChain([M('openai'), M('gemini'), M('grok')], {
      excludeProvider: 'openai',
      max: 2,
    });
    expect(chain.map(m => m.provider)).toEqual(['gemini', 'grok']);
  });

  it('pickFallbackChain returns [] for empty input', () => {
    expect(pickFallbackChain([])).toEqual([]);
  });
});
