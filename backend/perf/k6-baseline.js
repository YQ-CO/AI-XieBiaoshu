import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const adminToken = __ENV.ADMIN_TOKEN || 'admin-secret';

export const options = {
  vus: Number(__ENV.K6_VUS || 5),
  duration: __ENV.K6_DURATION || '2m',
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01']
  }
};

function login() {
  const username = `perf_user_${__VU}_${Date.now()}`;
  const response = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ type: 'password', username, password: 'pwd' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(response, { 'login status is 200': (r) => r.status === 200 });
  return response.status === 200 ? response.json('token') : '';
}

export default function () {
  const token = login();
  if (!token) return;

  const taskResp = http.post(
    `${baseUrl}/model/generate/task`,
    JSON.stringify({ prompt: '性能基线测试提示词', docId: 'perf-doc' }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }
  );

  const ordersResp = http.get(`${baseUrl}/admin/orders`, {
    headers: { 'x-admin-token': adminToken }
  });

  const ledgerResp = http.get(`${baseUrl}/admin/orders/invoice/ledger/export`, {
    headers: { 'x-admin-token': adminToken }
  });

  check(taskResp, { 'generate task status is 200': (r) => r.status === 200 });
  check(ordersResp, { 'admin orders status is 200': (r) => r.status === 200 });
  check(ledgerResp, { 'ledger export status is 200': (r) => r.status === 200 });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'backend/perf/k6-summary.json': JSON.stringify(data, null, 2)
  };
}
