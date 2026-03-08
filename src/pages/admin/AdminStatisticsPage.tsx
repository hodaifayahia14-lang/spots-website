import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, MapPin, Package, XCircle, ShoppingCart, Award } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

type Period = '1d' | '7d' | '30d' | '90d' | '365d' | 'all';

function periodToDate(period: Period): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  const days = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[period];
  now.setDate(now.getDate() - days);
  return now;
}

const PERIOD_LABELS: Record<Period, string> = {
  '1d': 'آخر يوم',
  '7d': 'آخر أسبوع',
  '30d': 'آخر شهر',
  '90d': 'آخر 3 أشهر',
  '365d': 'آخر سنة',
  'all': 'الكل',
};

const BAR_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(30, 80%, 55%)',
  'hsl(var(--secondary))',
  'hsl(280, 60%, 50%)',
];

export default function AdminStatisticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('30d');

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ['stats-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, status, created_at, total_amount, wilaya_id, wilayas(name)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: orderItems, isLoading: loadingItems } = useQuery({
    queryKey: ['stats-order-items'],
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity, unit_price, products(name, images)');
      return data || [];
    },
  });

  const isLoading = loadingOrders || loadingItems;

  // Filter orders by period
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const since = periodToDate(period);
    if (!since) return orders;
    return orders.filter(o => new Date(o.created_at!) >= since);
  }, [orders, period]);

  const filteredOrderIds = useMemo(() => new Set(filteredOrders.map(o => o.id)), [filteredOrders]);

  // Best selling products
  const topProducts = useMemo(() => {
    if (!orderItems) return [];
    const productMap = new Map<string, { name: string; image: string; qty: number; revenue: number }>();

    for (const item of orderItems) {
      if (!filteredOrderIds.has(item.order_id)) continue;
      const pid = item.product_id || 'unknown';
      const existing = productMap.get(pid);
      const productData = item.products as any;
      if (existing) {
        existing.qty += item.quantity;
        existing.revenue += item.quantity * item.unit_price;
      } else {
        productMap.set(pid, {
          name: productData?.name || 'منتج محذوف',
          image: productData?.images?.[0] || '',
          qty: item.quantity,
          revenue: item.quantity * item.unit_price,
        });
      }
    }

    return Array.from(productMap.entries())
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [orderItems, filteredOrderIds]);

  // Best wilayas (by demand + cancellation rate)
  const wilayaStats = useMemo(() => {
    if (!filteredOrders.length) return [];
    const wilayaMap = new Map<string, { name: string; total: number; delivered: number; cancelled: number; revenue: number }>();

    for (const order of filteredOrders) {
      const wid = order.wilaya_id || 'unknown';
      const wName = (order as any).wilayas?.name || 'غير محدد';
      const existing = wilayaMap.get(wid);
      if (existing) {
        existing.total++;
        if (order.status === 'تم التسليم') { existing.delivered++; existing.revenue += Number(order.total_amount || 0); }
        if (order.status === 'ملغي') existing.cancelled++;
      } else {
        wilayaMap.set(wid, {
          name: wName,
          total: 1,
          delivered: order.status === 'تم التسليم' ? 1 : 0,
          cancelled: order.status === 'ملغي' ? 1 : 0,
          revenue: order.status === 'تم التسليم' ? Number(order.total_amount || 0) : 0,
        });
      }
    }

    return Array.from(wilayaMap.entries())
      .map(([id, d]) => ({
        id,
        ...d,
        cancelRate: d.total > 0 ? (d.cancelled / d.total) * 100 : 0,
        deliveryRate: d.total > 0 ? (d.delivered / d.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [filteredOrders]);

  // Summary
  const summary = useMemo(() => {
    const total = filteredOrders.length;
    const delivered = filteredOrders.filter(o => o.status === 'تم التسليم').length;
    const cancelled = filteredOrders.filter(o => o.status === 'ملغي').length;
    const revenue = filteredOrders
      .filter(o => o.status === 'تم التسليم')
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    return { total, delivered, cancelled, revenue, cancelRate: total > 0 ? (cancelled / total) * 100 : 0 };
  }, [filteredOrders]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-cairo font-bold flex items-center gap-2">
            <BarChart className="w-6 h-6 text-primary" />
            {t('stats.title')}
          </h1>
          <p className="text-sm text-muted-foreground font-cairo mt-1">{t('stats.description')}</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-full sm:w-48 font-cairo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="font-cairo">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <span className="font-cairo text-xs text-muted-foreground">{t('stats.totalOrders')}</span>
            </div>
            <p className="font-roboto font-bold text-2xl">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="font-cairo text-xs text-muted-foreground">{t('stats.revenue')}</span>
            </div>
            <p className="font-roboto font-bold text-2xl">{formatPrice(summary.revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="font-cairo text-xs text-muted-foreground">{t('stats.delivered')}</span>
            </div>
            <p className="font-roboto font-bold text-2xl">{summary.delivered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="font-cairo text-xs text-muted-foreground">{t('stats.cancelRate')}</span>
            </div>
            <p className="font-roboto font-bold text-2xl">{summary.cancelRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="font-cairo text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            {t('stats.topProducts')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topProducts.length > 0 ? (
            <>
              {/* Chart */}
              <div className="p-4">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topProducts.slice(0, 7)} layout="vertical">
                    <XAxis type="number" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      fontSize={11}
                      tick={{ fontFamily: 'Cairo' }}
                    />
                    <Tooltip
                      formatter={(value: number) => [value, t('stats.unitsSold')]}
                      labelStyle={{ fontFamily: 'Cairo' }}
                    />
                    <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                      {topProducts.slice(0, 7).map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* List */}
              <div className="divide-y">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="font-roboto font-bold text-sm text-muted-foreground w-6 shrink-0">
                      #{i + 1}
                    </span>
                    {p.image ? (
                      <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-cairo text-sm font-medium truncate">{p.name}</p>
                      <p className="font-roboto text-xs text-muted-foreground">
                        {p.qty} {t('stats.unitsSold')} · {formatPrice(p.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="font-cairo text-sm text-muted-foreground">{t('stats.noData')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best Wilayas */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="font-cairo text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            {t('stats.topWilayas')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {wilayaStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="text-sm w-full min-w-[500px]">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-right font-cairo font-semibold px-4 py-2.5">{t('stats.wilaya')}</th>
                    <th className="text-right font-cairo font-semibold px-4 py-2.5">{t('stats.totalOrders')}</th>
                    <th className="text-right font-cairo font-semibold px-4 py-2.5">{t('stats.delivered')}</th>
                    <th className="text-right font-cairo font-semibold px-4 py-2.5">{t('stats.cancelRate')}</th>
                    <th className="text-right font-cairo font-semibold px-4 py-2.5">{t('stats.deliveryRate')}</th>
                    <th className="text-right font-cairo font-semibold px-4 py-2.5">{t('stats.revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {wilayaStats.map((w, i) => (
                    <tr key={w.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-cairo font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-roboto text-xs text-muted-foreground w-5">#{i + 1}</span>
                          {w.name}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-roboto">{w.total}</td>
                      <td className="px-4 py-2.5 font-roboto">{w.delivered}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={w.cancelRate > 30 ? 'destructive' : w.cancelRate > 15 ? 'secondary' : 'outline'}
                          className="font-roboto text-xs"
                        >
                          {w.cancelRate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={w.deliveryRate > 60 ? 'default' : 'secondary'}
                          className="font-roboto text-xs"
                        >
                          {w.deliveryRate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 font-roboto">{formatPrice(w.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="font-cairo text-sm text-muted-foreground">{t('stats.noData')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
