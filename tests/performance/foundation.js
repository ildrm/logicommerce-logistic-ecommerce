import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: { baseline: { executor: 'constant-vus', vus: 10, duration: '30s' } },
  thresholds: { http_req_duration: ['p(95)<150', 'p(99)<400'], http_req_failed: ['rate<0.01'] },
};

export default function () {
  const response = http.get(`${__ENV.BASE_URL ?? 'http://localhost:8080'}/health/live`);
  check(response, { healthy: (result) => result.status === 200 });
}
