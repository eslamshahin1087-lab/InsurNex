# InsurNex Brand Identity System V3

## Brand direction

The V3 application identity uses a restrained enterprise palette designed for an insurance brokerage workspace:

| Role | Light theme | Dark theme |
|---|---|---|
| Brand navy | `#071B37` | `#071729` |
| Brand blue | `#244E78` | `#6F9CC8` |
| Gold accent | `#C99A44` | `#E0B96F` |
| Main surface | `#FFFFFF` | `#10243A` |
| Workspace background | `#F4F7FB` | `#081727` |
| Border | `#DCE5EF` | `#2A435D` |

Gold is an accent for active navigation, brand details, and selected states. It is not used as a low-contrast body-text color. Status colors for success, warning, and danger remain semantically distinct.

## Experience principles

- Arabic RTL remains the default experience.
- Phone and tablet layouts retain the compact bottom navigation.
- Wide desktop layouts use a persistent right-side navigation rail and a full-width workspace.
- Existing routes, role checks, feature gates, workflows, and data contracts are unchanged by the identity layer.
- Light and dark themes share the same hierarchy and are independently tokenized.
- Keyboard focus remains visible and reduced-motion preferences are respected.

## Implementation

The global refresh is layered at the end of `src/theme/visual-identity-quality.css` under the marker `INSURNEX_BRAND_REFRESH_V3`. This placement deliberately follows older identity overrides so the shared design tokens and responsive shell have one final, consistent refinement layer.

The desktop shell correction is intentional: the prior shared mobile-shell rule forced `display: flex !important` and constrained wide screens to a phone-width frame. At 1024px and above, V3 changes the shell to a two-column RTL grid with a 264px navigation rail.

## Validation

Run:

```powershell
npm run test:visual-identity
npm run lint
npm run build
```

The automated identity test checks palette tokens, light/dark coverage, desktop grid behavior, responsive navigation, and reduced-motion support.
