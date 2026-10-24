# InsurNex Web/PWA

## Scope

InsurNex remains the existing React + Vite application. This PWA foundation adds install metadata and a privacy-safe service worker without replacing routes, authentication, Firestore rules, or Supabase storage.

## Installability

- `public/manifest.webmanifest` defines the Arabic RTL app name, standalone display, root scope, theme, shortcuts, and icons.
- `public/sw.js` is registered in production builds only.
- Firebase Hosting serves the static Vite output from `dist`; the existing SPA rewrite remains in place.

## Offline and privacy behavior

The service worker caches only the static manifest, public icons, favicon, offline notice, and Vite assets under `/assets/`. It does not cache navigation responses, authenticated HTML, Firebase/Supabase responses, client records, insurance policies, claims, medical reports, or uploaded documents. If navigation fails offline, the app shows a static notice explaining that a connection is required to access private data.

This is not an offline-first data mode. Authenticated operations still require connectivity and server-side authorization.

## Validation

Run:

```bash
npm run test:pwa
npm run lint
npm run build
```

After deploying to HTTPS, verify on a mobile browser:
1. The manifest loads without errors and both icon files return HTTP 200.
2. The browser offers **Install app** / **Add to Home Screen**.
3. The installed app opens in standalone display.
4. Login, protected routes, admin routes, and direct refresh on nested routes still work.
5. When offline, navigation shows the offline notice and no private records are exposed from cache.

Do not treat a successful build as proof of a production deployment or a complete mobile acceptance test.
