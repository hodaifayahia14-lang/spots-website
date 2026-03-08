

# Fix: Send Orders to Delivery Company via API (Not CSV Download)

## Problem
Currently, clicking "Push to Delivery" always downloads a CSV file. The user wants it to **send orders directly to the delivery company's API**. CSV should only be a fallback when no API is configured.

## Changes

### 1. `src/pages/admin/AdminOrdersPage.tsx` -- Fix `handleExportToDelivery`

Update the handler logic (lines 98-130):
- If the delivery company has an API configured and the API call succeeds, show a success toast -- NO CSV download
- If the API call fails, show an error toast with the failure message
- Only download CSV as fallback when the company has NO API key/URL configured
- Change the button icon from `Download` to `Truck` (send icon) to reflect the action
- Update button text to indicate "send" not "export"

### 2. `supabase/functions/delivery-export/index.ts` -- Improve API response

The edge function already handles API calls correctly. Minor improvement:
- When API is configured, include the API response body in `apiResult` for better error reporting
- Still return CSV in the response for fallback use, but the frontend will decide whether to download it

### 3. Dialog UX improvements in `AdminOrdersPage.tsx`

- Show which companies have API configured (green dot already exists)
- Add a note in the dialog: "Orders will be sent directly to the company" when API is configured, or "CSV will be downloaded" when not
- Show a success summary after push (e.g., "15 orders sent to Yalidine successfully")

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/admin/AdminOrdersPage.tsx` | Prioritize API push over CSV download in `handleExportToDelivery`; update icons and labels |
| `supabase/functions/delivery-export/index.ts` | Include API response body for better error messages |

No database changes needed.

