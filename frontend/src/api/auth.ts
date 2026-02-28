import axios from 'axios';

export const login = (payload: any) => axios.post('/api/auth/login', payload).then(r => r.data);
export const me = (token: string) => axios.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
