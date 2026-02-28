import { describe, expect, it } from 'vitest';
import { normalizeModelConfig, validateModelConfig } from '../../src/lib/modelConfig';

describe('modelConfig lib', () => {
  it('normalizes default values', () => {
    const cfg = normalizeModelConfig({});
    expect(cfg.mode).toBe('mock');
    expect(cfg.maxPromptLength).toBe(4000);
  });

  it('rejects invalid mode', () => {
    const result = validateModelConfig({ mode: 'unknown' });
    expect(result.valid).toBe(false);
  });

  it('validates openai compatible model presence', () => {
    const result = validateModelConfig({ mode: 'openai_compatible' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('model is required');
  });
});
