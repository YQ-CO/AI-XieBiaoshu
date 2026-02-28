import { mount, flushPromises } from '@vue/test-utils';
import axios from 'axios';

import Login from './Login.vue';
import Orders from './Orders.vue';
import Account from './Account.vue';
import Parse from './Parse.vue';
import MyDocuments from './MyDocuments.vue';
import AdminBms from './AdminBms.vue';
import AdminModel from './AdminModel.vue';
import { myOrders, recharge, requestInvoice } from '../api/orders';
import {
  createEnterprise,
  myEnterprises,
  enterpriseMembers,
  switchEnterprise
} from '../api/enterprise';
import { uploadFile } from '../api/parse';
import { myDocuments as fetchMyDocuments } from '../api/documents';
import {
  getAdminConfig,
  getModelProviders,
  updateAdminConfig,
  getAdminDashboard,
  getAdminEnterprises,
  getAdminOrdersFiltered,
  getInvoiceRejectReasons,
  getAdminUsers
} from '../api/admin';

vi.mock('axios');
vi.mock('../api/orders', () => ({
  myOrders: vi.fn(),
  recharge: vi.fn(),
  requestInvoice: vi.fn()
}));
vi.mock('../api/enterprise', () => ({
  createEnterprise: vi.fn(),
  joinEnterprise: vi.fn(),
  myEnterprises: vi.fn(),
  enterpriseMembers: vi.fn(),
  updateEnterpriseRole: vi.fn(),
  switchEnterprise: vi.fn()
}));
vi.mock('../api/parse', () => ({
  uploadFile: vi.fn()
}));
vi.mock('../api/documents', () => ({
  myDocuments: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  documentDetail: vi.fn(),
  submitDocument: vi.fn(),
  exportWordDocument: vi.fn()
}));
vi.mock('../api/admin', () => ({
  disableAdminUser: vi.fn(),
  enableAdminUser: vi.fn(),
  getAdminConfig: vi.fn(),
  getModelProviders: vi.fn(),
  updateAdminConfig: vi.fn(),
  getAdminDashboard: vi.fn(),
  getAdminEnterprises: vi.fn(),
  getAdminOrdersFiltered: vi.fn(),
  getInvoiceRejectReasons: vi.fn(),
  getAdminUsers: vi.fn(),
  exportInvoiceLedgerCsv: vi.fn(),
  reviewInvoice: vi.fn()
}));

const mockedAxios = vi.mocked(axios, true);
const mockedMyOrders = vi.mocked(myOrders);
const mockedRecharge = vi.mocked(recharge);
const mockedRequestInvoice = vi.mocked(requestInvoice);
const mockedCreateEnterprise = vi.mocked(createEnterprise);
const mockedMyEnterprises = vi.mocked(myEnterprises);
const mockedEnterpriseMembers = vi.mocked(enterpriseMembers);
const mockedSwitchEnterprise = vi.mocked(switchEnterprise);
const mockedUploadFile = vi.mocked(uploadFile);
const mockedMyDocumentsApi = vi.mocked(fetchMyDocuments);
const mockedGetAdminConfig = vi.mocked(getAdminConfig);
const mockedGetModelProviders = vi.mocked(getModelProviders);
const mockedUpdateAdminConfig = vi.mocked(updateAdminConfig);
const mockedGetAdminDashboard = vi.mocked(getAdminDashboard);
const mockedGetAdminEnterprises = vi.mocked(getAdminEnterprises);
const mockedGetAdminOrdersFiltered = vi.mocked(getAdminOrdersFiltered);
const mockedGetInvoiceRejectReasons = vi.mocked(getInvoiceRejectReasons);
const mockedGetAdminUsers = vi.mocked(getAdminUsers);

