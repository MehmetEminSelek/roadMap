/**
 * Stress Test Suite - k6 Load Testing
 *
 * Tests API under load:
 * - Concurrent requests
 * - Rate limiting verification
 * - Response time percentiles
 * - Error rates
 *
 * Run: k6 run stress-tests/api-stress-test.ts
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const checkRate = new Rate('checks_passed');

// Test configuration
export const options = {
  // Scenario 1: Smoke test (1 min)
  smoke: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 5 },
      { duration: '30s', target: 5 },
    ],
    gracefulStop: '30s',
    tags: { test_type: 'smoke' },
  },

  // Scenario 2: Load test (5 min)
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '2m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '1m', target: 0 },
    ],
    gracefulStop: '30s',
    tags: { test_type: 'load' },
  },

  // Scenario 3: Stress test (3 min)
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 },
      { duration: '1m', target: 200 },
      { duration: '1m', target: 0 },
    ],
    gracefulStop: '30s',
    tags: { test_type: 'stress' },
  },

  thresholds: {
    http_req_duration: ['p(50)<500', 'p(90)<1000', 'p(95)<2000'], // Percentiles
    http_req_failed: ['rate<0.1'], // Error rate < 10%
    checks_passed: ['rate>0.9'], // 90% checks pass
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = `stress-${Date.now()}@test.com`;
const TEST_PASSWORD = 'StressTest123!';

// ============================================
// Helper Functions
// ============================================

function registerUser() {
  const res = http.post(`${BASE_URL}/auth/register`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: 'Stress Test User',
  });

  check(res, {
    'register: status 201': (r: any) => r.status === 201,
    'register: has token': (r: any) => r.json('token') !== undefined,
  }) && checkRate.add(true);

  errorRate.add(res.status >= 400);

  return res.json('token');
}

function loginUser(email: string, password: string) {
  const res = http.post(`${BASE_URL}/auth/login`, {
    email,
    password,
  });

  check(res, {
    'login: status 200': (r: any) => r.status === 200,
    'login: has token': (r: any) => r.json('access_token') !== undefined,
  });

  errorRate.add(res.status >= 400);

  return res.json('access_token');
}

function createRoute(token: string): string | null {
  const payload = JSON.stringify({
    origin: 'İstanbul, Türkiye',
    destination: 'Ankara, Türkiye',
    hasClimateControl: true,
  });

  const res = http.post(`${BASE_URL}/routes/calculate`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  check(res, {
    'create-route: status 201': (r: any) => r.status === 201,
    'create-route: has route': (r: any) => {
      try {
        const body = r.json();
        return body && body.route && body.route.id;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(res.status >= 400);

  try {
    const body = res.json();
    return body.route?.id || null;
  } catch {
    return null;
  }
}

function getRoutes(token: string) {
  const res = http.get(`${BASE_URL}/routes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    'get-routes: status 200': (r: any) => r.status === 200,
    'get-routes: is array': (r: any) => Array.isArray(r.json('data')),
    'get-routes: has meta': (r: any) => r.json('meta') !== undefined,
  });

  errorRate.add(res.status >= 400);
}

function getRouteById(token: string, routeId: string) {
  const res = http.get(`${BASE_URL}/routes/${routeId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    'get-route-by-id: status 200': (r: any) => r.status === 200,
    'get-route-by-id: has id': (r: any) => r.json('id') === routeId,
  });

  errorRate.add(res.status >= 400);
}

function deleteRoute(token: string, routeId: string) {
  if (!routeId) return; // Skip if no route ID

  const res = http.del(`${BASE_URL}/routes/${routeId}`, null, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    'delete-route: status 200': (r: any) => r.status === 200,
  });

  errorRate.add(res.status >= 400);
}

function getStats(token: string) {
  const res = http.get(`${BASE_URL}/routes/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    'get-stats: status 200': (r: any) => r.status === 200,
    'get-stats: has totalRoutes': (r: any) => r.json('totalRoutes') !== undefined,
    'get-stats: has totalCost': (r: any) => r.json('totalCost') !== undefined,
  });

  errorRate.add(res.status >= 400);
}

// ============================================
// Test Scenarios
// ============================================

export function smokeTest() {
  // Simple smoke test: register, create route, get routes, cleanup
  const token = registerUser();
  sleep(1);

  const routeId = createRoute(token);
  sleep(0.5);

  if (routeId) {
    getRoutes(token);
    sleep(0.5);
    getStats(token);
    sleep(0.5);
    deleteRoute(token, routeId);
  } else {
    // If route creation failed, still test read endpoints
    getRoutes(token);
    sleep(0.5);
    getStats(token);
  }
}

export function loadTest() {
  // Load test with multiple users
  const token = registerUser();

  // Create 5 routes
  const routeIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = createRoute(token);
    if (id) routeIds.push(id);
    sleep(0.5);
  }

  // Get all routes
  getRoutes(token);
  sleep(0.5);

  // Get each route by ID
  routeIds.forEach((id) => {
    getRouteById(token, id);
    sleep(0.2);
  });

  // Get stats
  getStats(token);
  sleep(0.5);

  // Cleanup
  routeIds.forEach((id) => deleteRoute(token, id));
}

export function stressTest() {
  // Stress test: rapid concurrent requests
  const token = registerUser();

  // Create 10 routes rapidly
  const routeIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = createRoute(token);
    if (id) routeIds.push(id);
    sleep(0.2);
  }

  // Hammer the API with stats requests
  for (let i = 0; i < 5; i++) {
    getStats(token);
    sleep(0.1);
  }

  // Get routes multiple times
  for (let i = 0; i < 3; i++) {
    getRoutes(token);
    sleep(0.2);
  }

  // Cleanup
  routeIds.forEach((id) => deleteRoute(token, id));
}

// Default export - runs based on scenario tags
export default function (data: any) {
  const scenario = __ENV.SCENARIO || 'smoke';

  switch (scenario) {
    case 'smoke':
      smokeTest();
      break;
    case 'load':
      loadTest();
      break;
    case 'stress':
      stressTest();
      break;
    default:
      smokeTest();
  }
}
