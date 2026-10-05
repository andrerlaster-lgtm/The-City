/**
 * Shared Playwright `test`. When targeting a protected Vercel deployment, it attaches
 * Vercel's access header to requests for that deployment's origin only, so the token
 * is never sent to any other host. Preferred: the short-lived development OIDC token
 * (`vercel env run -- npm run test:e2e:preview`). Fallback: a Protection Bypass secret.
 */
import { test as base } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

export const test = base.extend<{ vercelAccess: void }>({
  vercelAccess: [async ({ context, baseURL }, use) => {
    const oidc = process.env.VERCEL_OIDC_TOKEN;
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (process.env.PLAYWRIGHT_BASE_URL && baseURL && (oidc || bypass)) {
      const origin = new URL(baseURL).origin;
      await context.route(`${origin}/**`, (route) => route.continue({
        headers: {
          ...route.request().headers(),
          ...(oidc ? { 'x-vercel-trusted-oidc-idp-token': oidc } : { 'x-vercel-protection-bypass': bypass! }),
        },
      }));
    }
    await use();
  }, { auto: true }],
});

export { expect } from '@playwright/test';
