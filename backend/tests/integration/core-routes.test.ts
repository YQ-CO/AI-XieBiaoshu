import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../../src/app';
import { restoreData, seedTestData, snapshotData } from '../helpers/dataSandbox';

const snapshot = snapshotData();

async function login(username = 'test_user') {
  const response = await request(app)
    .post('/auth/login')
    .send({ type: 'password', username, password: '123456' });

  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe('integration routes', () => {
  beforeEach(() => {
    seedTestData();
  });

  afterAll(() => {
    restoreData(snapshot);
  });

  it('supports login flow', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ type: 'password', username: 'test_user', password: 'pwd' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
  });

  it('supports recharge and list my orders', async () => {
    const token = await login();

    const createOrder = await request(app)
      .post('/orders/recharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 99, enterpriseId: 'ent-test-1' });

    expect(createOrder.status).toBe(200);
    expect(createOrder.body.amount).toBe(99);

    const listMine = await request(app)
      .get('/orders/my')
      .set('Authorization', `Bearer ${token}`);

    expect(listMine.status).toBe(200);
    expect(listMine.body.length).toBe(1);
  });

  it('supports special invoice review by admin', async () => {
    const token = await login();

    const createOrder = await request(app)
      .post('/orders/recharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 199, enterpriseId: 'ent-test-1' });

    const orderId = createOrder.body.id;
    const requestInvoice = await request(app)
      .post('/orders/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId, type: 'special', info: { company: '测试企业A' } });

    expect(requestInvoice.status).toBe(200);
    expect(requestInvoice.body.order.invoiceStatus).toBe('pending');

    const review = await request(app)
      .post('/admin/orders/invoice/review')
      .set('x-admin-token', 'admin-secret')
      .send({ orderId, status: 'approved' });

    expect(review.status).toBe(200);
    expect(review.body.order.invoiceStatus).toBe('approved');
  });

  it('supports model async task generation', async () => {
    const token = await login();

    const triggerTask = await request(app)
      .post('/model/generate/task')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: '测试提示词', docId: 'doc-1' });

    expect(triggerTask.status).toBe(200);
    expect(triggerTask.body.id).toBeTruthy();

    let statusResponse = await request(app)
      .get(`/model/generate/task/${triggerTask.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    for (let i = 0; i < 20 && ['queued', 'running'].includes(statusResponse.body.status); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      statusResponse = await request(app)
        .get(`/model/generate/task/${triggerTask.body.id}`)
        .set('Authorization', `Bearer ${token}`);
    }

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe('success');
    expect(String(statusResponse.body.text || '')).toContain('测试提示词');
  });

  it('exports invoice ledger as csv', async () => {
    const token = await login();

    const createOrder = await request(app)
      .post('/orders/recharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 20, enterpriseId: 'ent-test-1' });

    const orderId = createOrder.body.id;
    await request(app)
      .post('/orders/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId, type: 'normal', info: { title: '测试抬头' } });

    const response = await request(app)
      .get('/admin/orders/invoice/ledger/export')
      .set('x-admin-token', 'admin-secret');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('orderId,enterpriseId,userId');
  });

  it('exports document as word', async () => {
    const token = await login();

    const createDoc = await request(app)
      .post('/documents/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '测试文档', type: 'special', enterpriseId: 'ent-test-1' });

    expect(createDoc.status).toBe(200);
    expect(createDoc.body.id).toBeTruthy();

    const updateDoc = await request(app)
      .post('/documents/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: createDoc.body.id, content: '第一行\n第二行' });

    expect(updateDoc.status).toBe(200);

    const exportResp = await request(app)
      .get('/documents/export/word')
      .set('Authorization', `Bearer ${token}`)
      .query({ id: createDoc.body.id });

    expect(exportResp.status).toBe(200);
    expect(exportResp.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(String(exportResp.headers['content-disposition'] || '')).toContain('attachment;');
    expect(Number(exportResp.headers['content-length'] || 0)).toBeGreaterThan(0);
    expect((exportResp.text || '').length).toBeGreaterThan(0);
  });

  it('blocks ledger export without admin permission', async () => {
    const response = await request(app)
      .get('/admin/orders/invoice/ledger/export');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
  });

  it('blocks invoice review for normal user token', async () => {
    const token = await login();

    const createOrder = await request(app)
      .post('/orders/recharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 56, enterpriseId: 'ent-test-1' });

    expect(createOrder.status).toBe(200);

    const review = await request(app)
      .post('/admin/orders/invoice/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: createOrder.body.id, status: 'approved' });

    expect(review.status).toBe(403);
    expect(review.body.error).toBe('forbidden');
  });

  it('blocks admin orders list for normal user token', async () => {
    const token = await login();

    const response = await request(app)
      .get('/admin/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
  });
});
