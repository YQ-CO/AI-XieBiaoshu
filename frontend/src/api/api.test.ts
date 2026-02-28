import axios from 'axios';

import { login, me } from './auth';
import { recharge, myOrders, requestInvoice } from './orders';
import {
  createDocument,
  updateDocument,
  myDocuments,
  documentDetail,
  submitDocument,
  exportWordDocument
} from './documents';
import {
  createEnterprise,
  joinEnterprise,
  myEnterprises,
  enterpriseMembers,
  updateEnterpriseRole,
  switchEnterprise
} from './enterprise';
import { generateText, getModelOptions, startGenerateTask, getGenerateTask } from './model';
import { uploadFile } from './parse';
import {
  getAdminConfig,
  updateAdminConfig,
  getModelProviders,
  getAdminDashboard,
  getAdminEnterprises,
  getAdminOrders,
  getAdminOrdersFiltered,
  reviewInvoice,
  getInvoiceRejectReasons,
  exportInvoiceLedgerCsv,
  getAdminUsers,
  disableAdminUser,
  enableAdminUser
} from './admin';

vi.mock('axios');

const mockedAxios = vi.mocked(axios, true);

describe('frontend api wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls auth endpoints with expected payload and headers', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { token: 't1' } } as any);
    mockedAxios.get.mockResolvedValueOnce({ data: { id: 'u1' } } as any);

    const tokenData = await login({ type: 'password', username: 'tester', password: 'pwd' });
    const userData = await me('t1');

    expect(tokenData).toEqual({ token: 't1' });
    expect(userData).toEqual({ id: 'u1' });
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/auth/login', {
      type: 'password',
      username: 'tester',
      password: 'pwd'
    });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/users/me', {
      headers: { Authorization: 'Bearer t1' }
    });
  });

  it('calls order endpoints with bearer token', async () => {
    mockedAxios.post.mockResolvedValue({ data: { ok: true } } as any);
    mockedAxios.get.mockResolvedValue({ data: [{ id: 'o1' }] } as any);

    await recharge({ amount: 99, enterpriseId: 'ent-1' }, 'token-1');
    await requestInvoice({ orderId: 'o1', type: 'normal' }, 'token-1');
    const data = await myOrders('token-1');

    expect(data).toEqual([{ id: 'o1' }]);
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      '/api/orders/recharge',
      { amount: 99, enterpriseId: 'ent-1' },
      { headers: { Authorization: 'Bearer token-1' } }
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      '/api/orders/invoice',
      { orderId: 'o1', type: 'normal' },
      { headers: { Authorization: 'Bearer token-1' } }
    );
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/orders/my', {
      headers: { Authorization: 'Bearer token-1' }
    });
  });

  it('calls document endpoints and triggers word export download', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'doc-1' } } as any)
      .mockResolvedValueOnce({ data: { id: 'doc-1', content: 'hello' } } as any)
      .mockResolvedValueOnce({ data: { id: 'doc-1', status: 'submitted' } } as any);
    mockedAxios.get
      .mockResolvedValueOnce({ data: [{ id: 'doc-1' }] } as any)
      .mockResolvedValueOnce({ data: { id: 'doc-1', content: 'hello' } } as any)
      .mockResolvedValueOnce({ data: new Uint8Array([1, 2, 3]) } as any);

    await createDocument({ name: 'n1', type: 'special' }, 'token-2');
    await updateDocument({ id: 'doc-1', content: 'hello' }, 'token-2');
    await myDocuments('token-2');
    await documentDetail('doc-1', 'token-2');
    await submitDocument('doc-1', 'token-2');

    const createUrlSpy = vi.fn(() => 'blob:mock');
    const revokeUrlSpy = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createUrlSpy
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeUrlSpy
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportWordDocument('doc-1', 'token-2');

    expect(mockedAxios.get).toHaveBeenLastCalledWith('/api/documents/export/word', {
      params: { id: 'doc-1' },
      headers: { Authorization: 'Bearer token-2' },
      responseType: 'blob'
    });
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock');

    clickSpy.mockRestore();
  });

  it('calls enterprise endpoints with expected payload and headers', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'ent-1' } } as any)
      .mockResolvedValueOnce({ data: { success: true } } as any)
      .mockResolvedValueOnce({ data: { enterpriseId: 'ent-1', userId: 'u2', role: 'admin' } } as any)
      .mockResolvedValueOnce({ data: { enterprise: { id: 'ent-1' } } } as any);
    mockedAxios.get
      .mockResolvedValueOnce({ data: [{ id: 'ent-1' }] } as any)
      .mockResolvedValueOnce({ data: { members: [{ userId: 'u1', role: 'owner' }] } } as any);

    await createEnterprise({ name: '测试企业A', creditCode: '9135' }, 'token-3');
    await joinEnterprise({ inviteCode: 'INV123' }, 'token-3');
    await myEnterprises('token-3');
    await enterpriseMembers('ent-1', 'token-3');
    await updateEnterpriseRole({ enterpriseId: 'ent-1', userId: 'u2', role: 'admin' }, 'token-3');
    await switchEnterprise({ enterpriseId: 'ent-1' }, 'token-3');

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      '/api/enterprise/create',
      { name: '测试企业A', creditCode: '9135' },
      { headers: { Authorization: 'Bearer token-3' } }
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      '/api/enterprise/join',
      { inviteCode: 'INV123' },
      { headers: { Authorization: 'Bearer token-3' } }
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, '/api/enterprise/my', {
      headers: { Authorization: 'Bearer token-3' }
    });
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2, '/api/enterprise/members', {
      params: { enterpriseId: 'ent-1' },
      headers: { Authorization: 'Bearer token-3' }
    });
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      3,
      '/api/enterprise/role/update',
      { enterpriseId: 'ent-1', userId: 'u2', role: 'admin' },
      { headers: { Authorization: 'Bearer token-3' } }
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      4,
      '/api/users/switch',
      { enterpriseId: 'ent-1' },
      { headers: { Authorization: 'Bearer token-3' } }
    );
  });

  it('calls model endpoints and encodes task id', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { text: 'ok' } } as any)
      .mockResolvedValueOnce({ data: { id: 'task-1' } } as any);
    mockedAxios.get
      .mockResolvedValueOnce({ data: { choices: [] } } as any)
      .mockResolvedValueOnce({ data: { id: 'task-1', status: 'success' } } as any);

    await generateText({ prompt: '写一段' }, 'token-4');
    await getModelOptions('token-4');
    await startGenerateTask({ prompt: '任务提示词' }, 'token-4');
    await getGenerateTask('task/a b', 'token-4');

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      '/api/model/generate',
      { prompt: '写一段' },
      { headers: { Authorization: 'Bearer token-4' } }
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, '/api/model/options', {
      headers: { Authorization: 'Bearer token-4' }
    });
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      '/api/model/generate/task',
      { prompt: '任务提示词' },
      { headers: { Authorization: 'Bearer token-4' } }
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2, '/api/model/generate/task/task%2Fa%20b', {
      headers: { Authorization: 'Bearer token-4' }
    });
  });

  it('uploads parse file with multipart form data', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { fileName: 'a.txt' } } as any);
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });

    await uploadFile(file, 'token-5');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/parse/upload',
      expect.any(FormData),
      {
        headers: {
          Authorization: 'Bearer token-5',
          'Content-Type': 'multipart/form-data'
        }
      }
    );
  });

  it('calls admin endpoints for platform and enterprise scopes', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { model: {} } } as any)
      .mockResolvedValueOnce({ data: [{ id: 'openai_compatible' }] } as any)
      .mockResolvedValueOnce({ data: { scope: 'platform' } } as any)
      .mockResolvedValueOnce({ data: [{ id: 'ent-1' }] } as any)
      .mockResolvedValueOnce({ data: [{ id: 'o1' }] } as any)
      .mockResolvedValueOnce({ data: [{ id: 'o2' }] } as any)
      .mockResolvedValueOnce({ data: [{ code: 'company_info_invalid' }] } as any)
      .mockResolvedValueOnce({ data: [{ id: 'u1' }] } as any)
      .mockResolvedValueOnce({
        data: new Uint8Array([1, 2, 3]),
        headers: { 'content-disposition': 'attachment; filename="invoice-ledger.csv"' }
      } as any)
      .mockResolvedValueOnce({ data: [{ id: 'o3' }] } as any);
    mockedAxios.post
      .mockResolvedValueOnce({ data: { success: true } } as any)
      .mockResolvedValueOnce({ data: { success: true } } as any)
      .mockResolvedValueOnce({ data: { success: true } } as any)
      .mockResolvedValueOnce({ data: { success: true } } as any);

    const createUrlSpy = vi.fn(() => 'blob:csv');
    const revokeUrlSpy = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createUrlSpy
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeUrlSpy
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    const platformAuth = { mode: 'platform' as const, adminToken: 'admin-secret' };
    const enterpriseAuth = { mode: 'enterprise' as const, userToken: 'user-t', enterpriseId: 'ent-1' };

    await getAdminConfig(platformAuth);
    await updateAdminConfig({ model: { timeoutMs: 30000 } }, platformAuth);
    await getModelProviders(platformAuth);
    await getAdminDashboard(platformAuth);
    await getAdminEnterprises(platformAuth);
    await getAdminOrders(platformAuth);
    await getAdminOrdersFiltered(platformAuth, { enterpriseId: 'ent-1', invoiceType: 'special', invoiceStatus: 'pending' });
    await getInvoiceRejectReasons(platformAuth);
    await getAdminUsers(platformAuth);
    await reviewInvoice({ orderId: 'o1', status: 'approved' }, platformAuth);
    await disableAdminUser({ userId: 'u1', reason: 'risk' }, platformAuth);
    await enableAdminUser({ userId: 'u1' }, platformAuth);
    const exportResult = await exportInvoiceLedgerCsv(platformAuth, { invoiceStatus: 'pending' });
    await getAdminOrders(enterpriseAuth);

    expect(exportResult).toBe(true);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, '/api/admin/config', {
      headers: { 'x-admin-token': 'admin-secret' }
    });
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      '/api/admin/config',
      { model: { timeoutMs: 30000 } },
      { headers: { 'x-admin-token': 'admin-secret' } }
    );
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/admin/orders', {
      headers: { 'x-admin-token': 'admin-secret' }
    });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/admin/orders', {
      headers: { 'x-admin-token': 'admin-secret' },
      params: { enterpriseId: 'ent-1', invoiceType: 'special', invoiceStatus: 'pending' }
    });
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      '/api/admin/orders/invoice/review',
      { orderId: 'o1', status: 'approved' },
      { headers: { 'x-admin-token': 'admin-secret' } }
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      3,
      '/api/admin/users/disable',
      { userId: 'u1', reason: 'risk' },
      { headers: { 'x-admin-token': 'admin-secret' } }
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      4,
      '/api/admin/users/enable',
      { userId: 'u1' },
      { headers: { 'x-admin-token': 'admin-secret' } }
    );
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/admin/orders/invoice/ledger/export', {
      headers: { 'x-admin-token': 'admin-secret' },
      params: { invoiceStatus: 'pending' },
      responseType: 'blob'
    });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/admin/orders', {
      headers: {
        Authorization: 'Bearer user-t',
        'x-enterprise-id': 'ent-1'
      }
    });
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect((appendSpy.mock.calls[0][0] as HTMLAnchorElement).download).toBe('invoice-ledger.csv');
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:csv');

    appendSpy.mockRestore();
    clickSpy.mockRestore();
  });
});