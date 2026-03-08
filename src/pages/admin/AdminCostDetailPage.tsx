import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/format';
import {
  ChevronRight,
  Package,
  Pencil,
  Save,
  TrendingUp,
  TrendingDown,
  X,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { Json } from '@/integrations/supabase/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
  is_active: boolean;
  has_variants: boolean;
  stock: number | null;
}

interface Variant {
  id: string;
  product_id: string;
  sku: string | null;
  price: number;
  option_values: Json;
  is_active: boolean;
  quantity: number;
}

interface CostRecord {
  id: string;
  product_id: string;
  variant_id: string | null;
  purchase_cost: number;
  packaging_cost: number;
  storage_cost: number;
  other_cost: number;
  other_cost_label: string | null;
  total_cost_per_unit: number;
}

interface CostDraft {
  purchase: string;
  packaging: string;
  storage: string;
  other: string;
  otherLabel: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function variantLabel(optionValues: Json): string {
  if (
    typeof optionValues === 'object' &&
    optionValues &&
    !Array.isArray(optionValues)
  ) {
    const vals = Object.values(optionValues as Record<string, string>);
    if (vals.length > 0) return vals.join(' / ');
  }
  return 'Default';
}

function getMarginColor(margin: number) {
  if (margin < 0) return 'text-red-700 bg-red-100';
  if (margin < 10) return 'text-red-600 bg-red-50';
  if (margin < 30) return 'text-yellow-700 bg-yellow-50';
  return 'text-green-700 bg-green-50';
}

function profitColor(profit: number) {
  return profit >= 0 ? 'text-green-700' : 'text-red-600';
}

const BASE_KEY = '__base__';

// ─── Page component ───────────────────────────────────────────────────────────

export default function AdminCostDetailPage() {
  const { t } = useTranslation();
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, CostDraft>>({});
  const [saving, setSaving] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ['cost-detail-product', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, images, is_active, has_variants, stock')
        .eq('id', productId!)
        .single();
      return data as Product | null;
    },
    enabled: !!productId,
  });

  const { data: variants, isLoading: loadingVariants } = useQuery({
    queryKey: ['cost-detail-variants', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_variants')
        .select('id, product_id, sku, price, option_values, is_active, quantity')
        .eq('product_id', productId!)
        .order('created_at' as any);
      return (data || []) as Variant[];
    },
    enabled: !!productId,
  });

  const { data: costs, isLoading: loadingCosts } = useQuery({
    queryKey: ['cost-detail-costs', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_costs')
        .select('*')
        .eq('product_id', productId!);
      return (data || []) as CostRecord[];
    },
    enabled: !!productId,
  });

  const isLoading = loadingProduct || loadingVariants || loadingCosts;

  // ── Derived data ───────────────────────────────────────────────────────────

  const costMap = useMemo(() => {
    const map = new Map<string | null, CostRecord>();
    (costs || []).forEach(c => map.set(c.variant_id, c));
    return map;
  }, [costs]);

  // Computed rows (real-time when in edit mode using draft values)
  const rows = useMemo(() => {
    if (!product) return [];

    const makeRow = (
      key: string,
      label: string,
      sellingPrice: number,
      c: CostRecord | undefined | null,
    ) => {
      const d = editMode ? drafts[key] : null;
      const purchase   = d ? (Number(d.purchase)  || 0) : (c?.purchase_cost  ?? 0);
      const packaging  = d ? (Number(d.packaging) || 0) : (c?.packaging_cost ?? 0);
      const storage    = d ? (Number(d.storage)   || 0) : (c?.storage_cost   ?? 0);
      const other      = d ? (Number(d.other)     || 0) : (c?.other_cost     ?? 0);
      const totalCost  = purchase + packaging + storage + other;
      const profit     = sellingPrice - totalCost;
      const margin     = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
      return {
        key,
        label,
        sellingPrice,
        purchase,
        packaging,
        storage,
        other,
        totalCost,
        profit,
        margin,
        hasCost: !!c,
        costId: c?.id,
      };
    };

    if (!product.has_variants) {
      const c = costMap.get(null);
      return [makeRow(BASE_KEY, t('costs.baseProduct'), product.price, c)];
    }

    return (variants || []).map(v => {
      const c = costMap.get(v.id);
      return makeRow(v.id, variantLabel(v.option_values), v.price, c);
    });
  }, [product, variants, costMap, editMode, drafts, t]);

  // Summary stats
  const summary = useMemo(() => {
    const configured = rows.filter(r => r.hasCost).length;
    const withCost   = rows.filter(r => r.hasCost);
    const avgMargin  = withCost.length > 0
      ? withCost.reduce((s, r) => s + r.margin, 0) / withCost.length : 0;
    const minMargin = withCost.length > 0 ? Math.min(...withCost.map(r => r.margin)) : 0;
    const maxMargin = withCost.length > 0 ? Math.max(...withCost.map(r => r.margin)) : 0;
    return { total: rows.length, configured, avgMargin, minMargin, maxMargin };
  }, [rows]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStartEdit = () => {
    const initial: Record<string, CostDraft> = {};
    if (product && !product.has_variants) {
      const c = costMap.get(null);
      initial[BASE_KEY] = {
        purchase:   String(c?.purchase_cost  ?? ''),
        packaging:  String(c?.packaging_cost ?? 0),
        storage:    String(c?.storage_cost   ?? 0),
        other:      String(c?.other_cost     ?? 0),
        otherLabel: c?.other_cost_label ?? '',
      };
    } else {
      (variants || []).forEach(v => {
        const c = costMap.get(v.id);
        initial[v.id] = {
          purchase:   String(c?.purchase_cost  ?? ''),
          packaging:  String(c?.packaging_cost ?? 0),
          storage:    String(c?.storage_cost   ?? 0),
          other:      String(c?.other_cost     ?? 0),
          otherLabel: c?.other_cost_label ?? '',
        };
      });
    }
    setDrafts(initial);
    setEditMode(true);
  };

  const handleDiscard = () => {
    setDrafts({});
    setEditMode(false);
  };

  const updateDraft = (key: string, field: keyof CostDraft, value: string) => {
    setDrafts(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const ops: Promise<void>[] = [];

      for (const row of rows) {
        const draft = drafts[row.key];
        if (!draft) continue;

        const purchase  = Number(draft.purchase)  || 0;
        const packaging = Number(draft.packaging) || 0;
        const storage   = Number(draft.storage)   || 0;
        const other     = Number(draft.other)     || 0;

        const payload = {
          product_id:         productId,
          variant_id:         row.key === BASE_KEY ? null : row.key,
          purchase_cost:      purchase,
          packaging_cost:     packaging,
          storage_cost:       storage,
          other_cost:         other,
          other_cost_label:   draft.otherLabel || null,
          updated_at:         new Date().toISOString(),
        };

        if (row.costId) {
          // Update existing record
          ops.push(
            Promise.resolve(
              supabase
                .from('product_costs')
                .update(payload)
                .eq('id', row.costId)
                .then(({ error }) => { if (error) throw error; }),
            ),
          );
        } else if (purchase > 0) {
          // Insert only if purchase cost is provided
          ops.push(
            Promise.resolve(
              supabase
                .from('product_costs')
                .insert(payload)
                .then(({ error }) => { if (error) throw error; }),
            ),
          );
        }
      }

      await Promise.all(ops);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cost-detail-costs', productId] }),
        qc.invalidateQueries({ queryKey: ['product-costs'] }),
        qc.invalidateQueries({ queryKey: ['admin-products-for-costs'] }),
      ]);
      toast.success(t('costs.allSaved'));
      setDrafts({});
      setEditMode(false);
    } catch (err: any) {
      toast.error(err.message || t('costs.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Package className="w-12 h-12 text-muted-foreground" />
        <p className="font-cairo text-muted-foreground">Product not found</p>
        <Button variant="outline" onClick={() => navigate('/admin/costs')} className="font-cairo gap-2">
          <ChevronRight className="w-4 h-4 rotate-180" />
          {t('costs.backToList')}
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 min-w-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => navigate('/admin/costs')}
          className="font-cairo text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('costs.title')}
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-cairo text-foreground font-medium truncate">{product.name}</span>
      </div>

      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt=""
              className="w-14 h-14 rounded-lg object-cover shrink-0 border"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <h2 className="font-cairo font-bold text-xl text-foreground">{product.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-cairo text-sm text-muted-foreground">
                {t('costs.sellingPrice')}:{' '}
                <strong className="font-roboto">{formatPrice(product.price)}</strong>
              </span>
              {product.has_variants && (
                <Badge variant="secondary" className="font-cairo text-xs">
                  {variants?.length ?? 0} {t('costs.variants')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {editMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={saving}
                className="font-cairo gap-1.5"
              >
                <X className="w-4 h-4" />
                {t('costs.discardChanges')}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAll}
                disabled={saving}
                className="font-cairo gap-1.5"
              >
                {saving ? (
                  <span className="font-cairo">{t('common.saving')}</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('costs.saveAll')}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartEdit}
              className="font-cairo gap-1.5"
            >
              <Pencil className="w-4 h-4" />
              {t('costs.editMode')}
            </Button>
          )}
        </div>
      </div>

      {/* KPI summary cards — only shown if at least 1 variant has a cost */}
      {summary.configured > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border">
            <CardContent className="p-4">
              <p className="font-cairo text-xs text-muted-foreground">{t('costs.configured')}</p>
              <p className="font-roboto font-bold text-xl mt-0.5">
                {summary.configured}/{summary.total}
              </p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <p className="font-cairo text-xs text-muted-foreground">{t('costs.avgMargin')}</p>
              <p
                className={`font-roboto font-bold text-xl mt-0.5 ${
                  summary.avgMargin >= 10 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {summary.avgMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <p className="font-cairo text-xs text-muted-foreground">{t('costs.minMargin')}</p>
              <p
                className={`font-roboto font-bold text-xl mt-0.5 ${
                  summary.minMargin >= 10 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {summary.minMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <p className="font-cairo text-xs text-muted-foreground">{t('costs.maxMargin')}</p>
              <p className="font-roboto font-bold text-xl mt-0.5 text-green-700">
                {summary.maxMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main table */}
      <Card className="border">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="font-cairo text-base font-semibold">
            {t('costs.variationCosts')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="text-sm w-full min-w-[820px] whitespace-nowrap">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[150px]">
                    {t('costs.variation')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[110px]">
                    {t('costs.sellingPrice')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[120px]">
                    {t('costs.purchaseCost')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[110px]">
                    {t('costs.packagingCost')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[110px]">
                    {t('costs.storageCost')}
                  </th>
                  <th className="text-right font-cairo font-semibold px-4 py-3 min-w-[100px]">
                    {t('costs.otherCost')}
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
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.key}
                    className="border-b last:border-0 hover:bg-muted/10 transition-colors"
                  >
                    {/* Variation name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-cairo font-medium text-foreground">
                          {row.label}
                        </span>
                        {!row.hasCost && !editMode && (
                          <Badge
                            variant="destructive"
                            className="font-cairo text-xs py-0 shrink-0"
                          >
                            {t('costs.notSet')}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Selling price */}
                    <td className="px-4 py-3 font-roboto text-foreground">
                      {formatPrice(row.sellingPrice)}
                    </td>

                    {/* Purchase cost */}
                    <td className="px-4 py-3">
                      {editMode ? (
                        <Input
                          type="number"
                          min={0}
                          value={drafts[row.key]?.purchase ?? ''}
                          onChange={e => updateDraft(row.key, 'purchase', e.target.value)}
                          className="font-roboto h-8 w-24 text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span
                          className={`font-roboto ${
                            !row.hasCost ? 'text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {row.hasCost ? formatPrice(row.purchase) : '—'}
                        </span>
                      )}
                    </td>

                    {/* Packaging cost */}
                    <td className="px-4 py-3">
                      {editMode ? (
                        <Input
                          type="number"
                          min={0}
                          value={drafts[row.key]?.packaging ?? ''}
                          onChange={e => updateDraft(row.key, 'packaging', e.target.value)}
                          className="font-roboto h-8 w-24 text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className="font-roboto text-foreground">
                          {row.hasCost ? formatPrice(row.packaging) : '—'}
                        </span>
                      )}
                    </td>

                    {/* Storage cost */}
                    <td className="px-4 py-3">
                      {editMode ? (
                        <Input
                          type="number"
                          min={0}
                          value={drafts[row.key]?.storage ?? ''}
                          onChange={e => updateDraft(row.key, 'storage', e.target.value)}
                          className="font-roboto h-8 w-24 text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className="font-roboto text-foreground">
                          {row.hasCost ? formatPrice(row.storage) : '—'}
                        </span>
                      )}
                    </td>

                    {/* Other cost */}
                    <td className="px-4 py-3">
                      {editMode ? (
                        <Input
                          type="number"
                          min={0}
                          value={drafts[row.key]?.other ?? ''}
                          onChange={e => updateDraft(row.key, 'other', e.target.value)}
                          className="font-roboto h-8 w-24 text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className="font-roboto text-foreground">
                          {row.hasCost ? formatPrice(row.other) : '—'}
                        </span>
                      )}
                    </td>

                    {/* Total cost — auto-calculated */}
                    <td className="px-4 py-3 font-roboto font-medium text-foreground">
                      {row.hasCost || editMode ? formatPrice(row.totalCost) : '—'}
                    </td>

                    {/* Profit */}
                    <td className="px-4 py-3">
                      {row.hasCost || editMode ? (
                        <span className={`font-roboto font-medium ${profitColor(row.profit)}`}>
                          {formatPrice(row.profit)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Margin badge */}
                    <td className="px-4 py-3">
                      {row.hasCost || editMode ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getMarginColor(
                            row.margin,
                          )}`}
                        >
                          {row.margin >= 10 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {row.margin.toFixed(1)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center font-cairo text-muted-foreground"
                    >
                      {t('costs.noVariants')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom per-variation summary grid */}
      {summary.configured > 0 && rows.length > 1 && (
        <Card className="border bg-muted/20">
          <CardContent className="p-4">
            <h4 className="font-cairo font-semibold text-sm mb-3">{t('costs.summaryTitle')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
              {rows
                .filter(r => r.hasCost || editMode)
                .map(row => (
                  <div key={row.key} className="space-y-1 border rounded-lg p-3 bg-card">
                    <p className="font-cairo text-xs text-muted-foreground truncate">{row.label}</p>
                    <p className="font-roboto font-bold">{formatPrice(row.totalCost)}</p>
                    <p className={`font-roboto text-xs font-medium ${profitColor(row.profit)}`}>
                      {formatPrice(row.profit)}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${getMarginColor(
                        row.margin,
                      )}`}
                    >
                      {row.margin.toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
