

## Database Seeding Plan

### Goal
Create an edge function `seed-database` that populates all tables with realistic Algerian e-commerce data, including AI-generated product images.

### What Gets Seeded

| Table | Records | Details |
|-------|---------|---------|
| `products` | 15 | Diverse categories (electronics, fashion, food, beauty, home). With AI-generated images via Lovable AI gateway |
| `product_variants` | ~20 | Size/color variants for applicable products |
| `product_variations` | ~10 | Legacy variation entries |
| `variation_options` | ~15 | Size, color options |
| `categories` (via products) | 8 | Electronics, Fashion, Food, Beauty, Home, Sports, Books, Accessories |
| `orders` | 30 | Mixed statuses (جديد, مؤكد, تم التسليم, ملغي, قيد التوصيل) with realistic dates |
| `order_items` | ~50 | Linked to products and orders |
| `clients` | 15 | Algerian names, phones, wilayas |
| `suppliers` | 5 | With contact info |
| `supplier_products` | 15 | Linked to suppliers |
| `supplier_transactions` | 10 | Receipt/payment records |
| `confirmers` | 3 | Active confirmers |
| `coupons` | 5 | Various discount types |
| `reviews` | 20 | Ratings 3-5, Arabic comments |
| `leads` | 10 | Mixed statuses |
| `delivery_companies` | 2 more | (ZR Express, Yalidine already exists) |
| `delivery_company_prices` | Prices for existing wilayas per company |
| `facebook_pixels` | 2 | Sample pixel IDs |
| `abandoned_orders` | 5 | Abandoned carts |
| `return_requests` + `return_items` | 3 | Sample returns |
| `return_reasons` | 5 | Common return reasons |
| `return_settings` | 1 | Default config |
| `product_costs` | 10 | Cost breakdown per product |
| `settings` | 5 | Store name, logo, theme settings |

### Implementation

**1. Edge Function: `supabase/functions/seed-database/index.ts`**
- Single POST endpoint, admin-only (checks auth)
- Inserts data in dependency order: settings → products → variants → clients → orders → order_items → reviews → suppliers → etc.
- For product images: calls the Lovable AI gateway (`google/gemini-2.5-flash-image`) to generate product photos, uploads to `products` storage bucket
- Uses service role key for unrestricted inserts
- Returns summary of seeded records

**2. Admin UI: Seed button in Settings page**
- Add a "Seed Database" button in `AdminSettingsPage.tsx` or a dev tools section
- Shows confirmation dialog before seeding
- Progress indicator during seeding
- Prevents double-seeding by checking if data already exists

### Data Characteristics
- All customer/product names in Arabic
- Phone numbers in Algerian format (05xxxxxxxx, 06xxxxxxxx, 07xxxxxxxx)
- Prices in DZD (realistic: 500-15000 DA range)
- Orders spread across last 90 days
- Stock levels: 0-100 per product
- Wilayas reference existing wilaya IDs from database

### Technical Details
- Edge function uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- Image generation uses `LOVABLE_API_KEY` with `google/gemini-2.5-flash-image` model
- Products get 1-2 AI-generated images each
- Order numbers generated via existing trigger
- Stock adjusted based on delivered orders

