import axios from 'axios';

export const recharge = (payload: any, token: string) => axios.post('/api/orders/recharge', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const myOrders = (token: string) => axios.get('/api/orders/my', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const requestInvoice = (payload: any, token: string) => axios.post('/api/orders/invoice', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
