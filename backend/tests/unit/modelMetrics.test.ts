import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getModelMetricsSummary, recordModelMetric } from '../../src/lib/modelMetrics';
import { restoreData, seedTestData, snapshotData } from '../helpers/dataSandbox';

describe('modelMetrics lib', () => {
  const snapshot = snapshotData();

  beforeEach(() => {
    seedTestData();
  });

  afterAll(() => {
    restoreData(snapshot);
  });

  it('aggregates success rate and average latency', () => {
    recordModelMetric({ durationMs: 100, success: true, mode: 'mock', apiName: 'm1' });
    recordModelMetric({ durationMs: 300, success: false, mode: 'mock', apiName: 'm1', errorCode: 'E1' });

    const summary = getModelMetricsSummary();
    expect(summary.total).toBe(2);
    expect(summary.success).toBe(1);
    expect(summary.failure).toBe(1);
    expect(summary.successRate).toBe(50);
    expect(summary.avgLatencyMs).toBe(200);
  });
});
