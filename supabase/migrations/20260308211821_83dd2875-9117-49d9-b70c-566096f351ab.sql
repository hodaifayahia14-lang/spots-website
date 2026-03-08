
-- Per-company per-wilaya delivery prices
CREATE TABLE public.delivery_company_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  wilaya_id UUID NOT NULL REFERENCES public.wilayas(id) ON DELETE CASCADE,
  price_office NUMERIC NOT NULL DEFAULT 0,
  price_home NUMERIC NOT NULL DEFAULT 0,
  return_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, wilaya_id)
);

-- Enable RLS
ALTER TABLE public.delivery_company_prices ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin can manage delivery_company_prices"
  ON public.delivery_company_prices
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public read for checkout
CREATE POLICY "Delivery prices publicly readable"
  ON public.delivery_company_prices
  FOR SELECT
  TO anon, authenticated
  USING (true);
