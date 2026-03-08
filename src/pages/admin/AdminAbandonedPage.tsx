import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Search, Phone, ShoppingCart, Trash2, StickyNote, ArrowRight, ChevronDown, ChevronUp, PackageX, Users, DollarSign } from 'lucide-react';
import { useTranslation } from '@/i18n';
import TablePagination from '@/components/admin/TablePagination';

interface AbandonedOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_wilaya: string | null;
  cart_items: any[];
  cart_total: number;
  item_count: number;
  status: string;
  recovered_order_id: string | null;
  notes: string | null;
  abandoned_at: string;
}

export default function AdminAbandonedPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDialog, setNoteDialog] = useState<{ id: string; notes: string } | null>(null);
  const [convertDialog, setConvertDialog] = useState<AbandonedOrder | null>(null);
  const [converting, setConverting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    abandoned: { label: t('abandoned.statusAbandoned'), color: 'bg-destructive/10 text-destructive' },
    contacted: { label: t('abandoned.statusContacted'), color: 'bg-primary/10 text-primary' },
    recovered: { label: t('abandoned.statusRecovered'), color: 'bg-green-100 text-green-700' },
    lost: { label: t('abandoned.statusLost'), color: 'bg-muted text-muted-foreground' },
  };

  const { data: abandoned, isLoading } = useQuery({
    queryKey: ['abandoned-orders', statusFilter],
    queryFn: async () => {
      let q = supabase.from('abandoned_orders').select('*').order('abandoned_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AbandonedOrder[];
    },
  });

  const filtered = abandoned?.filter(a => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return a.customer_name.toLowerCase().includes(s) || a.customer_phone.includes(s);
  }) || [];

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedFiltered = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // KPI calculations
  const abandonedCount = abandoned?.filter(a => a.status === 'abandoned').length || 0;
  const contactedCount = abandoned?.filter(a => a.status === 'contacted').length || 0;
  const abandonedValue = abandoned?.filter(a => a.status === 'abandoned').reduce((s, a) => s + Number(a.cart_total), 0) || 0;

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('abandoned_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['abandoned-orders'] });
    toast.success(t('abandoned.statusUpdated'));
  };

  const saveNote = async () => {
    if (!noteDialog) return;
    await supabase.from('abandoned_orders').update({ notes: noteDialog.notes, updated_at: new Date().toISOString() }).eq('id', noteDialog.id);
    queryClient.invalidateQueries({ queryKey: ['abandoned-orders'] });
    setNoteDialog(null);
    toast.success(t('abandoned.noteSaved'));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('abandoned_orders').delete().eq('id', deleteId);
    queryClient.invalidateQueries({ queryKey: ['abandoned-orders'] });
    setDeleteId(null);
    toast.success(t('abandoned.deleted'));
  };

  const handleConvert = async () => {
    if (!convertDialog) return;
    setConverting(true);
    try {
      // Create order
      const { data: order, error } = await supabase.from('orders').insert({
        order_number: '',
        customer_name: convertDialog.customer_name,
        customer_phone: convertDialog.customer_phone,
        subtotal: convertDialog.cart_total,
        total_amount: convertDialog.cart_total,
        shipping_cost: 0,
        discount_amount: 0,
        payment_method: 'cod',
        status: 'جديد',
      }).select().single();
      if (error) throw error;

      // Create order items
      const items = (convertDialog.cart_items || []).map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,
        ...(item.variant_id ? { variant_id: item.variant_id } : {}),
      }));
      if (items.length > 0) {
        await supabase.from('order_items').insert(items);
      }

      // Mark abandoned as recovered
      await supabase.from('abandoned_orders').update({
        status: 'recovered',
        recovered_order_id: order.id,
        updated_at: new Date().toISOString(),
      }).eq('id', convertDialog.id);

      queryClient.invalidateQueries({ queryKey: ['abandoned-orders'] });
      setConvertDialog(null);
      toast.success(`Order #${order.order_number} created`);
    } catch {
      toast.error(t('abandoned.convertError'));
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <PackageX className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-cairo text-sm text-muted-foreground">{t('abandoned.abandonedCarts')}</p>
              <p className="font-cairo font-bold text-xl">{abandonedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-cairo text-sm text-muted-foreground">{t('abandoned.contacted')}</p>
              <p className="font-cairo font-bold text-xl">{contactedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-cairo text-sm text-muted-foreground">{t('abandoned.abandonedValue')}</p>
              <p className="font-cairo font-bold text-xl">{formatPrice(abandonedValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('abandoned.searchPlaceholder')} className="pr-9 font-cairo" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 font-cairo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-cairo">{t('common.all')}</SelectItem>
            <SelectItem value="abandoned" className="font-cairo">{t('abandoned.statusAbandoned')}</SelectItem>
            <SelectItem value="contacted" className="font-cairo">{t('abandoned.statusContacted')}</SelectItem>
            <SelectItem value="recovered" className="font-cairo">{t('abandoned.statusRecovered')}</SelectItem>
            <SelectItem value="lost" className="font-cairo">{t('abandoned.statusLost')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <PackageX className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-cairo text-lg text-muted-foreground">{t('abandoned.noAbandoned')}</p>
          <p className="font-cairo text-sm text-muted-foreground/70 mt-1">{t('abandoned.autoCaptureHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const statusInfo = STATUS_MAP[a.status] || STATUS_MAP.abandoned;
            const isExpanded = expandedId === a.id;
            return (
              <Card key={a.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-cairo font-bold text-sm truncate">{a.customer_name}</span>
                        <Badge variant="outline" className={`text-[11px] font-cairo ${statusInfo.color}`}>{statusInfo.label}</Badge>
                      </div>
                      <p className="font-roboto text-sm text-muted-foreground" dir="ltr">{a.customer_phone}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-cairo">
                        <span>{a.item_count} {t('common.products')}</span>
                        <span>•</span>
                        <span className="font-roboto font-semibold text-foreground">{formatPrice(Number(a.cart_total))}</span>
                        <span>•</span>
                        <span>{new Date(a.abandoned_at).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {a.notes && <p className="font-cairo text-xs text-muted-foreground mt-1 truncate">📝 {a.notes}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <Button variant="outline" size="sm" className="h-8 gap-1 font-cairo text-xs" asChild>
                        <a href={`tel:${a.customer_phone}`}><Phone className="w-3.5 h-3.5" /> {t('abandoned.call')}</a>
                      </Button>
                      {a.status !== 'recovered' && (
                        <Button variant="default" size="sm" className="h-8 gap-1 font-cairo text-xs" onClick={() => setConvertDialog(a)}>
                          <ArrowRight className="w-3.5 h-3.5" /> {t('abandoned.convertToOrder')}
                        </Button>
                      )}
                      <Select value={a.status} onValueChange={v => updateStatus(a.id, v)}>
                        <SelectTrigger className="h-8 w-28 font-cairo text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="abandoned" className="font-cairo text-xs">{t('abandoned.statusAbandoned')}</SelectItem>
                          <SelectItem value="contacted" className="font-cairo text-xs">{t('abandoned.statusContacted')}</SelectItem>
                          <SelectItem value="lost" className="font-cairo text-xs">{t('abandoned.statusLost')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNoteDialog({ id: a.id, notes: a.notes || '' })}>
                        <StickyNote className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(a.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded products */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      {(a.cart_items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3">
                          {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded object-cover border" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-cairo text-sm truncate">{item.name}</p>
                            {item.variant_label && <p className="font-cairo text-xs text-muted-foreground">{item.variant_label}</p>}
                          </div>
                          <span className="font-cairo text-xs text-muted-foreground">×{item.quantity}</span>
                          <span className="font-roboto text-sm font-semibold">{formatPrice(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Note Dialog */}
      <Dialog open={!!noteDialog} onOpenChange={o => !o && setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-cairo">{t('abandoned.note')}</DialogTitle></DialogHeader>
          <Textarea value={noteDialog?.notes || ''} onChange={e => setNoteDialog(prev => prev ? { ...prev, notes: e.target.value } : null)} placeholder="..." className="font-cairo" rows={4} />
          <DialogFooter>
            <Button onClick={saveNote} className="font-cairo">{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={!!convertDialog} onOpenChange={o => !o && setConvertDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-cairo">{t('abandoned.convertTitle')}</DialogTitle></DialogHeader>
          {convertDialog && (
            <div className="space-y-3">
              <p className="font-cairo text-sm"><strong>{t('common.customer')}:</strong> {convertDialog.customer_name}</p>
              <p className="font-cairo text-sm"><strong>{t('common.phone')}:</strong> <span dir="ltr">{convertDialog.customer_phone}</span></p>
              <div className="border rounded-lg p-3 space-y-2">
                {(convertDialog.cart_items || []).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm font-cairo">
                    <span>{item.name} {item.variant_label ? `(${item.variant_label})` : ''} ×{item.quantity}</span>
                    <span className="font-roboto">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                <hr />
                <div className="flex justify-between font-cairo font-bold">
                  <span>{t('common.total')}</span>
                  <span className="font-roboto">{formatPrice(Number(convertDialog.cart_total))}</span>
                </div>
              </div>
              <p className="font-cairo text-xs text-muted-foreground">{t('abandoned.convertHint')}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialog(null)} className="font-cairo">{t('common.cancel')}</Button>
            <Button onClick={handleConvert} disabled={converting} className="font-cairo">{converting ? t('abandoned.converting') : t('abandoned.confirmConvert')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-cairo">{t('abandoned.deleteTitle')}</DialogTitle></DialogHeader>
          <p className="font-cairo text-sm text-muted-foreground">{t('abandoned.deleteMessage')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-cairo">{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} className="font-cairo">{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
