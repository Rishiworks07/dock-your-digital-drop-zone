
# Dock — Universal Personal Drop Zone

A clean, light-blue web app where authenticated users can drop, paste, or save anything (files, notes, links, code, images, videos) into one searchable, filterable grid backed by Lovable Cloud.

## Auth
- Lovable Cloud email + password sign up / sign in
- Routes: `/login`, `/signup` (public) and `/_authenticated/*` (protected layout that redirects to `/login`)
- After sign-in → `/dashboard`. Sign out from avatar dropdown.

## Top Navigation
- Left: **Dock** wordmark
- Center: search input ("Search your items…") with debounced live filter and clear (X) button
- Right: avatar dropdown → Profile, Settings, Sign Out
- White bar with subtle shadow, sticky on scroll

## Dashboard
1. **Upload Zone** — large dashed-blue drop area with cloud icon, "Drag & drop files here", "or paste anything (Ctrl+V)", and a Browse Files button. Hover and active-drag states with pulse animation.
2. **Quick Actions** — three pill buttons: 📝 Quick Note, 🔗 Save Link, 📋 Paste Text (auto-reads clipboard).
3. **Storage Bar** — "Storage: X / 5 GB used" with gradient progress; turns orange ≥80%, red at 100% and blocks uploads.
4. **Filters & Sort** — chip row [All][Text][Images][Files][Links][Videos][Pinned] + sort dropdown (Most Recent, Oldest, A–Z, Size ↑/↓).
5. **Items Grid** — responsive 4/2/1 columns, 16px gap, infinite scroll (20 per page), empty state illustration + "Drop your first item to get started!".

## Upload Methods
- Drag & drop, file picker, global paste detection (image → upload, URL text → link, plain text → note), Quick Note modal, Save Link modal.
- Per-upload: client-side quota check, progress bar, success checkmark animation, fade-in into grid, real-time storage bar update.
- Limits: 100 MB/file, 5 GB/user. Images >2 MB compressed before upload. Friendly error toasts for quota/size/type.

## Item Cards (white, 16px radius, lift on hover)
Six card variants — Note, Image, File, Link, Video, Code — each with type-specific icon/preview, title, size, timestamp, pin toggle (top-right), and three-dot menu (Copy / Share / Delete). Hover actions per type (Copy/Edit, View/Download, Open, Play, etc.). Pinned items float to top with a pin badge. File-type icons color-coded (PDF red, DOC blue, ZIP purple, XLS green).

## Modals
- **New Note** — optional title, content textarea, optional tags
- **Save Link** — URL input with auto-fetched title/favicon/preview
- **Item Detail** — type-specific full view (text + copy, zoomable image, embedded video, syntax-highlighted code, file preview/download, link preview); footer actions Download / Share / Delete; metadata shown
- **Delete Confirmation** — preview + "This cannot be undone"
- All modals: fade + scale animation, full-screen on mobile

## Settings Page
- Account (email, change password, delete account)
- Storage breakdown (pie chart by type, list of largest files with quick delete, Clear All Items)
- Preferences (Grid/List default view, auto-delete Off / 30 / 90 days, paste detection toggle)

## Real-time & Sync
- Supabase real-time subscription on `items` — new/updated/deleted items appear instantly across devices with a "Synced from another device" toast.

## Mobile
- Single-column grid, full-screen modals, always-visible card actions, collapsible search, floating upload button bottom-right.

## Toasts
Top-right, 3s auto-dismiss, success/error/info variants with icons.

## Data Model (Lovable Cloud)
- `items` (id, user_id, type, title, content, file_url, file_name, file_size, file_type, thumbnail_url, link_url, link_title, link_favicon, is_pinned, tags[], created_at, updated_at)
- `user_storage` (user_id, used_bytes, limit_bytes default 5 GB)
- Storage bucket `user-files` (private), folder per `user_id`
- RLS: users read/write only their own rows and their own folder
- Triggers: increment/decrement `user_storage.used_bytes` on item insert/delete; auto-create `user_storage` row on signup

## Visual System
Background gradient `#F0F9FF → #E0F2FE`, primary `#0EA5E9`, secondary `#38BDF8`, white cards with soft shadow, 16px / 8px radii, Inter font, Lucide outline icons, 200ms ease-in-out transitions throughout.

## Build Order
1. Lovable Cloud setup + auth pages + protected layout
2. DB schema, storage bucket, RLS, triggers
3. Dashboard shell (nav, upload zone, storage bar, filters, empty grid)
4. File/drag/paste upload pipeline + quota enforcement
5. Quick Note + Save Link modals (with link metadata fetch via server function)
6. All six card types + detail/delete modals
7. Search, filters, sort, infinite scroll, pinning
8. Real-time subscription + toasts
9. Settings page (account, storage breakdown, preferences)
10. Mobile polish + animations
