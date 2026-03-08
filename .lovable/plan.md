

# Sports Theme Complete Redesign Plan

This is a massive redesign touching the entire application. I'll break it into logical phases.

## Scope

**Files to modify:** ~20+ files across design system, public pages, admin dashboard, and shared components.

---

## Phase 1: Global Design System (Dark Mode Only)

**Files:** `src/index.css`, `tailwind.config.ts`, `index.html`

- Force dark mode by adding `class="dark"` to `<html>` and removing light theme CSS variables
- Update dark palette:
  - Background: deep navy/black (`#0a0a0f`, `#111118`)
  - Primary: neon green `#00FF87` (145 100% 50%)
  - Secondary: electric orange `#FF4D00`
  - Accent: gold `#FFD700`
  - Cards: `#16161f` with subtle border glow
- Add `Barlow Condensed` font import alongside existing Bebas Neue
- Add new keyframes: `slide-in-up`, `glow-border`, `sport-spin` (spinning ball loader)
- Add neon focus ring utility for inputs: `0 0 0 2px #00FF87`
- Add jersey-stripe table row utility class

## Phase 2: Navbar + Footer (Sports Rebrand)

**Files:** `src/components/Navbar.tsx`, `src/components/Footer.tsx`

- Dark sticky navbar with neon green active state indicators
- Sports logo area with Dumbbell/Trophy icon
- Active nav items get a bottom neon bar highlight with transition
- Footer: dark background, neon accent links, sports-themed sections

## Phase 3: Homepage Redesign

**File:** `src/pages/Index.tsx`

- Hero: full-viewport cinematic section with dynamic athlete banner, parallax, neon green CTA buttons, scoreboard-style animated stats
- KPI trust bar: redesign as scoreboard blocks with neon borders
- Categories section: **asymmetric photo grid** layout using CSS Grid:
  ```text
  ┌─────────────┬──────────┐
  │             │  Cat B   │
  │   Cat A     ├──────────┤
  │  (span 2)   │  Cat C   │
  └─────────────┴──────────┘
  ```
  Each card: full-bleed photo, bold white text overlay, dark gradient, hover zoom
- Product sections: dark card backgrounds with neon hover glow
- Reviews section with athlete-card styling

## Phase 4: Products Page (Infinite Scroll + RTL)

**File:** `src/pages/ProductsPage.tsx`

- Replace pagination with **Intersection Observer infinite scroll**:
  - Load 12 products initially, fetch next batch when sentinel enters viewport
  - Animated sports spinner (spinning ball CSS animation) as loading indicator
- RTL product grid flow with `dir="rtl"` on container
- Dark filter sidebar with neon focus outlines on inputs
- Category badges styled as sport badges with emoji
- Maintain scroll position via `scrollRestoration`

## Phase 5: ProductCard Redesign

**File:** `src/components/ProductCard.tsx`

- Dark card with subtle border, neon green hover glow effect
- Sport category badge overlay on image
- Price styled like a jersey number (Bebas Neue font, large)
- Quick-add-to-cart slide-up overlay on hover
- Hover lift animation with neon shadow

## Phase 6: About Page (Sports Brand)

**File:** `src/pages/AboutPage.tsx`

- Rewrite content: sports brand identity, championship mentality, athletic vision
- Team cards styled as athlete profile cards (jersey number, position/role)
- Timeline section as match history feed
- Dark theme with neon accents throughout

## Phase 7: Admin Dashboard

**Files:** `src/components/AdminLayout.tsx`, `src/pages/admin/AdminDashboardPage.tsx`

- AdminLayout sidebar: dark navy background, neon green active states, sport category icons
- Dashboard StatCards: scoreboard-style with neon borders and sport icons
- Charts: neon green/orange color scheme
- Tables across all admin pages: jersey-stripe alternating rows (subtle dark alternation)
- Buttons: sporty CTA language where appropriate ("Go!", "Score!")
- Form inputs: dark fields with neon focus outlines

## Phase 8: Categories Page (Photo Grid)

**File:** `src/pages/admin/AdminCategoriesPage.tsx` (admin) + homepage categories section

- Storefront categories: asymmetric photo-based grid (CSS Grid, first item spans 2 rows)
- Each card: full-bleed background photo with `object-fit: cover`, bold white text, dark gradient overlay, hover zoom transform

## Phase 9: Remaining Pages Polish

**Files:** `CartPage.tsx`, `CheckoutPage.tsx`, `SingleProductPage.tsx`, `AuthPage.tsx`, etc.

- Apply dark sports palette consistently
- Neon focus states on all form inputs
- Sport-themed empty states and loading spinners
- Consistent card styling with dark backgrounds

---

## Technical Notes

- **Dark mode only**: Set `class="dark"` on `<html>`, remove light mode toggle references
- **Infinite scroll**: `IntersectionObserver` on a sentinel div after the last product card
- **RTL**: Already set globally; ensure product grid respects `dir="rtl"`
- **CSS Grid for categories**: `grid-template-rows: 1fr 1fr` with first item `grid-row: span 2`
- **Responsive**: Mobile-first, breakpoints at `md:768px` and `xl:1280px`
- **Fonts**: Add `Barlow Condensed` to Google Fonts import and Tailwind config

This redesign transforms every surface of the application into a cohesive dark sports aesthetic inspired by Nike/ESPN with neon accents, cinematic imagery, and performance-focused UX patterns.

