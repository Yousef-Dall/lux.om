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
}
