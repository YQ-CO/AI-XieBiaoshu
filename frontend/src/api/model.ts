import axios from 'axios';

export const generateText = (payload: any, token: string) => axios.post('/api/model/generate', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const getModelOptions = (token: string) => axios.get('/api/model/options', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const startGenerateTask = (payload: any, token: string) => axios.post('/api/model/generate/task', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const getGenerateTask = (taskId: string, token: string) => axios.get(`/api/model/generate/task/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
