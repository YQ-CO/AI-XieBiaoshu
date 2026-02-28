import axios from 'axios';

type AdminAuth =
  | string
  | {
      mode: 'platform' | 'enterprise';
      adminToken?: string;
      userToken?: string;
      enterpriseId?: string;
    };

const adminHeaders = (auth: AdminAuth) => {
  if (typeof auth === 'string') return { 'x-admin-token': auth };
  if (auth.mode === 'platform') return { 'x-admin-token': auth.adminToken || '' };
  return {
    Authorization: `Bearer ${auth.userToken || ''}`,
    'x-enterprise-id': auth.enterpriseId || ''
  };
};

export const getAdminConfig = (auth: AdminAuth) =>
  axios.get('/api/admin/config', { headers: adminHeaders(auth) }).then(r => r.data);

export const updateAdminConfig = (payload: any, auth: AdminAuth) =>
  axios.post('/api/admin/config', payload, { headers: adminHeaders(auth) }).then(r => r.data);

export const getModelProviders = (auth: AdminAuth) =>
  axios.get('/api/admin/model/providers', { headers: adminHeaders(auth) }).then(r => r.data);

export const getAdminDashboard = (auth: AdminAuth) =>
  axios.get('/api/admin/dashboard', { headers: adminHeaders(auth) }).then(r => r.data);

export const getAdminEnterprises = (auth: AdminAuth) =>
  axios.get('/api/admin/enterprises', { headers: adminHeaders(auth) }).then(r => r.data);

export const getAdminOrders = (auth: AdminAuth) =>
  axios.get('/api/admin/orders', { headers: adminHeaders(auth) }).then(r => r.data);

export const getAdminOrdersFiltered = (
  auth: AdminAuth,
  params: { enterpriseId?: string; invoiceType?: 'normal' | 'special' | ''; invoiceStatus?: string }
) =>
  axios.get('/api/admin/orders', { headers: adminHeaders(auth), params }).then(r => r.data);

export const reviewInvoice = (
  payload: {
    orderId: string;
    status: 'approved' | 'rejected';
    rejectCode?: 'company_info_invalid' | 'taxpayer_info_invalid' | 'duplicate_request' | 'unsupported_scope' | 'other';
    rejectRemark?: string;
  },
  auth: AdminAuth
) =>
  axios.post('/api/admin/orders/invoice/review', payload, { headers: adminHeaders(auth) }).then(r => r.data);

export const getInvoiceRejectReasons = (auth: AdminAuth) =>
  axios.get('/api/admin/orders/invoice/reject-reasons', { headers: adminHeaders(auth) }).then(r => r.data);

export const exportInvoiceLedgerCsv = (
  auth: AdminAuth,
  params: { enterpriseId?: string; invoiceType?: 'normal' | 'special' | ''; invoiceStatus?: string }
) =>
  axios
    .get('/api/admin/orders/invoice/ledger/export', {
      headers: adminHeaders(auth),
      params,
      responseType: 'blob'
    })
    .then(r => {
      const blob = new Blob([r.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = String(r.headers?.['content-disposition'] || '');
      const match = disposition.match(/filename="?([^\"]+)"?/i);
      a.href = url;
      a.download = match?.[1] || `invoice-ledger-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return true;
    });

export const getAdminUsers = (auth: AdminAuth) =>
  axios.get('/api/admin/users', { headers: adminHeaders(auth) }).then(r => r.data);

export const disableAdminUser = (payload: { userId: string; reason?: string }, auth: AdminAuth) =>
  axios.post('/api/admin/users/disable', payload, { headers: adminHeaders(auth) }).then(r => r.data);

export const enableAdminUser = (payload: { userId: string }, auth: AdminAuth) =>
  axios.post('/api/admin/users/enable', payload, { headers: adminHeaders(auth) }).then(r => r.data);
