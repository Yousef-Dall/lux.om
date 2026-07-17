import type { Page } from '@playwright/test';

export const crmApiPattern = '**/api/crm/**';

export async function mockNotificationsApi(page: Page) {
  await page.route(/\/api\/notifications(?:\/[^?]*)?(?:\?.*)?$/, (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname.endsWith('/api/notifications')) {
      return route.fulfill({
        json: {
          notifications: [],
          unreadCount: 0,
          pagination: { total: 0, take: 20, skip: 0, count: 0 }
        }
      });
    }

    if (request.method() === 'PATCH' || request.method() === 'POST') {
      return route.fulfill({ json: { ok: true, unreadCount: 0 } });
    }

    return route.fulfill({ status: 404, json: { message: 'Unhandled notification test route.' } });
  });

  await page.route(/\/api\/dashboard(?:\/[^?]*)?(?:\?.*)?$/, (route) => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 405, json: { message: 'Method not allowed.' } });
    }
    return route.fulfill({
      json: {
        stats: {},
        recentListings: [],
        recentActivities: [],
        recentBookings: [],
        notifications: []
      }
    });
  });

  // Workspace shells may prefetch selector data before a feature spec installs
  // its domain-specific routes. Keep those requests deterministic and prevent
  // harmless Vite proxy ECONNREFUSED noise. Later, more-specific routes win.
  await page.route(/\/api\/pms\/(properties|units|vendors)(?:\/[^?]*)?(?:\?.*)?$/, (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback();
    const segments = new URL(request.url()).pathname.split('/');
    const resource = segments[segments.indexOf('pms') + 1];
    const collection = resource === 'properties' ? 'properties' : resource === 'units' ? 'units' : 'vendors';
    return route.fulfill({
      json: {
        workspace: {},
        [collection]: [],
        pagination: { total: 0, take: 100, skip: 0, count: 0 }
      }
    });
  });
}
