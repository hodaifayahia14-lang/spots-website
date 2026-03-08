
-- Fix the stock adjustment trigger to handle variants properly
CREATE OR REPLACE FUNCTION public.adjust_stock_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When status changes to 'تم التسليم' (delivered), deduct stock
  IF NEW.status = 'تم التسليم' AND (OLD.status IS DISTINCT FROM 'تم التسليم') THEN
    -- Deduct variant stock if variant_id is set
    UPDATE product_variants pv
    SET quantity = GREATEST(0, pv.quantity - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.variant_id = pv.id AND oi.variant_id IS NOT NULL;

    -- Deduct product stock (for non-variant items, or sync parent stock)
    UPDATE products p
    SET stock = GREATEST(0, COALESCE(p.stock, 0) - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;

  -- When status changes to 'ملغي' (cancelled) from 'تم التسليم', restore stock
  IF NEW.status = 'ملغي' AND OLD.status = 'تم التسليم' THEN
    -- Restore variant stock
    UPDATE product_variants pv
    SET quantity = pv.quantity + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.variant_id = pv.id AND oi.variant_id IS NOT NULL;

    -- Restore product stock
    UPDATE products p
    SET stock = COALESCE(p.stock, 0) + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;

  -- When status changes FROM 'ملغي' to 'تم التسليم', deduct again
  IF OLD.status = 'ملغي' AND NEW.status = 'تم التسليم' THEN
    UPDATE product_variants pv
    SET quantity = GREATEST(0, pv.quantity - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.variant_id = pv.id AND oi.variant_id IS NOT NULL;

    UPDATE products p
    SET stock = GREATEST(0, COALESCE(p.stock, 0) - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the trigger if not exists (drop and recreate to be safe)
DROP TRIGGER IF EXISTS trigger_adjust_stock_on_status_change ON public.orders;
CREATE TRIGGER trigger_adjust_stock_on_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.adjust_stock_on_status_change();
