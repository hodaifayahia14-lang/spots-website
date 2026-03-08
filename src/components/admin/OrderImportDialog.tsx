import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle, Truck, X } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface OrderImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryCompanies: { id: string; name: string; api_key: string | null; api_url: string | null }[];
}

interface ParsedRow {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  wilaya: string;
  address: string;
  total_amount: number;
  delivery_type: string;
  status: string;
  product_name?: string;
  category?: string;
  quantity?: number;
  unit_price?: number;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

const STATUS_MAP: Record<string, string> = {
  'new': 'جديد',
  'pending': 'جديد',
  'processing': 'قيد المعالجة',
  'shipped': 'تم الشحن',
  'delivered': 'تم التسليم',
  'cancelled': 'ملغي',
  'returned': 'ملغي',
  // Arabic passthrough
  'جديد': 'جديد',
  'قيد المعالجة': 'قيد المعالجة',
  'تم الشحن': 'تم الشحن',
  'تم التسليم': 'تم التسليم',
  'ملغي': 'ملغي',
};

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  });
}

function guessColumnMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const lower = headers.map(h => h.toLowerCase().replace(/[_\-\s]+/g, ''));

  const patterns: Record<string, string[]> = {
    order_number: ['ordernumber', 'orderid', 'order', 'numéro', 'رقم', 'tracking', 'ref', 'reference', 'id'],
    customer_name: ['customername', 'name', 'nom', 'client', 'الاسم', 'اسم'],
    customer_phone: ['phone', 'tel', 'téléphone', 'mobile', 'الهاتف', 'رقمالهاتف', 'customerphone'],
    wilaya: ['wilaya', 'ولاية', 'state', 'city', 'ville', 'المدينة'],
    address: ['address', 'adresse', 'العنوان', 'commune', 'بلدية'],
    total_amount: ['total', 'amount', 'montant', 'المبلغ', 'prix', 'price', 'totalamount'],
    delivery_type: ['deliverytype', 'delivery', 'type', 'نوعالتوصيل', 'livraison'],
    status: ['status', 'statut', 'الحالة', 'état', 'etat'],
    product_name: ['product', 'productname', 'produit', 'المنتج', 'اسمالمنتج', 'item'],
    category: ['category', 'catégorie', 'الفئة', 'categorie', 'التصنيف'],
    quantity: ['quantity', 'qty', 'quantité', 'الكمية'],
    unit_price: ['unitprice', 'prixunitaire', 'سعرالوحدة'],
  };

  for (const [field, keys] of Object.entries(patterns)) {
    const idx = lower.findIndex(h => keys.some(k => h.includes(k)));
    if (idx !== -1) mapping[field] = idx;
  }

  return mapping;
}

