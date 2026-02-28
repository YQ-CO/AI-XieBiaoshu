import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createModelTask, getModelTask, updateModelTask } from '../../src/lib/modelTasks';
import { restoreData, seedTestData, snapshotData } from '../helpers/dataSandbox';

describe('modelTasks lib', () => {
  const snapshot = snapshotData();

  beforeEach(() => {
    seedTestData();
  });

  afterAll(() => {
    restoreData(snapshot);
  });

  it('creates and fetches task', () => {
    const task = createModelTask({ userId: 'u-task', promptLength: 12, docId: 'doc-1', modelChoice: 'default' });
    const saved = getModelTask(task.id);

    expect(saved?.userId).toBe('u-task');
    expect(saved?.status).toBe('queued');
  });

  it('updates task fields', () => {
    const task = createModelTask({ userId: 'u-task2', promptLength: 20 });
    const updated = updateModelTask(task.id, { status: 'running', startedAt: new Date().toISOString() });

    expect(updated?.status).toBe('running');
    expect(updated?.startedAt).toBeTruthy();
  });
});
