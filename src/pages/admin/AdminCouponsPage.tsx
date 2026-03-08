import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Package, Search, Tag, CheckCircle, XCircle, Wand2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useTranslation } from '@/i18n';
import TablePagination from '@/components/admin/TablePagination';

export default function AdminCouponsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: '', discount_type: 'percentage', discount_value: '', expiry_date: '', is_active: true });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Auto-generate coupon code
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm(f => ({ ...f, code }));
  };

  const { data: coupons } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data } = await supabase.from('coupons').select('*').order('code');
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['admin-products-list'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: couponProducts } = useQuery({
    queryKey: ['coupon-products'],
    queryFn: async () => {
      const { data } = await supabase.from('coupon_products').select('coupon_id, product_id');
      return (data || []) as { coupon_id: string; product_id: string }[];
    },
  });

  const getCouponProductCount = (couponId: string) => {
    return couponProducts?.filter(cp => cp.coupon_id === couponId).length || 0;
  };

  const openEditDialog = async (coupon: any) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      expiry_date: coupon.expiry_date ? coupon.expiry_date.split('T')[0] : '',
      is_active: coupon.is_active ?? true,
    });
    const ids = couponProducts?.filter(cp => cp.coupon_id === coupon.id).map(cp => cp.product_id) || [];
    setSelectedProductIds(ids);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditing(null);
    setForm({ code: '', discount_type: 'percentage', discount_value: '', expiry_date: '', is_active: true });
    setSelectedProductIds([]);
    setDialogOpen(true);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        expiry_date: form.expiry_date || null,
        is_active: form.is_active,
      };

      let couponId: string;
      if (editing) {
        await supabase.from('coupons').update(payload).eq('id', editing.id);
        couponId = editing.id;
      } else {
        const { data, error } = await supabase.from('coupons').insert(payload).select('id').single();
        if (error) throw error;
        couponId = data.id;
      }

      await supabase.from('coupon_products').delete().eq('coupon_id', couponId);
      if (selectedProductIds.length > 0) {
        const rows = selectedProductIds.map(product_id => ({ coupon_id: couponId, product_id }));
        await supabase.from('coupon_products').insert(rows);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      qc.invalidateQueries({ queryKey: ['coupon-products'] });
      setDialogOpen(false);
      toast({ title: t('common.savedSuccess') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('coupons').delete().eq('id', id); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      qc.invalidateQueries({ queryKey: ['coupon-products'] });
      toast({ title: t('common.deletedSuccess') });
    },
  });

  // KPI calculations
  const kpis = useMemo(() => {
    const all = coupons || [];
    const active = all.filter(c => c.is_active);
    const expired = all.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date());
    return { total: all.length, active: active.length, expired: expired.length };
  }, [coupons]);

  // Filtered coupons by search
  const filteredCoupons = useMemo(() => {
    if (!searchQuery) return coupons || [];
    const q = searchQuery.toLowerCase();
    return (coupons || []).filter(c => c.code.toLowerCase().includes(q));
  }, [coupons, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="font-cairo font-bold text-xl">{t('coupons.title')}</h2>
        <Button onClick={openNewDialog} className="font-cairo gap-1"><Plus className="w-4 h-4" /> {t('coupons.addCoupon')}</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Tag className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground font-cairo">{t('coupons.totalCoupons')}</p><p className="text-xl font-bold font-roboto">{kpis.total}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0"><CheckCircle className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground font-cairo">{t('coupons.activeCoupons')}</p><p className="text-xl font-bold font-roboto">{kpis.active}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0"><XCircle className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-xs text-muted-foreground font-cairo">{t('coupons.expiredCoupons')}</p><p className="text-xl font-bold font-roboto">{kpis.expired}</p></div>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('coupons.searchCoupons')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="ps-9 font-cairo h-10" />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-right font-cairo">{t('coupons.code')}</th>
              <th className="p-3 text-right font-cairo">{t('common.type')}</th>
              <th className="p-3 text-right font-cairo">{t('common.value')}</th>
              <th className="p-3 text-right font-cairo">{t('coupons.assignedProducts')}</th>
              <th className="p-3 text-right font-cairo">{t('coupons.expiry')}</th>
              <th className="p-3 text-right font-cairo">{t('common.status')}</th>
              <th className="p-3 text-right font-cairo">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCoupons.map(c => {
              const productCount = getCouponProductCount(c.id);
              return (
                <tr key={c.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-roboto font-bold">{c.code}</td>
                  <td className="p-3 font-cairo">{c.discount_type === 'percentage' ? t('common.percentage') : t('common.fixedAmount')}</td>
                  <td className="p-3 font-roboto">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} دج`}</td>
                  <td className="p-3">
                    {productCount > 0 ? (
                      <Badge variant="secondary" className="font-cairo gap-1"><Package className="w-3 h-3" />{productCount} {t('common.product')}</Badge>
                    ) : (
                      <span className="text-muted-foreground font-cairo text-xs">{t('coupons.allProducts')}</span>
                    )}
                  </td>
                  <td className="p-3 font-cairo text-xs">{c.expiry_date ? formatDate(c.expiry_date) : '—'}</td>
                  <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full font-cairo ${c.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{c.is_active ? t('common.active') : t('common.inactive')}</span></td>
                  <td className="p-3 flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(t('common.delete') + '?')) deleteMutation.mutate(c.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredCoupons.map(c => {
          const productCount = getCouponProductCount(c.id);
          return (
            <div key={c.id} className="bg-card border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-roboto font-bold text-sm">{c.code}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-cairo ${c.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{c.is_active ? t('common.active') : t('common.inactive')}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs font-cairo text-muted-foreground">
                <div>{t('common.type')}: {c.discount_type === 'percentage' ? t('common.percentage') : t('common.fixedAmount')}</div>
                <div>{t('common.value')}: <span className="font-roboto font-bold">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} دج`}</span></div>
                <div>{t('coupons.assignedProducts')}: {productCount > 0 ? `${productCount} ${t('common.product')}` : t('coupons.allProducts')}</div>
                <div>{t('coupons.expiry')}: {c.expiry_date ? formatDate(c.expiry_date) : '—'}</div>
              </div>
              <div className="flex justify-end gap-1 pt-2 border-t">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditDialog(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(t('common.delete') + '?')) deleteMutation.mutate(c.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-cairo">{editing ? t('coupons.editCoupon') : t('coupons.addCoupon')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-cairo">{t('coupons.code')}</Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="font-roboto flex-1" dir="ltr" placeholder="SUMMER2024" />
                <Button type="button" variant="outline" size="sm" onClick={generateCode} className="font-cairo gap-1 shrink-0">
                  <Wand2 className="w-3.5 h-3.5" /> {t('coupons.generateCode')}
                </Button>
              </div>
            </div>
            <div>
              <Label className="font-cairo">{t('coupons.discountType')}</Label>
              <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v }))}>
                <SelectTrigger className="font-cairo mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage" className="font-cairo">{t('coupons.percentage')}</SelectItem>
                  <SelectItem value="fixed" className="font-cairo">{t('coupons.fixed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="font-cairo">{t('coupons.discountValue')}</Label><Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} className="font-roboto mt-1" /></div>
            <div><Label className="font-cairo">{t('coupons.expiryDate')}</Label><Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="font-roboto mt-1" dir="ltr" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label className="font-cairo">{t('common.active')}</Label></div>

            {/* Product restriction */}
            <div>
              <Label className="font-cairo mb-2 block">{t('coupons.selectProducts')}</Label>
              <p className="text-xs text-muted-foreground font-cairo mb-2">{t('coupons.selectProductsHint')}</p>
              <ScrollArea className="h-40 border rounded-md p-2">
                <div className="space-y-2">
                  {products?.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1">
                      <Checkbox
                        checked={selectedProductIds.includes(p.id)}
                        onCheckedChange={() => toggleProduct(p.id)}
                      />
                      <span className="font-cairo text-sm">{p.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              {selectedProductIds.length > 0 && (
                <p className="text-xs text-primary font-cairo mt-1">{t('coupons.selectedProducts').replace('{n}', String(selectedProductIds.length))}</p>
              )}
            </div>

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full font-cairo font-semibold">{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
