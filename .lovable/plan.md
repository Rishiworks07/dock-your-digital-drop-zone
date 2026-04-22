

## Add Infinite-Loop Light Animation to "Workspace Synced" Indicator

When the user hovers over the "Workspace Synced" badge in the dashboard header, an animated light will trace an infinity (∞) symbol inside the badge in a continuous loop.

### What you'll see
- Default state: badge looks the same as today (small dot + "Workspace Synced" label).
- On hover: a soft glowing light particle smoothly travels along an infinity-shaped path inside the badge, looping forever while the cursor remains. The badge subtly lifts and the background gets a faint sky-blue glow.
- On mouse leave: the animation gracefully stops and the badge returns to its resting state.

### Implementation

1. **`src/routes/_authenticated/dashboard.tsx`** (line ~251)
   - Wrap the existing "Workspace Synced" badge in a `group` container with `relative overflow-hidden`.
   - Inside, add an absolutely-positioned inline SVG (`viewBox="0 0 100 40"`) containing:
     - A faint infinity path (stroke `var(--primary)` at low opacity) — only visible on hover.
     - A glowing `<circle>` (radius ~2.5, fill `var(--primary-glow)` with a blur filter) animated along the path via SVG `<animateMotion dur="2s" repeatCount="indefinite">` referencing the infinity path's id with `<mpath>`.
   - Use Tailwind `opacity-0 group-hover:opacity-100 transition-opacity duration-300` on the SVG layer so the animation only appears on hover.
   - Add `group-hover:shadow-lift group-hover:-translate-y-0.5 transition-all` to the badge wrapper for the lift effect.

2. **`src/styles.css`**
   - Add a small reusable utility `.infinity-glow` with a `filter: drop-shadow(0 0 4px var(--primary-glow))` for the moving light particle.
   - (No new keyframes needed — `<animateMotion>` handles the path traversal natively.)

### Technical notes
- Infinity path uses two cubic Béziers forming a lemniscate inside the SVG viewBox, e.g. `M 20,20 C 20,5 45,5 50,20 C 55,35 80,35 80,20 C 80,5 55,5 50,20 C 45,35 20,35 20,20 Z`.
- `<animateMotion>` with `repeatCount="indefinite"` is GPU-friendly and pauses naturally when the SVG is hidden via `opacity-0` (we can also gate with `pointer-events-none` so it never blocks clicks).
- Respects existing design tokens (`--primary`, `--primary-glow`, `--shadow-lift`) — no new colors introduced.
- Works in both light and dark modes since the glow color is theme-driven.

