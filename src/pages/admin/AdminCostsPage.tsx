import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/format';
import {
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import TablePagination from '@/components/admin/TablePagination';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
  is_active: boolean;
  has_variants: boolean;
  stock: number | null;
  baseCost: {
    id: string;
    purchase_cost: number;
    packaging_cost: number;
    total_cost_per_unit: number;
  } | null;
  variantCostCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMarginColor(margin: number) {
  if (margin < 0) return 'text-red-700 bg-red-100';
  if (margin < 10) return 'text-red-600 bg-red-50';
  if (margin < 30) return 'text-yellow-700 bg-yellow-50';
  return 'text-green-700 bg-green-50';
}

function getMarginIcon(margin: number) {
  if (margin < 10) return <TrendingDown className="w-3.5 h-3.5" />;
  return <TrendingUp className="w-3.5 h-3.5" />;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function AdminCostsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Fetch products including has_variants flag
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['admin-products-for-costs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, images, is_active, has_variants, stock')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Fetch ALL cost records (both base-level and variant-level)
  const { data: allCosts, isLoading: loadingCosts } = useQuery({
    queryKey: ['product-costs'],
    queryFn: async () => {
      const { data } = await supabase.from('product_costs').select('*');
      return data || [];
    },
  });

  // Merge products with derived cost info
  const productsWithCosts: ProductRow[] = useMemo(() => {
    if (!products) return [];

    const baseCostMap = new Map(
      (allCosts || [])
        .filter(c => !c.variant_id)
        .map(c => [c.product_id, c]),
    );

    const variantCostCount = new Map<string, number>();
    (allCosts || [])
      .filter(c => c.variant_id)
      .forEach(c => {
        variantCostCount.set(c.product_id, (variantCostCount.get(c.product_id) ?? 0) + 1);
      });

    return products.map(p => {
      const bc = baseCostMap.get(p.id);
      return {
        ...p,
        baseCost: bc
          ? {
              id: bc.id,
              purchase_cost: Number(bc.purchase_cost),
              packaging_cost: Number(bc.packaging_cost),
              total_cost_per_unit: Number(bc.total_cost_per_unit),
            }
          : null,
        variantCostCount: variantCostCount.get(p.id) ?? 0,
      };
    });
  }, [products, allCosts]);

  const filtered = useMemo(() => {
    if (!search) return productsWithCosts;
    const q = search.toLowerCase();
    return productsWithCosts.filter(p => p.name.toLowerCase().includes(q));
  }, [productsWithCosts, search]);

  // KPIs
  const kpis = useMemo(() => {
    const total = productsWithCosts.length;
    const noCost = productsWithCosts.filter(p =>
      p.has_variants ? p.variantCostCount === 0 : !p.baseCost,
    ).length;
    const profitable = productsWithCosts.filter(p => {
      if (p.has_variants || !p.baseCost) return false;
      return ((p.price - p.baseCost.total_cost_per_unit) / p.price) * 100 >= 10;
    }).length;
    const lowMargin = productsWithCosts.filter(p => {
      if (p.has_variants || !p.baseCost) return false;
      return ((p.price - p.baseCost.total_cost_per_unit) / p.price) * 100 < 10;
    }).length;
    return { total, noCost, profitable, lowMargin };
  }, [productsWithCosts]);

  const isLoading = loadingProducts || loadingCosts;

  return (
    <div className="space-y-5 min-w-0">
      <div>
        <h2 className="font-cairo font-bold text-2xl text-foreground">{t('costs.title')}</h2>
        <p className="font-cairo text-sm text-muted-foreground mt-1">{t('costs.subtitle')}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-cairo text-xs text-muted-foreground">{t('costs.allProducts')}</p>
              <p className="font-roboto font-bold text-xl text-foreground">{kpis.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-cairo text-xs text-muted-foreground">{t('costs.noCost')}</p>
              <p className="font-roboto font-bold text-xl text-foreground">{kpis.noCost}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-cairo text-xs text-muted-foreground">{t('costs.goodMargin')}</p>
              <p className="font-roboto font-bold text-xl text-foreground">{kpis.profitable}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-cairo text-xs text-muted-foreground">{t('costs.lowMargin')}</p>
              <p className="font-roboto font-bold text-xl text-foreground">{kpis.lowMargin}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('costs.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10 font-cairo h-10"
        />
      </div>

      {/* Table — Desktop */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="border rounded-lg overflow-x-auto max-w-full hidden md:block">
            <table className="text-sm min-w-[860px] whitespace-nowrap w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[200px]">
                    {t('common.product')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[110px]">
                    {t('costs.sellingPrice')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[120px]">
                    {t('costs.purchaseCost')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[110px]">
                    {t('costs.totalCost')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[100px]">
                    {t('costs.profit')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[90px]">
                    {t('costs.margin')}
                  </th>
                  <th className="text-center font-cairo font-semibold px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isVariant = p.has_variants;
                  const hasCost = isVariant ? p.variantCostCount > 0 : !!p.baseCost;
                  const totalCost = p.baseCost?.total_cost_per_unit ?? 0;
                  const grossProfit = p.price - totalCost;
                  const margin = p.price > 0 ? (grossProfit / p.price) * 100 : 0;

                  return (
                    <tr
                      key={p.id}
                      className="border-b hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/costs/${p.id}`)}
                    >
                      {/* Product name + variant indicator */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              className="w-9 h-9 rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-cairo font-medium text-foreground block truncate max-w-[200px]">
                              {p.name}
                            </span>
                            {isVariant && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-cairo mt-0.5">
                                <Layers className="w-3 h-3" />
                                {p.variantCostCount > 0
                                  ? `${p.variantCostCount} ${t('costs.variants')}`
                                  : t('costs.hasVariants')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Selling price */}
                      <td className="px-4 py-3 font-roboto text-foreground">
                        {formatPrice(p.price)}
                      </td>

                      {/* Purchase cost */}
                      <td className="px-4 py-3 font-roboto text-foreground">
                        {isVariant ? (
                          <span className="font-cairo text-xs text-muted-foreground italic">
                            {t('costs.viewDetails')}
                          </span>
                        ) : hasCost ? (
                          formatPrice(p.baseCost!.purchase_cost)
                        ) : (
                          <span className="text-destructive font-cairo text-xs">
                            {t('costs.notSet')}
                          </span>
                        )}
                      </td>

                      {/* Total cost */}
                      <td className="px-4 py-3 font-roboto font-medium text-foreground">
                        {!isVariant && hasCost ? formatPrice(totalCost) : '—'}
                      </td>

                      {/* Profit */}
                      <td className="px-4 py-3 font-roboto font-medium">
                        {!isVariant && hasCost ? (
                          <span className={grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}>
                            {formatPrice(grossProfit)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Margin */}
                      <td className="px-4 py-3">
                        {!isVariant && hasCost ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getMarginColor(
                              margin,
                            )}`}
                          >
                            {getMarginIcon(margin)}
                            {margin.toFixed(1)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Chevron */}
                      <td className="px-4 py-3 text-center">
                        <ChevronRight className="w-4 h-4 text-muted-foreground mx-auto" />
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center font-cairo text-muted-foreground"
                    >
                      {t('costs.noProducts')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center font-cairo text-muted-foreground">
                  {t('costs.noProducts')}
                </CardContent>
              </Card>
            ) : (
              filtered.map(p => {
                const isVariant = p.has_variants;
                const hasCost = isVariant ? p.variantCostCount > 0 : !!p.baseCost;
                const totalCost = p.baseCost?.total_cost_per_unit ?? 0;
                const grossProfit = p.price - totalCost;
                const margin = p.price > 0 ? (grossProfit / p.price) * 100 : 0;

                return (
                  <Card
                    key={p.id}
                    className="border cursor-pointer hover:bg-muted/10 transition-colors"
                    onClick={() => navigate(`/admin/costs/${p.id}`)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img
                            src={p.images[0]}
                            alt=""
                            className="w-10 h-10 rounded object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="font-cairo font-semibold text-foreground block truncate">
                            {p.name}
                          </span>
                          {isVariant && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-cairo mt-0.5">
                              <Layers className="w-3 h-3" />
                              {p.variantCostCount > 0
                                ? `${p.variantCostCount} ${t('costs.variants')}`
                                : t('costs.hasVariants')}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>

                      {!isVariant && (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-muted/30 rounded-lg p-2">
                            <p className="font-cairo text-xs text-muted-foreground">
                              {t('costs.sellingPrice')}
                            </p>
                            <p className="font-roboto font-bold">{formatPrice(p.price)}</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-2">
                            <p className="font-cairo text-xs text-muted-foreground">
                              {t('costs.totalCost')}
                            </p>
                            <p className="font-roboto font-bold">
                              {hasCost ? (
                                formatPrice(totalCost)
                              ) : (
                                <span className="text-destructive text-xs font-cairo">
                                  {t('costs.notSet')}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-2">
                            <p className="font-cairo text-xs text-muted-foreground">
                              {t('costs.profit')}
                            </p>
                            <p
                              className={`font-roboto font-bold ${
                                hasCost
                                  ? grossProfit >= 0
                                    ? 'text-green-700'
                                    : 'text-red-600'
                                  : ''
                              }`}
                            >
                              {hasCost ? formatPrice(grossProfit) : '—'}
                            </p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-2">
                            <p className="font-cairo text-xs text-muted-foreground">
                              {t('costs.margin')}
                            </p>
                            {hasCost ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getMarginColor(
                                  margin,
                                )}`}
                              >
                                {getMarginIcon(margin)} {margin.toFixed(1)}%
                              </span>
                            ) : (
                              <p className="font-roboto">—</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