describe('Login page state logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('fills mock verification code after sendCode', async () => {
    const wrapper = mount(Login);
    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');

    expect((wrapper.vm as any).code).toBe('123456');
    expect((wrapper.vm as any).debug).toContain('已发送假验证码');
  });

  it('shows failure message when login api rejects', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { error: 'invalid credentials' } }
    } as any);

    const wrapper = mount(Login);
    (wrapper.vm as any).mobile = '13800000000';
    (wrapper.vm as any).code = '123456';

    const buttons = wrapper.findAll('button');
    await buttons[1].trigger('click');
    await flushPromises();

    expect((wrapper.vm as any).debug).toContain('登录失败');
    expect((wrapper.vm as any).debug).toContain('invalid credentials');
  });
});

describe('Orders page state logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'token-1');
    localStorage.setItem('enterpriseId', 'ent-1');
  });

  it('loads orders on mount and refreshes after recharge', async () => {
    mockedMyOrders
      .mockResolvedValueOnce([{ id: 'o1', amount: 100, createdAt: 'now', invoiceRequested: false }] as any)
      .mockResolvedValueOnce([{ id: 'o2', amount: 200, createdAt: 'later', invoiceRequested: false }] as any);
    mockedRecharge.mockResolvedValueOnce({ id: 'o2' } as any);

    const wrapper = mount(Orders);
    await flushPromises();

    expect(mockedMyOrders).toHaveBeenCalledTimes(1);
    expect((wrapper.vm as any).orders.length).toBe(1);

    (wrapper.vm as any).amount = 200;
    const rechargeButton = wrapper.find('button');
    await rechargeButton.trigger('click');
    await flushPromises();

    expect(mockedRecharge).toHaveBeenCalledWith({ amount: 200, enterpriseId: 'ent-1' }, 'token-1');
    expect(mockedMyOrders).toHaveBeenCalledTimes(2);
    expect((wrapper.vm as any).debug).toContain('充值成功');
  });

  it('submits invoice and closes invoice panel', async () => {
    mockedMyOrders
      .mockResolvedValueOnce([{ id: 'o1', amount: 100, createdAt: 'now', invoiceRequested: false }] as any)
      .mockResolvedValueOnce([{ id: 'o1', amount: 100, createdAt: 'now', invoiceRequested: true, invoiceStatus: 'pending' }] as any);
    mockedRequestInvoice.mockResolvedValueOnce({ ok: true } as any);

    const wrapper = mount(Orders);
    await flushPromises();

    (wrapper.vm as any).openInvoice('o1');
    (wrapper.vm as any).invoiceType = 'special';
    (wrapper.vm as any).invoiceInfo = { company: '测试企业A', code: '9133', contact: 'a@test.com' };

    await (wrapper.vm as any).submitInvoice();
    await flushPromises();

    expect(mockedRequestInvoice).toHaveBeenCalledWith(
      {
        orderId: 'o1',
        type: 'special',
        info: { company: '测试企业A', code: '9133', contact: 'a@test.com' }
      },
      'token-1'
    );
    expect((wrapper.vm as any).showInvoice).toBe(false);
    expect((wrapper.vm as any).debug).toContain('发票申请已提交');
  });
});

