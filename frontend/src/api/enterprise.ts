import axios from 'axios';

export const createEnterprise = (payload: any, token: string) => axios.post('/api/enterprise/create', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const joinEnterprise = (payload: any, token: string) => axios.post('/api/enterprise/join', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const myEnterprises = (token: string) => axios.get('/api/enterprise/my', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const enterpriseMembers = (enterpriseId: string, token: string) => axios.get('/api/enterprise/members', { params: { enterpriseId }, headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const updateEnterpriseRole = (payload: { enterpriseId: string; userId: string; role: 'admin' | 'member' }, token: string) => axios.post('/api/enterprise/role/update', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const switchEnterprise = (payload: any, token: string) => axios.post('/api/users/switch', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
