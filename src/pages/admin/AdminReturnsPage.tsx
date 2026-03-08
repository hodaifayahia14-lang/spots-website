import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, formatDate } from '@/lib/format';
import {
  Search, Eye, RotateCcw, Clock, CheckCircle, XCircle, Truck, Package,
  PackageCheck, AlertTriangle, Plus, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import { useTranslation } from '@/i18n';

const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'pickup_scheduled', 'in_transit', 'received', 'inspected', 'completed', 'cancelled', 'disputed'];

const STATUS_LABELS: Record<string, string> = {
  requested: 'بانتظار المراجعة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
  pickup_scheduled: 'جاري الاستلام',
  in_transit: 'في الطريق',
  received: 'تم الاستلام',
  inspected: 'تم الفحص',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  disputed: 'متنازع عليه',
};

const STATUS_STYLE: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
  requested: { color: 'text-orange-600', bg: 'bg-orange-100', icon: Clock },
  approved: { color: 'text-blue-600', bg: 'bg-blue-100', icon: CheckCircle },
  rejected: { color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
  pickup_scheduled: { color: 'text-purple-600', bg: 'bg-purple-100', icon: Truck },
  in_transit: { color: 'text-indigo-600', bg: 'bg-indigo-100', icon: Truck },
  received: { color: 'text-teal-600', bg: 'bg-teal-100', icon: Package },
  inspected: { color: 'text-cyan-600', bg: 'bg-cyan-100', icon: Eye },
  completed: { color: 'text-primary', bg: 'bg-primary/10', icon: PackageCheck },
  cancelled: { color: 'text-muted-foreground', bg: 'bg-muted', icon: XCircle },
  disputed: { color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
};

const RESOLUTION_LABELS: Record<string, string> = {
  refund: 'استرجاع',
  exchange: 'استبدال',
  store_credit: 'رصيد متجر',
};

export default function AdminReturnsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [typeFilter, setTypeFilter] = useState('الكل');
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch returns with joins
  const { data: returns, isLoading } = useQuery({
    queryKey: ['admin-returns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('return_requests')
        .select('*, return_reasons(label_ar, fault_type), orders(order_number)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Fetch return items for selected return
  const { data: returnItems } = useQuery({
    queryKey: ['return-items', selectedReturn?.id],
    queryFn: async () => {
      if (!selectedReturn) return [];
      const { data } = await supabase
        .from('return_items')
        .select('*')
        .eq('return_request_id', selectedReturn.id);
      return data || [];
    },
    enabled: !!selectedReturn,
  });

  // Fetch status history for selected return
  const { data: statusHistory } = useQuery({
    queryKey: ['return-history', selectedReturn?.id],
    queryFn: async () => {
      if (!selectedReturn) return [];
      const { data } = await supabase
        .from('return_status_history')
        .select('*')
        .eq('return_request_id', selectedReturn.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!selectedReturn,
  });

  // KPI stats
  const stats = useMemo(() => {
    if (!returns) return { total: 0, pending: 0, inProgress: 0, completed: 0 };
    return {
      total: returns.length,
      pending: returns.filter(r => r.status === 'requested').length,
      inProgress: returns.filter(r => ['approved', 'pickup_scheduled', 'in_transit', 'received', 'inspected'].includes(r.status)).length,
      completed: returns.filter(r => r.status === 'completed').length,
    };
  }, [returns]);

  // Filtered list
  const filtered = useMemo(() => {
    return (returns || []).filter(r => {
      const matchSearch = !search ||
        r.return_number?.includes(search) ||
        r.customer_name?.includes(search) ||
        r.customer_phone?.includes(search) ||
        (r as any).orders?.order_number?.includes(search);
      const matchStatus = statusFilter === 'الكل' || r.status === statusFilter;
      const matchType = typeFilter === 'الكل' || r.resolution_type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [returns, search, statusFilter, typeFilter]);

  // Status update mutation
  const updateReturn = useMutation({
    mutationFn: async (params: { id: string; updates: Record<string, any>; newStatus?: string; oldStatus?: string; reason?: string }) => {
      const { error } = await supabase.from('return_requests').update(params.updates).eq('id', params.id);
      if (error) throw error;
      if (params.newStatus) {
        await supabase.from('return_status_history').insert({
          return_request_id: params.id,
          from_status: params.oldStatus || null,
          to_status: params.newStatus,
          change_reason: params.reason || null,
        });
      }
      // Restock items when return is completed
      if (params.newStatus === 'completed') {
        const { data: returnItems } = await supabase
          .from('return_items')
          .select('product_id, variant_id, quantity_returned')
          .eq('return_request_id', params.id);
        if (returnItems) {
          for (const item of returnItems) {
            if (item.variant_id) {
              const { data: variant } = await supabase.from('product_variants').select('quantity').eq('id', item.variant_id).single();
              if (variant) {
                await supabase.from('product_variants').update({ quantity: variant.quantity + item.quantity_returned }).eq('id', item.variant_id);
              }
            }
            const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
            if (prod) {
              await supabase.from('products').update({ stock: (prod.stock || 0) + item.quantity_returned }).eq('id', item.product_id);
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-returns'] });
      qc.invalidateQueries({ queryKey: ['return-history'] });
      toast({ title: 'تم التحديث ✅' });
    },
  });

  return (
    <div className="space-y-4 min-w-0">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={t('returns.totalReturns')} value={stats.total} icon={RotateCcw} color="text-foreground" />
        <KpiCard label={t('returns.pendingReview')} value={stats.pending} icon={Clock} color="text-orange-600" />
        <KpiCard label={t('returns.inProgress')} value={stats.inProgress} icon={Truck} color="text-blue-600" />
        <KpiCard label={t('returns.completed')} value={stats.completed} icon={PackageCheck} color="text-primary" />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('returns.searchPlaceholder')} className="pr-10 font-cairo" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 font-cairo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="الكل" className="font-cairo">{t('returns.allStatuses')}</SelectItem>
            {RETURN_STATUSES.map(s => (
              <SelectItem key={s} value={s} className="font-cairo">{t(`returns.status${s.charAt(0).toUpperCase() + s.slice(1).replace('_', '')}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36 font-cairo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="الكل" className="font-cairo">{t('returns.allTypes')}</SelectItem>
            <SelectItem value="refund" className="font-cairo">{t('returns.refund')}</SelectItem>
            <SelectItem value="exchange" className="font-cairo">{t('returns.exchange')}</SelectItem>
            <SelectItem value="store_credit" className="font-cairo">{t('returns.storeCredit')}</SelectItem>
          </SelectContent>
        </Select>
        <Button className="font-cairo gap-2" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4" />
          {t('returns.createReturn')}
        </Button>
      </div>

      {/* Table - Desktop */}
      <div className="bg-card border rounded-lg overflow-x-auto max-w-full hidden md:block">
        <table className="text-sm min-w-[860px] whitespace-nowrap">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-right font-cairo">{t('returns.returnNumber')}</th>
              <th className="p-3 text-right font-cairo">{t('returns.order')}</th>
              <th className="p-3 text-right font-cairo">{t('returns.customer')}</th>
              <th className="p-3 text-right font-cairo hidden md:table-cell">{t('returns.reason')}</th>
              <th className="p-3 text-right font-cairo">{t('returns.resolutionType')}</th>
              <th className="p-3 text-right font-cairo hidden md:table-cell">{t('returns.amount')}</th>
              <th className="p-3 text-right font-cairo">{t('common.status')}</th>
              <th className="p-3 text-right font-cairo hidden md:table-cell">{t('common.date')}</th>
              <th className="p-3 text-right font-cairo">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="p-8 text-center font-cairo text-muted-foreground">{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center font-cairo text-muted-foreground">{t('returns.noReturns')}</td></tr>
            ) : filtered.map(r => {
              const style = STATUS_STYLE[r.status] || STATUS_STYLE.requested;
              const StatusIcon = style.icon;
              return (
                <tr key={r.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-roboto font-bold text-primary">{r.return_number}</td>
                  <td className="p-3 font-roboto text-xs">{(r as any).orders?.order_number}</td>
                  <td className="p-3 font-cairo">
                    <div>{r.customer_name}</div>
                    <div className="text-xs text-muted-foreground font-roboto">{r.customer_phone}</div>
                  </td>
                  <td className="p-3 font-cairo text-xs hidden md:table-cell">{(r as any).return_reasons?.label_ar || '-'}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="font-cairo text-xs">{RESOLUTION_LABELS[r.resolution_type] || r.resolution_type}</Badge>
                  </td>
                  <td className="p-3 font-roboto hidden md:table-cell">{formatPrice(Number(r.net_refund_amount))}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-cairo ${style.bg} ${style.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="p-3 font-cairo text-xs text-muted-foreground hidden md:table-cell">{formatDate(r.created_at)}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedReturn(r)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center font-cairo text-muted-foreground">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border rounded-lg p-8 text-center font-cairo text-muted-foreground">{t('returns.noReturns')}</div>
        ) : filtered.map(r => {
          const style = STATUS_STYLE[r.status] || STATUS_STYLE.requested;
          const StatusIcon = style.icon;
          return (
            <div key={r.id} className="bg-card border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-roboto font-bold text-primary text-sm">{r.return_number}</p>
                  <p className="font-cairo font-medium">{r.customer_name}</p>
                  <p className="text-xs text-muted-foreground font-roboto">{r.customer_phone}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-cairo ${style.bg} ${style.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {STATUS_LABELS[r.status]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="font-cairo text-xs text-muted-foreground">{t('returns.order')}</p>
                  <p className="font-roboto font-medium text-xs">{(r as any).orders?.order_number || '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="font-cairo text-xs text-muted-foreground">{t('returns.amount')}</p>
                  <p className="font-roboto font-medium">{formatPrice(Number(r.net_refund_amount))}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="font-cairo text-xs text-muted-foreground">{t('returns.resolutionType')}</p>
                  <Badge variant="outline" className="font-cairo text-xs mt-0.5">{RESOLUTION_LABELS[r.resolution_type] || r.resolution_type}</Badge>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="font-cairo text-xs text-muted-foreground">{t('common.date')}</p>
                  <p className="font-cairo text-xs">{formatDate(r.created_at)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full font-cairo gap-1" onClick={() => setSelectedReturn(r)}>
                <Eye className="w-3.5 h-3.5" /> {t('common.view')}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      {selectedReturn && (
        <ReturnDetailDialog
          returnReq={selectedReturn}
          items={returnItems || []}
          history={statusHistory || []}
          onClose={() => setSelectedReturn(null)}
          onAction={(id, updates, newStatus, oldStatus, reason) => {
            updateReturn.mutate({ id, updates, newStatus, oldStatus, reason });
            if (newStatus) setSelectedReturn((prev: any) => prev ? { ...prev, status: newStatus, ...updates } : null);
          }}
          isPending={updateReturn.isPending}
        />
      )}

      {/* Create Return Dialog */}
      {showCreateDialog && (
        <CreateReturnDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['admin-returns'] });
            setShowCreateDialog(false);
          }}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Clock; color: string }) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="font-roboto font-bold text-2xl">{value}</span>
      </div>
      <p className="font-cairo text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function ReturnDetailDialog({
  returnReq, items, history, onClose, onAction, isPending
}: {
  returnReq: any;
  items: any[];
  history: any[];
  onClose: () => void;
  onAction: (id: string, updates: Record<string, any>, newStatus?: string, oldStatus?: string, reason?: string) => void;
  isPending: boolean;
}) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [merchantNotes, setMerchantNotes] = useState(returnReq.merchant_notes || '');
  const [trackingNumber, setTrackingNumber] = useState(returnReq.pickup_tracking_number || '');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = () => {
    onAction(returnReq.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      merchant_notes: merchantNotes || null,
    }, 'approved', returnReq.status);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onAction(returnReq.id, {
      status: 'rejected',
      rejection_reason: rejectionReason,
      merchant_notes: merchantNotes || null,
    }, 'rejected', returnReq.status, rejectionReason);
  };

  const handleMarkReceived = () => {
    onAction(returnReq.id, {
      status: 'received',
      item_received_at: new Date().toISOString(),
      pickup_tracking_number: trackingNumber || null,
    }, 'received', returnReq.status);
  };

  const handleComplete = () => {
    onAction(returnReq.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }, 'completed', returnReq.status);
  };

  const style = STATUS_STYLE[returnReq.status] || STATUS_STYLE.requested;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-cairo flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            تفاصيل الاسترجاع — {returnReq.return_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status + Type */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-cairo font-semibold ${style.bg} ${style.color}`}>
              {STATUS_LABELS[returnReq.status]}
            </span>
            <Badge variant="outline" className="font-cairo">{RESOLUTION_LABELS[returnReq.resolution_type]}</Badge>
            {returnReq.return_reasons && (
              <Badge variant="secondary" className="font-cairo">
                {(returnReq as any).return_reasons.label_ar}
                {(returnReq as any).return_reasons.fault_type === 'merchant_fault' && ' (خطأ التاجر)'}
              </Badge>
            )}
          </div>

          {/* Customer Info */}
          <div className="bg-muted rounded-lg p-4 grid grid-cols-2 gap-3">
            <div>
              <p className="font-cairo text-xs text-muted-foreground">العميل</p>
              <p className="font-cairo font-semibold">{returnReq.customer_name}</p>
            </div>
            <div>
              <p className="font-cairo text-xs text-muted-foreground">الهاتف</p>
              <p className="font-roboto font-semibold">{returnReq.customer_phone}</p>
            </div>
            <div>
              <p className="font-cairo text-xs text-muted-foreground">رقم الطلب</p>
              <p className="font-roboto font-semibold">{(returnReq as any).orders?.order_number}</p>
            </div>
            <div>
              <p className="font-cairo text-xs text-muted-foreground">تاريخ الطلب</p>
              <p className="font-cairo text-sm">{formatDate(returnReq.requested_at)}</p>
            </div>
          </div>

          {/* Reason Notes */}
          {returnReq.reason_notes && (
            <div className="bg-card border rounded-lg p-3">
              <p className="font-cairo text-xs text-muted-foreground mb-1">ملاحظات العميل</p>
              <p className="font-cairo text-sm">{returnReq.reason_notes}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="font-cairo font-bold text-sm mb-2">المنتجات المسترجعة</h3>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-muted rounded-lg p-3">
                  <div>
                    <p className="font-cairo font-semibold text-sm">{item.product_name}</p>
                    {item.variant_label && <p className="font-cairo text-xs text-muted-foreground">{item.variant_label}</p>}
                    <p className="font-cairo text-xs">الكمية: {item.quantity_returned} من {item.quantity_ordered}</p>
                  </div>
                  <p className="font-roboto font-bold">{formatPrice(Number(item.item_total))}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-card border rounded-lg p-4 space-y-2">
            <h3 className="font-cairo font-bold text-sm">الملخص المالي</h3>
            <div className="flex justify-between font-cairo text-sm">
              <span>إجمالي المنتجات</span>
              <span className="font-roboto">{formatPrice(Number(returnReq.total_refund_amount))}</span>
            </div>
            <div className="flex justify-between font-cairo text-sm">
              <span>تكلفة الشحن ({returnReq.shipping_paid_by === 'merchant' ? 'على التاجر' : 'على العميل'})</span>
              <span className="font-roboto">{formatPrice(Number(returnReq.return_shipping_cost))}</span>
            </div>
            <div className="flex justify-between font-cairo font-bold border-t pt-2">
              <span>صافي الاسترجاع</span>
              <span className="font-roboto text-primary">{formatPrice(Number(returnReq.net_refund_amount))}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 border-t pt-4">
            {returnReq.status === 'requested' && (
              <>
                <div>
                  <Label className="font-cairo text-sm">ملاحظات التاجر</Label>
                  <Textarea value={merchantNotes} onChange={e => setMerchantNotes(e.target.value)} className="font-cairo mt-1" placeholder="ملاحظات داخلية..." />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleApprove} disabled={isPending} className="font-cairo gap-2 flex-1">
                    <CheckCircle className="w-4 h-4" /> موافقة
                  </Button>
                  <Button variant="destructive" onClick={() => setShowRejectForm(!showRejectForm)} className="font-cairo gap-2 flex-1">
                    <XCircle className="w-4 h-4" /> رفض
                  </Button>
                </div>
                {showRejectForm && (
                  <div className="space-y-2">
                    <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="font-cairo" placeholder="سبب الرفض (مطلوب)..." />
                    <Button variant="destructive" onClick={handleReject} disabled={isPending || !rejectionReason.trim()} className="font-cairo w-full">
                      تأكيد الرفض
                    </Button>
                  </div>
                )}
              </>
            )}

            {returnReq.status === 'approved' && (
              <div className="space-y-2">
                <Label className="font-cairo text-sm">رقم التتبع (اختياري)</Label>
                <Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} className="font-roboto" dir="ltr" placeholder="رقم التتبع..." />
                <Button onClick={handleMarkReceived} disabled={isPending} className="font-cairo gap-2 w-full">
                  <Package className="w-4 h-4" /> تأكيد الاستلام
                </Button>
              </div>
            )}

            {returnReq.status === 'received' && (
              <Button onClick={handleComplete} disabled={isPending} className="font-cairo gap-2 w-full">
                <PackageCheck className="w-4 h-4" /> إتمام الاسترجاع
              </Button>
            )}

            {returnReq.rejection_reason && (
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="font-cairo text-xs text-destructive font-semibold">سبب الرفض:</p>
                <p className="font-cairo text-sm">{returnReq.rejection_reason}</p>
              </div>
            )}
          </div>

          {/* Status History Timeline */}
          {history.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-cairo font-bold text-sm mb-3">سجل الحالات</h3>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-cairo text-sm font-semibold">{STATUS_LABELS[h.to_status] || h.to_status}</span>
                        {h.from_status && (
                          <span className="font-cairo text-xs text-muted-foreground">← {STATUS_LABELS[h.from_status] || h.from_status}</span>
                        )}
                      </div>
                      {h.change_reason && <p className="font-cairo text-xs text-muted-foreground">{h.change_reason}</p>}
                      <p className="font-cairo text-xs text-muted-foreground/70">{formatDate(h.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateReturnDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [resolutionType, setResolutionType] = useState('refund');
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);

  const { data: reasons } = useQuery({
    queryKey: ['return-reasons'],
    queryFn: async () => {
      const { data } = await supabase.from('return_reasons').select('*').eq('is_active', true).order('position');
      return data || [];
    },
  });

  const searchOrder = async () => {
    if (!orderSearch.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .or(`order_number.eq.${orderSearch.trim()},customer_phone.eq.${orderSearch.trim()}`)
      .eq('status', 'تم التسليم')
      .limit(1)
      .single();
    
    if (data) {
      setSelectedOrder(data);
      const { data: items } = await supabase
        .from('order_items')
        .select('*, products(name)')
        .eq('order_id', data.id);
      setOrderItems(items || []);
    } else {
      toast({ title: 'لم يتم العثور على طلب مسلّم بهذا الرقم', variant: 'destructive' });
    }
    setSearching(false);
  };

  const toggleItem = (itemId: string, qty: number) => {
    const next = new Map(selectedItems);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.set(itemId, qty);
    }
    setSelectedItems(next);
  };

  const handleCreate = async () => {
    if (!selectedOrder || selectedItems.size === 0 || !reasonId) {
      toast({ title: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      // Calculate totals
      let totalRefund = 0;
      const itemsToInsert: any[] = [];
      selectedItems.forEach((qty, itemId) => {
        const orderItem = orderItems.find(i => i.id === itemId);
        if (orderItem) {
          const itemTotal = qty * Number(orderItem.unit_price);
          totalRefund += itemTotal;
          itemsToInsert.push({
            order_item_id: itemId,
            product_id: orderItem.product_id,
            variant_id: orderItem.variant_id,
            product_name: (orderItem as any).products?.name || 'منتج',
            quantity_ordered: orderItem.quantity,
            quantity_returned: qty,
            unit_price: orderItem.unit_price,
            item_total: itemTotal,
          });
        }
      });

      // Get fault type from reason
      const reason = reasons?.find(r => r.id === reasonId);
      const shippingPaidBy = reason?.fault_type === 'merchant_fault' ? 'merchant' : 'customer';

      // Insert return request (return_number auto-generated by trigger)
      const { data: returnReq, error } = await supabase
        .from('return_requests')
        .insert({
          order_id: selectedOrder.id,
          return_number: '', // trigger generates this
          customer_name: selectedOrder.customer_name,
          customer_phone: selectedOrder.customer_phone,
          resolution_type: resolutionType,
          reason_id: reasonId,
          reason_notes: notes || null,
          total_refund_amount: totalRefund,
          net_refund_amount: totalRefund,
          shipping_paid_by: shippingPaidBy,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert return items
      const returnItems = itemsToInsert.map(item => ({
        ...item,
        return_request_id: returnReq.id,
      }));
      await supabase.from('return_items').insert(returnItems);

      // Insert initial status history
      await supabase.from('return_status_history').insert({
        return_request_id: returnReq.id,
        to_status: 'requested',
        change_reason: 'تم إنشاء طلب الاسترجاع من لوحة التحكم',
      });

      toast({ title: `تم إنشاء طلب الاسترجاع ${returnReq.return_number} ✅` });
      onCreated();
    } catch (err: any) {
      toast({ title: 'فشل إنشاء الاسترجاع', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-cairo">إنشاء طلب استرجاع جديد</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Find Order */}
          <div>
            <Label className="font-cairo">البحث عن الطلب (رقم الطلب أو الهاتف)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchOrder()} className="font-roboto" dir="ltr" placeholder="ORD-001 أو 0555..." />
              <Button variant="outline" onClick={searchOrder} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {selectedOrder && (
            <>
              <div className="bg-muted rounded-lg p-3">
                <p className="font-cairo text-sm">الطلب: <span className="font-roboto font-bold">{selectedOrder.order_number}</span></p>
                <p className="font-cairo text-sm">العميل: {selectedOrder.customer_name} — <span className="font-roboto">{selectedOrder.customer_phone}</span></p>
              </div>

              {/* Step 2: Select Items */}
              <div>
                <Label className="font-cairo">اختر المنتجات للاسترجاع</Label>
                <div className="space-y-2 mt-2">
                  {orderItems.map(item => (
                    <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedItems.has(item.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`} onClick={() => toggleItem(item.id, item.quantity)}>
                      <div className="flex-1">
                        <p className="font-cairo text-sm font-semibold">{(item as any).products?.name}</p>
                        <p className="font-cairo text-xs text-muted-foreground">الكمية: {item.quantity} × {formatPrice(Number(item.unit_price))}</p>
                      </div>
                      {selectedItems.has(item.id) && (
                        <Input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={selectedItems.get(item.id)}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const v = Math.min(Math.max(1, parseInt(e.target.value) || 1), item.quantity);
                            setSelectedItems(new Map(selectedItems).set(item.id, v));
                          }}
                          className="w-16 font-roboto text-center"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: Resolution + Reason */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-cairo">نوع الحل</Label>
                  <Select value={resolutionType} onValueChange={setResolutionType}>
                    <SelectTrigger className="font-cairo mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="refund" className="font-cairo">استرجاع</SelectItem>
                      <SelectItem value="exchange" className="font-cairo">استبدال</SelectItem>
                      <SelectItem value="store_credit" className="font-cairo">رصيد متجر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-cairo">السبب</Label>
                  <Select value={reasonId} onValueChange={setReasonId}>
                    <SelectTrigger className="font-cairo mt-1"><SelectValue placeholder="اختر السبب" /></SelectTrigger>
                    <SelectContent>
                      {reasons?.map(r => (
                        <SelectItem key={r.id} value={r.id} className="font-cairo">{r.label_ar}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="font-cairo">ملاحظات</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="font-cairo mt-1" placeholder="ملاحظات إضافية..." />
              </div>

              <Button onClick={handleCreate} disabled={creating || selectedItems.size === 0 || !reasonId} className="font-cairo gap-2 w-full">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                إنشاء طلب الاسترجاع
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