describe('Account page state logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'token-acc-1');
  });

  it('creates enterprise then refreshes list', async () => {
    mockedMyEnterprises
      .mockResolvedValueOnce([{ id: 'ent-1', name: '企业A' }] as any)
      .mockResolvedValueOnce([{ id: 'ent-1', name: '企业A' }, { id: 'ent-2', name: '企业B' }] as any);
    mockedCreateEnterprise.mockResolvedValueOnce({ id: 'ent-2' } as any);

    const wrapper = mount(Account);
    await flushPromises();

    (wrapper.vm as any).name = '企业B';
    (wrapper.vm as any).creditCode = '9135';
    await (wrapper.vm as any).create();
    await flushPromises();

    expect(mockedCreateEnterprise).toHaveBeenCalledWith({ name: '企业B', creditCode: '9135' }, 'token-acc-1');
    expect(mockedMyEnterprises).toHaveBeenCalledTimes(2);
    expect((wrapper.vm as any).debug).toContain('创建成功');
  });

  it('switches enterprise and loads members', async () => {
    mockedMyEnterprises.mockResolvedValueOnce([{ id: 'ent-1', name: '企业A' }] as any);
    mockedSwitchEnterprise.mockResolvedValueOnce({ enterprise: { id: 'ent-1' } } as any);
    mockedEnterpriseMembers.mockResolvedValueOnce({ members: [{ userId: 'u1', role: 'owner' }] } as any);

    const wrapper = mount(Account);
    await flushPromises();

    await (wrapper.vm as any).switchTo('ent-1');
    await flushPromises();

    expect(localStorage.getItem('enterpriseId')).toBe('ent-1');
    expect(mockedSwitchEnterprise).toHaveBeenCalledWith({ enterpriseId: 'ent-1' }, 'token-acc-1');
    expect(mockedEnterpriseMembers).toHaveBeenCalledWith('ent-1', 'token-acc-1');
    expect((wrapper.vm as any).members.length).toBe(1);
    expect((wrapper.vm as any).debug).toContain('切换成功');
  });
});

describe('Parse page state logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'token-parse-1');
  });

  it('uploads file and renders parse result', async () => {
    mockedUploadFile.mockResolvedValueOnce({
      fileName: '招标文件A.pdf',
      sections: [{ title: '项目概况', content: '内容A' }]
    } as any);

    const wrapper = mount(Parse);
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    await (wrapper.vm as any).onFileChange({ target: { files: [file] } } as any);
    await (wrapper.vm as any).submit();
    await flushPromises();

    expect(mockedUploadFile).toHaveBeenCalledWith(file, 'token-parse-1');
    expect((wrapper.vm as any).result.fileName).toBe('招标文件A.pdf');
    expect((wrapper.vm as any).debug).toBe('');
  });

  it('shows debug message when upload fails', async () => {
    mockedUploadFile.mockRejectedValueOnce({ response: { data: { error: 'bad file' } } } as any);

    const wrapper = mount(Parse);
    const file = new File(['oops'], 'b.txt', { type: 'text/plain' });
    await (wrapper.vm as any).onFileChange({ target: { files: [file] } } as any);
    await (wrapper.vm as any).submit();
    await flushPromises();

    expect((wrapper.vm as any).debug).toContain('解析失败');
    expect((wrapper.vm as any).debug).toContain('bad file');
  });
});

describe('MyDocuments page state logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'token-doc-1');
  });

  it('loads documents on mount and resolves edit links by type', async () => {
    mockedMyDocumentsApi.mockResolvedValueOnce([
      { id: 'd1', type: 'scoring', name: '评分文档' },
      { id: 'd2', type: 'directory', name: '目录文档' },
      { id: 'd3', type: 'special', name: '专项文档' }
    ] as any);

    const wrapper = mount(MyDocuments);
    await flushPromises();

    expect(mockedMyDocumentsApi).toHaveBeenCalledWith('token-doc-1');
    expect((wrapper.vm as any).docs.length).toBe(3);
    expect((wrapper.vm as any).editLink({ id: 'd1', type: 'scoring' })).toBe('/write/scoring?id=d1');
    expect((wrapper.vm as any).editLink({ id: 'd2', type: 'directory' })).toBe('/write/directory?id=d2');
    expect((wrapper.vm as any).editLink({ id: 'd3', type: 'special' })).toBe('/write/special?id=d3');
  });

  it('shows debug message when loading documents fails', async () => {
    mockedMyDocumentsApi.mockRejectedValueOnce({ response: { data: { error: 'unauthorized' } } } as any);

    const wrapper = mount(MyDocuments);
    await flushPromises();

    expect((wrapper.vm as any).debug).toContain('加载失败');
    expect((wrapper.vm as any).debug).toContain('unauthorized');
  });
});