export default function OrderImportDialog({ open, onOpenChange, deliveryCompanies }: OrderImportDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: number }>({ created: 0, updated: 0, errors: 0 });
  const [importing, setImporting] = useState(false);

  // Categories extracted from imported data
  const categories = [...new Set(rows.map(r => r.category).filter(Boolean))] as string[];

  const reset = () => {
    setStep('upload');
    setSelectedCompanyId('');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setRawRows([]);
    setMapping({});
    setImportResult({ created: 0, updated: 0, errors: 0 });
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'text/tab-separated-values'];
    const validExts = ['.csv', '.tsv', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      toast({ title: t('import.invalidFile'), variant: 'destructive' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t('import.fileTooLarge'), variant: 'destructive' });
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        toast({ title: t('import.noDataFound'), variant: 'destructive' });
        return;
      }

      const hdrs = parsed[0];
      setHeaders(hdrs);
      setRawRows(parsed.slice(1));

      const autoMapping = guessColumnMapping(hdrs);
      setMapping(autoMapping);

      // Parse rows with mapping
      const dataRows = parsed.slice(1).map(row => {
        const get = (field: string) => autoMapping[field] !== undefined ? row[autoMapping[field]] || '' : '';
        return {
          order_number: get('order_number'),
          customer_name: get('customer_name'),
          customer_phone: get('customer_phone'),
          wilaya: get('wilaya'),
          address: get('address'),
          total_amount: parseFloat(get('total_amount')) || 0,
          delivery_type: get('delivery_type') || 'office',
          status: STATUS_MAP[get('status').toLowerCase()] || get('status') || 'جديد',
          product_name: get('product_name') || undefined,
          category: get('category') || undefined,
          quantity: parseInt(get('quantity')) || undefined,
          unit_price: parseFloat(get('unit_price')) || undefined,
        };
      }).filter(r => r.customer_name || r.customer_phone || r.order_number);

      setRows(dataRows);
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [t, toast]);

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setStep('importing');

    let created = 0, updated = 0, errors = 0;

    // Get wilayas for mapping
    const { data: wilayas } = await supabase.from('wilayas').select('id, name');
    const wilayaMap = new Map((wilayas || []).map(w => [w.name.toLowerCase().trim(), w.id]));

    // Get existing products for category matching
    const { data: products } = await supabase.from('products').select('id, name, category');

    // If categories exist in imported data, ensure products with matching categories exist
    if (categories.length > 0 && products) {
      // Categories are informational — we just display them in the preview
    }

    // Get existing orders for update vs create logic
    const orderNumbers = rows.map(r => r.order_number).filter(Boolean);
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .in('order_number', orderNumbers.length > 0 ? orderNumbers : ['__none__']);

    const existingMap = new Map((existingOrders || []).map(o => [o.order_number, o]));

    for (const row of rows) {
      try {
        // Find wilaya ID
        let wilayaId: string | null = null;
        if (row.wilaya) {
          const key = row.wilaya.toLowerCase().trim();
          wilayaId = wilayaMap.get(key) || null;
          if (!wilayaId) {
            // Try partial match
            for (const [name, id] of wilayaMap) {
              if (name.includes(key) || key.includes(name)) {
                wilayaId = id;
                break;
              }
            }
          }
        }

        const existing = row.order_number ? existingMap.get(row.order_number) : null;

        if (existing) {
          // Update existing order status
          const { error } = await supabase.from('orders').update({
            status: row.status || existing.status,
            address: row.address || undefined,
          }).eq('id', existing.id);

          if (error) throw error;
          updated++;
        } else {
          // Create new order
          const orderData: any = {
            customer_name: row.customer_name || 'غير محدد',
            customer_phone: row.customer_phone || '0000000000',
            order_number: row.order_number || `IMP-${Date.now()}-${created}`,
            total_amount: row.total_amount,
            subtotal: row.total_amount,
            status: row.status || 'جديد',
            delivery_type: row.delivery_type || 'office',
            address: row.address || null,
            wilaya_id: wilayaId,
            payment_method: 'cod',
          };

          const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert(orderData)
            .select('id')
            .single();

          if (orderError) throw orderError;

          // If product info exists, create order items
          if (newOrder && row.product_name) {
            // Try to match product by name
            const matchedProduct = products?.find(p =>
              p.name.toLowerCase().includes(row.product_name!.toLowerCase()) ||
              row.product_name!.toLowerCase().includes(p.name.toLowerCase())
            );

            await supabase.from('order_items').insert({
              order_id: newOrder.id,
              product_id: matchedProduct?.id || null,
              quantity: row.quantity || 1,
              unit_price: row.unit_price || row.total_amount,
            });
          }

          created++;
        }
      } catch (err) {
        console.error('Import row error:', err);
        errors++;
      }
    }

    setImportResult({ created, updated, errors });
    setStep('done');
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-cairo flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {t('import.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="font-cairo text-sm text-muted-foreground">{t('import.description')}</p>

            {/* Select Delivery Company */}
            <div>
              <Label className="font-cairo">{t('delivery.selectCompany')}</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="font-cairo mt-1"><SelectValue placeholder={t('delivery.selectCompany')} /></SelectTrigger>
                <SelectContent>
                  {deliveryCompanies?.map(c => (
                    <SelectItem key={c.id} value={c.id} className="font-cairo">
                      <span className="flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5" />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                  <SelectItem value="__other__" className="font-cairo">{t('import.otherSource')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Upload area */}
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-cairo text-sm font-medium">{t('import.dragOrClick')}</p>
              <p className="font-cairo text-xs text-muted-foreground mt-1">{t('import.supportedFormats')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-cairo text-sm font-medium flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  {fileName}
                </p>
                <p className="font-cairo text-xs text-muted-foreground mt-0.5">
                  {t('import.rowsFound').replace('{n}', String(rows.length))}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} className="font-cairo gap-1">
                <X className="w-3.5 h-3.5" /> {t('import.changeFile')}
              </Button>
            </div>

            {/* Column mapping summary */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              <p className="font-cairo text-xs font-semibold">{t('import.detectedColumns')}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(mapping).map(([field, idx]) => (
                  <Badge key={field} variant="secondary" className="font-cairo text-xs gap-1">
                    {t(`import.field.${field}`)} ← {headers[idx]}
                  </Badge>
                ))}
              </div>
              {Object.keys(mapping).length < 3 && (
                <p className="font-cairo text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t('import.fewColumnsWarning')}
                </p>
              )}
            </div>

            {/* Categories found */}
            {categories.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="font-cairo text-xs font-semibold mb-1.5">{t('import.categoriesFound')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <Badge key={cat} className="font-cairo text-xs">{cat}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            <div className="border rounded-lg overflow-x-auto max-h-60">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="font-cairo p-2 text-right">#</th>
                    <th className="font-cairo p-2 text-right">{t('import.field.order_number')}</th>
                    <th className="font-cairo p-2 text-right">{t('import.field.customer_name')}</th>
                    <th className="font-cairo p-2 text-right">{t('import.field.customer_phone')}</th>
                    <th className="font-cairo p-2 text-right">{t('import.field.wilaya')}</th>
                    <th className="font-cairo p-2 text-right">{t('import.field.total_amount')}</th>
                    <th className="font-cairo p-2 text-right">{t('import.field.status')}</th>
                    {categories.length > 0 && <th className="font-cairo p-2 text-right">{t('import.field.category')}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="p-2 font-roboto text-muted-foreground">{i + 1}</td>
                      <td className="p-2 font-roboto">{row.order_number || '—'}</td>
                      <td className="p-2 font-cairo">{row.customer_name || '—'}</td>
                      <td className="p-2 font-roboto" dir="ltr">{row.customer_phone || '—'}</td>
                      <td className="p-2 font-cairo">{row.wilaya || '—'}</td>
                      <td className="p-2 font-roboto">{row.total_amount || '—'}</td>
                      <td className="p-2 font-cairo">{row.status || '—'}</td>
                      {categories.length > 0 && <td className="p-2 font-cairo">{row.category || '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="font-cairo text-xs text-muted-foreground text-center py-2">
                  {t('import.moreRows').replace('{n}', String(rows.length - 20))}
                </p>
              )}
            </div>

            <Button onClick={handleImport} className="w-full font-cairo gap-2" disabled={rows.length === 0}>
              <Upload className="w-4 h-4" />
              {t('import.startImport').replace('{n}', String(rows.length))}
            </Button>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="font-cairo text-sm">{t('import.importing')}</p>
            <p className="font-cairo text-xs text-muted-foreground">{t('import.doNotClose')}</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="py-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-primary mx-auto" />
            <h3 className="font-cairo font-bold text-lg">{t('import.completed')}</h3>
            <div className="flex justify-center gap-4">
              <div className="text-center">
                <p className="font-roboto text-2xl font-bold text-primary">{importResult.created}</p>
                <p className="font-cairo text-xs text-muted-foreground">{t('import.created')}</p>
              </div>
              <div className="text-center">
                <p className="font-roboto text-2xl font-bold text-blue-500">{importResult.updated}</p>
                <p className="font-cairo text-xs text-muted-foreground">{t('import.updated')}</p>
              </div>
              {importResult.errors > 0 && (
                <div className="text-center">
                  <p className="font-roboto text-2xl font-bold text-destructive">{importResult.errors}</p>
                  <p className="font-cairo text-xs text-muted-foreground">{t('import.errors')}</p>
                </div>
              )}
            </div>
            <Button onClick={() => { reset(); onOpenChange(false); }} className="font-cairo">
              {t('common.close')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
