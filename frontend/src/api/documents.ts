import axios from 'axios';

export const createDocument = (payload: any, token: string) => axios.post('/api/documents/create', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const updateDocument = (payload: any, token: string) => axios.post('/api/documents/update', payload, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const myDocuments = (token: string) => axios.get('/api/documents/my', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const documentDetail = (id: string, token: string) => axios.get('/api/documents/detail', { params: { id }, headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
export const submitDocument = (id: string, token: string) => axios.post('/api/documents/submit', { id }, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);

export const exportWordDocument = async (id: string, token: string) => {
	const resp = await axios.get('/api/documents/export/word', {
		params: { id },
		headers: { Authorization: `Bearer ${token}` },
		responseType: 'blob'
	});
	const blob = new Blob([resp.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${id}.docx`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.URL.revokeObjectURL(url);
};
