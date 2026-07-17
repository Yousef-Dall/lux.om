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
}
