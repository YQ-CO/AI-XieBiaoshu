import axios from 'axios';

export const uploadFile = (file: File, token: string) => {
  const form = new FormData();
  form.append('file', file);
  return axios.post('/api/parse/upload', form, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  }).then(r => r.data);
};
