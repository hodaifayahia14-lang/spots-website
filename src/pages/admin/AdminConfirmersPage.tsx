import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, Pencil, UserCheck, Search, ToggleLeft, ToggleRight, Settings, Users, UserPlus, Eye, EyeOff } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useTranslation } from '@/i18n';
import TablePagination from '@/components/admin/TablePagination';

const TYPE_OPTIONS = [
  { value: 'private', label: 'خاص', color: 'bg-primary/10 text-primary' },
  { value: 'external', label: 'خارجي', color: 'bg-secondary/10 text-secondary' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'نشط', color: 'bg-primary/10 text-primary' },
  { value: 'inactive', label: 'غير نشط', color: 'bg-muted text-muted-foreground' },
];

const PAYMENT_MODE_OPTIONS = [
  { value: 'per_order', label: 'دفع حسب الطلبات' },
  { value: 'monthly', label: 'دفع شهري' },
];

export default function AdminConfirmersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();

  // Tab 2 state
  const [editingConfirmer, setEditingConfirmer] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('الكل');
  const [filterStatus, setFilterStatus] = useState('الكل');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Tab 1: Add form state
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addType, setAddType] = useState('private');
  const [addPaymentMode, setAddPaymentMode] = useState('per_order');
  const [addConfirmationPrice, setAddConfirmationPrice] = useState('0');
  const [addCancellationPrice, setAddCancellationPrice] = useState('0');
  const [addMonthlySalary, setAddMonthlySalary] = useState('0');
  const [addNotes, setAddNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Edit dialog state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editType, setEditType] = useState('private');
  const [editPaymentMode, setEditPaymentMode] = useState('per_order');
  const [editConfirmationPrice, setEditConfirmationPrice] = useState('0');
  const [editCancellationPrice, setEditCancellationPrice] = useState('0');
  const [editMonthlySalary, setEditMonthlySalary] = useState('0');
  const [editNotes, setEditNotes] = useState('');

  // Query
  const { data: confirmers, isLoading } = useQuery({
    queryKey: ['admin-confirmers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('confirmers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Tab 3: Settings query
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['confirmation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('confirmation_settings' as any)
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<any>(null);
  useMemo(() => {
    if (settings && !settingsForm) {
      setSettingsForm(settings);
    }
  }, [settings]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!addName.trim()) throw new Error('الاسم مطلوب');
      if (!addEmail.trim()) throw new Error('الإيمايل مطلوب');
      if (!addPassword.trim() || addPassword.length < 8) throw new Error('كلمة السر يجب أن تكون 8 أحرف على الأقل');

      // 1. Insert into confirmers table first
      const payload: any = {
        name: addName.trim(),
        phone: addPhone.trim() || '',
        type: addType,
        payment_mode: addPaymentMode,
        confirmation_price: addPaymentMode === 'per_order' ? parseFloat(addConfirmationPrice) || 0 : 0,
        cancellation_price: addPaymentMode === 'per_order' ? parseFloat(addCancellationPrice) || 0 : 0,
        monthly_salary: addPaymentMode === 'monthly' ? parseFloat(addMonthlySalary) || 0 : 0,
        email: addEmail.trim(),
        notes: addNotes.trim() || null,
      };

      const { data: newConfirmer, error: insertErr } = await supabase
        .from('confirmers')
        .insert(payload)
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // 2. Call edge function to create auth account
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('manage-confirmer', {
        body: {
          action: 'create',
          email: addEmail.trim(),
          password: addPassword,
          confirmerId: newConfirmer.id,
        },
      });
      if (fnErr) throw fnErr;
      if (fnData?.error) throw new Error(fnData.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-confirmers'] });
      toast({ title: 'تمت إضافة المؤكد بنجاح ✅' });
      // Reset form
      setAddName(''); setAddEmail(''); setAddPassword(''); setAddPhone('');
      setAddType('private'); setAddPaymentMode('per_order');
      setAddConfirmationPrice('0'); setAddCancellationPrice('0');
      setAddMonthlySalary('0'); setAddNotes('');
    },
    onError: (err: any) => toast({ title: err.message || 'حدث خطأ', variant: 'destructive' }),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingConfirmer || !editName.trim()) throw new Error('الاسم مطلوب');
      const payload: any = {
        name: editName.trim(),
        phone: editPhone.trim(),
        type: editType,
        payment_mode: editPaymentMode,
        confirmation_price: editPaymentMode === 'per_order' ? parseFloat(editConfirmationPrice) || 0 : 0,
        cancellation_price: editPaymentMode === 'per_order' ? parseFloat(editCancellationPrice) || 0 : 0,
        monthly_salary: editPaymentMode === 'monthly' ? parseFloat(editMonthlySalary) || 0 : 0,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('confirmers').update(payload).eq('id', editingConfirmer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-confirmers'] });
      toast({ title: 'تم تعديل المؤكد ✅' });
      setShowEditDialog(false);
    },
    onError: (err: any) => toast({ title: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('confirmers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-confirmers'] });
      toast({ title: 'تم حذف المؤكد' });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('confirmers').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-confirmers'] });
      toast({ title: 'تم تحديث حالة المؤكد' });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!settingsForm) return;
      const payload = {
        assignment_mode: settingsForm.assignment_mode || 'manual',
        auto_timeout_minutes: settingsForm.auto_timeout_minutes || 30,
        max_call_attempts: settingsForm.max_call_attempts || 3,
        enable_confirm_chat: settingsForm.enable_confirm_chat || false,
        working_hours_start: settingsForm.working_hours_start || '08:00',
        working_hours_end: settingsForm.working_hours_end || '20:00',
        updated_at: new Date().toISOString(),
      };

      if (settingsForm.id) {
        const { error } = await supabase.from('confirmation_settings' as any).update(payload).eq('id', settingsForm.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('confirmation_settings' as any).insert(payload).select().single();
        if (error) throw error;
        setSettingsForm(data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['confirmation-settings'] });
      toast({ title: 'تم حفظ الإعدادات ✅' });
    },
    onError: (err: any) => toast({ title: err.message, variant: 'destructive' }),
  });

  // Filtering
  const filteredConfirmers = useMemo(() => {
    return (confirmers || []).filter(c => {
      const matchSearch = !searchQuery || c.name.includes(searchQuery) || c.phone.includes(searchQuery);
      const matchType = filterType === 'الكل' || (filterType === 'خاص' && c.type === 'private') || (filterType === 'خارجي' && c.type === 'external');
      const matchStatus = filterStatus === 'الكل' || (filterStatus === 'نشط' && c.status === 'active') || (filterStatus === 'غير نشط' && c.status === 'inactive');
      return matchSearch && matchType && matchStatus;
    });
  }, [confirmers, searchQuery, filterType, filterStatus]);

  const counts = useMemo(() => {
    const all = confirmers || [];
    return { total: all.length, private: all.filter(c => c.type === 'private').length, external: all.filter(c => c.type === 'external').length };
  }, [confirmers]);

  const openEdit = (c: any) => {
    setEditingConfirmer(c);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditType(c.type);
    setEditPaymentMode(c.payment_mode || 'per_order');
    setEditConfirmationPrice(String(c.confirmation_price || 0));
    setEditCancellationPrice(String(c.cancellation_price || 0));
    setEditMonthlySalary(String(c.monthly_salary || 0));
    setEditNotes(c.notes || '');
    setShowEditDialog(true);
  };

  const typeStyle = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.color || '';
  const typeLabel = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.label || t;
  const statusStyle = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.color || '';
  const statusLabel = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.label || s;
  const paymentLabel = (m: string) => PAYMENT_MODE_OPTIONS.find(o => o.value === m)?.label || m;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-cairo font-bold text-2xl text-foreground">إدارة المؤكدين</h2>
          <p className="font-cairo text-sm text-muted-foreground">{counts.total} مؤكد</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" dir="rtl" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-11">
          <TabsTrigger value="add" className="font-cairo gap-1.5 text-xs sm:text-sm">
            <UserPlus className="w-4 h-4 hidden sm:block" /> {t('confirmers.addTab')}
          </TabsTrigger>
          <TabsTrigger value="team" className="font-cairo gap-1.5 text-xs sm:text-sm">
            <Users className="w-4 h-4 hidden sm:block" /> {t('confirmers.teamTab')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="font-cairo gap-1.5 text-xs sm:text-sm">
            <Settings className="w-4 h-4 hidden sm:block" /> {t('confirmers.settingsTab')}
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: Add New Confirmer ===== */}
        <TabsContent value="add" className="mt-4">
          <div className="bg-card border rounded-xl p-5 max-w-2xl mx-auto space-y-6">
            <h3 className="font-cairo font-bold text-lg text-foreground">إنشاء حساب للمؤكد</h3>

            {/* Confirmer Info */}
            <div className="space-y-4">
              <p className="font-cairo text-sm font-semibold text-muted-foreground border-b pb-2">معلومات المؤكد</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="font-cairo">الاسم الكامل <span className="text-destructive">*</span></Label>
                  <Input value={addName} onChange={e => setAddName(e.target.value)} className="font-cairo mt-1.5" placeholder="أدخل اسم المؤكد" />
                </div>
                <div>
                  <Label className="font-cairo">الإيمايل <span className="text-destructive">*</span></Label>
                  <Input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} className="font-roboto mt-1.5" placeholder="ahmed@example.com" dir="ltr" />
                </div>
                <div>
                  <Label className="font-cairo">كلمة السر <span className="text-destructive">*</span></Label>
                  <div className="relative mt-1.5">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={addPassword}
                      onChange={e => setAddPassword(e.target.value)}
                      className="font-roboto pr-10"
                      placeholder="8 أحرف على الأقل"
                      dir="ltr"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="font-cairo">رقم الهاتف</Label>
                  <Input value={addPhone} onChange={e => setAddPhone(e.target.value)} className="font-roboto mt-1.5" placeholder="0555000000" dir="ltr" />
                </div>
                <div>
                  <Label className="font-cairo">النوع</Label>
                  <Select value={addType} onValueChange={setAddType}>
                    <SelectTrigger className="font-cairo mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private" className="font-cairo">خاص</SelectItem>
                      <SelectItem value="external" className="font-cairo">خارجي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Payment System */}
            <div className="space-y-4">
              <p className="font-cairo text-sm font-semibold text-muted-foreground border-b pb-2">نظام محاسبة المؤكد</p>
              <div>
                <Label className="font-cairo">طريقة المحاسبة</Label>
                <Select value={addPaymentMode} onValueChange={setAddPaymentMode}>
                  <SelectTrigger className="font-cairo mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_order" className="font-cairo">دفع حسب الطلبات</SelectItem>
                    <SelectItem value="monthly" className="font-cairo">دفع شهري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {addPaymentMode === 'per_order' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-cairo">سعر التأكيد (د.ج)</Label>
                    <Input type="number" min="0" value={addConfirmationPrice} onChange={e => setAddConfirmationPrice(e.target.value)} className="font-roboto mt-1.5" dir="ltr" />
                  </div>
                  <div>
                    <Label className="font-cairo">سعر الإلغاء (د.ج)</Label>
                    <Input type="number" min="0" value={addCancellationPrice} onChange={e => setAddCancellationPrice(e.target.value)} className="font-roboto mt-1.5" dir="ltr" />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="font-cairo">الراتب الشهري (د.ج)</Label>
                  <Input type="number" min="0" value={addMonthlySalary} onChange={e => setAddMonthlySalary(e.target.value)} className="font-roboto mt-1.5" dir="ltr" />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label className="font-cairo">ملاحظات</Label>
              <Textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} className="font-cairo mt-1.5" placeholder="أي ملاحظات إضافية..." />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                className="font-cairo"
                onClick={() => {
                  setAddName(''); setAddEmail(''); setAddPassword(''); setAddPhone('');
                  setAddType('private'); setAddPaymentMode('per_order');
                  setAddConfirmationPrice('0'); setAddCancellationPrice('0');
                  setAddMonthlySalary('0'); setAddNotes('');
                }}
              >
                إلغاء
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !addName.trim() || !addEmail.trim() || addPassword.length < 8}
                className="font-cairo gap-1.5"
              >
                {createMutation.isPending ? 'جاري الإضافة...' : 'إضافة'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ===== TAB 2: Confirmer Team ===== */}
        <TabsContent value="team" className="mt-4 space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'كل المؤكدين', value: counts.total, color: 'bg-primary/10 text-primary' },
              { label: 'مؤكدين خاصين', value: counts.private, color: 'bg-accent text-accent-foreground' },
              { label: 'مؤكدين خارجيين', value: counts.external, color: 'bg-secondary/10 text-secondary' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-card border rounded-xl p-4 text-center">
                <p className="font-cairo text-sm text-muted-foreground">{kpi.label}</p>
                <p className={`font-cairo font-bold text-2xl mt-1 ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ابحث عن مؤكد..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-10 font-cairo h-10" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-36 font-cairo h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="الكل" className="font-cairo">كل الأنواع</SelectItem>
                <SelectItem value="خاص" className="font-cairo">خاص</SelectItem>
                <SelectItem value="خارجي" className="font-cairo">خارجي</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36 font-cairo h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="الكل" className="font-cairo">كل الحالات</SelectItem>
                <SelectItem value="نشط" className="font-cairo">نشط</SelectItem>
                <SelectItem value="غير نشط" className="font-cairo">غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table / Cards */}
          {isLoading ? (
            <div className="text-center py-12 font-cairo text-muted-foreground">جاري التحميل...</div>
          ) : filteredConfirmers.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-card border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 text-right font-cairo font-semibold">المؤكد</th>
                      <th className="p-3 text-right font-cairo font-semibold">رقم الهاتف</th>
                      <th className="p-3 text-right font-cairo font-semibold">النوع</th>
                      <th className="p-3 text-right font-cairo font-semibold">طريقة الدفع</th>
                      <th className="p-3 text-right font-cairo font-semibold">سعر التأكيد</th>
                      <th className="p-3 text-right font-cairo font-semibold">سعر الإلغاء</th>
                      <th className="p-3 text-right font-cairo font-semibold">الحالة</th>
                      <th className="p-3 text-right font-cairo font-semibold">تاريخ الانضمام</th>
                      <th className="p-3 text-right font-cairo font-semibold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredConfirmers.map(c => (
                      <tr key={c.id} className={`hover:bg-muted/30 transition-colors group ${c.status === 'inactive' ? 'opacity-50' : ''}`}>
                        <td className="p-3">
                          <div className="font-cairo font-medium text-foreground">{c.name}</div>
                          {(c as any).email && <div className="font-roboto text-xs text-muted-foreground" dir="ltr">{(c as any).email}</div>}
                        </td>
                        <td className="p-3 font-roboto text-muted-foreground" dir="ltr">{c.phone}</td>
                        <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full font-cairo ${typeStyle(c.type)}`}>{typeLabel(c.type)}</span></td>
                        <td className="p-3">
                          <span className="text-xs px-2 py-1 rounded-full font-cairo bg-muted text-muted-foreground">
                            {paymentLabel((c as any).payment_mode || 'per_order')}
                          </span>
                        </td>
                        <td className="p-3 font-cairo text-sm">
                          {(c as any).payment_mode === 'monthly' ? '-' : `${c.confirmation_price} د.ج`}
                        </td>
                        <td className="p-3 font-cairo text-sm">
                          {(c as any).payment_mode === 'monthly' ? `${(c as any).monthly_salary || 0} د.ج/شهر` : `${c.cancellation_price} د.ج`}
                        </td>
                        <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full font-cairo ${statusStyle(c.status)}`}>{statusLabel(c.status)}</span></td>
                        <td className="p-3 font-cairo text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                        <td className="p-3">
                          <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => toggleStatusMutation.mutate({ id: c.id, currentStatus: c.status || 'active' })}>
                              {c.status === 'active' ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteDialog(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredConfirmers.map(c => (
                  <div key={c.id} className={`bg-card border rounded-xl p-4 space-y-2 ${c.status === 'inactive' ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-cairo font-medium text-sm">{c.name}</span>
                        {(c as any).email && <p className="font-roboto text-xs text-muted-foreground" dir="ltr">{(c as any).email}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-cairo ${typeStyle(c.type)}`}>{typeLabel(c.type)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-cairo ${statusStyle(c.status)}`}>{statusLabel(c.status)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs font-cairo text-muted-foreground">
                      <div>الهاتف: <span className="font-roboto">{c.phone}</span></div>
                      <div>الدفع: {paymentLabel((c as any).payment_mode || 'per_order')}</div>
                      {(c as any).payment_mode !== 'monthly' && <div>سعر التأكيد: {c.confirmation_price} د.ج</div>}
                      {(c as any).payment_mode !== 'monthly' && <div>سعر الإلغاء: {c.cancellation_price} د.ج</div>}
                      {(c as any).payment_mode === 'monthly' && <div>الراتب: {(c as any).monthly_salary || 0} د.ج/شهر</div>}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-cairo text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => toggleStatusMutation.mutate({ id: c.id, currentStatus: c.status || 'active' })}>
                          {c.status === 'active' ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteDialog(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-card border rounded-xl">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-cairo text-muted-foreground font-medium">لا يوجد مؤكدين بعد</p>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 3: Confirmation Settings ===== */}
        <TabsContent value="settings" className="mt-4">
          <div className="bg-card border rounded-xl p-5 max-w-2xl mx-auto space-y-6">
            <h3 className="font-cairo font-bold text-lg text-foreground">إعدادات التأكيد</h3>

            {settingsLoading ? (
              <div className="text-center py-8 font-cairo text-muted-foreground">جاري التحميل...</div>
            ) : (
              <div className="space-y-5">
                <div>
                  <Label className="font-cairo">طريقة التوزيع</Label>
                  <Select
                    value={settingsForm?.assignment_mode || 'manual'}
                    onValueChange={v => setSettingsForm((s: any) => ({ ...s, assignment_mode: v }))}
                  >
                    <SelectTrigger className="font-cairo mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual" className="font-cairo">يدوي</SelectItem>
                      <SelectItem value="round_robin" className="font-cairo">دوري</SelectItem>
                      <SelectItem value="load_balanced" className="font-cairo">حسب الحمل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-cairo">مهلة التأكيد (دقائق)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={settingsForm?.auto_timeout_minutes || 30}
                      onChange={e => setSettingsForm((s: any) => ({ ...s, auto_timeout_minutes: parseInt(e.target.value) || 30 }))}
                      className="font-roboto mt-1.5"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label className="font-cairo">محاولات الاتصال القصوى</Label>
                    <Input
                      type="number"
                      min="1"
                      value={settingsForm?.max_call_attempts || 3}
                      onChange={e => setSettingsForm((s: any) => ({ ...s, max_call_attempts: parseInt(e.target.value) || 3 }))}
                      className="font-roboto mt-1.5"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg">
                  <div>
                    <Label className="font-cairo font-medium">تفعيل التأكيد التلقائي (Confirm Chat)</Label>
                    <p className="font-cairo text-xs text-muted-foreground mt-0.5">تأكيد الطلبات تلقائيا عبر الرسائل قبل توجيهها للمؤكدين</p>
                  </div>
                  <Switch
                    checked={settingsForm?.enable_confirm_chat || false}
                    onCheckedChange={v => setSettingsForm((s: any) => ({ ...s, enable_confirm_chat: v }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-cairo">بداية ساعات العمل</Label>
                    <Input
                      type="time"
                      value={settingsForm?.working_hours_start || '08:00'}
                      onChange={e => setSettingsForm((s: any) => ({ ...s, working_hours_start: e.target.value }))}
                      className="font-roboto mt-1.5"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label className="font-cairo">نهاية ساعات العمل</Label>
                    <Input
                      type="time"
                      value={settingsForm?.working_hours_end || '20:00'}
                      onChange={e => setSettingsForm((s: any) => ({ ...s, working_hours_end: e.target.value }))}
                      className="font-roboto mt-1.5"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => saveSettingsMutation.mutate()}
                    disabled={saveSettingsMutation.isPending}
                    className="font-cairo gap-1.5"
                  >
                    {saveSettingsMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-cairo">تعديل المؤكد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="font-cairo">الاسم <span className="text-destructive">*</span></Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="font-cairo mt-1.5" />
            </div>
            <div>
              <Label className="font-cairo">رقم الهاتف</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="font-roboto mt-1.5" dir="ltr" />
            </div>
            <div>
              <Label className="font-cairo">النوع</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="font-cairo mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private" className="font-cairo">خاص</SelectItem>
                  <SelectItem value="external" className="font-cairo">خارجي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-cairo">طريقة المحاسبة</Label>
              <Select value={editPaymentMode} onValueChange={setEditPaymentMode}>
                <SelectTrigger className="font-cairo mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_order" className="font-cairo">دفع حسب الطلبات</SelectItem>
                  <SelectItem value="monthly" className="font-cairo">دفع شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editPaymentMode === 'per_order' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-cairo">سعر التأكيد (د.ج)</Label>
                  <Input type="number" min="0" value={editConfirmationPrice} onChange={e => setEditConfirmationPrice(e.target.value)} className="font-roboto mt-1.5" dir="ltr" />
                </div>
                <div>
                  <Label className="font-cairo">سعر الإلغاء (د.ج)</Label>
                  <Input type="number" min="0" value={editCancellationPrice} onChange={e => setEditCancellationPrice(e.target.value)} className="font-roboto mt-1.5" dir="ltr" />
                </div>
              </div>
            ) : (
              <div>
                <Label className="font-cairo">الراتب الشهري (د.ج)</Label>
                <Input type="number" min="0" value={editMonthlySalary} onChange={e => setEditMonthlySalary(e.target.value)} className="font-roboto mt-1.5" dir="ltr" />
              </div>
            )}
            <div>
              <Label className="font-cairo">ملاحظات</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="font-cairo mt-1.5" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)} className="font-cairo">إلغاء</Button>
              <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editName.trim()} className="font-cairo">
                {editMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog !== null} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-cairo text-center">حذف المؤكد</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <p className="font-cairo text-muted-foreground">هل أنت متأكد من حذف هذا المؤكد؟</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => setDeleteDialog(null)} className="font-cairo px-6">إلغاء</Button>
              <Button variant="destructive" onClick={() => { if (deleteDialog) { deleteMutation.mutate(deleteDialog); setDeleteDialog(null); } }} className="font-cairo px-6">حذف</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