describe('AdminBms page state logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('adminToken', 'admin-secret');
    localStorage.setItem('bmsScopeMode', 'platform');
  });

  it('loads dashboard/orders/users on mounted for platform mode', async () => {
    mockedGetAdminDashboard.mockResolvedValueOnce({ scope: 'platform', enterpriseCount: 2 } as any);
    mockedGetAdminEnterprises.mockResolvedValueOnce([{ id: 'ent-1', name: '企业A' }] as any);
    mockedGetAdminOrdersFiltered.mockResolvedValueOnce([{ id: 'o1', invoiceStatus: 'pending' }] as any);
    mockedGetAdminUsers.mockResolvedValueOnce([{ id: 'u1', disabled: false }] as any);
    mockedGetInvoiceRejectReasons.mockResolvedValueOnce([{ code: 'company_info_invalid', label: '企业信息不完整或不匹配' }] as any);

    const wrapper = mount(AdminBms);
    await flushPromises();

    expect(mockedGetAdminDashboard).toHaveBeenCalledTimes(1);
    expect(mockedGetAdminEnterprises).toHaveBeenCalledTimes(1);
    expect(mockedGetAdminOrdersFiltered).toHaveBeenCalledTimes(1);
    expect(mockedGetAdminUsers).toHaveBeenCalledTimes(1);
    expect((wrapper.vm as any).dashboard.enterpriseCount).toBe(2);
    expect((wrapper.vm as any).orders.length).toBe(1);
    expect((wrapper.vm as any).users.length).toBe(1);
    expect((wrapper.vm as any).debug).toContain('后台数据已刷新');
  });

  it('shows prompt when enterprise mode misses enterprise id', async () => {
    localStorage.setItem('bmsScopeMode', 'enterprise');

    const wrapper = mount(AdminBms);
    await flushPromises();

    expect((wrapper.vm as any).debug).toContain('企业管理员模式请填写企业ID');
    expect(mockedGetAdminDashboard).not.toHaveBeenCalled();
  });
});

describe('AdminModel page state logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('adminToken', 'admin-secret');
  });

  it('loads model config and provider templates on mounted', async () => {
    mockedGetAdminConfig.mockResolvedValueOnce({
      model: {
        mode: 'openai_compatible',
        provider: 'openai_compatible',
        apiName: '写标书',
        selectableModels: [{ id: 'm1', name: '模型1' }]
      }
    } as any);
    mockedGetModelProviders.mockResolvedValueOnce([{ provider: 'openai_compatible', template: { mode: 'openai_compatible' } }] as any);

    const wrapper = mount(AdminModel);
    await flushPromises();

    expect(mockedGetAdminConfig).toHaveBeenCalledWith('admin-secret');
    expect(mockedGetModelProviders).toHaveBeenCalledWith('admin-secret');
    expect((wrapper.vm as any).providers.length).toBe(1);
    expect((wrapper.vm as any).form.mode).toBe('openai_compatible');
    expect((wrapper.vm as any).debug).toContain('已加载当前配置和模板');
  });

  it('blocks invalid selectableModels json and saves valid config', async () => {
    mockedGetAdminConfig.mockResolvedValueOnce({ model: {} } as any);
    mockedGetModelProviders.mockResolvedValueOnce([] as any);
    mockedUpdateAdminConfig.mockResolvedValueOnce({
      config: {
        model: {
          mode: 'mock',
          selectableModels: [{ id: 'm2', name: '模型2' }]
        }
      }
    } as any);

    const wrapper = mount(AdminModel);
    await flushPromises();

    (wrapper.vm as any).selectableModelsText = '{bad json}';
    await (wrapper.vm as any).saveConfig();
    expect((wrapper.vm as any).debug).toContain('不是合法JSON');
    expect(mockedUpdateAdminConfig).not.toHaveBeenCalled();

    (wrapper.vm as any).selectableModelsText = '[{"id":"m2","name":"模型2"}]';
    await (wrapper.vm as any).saveConfig();
    expect(mockedUpdateAdminConfig).toHaveBeenCalledTimes(1);
    expect((wrapper.vm as any).debug).toContain('模型配置保存成功');
  });
});