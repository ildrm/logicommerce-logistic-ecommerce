import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    read_control_plane: { executor: 'constant-vus', vus: 25, duration: '60s' },
  },
  thresholds: {
    http_req_duration: ['p(50)<50', 'p(95)<150', 'p(99)<400'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const baseUrl = __ENV.BASE_URL ?? 'http://localhost:8080';
  const response = http.post(
    `${baseUrl}/api/v1/auth/login`,
    JSON.stringify({
      email: 'admin@demo.logicommerce.local',
      password: __ENV.DEMO_PASSWORD,
    }),
    {
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': '00000000-0000-4000-8000-000000000001',
      },
    },
  );
  check(response, { authenticated: (result) => result.status === 200 });
  return { baseUrl, token: response.json('accessToken') };
}

export default function (data) {
  const response = http.get(`${data.baseUrl}/api/v1/operability/slos`, {
    headers: {
      authorization: `Bearer ${data.token}`,
      'x-tenant-id': '00000000-0000-4000-8000-000000000001',
    },
  });
  check(response, { successful: (result) => result.status === 200 });
}
