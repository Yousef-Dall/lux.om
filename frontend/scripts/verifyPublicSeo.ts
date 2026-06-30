import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const repoRoot = resolve(frontendRoot, '..');

const SITE_ORIGIN = 'https://lux.om';

const publicRoutes = [
  '/',
  '/listings',
  '/activities',
  '/market-insights',
  '/developers',
  '/travel-agencies',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/trust-safety',
  '/cancellation-policy',
  '/refund-policy',
  '/verification-policy'
] as const;

const privateRoutePrefixes = [
  '/admin',
  '/dashboard',
  '/profile',
  '/notifications',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth'
] as const;

const legalFooterRoutes = [
  '/terms',
  '/privacy',
  '/trust-safety',
  '/cancellation-policy',
  '/refund-policy',
  '/verification-policy'
] as const;

function read(relativePath: string) {
  return readFileSync(join(frontendRoot, relativePath), 'utf-8');
}

function readRepo(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf-8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[public-seo] ${message}`);
  }
}

function publicUrl(pathname: string) {
  return `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname}`;
}

function routePathLiteral(pathname: string) {
  return pathname === '/' ? '<Route path="/"' : `<Route path="${pathname}"`;
}

const app = read('src/App.tsx');
const footer = read('src/components/Footer.tsx');
const robots = read('public/robots.txt');
const sitemap = read('public/sitemap.xml');
const indexHtml = read('index.html');
const manifest = JSON.parse(read('public/site.webmanifest')) as {
  id?: string;
  name?: string;
  short_name?: string;
  description?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  theme_color?: string;
  icons?: Array<{ src?: string; type?: string }>;
};
const readme = readRepo('README.md');

for (const route of publicRoutes) {
  const loc = `<loc>${publicUrl(route)}</loc>`;

  assert(
    sitemap.includes(loc),
    `sitemap.xml is missing public route ${route}`
  );

  assert(
    app.includes(routePathLiteral(route)),
    `App.tsx is missing public route definition for ${route}`
  );
}

for (const route of legalFooterRoutes) {
  assert(
    footer.includes(`to="${route}"`),
    `Footer.tsx is missing legal/trust link to ${route}`
  );

  assert(
    app.includes(`pathname.startsWith('${route}')`),
    `App.tsx is missing SEO key mapping for ${route}`
  );
}

for (const prefix of privateRoutePrefixes) {
  assert(
    app.includes(`'${prefix}'`),
    `App.tsx NO_INDEX_ROUTE_PREFIXES is missing ${prefix}`
  );

  assert(
    !sitemap.includes(`<loc>${publicUrl(prefix)}</loc>`),
    `sitemap.xml must not include private route ${prefix}`
  );
}

const expectedRobotRules = [
  'Disallow: /admin',
  'Disallow: /dashboard',
  'Disallow: /profile',
  'Disallow: /notifications',
  'Disallow: /login',
  'Disallow: /register',
  'Disallow: /forgot-password',
  'Disallow: /reset-password',
  'Disallow: /verify-email',
  'Disallow: /auth/'
];

for (const rule of expectedRobotRules) {
  assert(robots.includes(rule), `robots.txt is missing ${rule}`);
}

assert(
  robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`),
  'robots.txt must point to the production sitemap'
);

assert(
  app.includes('const NO_INDEX_ROUTE_PREFIXES'),
  'App.tsx is missing NO_INDEX_ROUTE_PREFIXES'
);
assert(
  app.includes('function getRobotsContent'),
  'App.tsx is missing getRobotsContent'
);
assert(
  app.includes("shouldNoIndex ? 'noindex, nofollow' : 'index, follow'"),
  'App.tsx must set noindex/nofollow for private routes'
);
assert(
  app.includes('function normalizeCanonicalPath'),
  'App.tsx is missing normalizeCanonicalPath'
);
assert(
  app.includes("setMetaTag('name', 'robots', getRobotsContent(pathname))"),
  'App.tsx must update runtime robots metadata'
);
assert(
  app.includes("setMetaTag('property', 'og:locale'"),
  'App.tsx must update runtime og:locale metadata'
);
assert(
  app.includes('setCanonical(canonicalUrl)'),
  'App.tsx must update canonical URLs'
);

assert(
  indexHtml.includes('<link rel="canonical" href="https://lux.om/" />'),
  'index.html is missing canonical link'
);
assert(
  indexHtml.includes('<meta name="robots" content="index, follow" />'),
  'index.html is missing default robots meta'
);
assert(
  indexHtml.includes('<meta property="og:locale" content="en_OM" />'),
  'index.html is missing default og:locale'
);
assert(
  indexHtml.includes('<meta name="twitter:site" content="@luxom" />'),
  'index.html is missing twitter site metadata'
);

assert(manifest.id === `${SITE_ORIGIN}/`, 'site.webmanifest id must be https://lux.om/');
assert(manifest.name === 'lux.om', 'site.webmanifest name must be lux.om');
assert(manifest.short_name === 'lux.om', 'site.webmanifest short_name must be lux.om');
assert(manifest.start_url === '/', 'site.webmanifest start_url must be /');
assert(manifest.scope === '/', 'site.webmanifest scope must be /');
assert(manifest.display === 'standalone', 'site.webmanifest display must be standalone');
assert(
  typeof manifest.description === 'string' && manifest.description.includes('Oman'),
  'site.webmanifest must include an Oman marketplace description'
);
assert(
  Array.isArray(manifest.icons) && manifest.icons.some((icon) => icon.src === '/favicon.svg'),
  'site.webmanifest must include favicon.svg icon'
);

assert(
  readme.includes('## Public SEO launch files'),
  'README.md is missing Public SEO launch files section'
);
assert(
  readme.includes('private/admin/auth routes set `noindex, nofollow`'),
  'README.md is missing noindex launch verification note'
);

console.log('[lux.om] Public SEO verification passed.');
