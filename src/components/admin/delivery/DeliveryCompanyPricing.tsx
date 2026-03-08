import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryCompany {
  id: string;
  name: string;
  is_active: boolean;
}

interface Wilaya {
  id: string;
  name: string;
}

interface PriceRow {
  wilaya_id: string;
  wilaya_name: string;
  price_office: number;
  price_home: number;
  return_price: number;
  existing_id?: string;
}

export default function DeliveryCompanyPricing() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: companies } = useQuery({
    queryKey: ['delivery-companies-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_companies')
        .select('id, name, is_active')
        .order('name');
      if (error) throw error;
      return (data || []) as DeliveryCompany[];
    },
  });

  const { data: wilayas } = useQuery({
    queryKey: ['wilayas-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wilayas')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data || []) as Wilaya[];
    },
  });

  const { isLoading: loadingPrices } = useQuery({
    queryKey: ['delivery-company-prices', selectedCompany],
    queryFn: async () => {
      if (!selectedCompany || !wilayas?.length) return [];
      const { data, error } = await supabase
        .from('delivery_company_prices' as any)
        .select('*')
        .eq('company_id', selectedCompany);
      if (error) throw error;

      const priceMap = new Map<string, any>();
      ((data || []) as any[]).forEach(p => priceMap.set(p.wilaya_id, p));

      const rows: PriceRow[] = wilayas.map(w => {
        const existing = priceMap.get(w.id);
        return {
          wilaya_id: w.id,
          wilaya_name: w.name,
          price_office: existing?.price_office ?? 0,
          price_home: existing?.price_home ?? 0,
          return_price: existing?.return_price ?? 0,
          existing_id: existing?.id,
        };
      });
      setPrices(rows);
      return rows;
    },
    enabled: !!selectedCompany && !!wilayas?.length,
  });

  const updatePrice = (wilayaId: string, field: 'price_office' | 'price_home' | 'return_price', value: string) => {
    setPrices(prev => prev.map(p =>
      p.wilaya_id === wilayaId ? { ...p, [field]: Number(value) || 0 } : p
    ));
  };

  const handleSaveAll = async () => {
    if (!selectedCompany) return;
    setSaving(true);
    try {
      const upserts = prices.map(p => ({
        company_id: selectedCompany,
        wilaya_id: p.wilaya_id,
        price_office: p.price_office,
        price_home: p.price_home,
        return_price: p.return_price,
        updated_at: new Date().toISOString(),
      }));

      // Upsert in batches
      for (let i = 0; i < upserts.length; i += 50) {
        const batch = upserts.slice(i, i + 50);
        const { error } = await (supabase.from('delivery_company_prices' as any) as any)
          .upsert(batch, { onConflict: 'company_id,wilaya_id' });
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['delivery-company-prices', selectedCompany] });
      toast.success(t('common.savedSuccess'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!prices.length) return;
    const companyName = companies?.find(c => c.id === selectedCompany)?.name || 'company';
    const header = 'wilaya_name,price_office,price_home,return_price';
    const rows = prices.map(p =>
      `"${p.wilaya_name}",${p.price_office},${p.price_home},${p.return_price}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery-prices-${companyName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !wilayas?.length) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error(t('delivery.invalidFile'));
        return;
      }

      // Skip header
      const dataLines = lines.slice(1);
      let matched = 0;

      const updatedPrices = [...prices];
      for (const line of dataLines) {
        // Parse CSV - handle quoted fields
        const parts = line.match(/(".*?"|[^,]+)/g)?.map(s => s.replace(/^"|"$/g, '').trim()) || [];
        if (parts.length < 4) continue;

        const [wilayaName, office, home, ret] = parts;
        const idx = updatedPrices.findIndex(p =>
          p.wilaya_name.trim().toLowerCase() === wilayaName.trim().toLowerCase()
        );
        if (idx >= 0) {
          updatedPrices[idx] = {
            ...updatedPrices[idx],
            price_office: Number(office) || 0,
            price_home: Number(home) || 0,
            return_price: Number(ret) || 0,
          };
          matched++;
        }
      }

      setPrices(updatedPrices);
      toast.success(t('delivery.importSuccess').replace('{n}', String(matched)));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Card className="border">
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="font-cairo text-base font-semibold">
            {t('delivery.companyPrices')}
          </CardTitle>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-full sm:w-64 font-cairo">
              <SelectValue placeholder={t('delivery.selectCompany')} />
            </SelectTrigger>
            <SelectContent>
              {companies?.map(c => (
                <SelectItem key={c.id} value={c.id} className="font-cairo">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      {selectedCompany && (
        <CardContent className="p-4 space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-cairo gap-1.5"
              onClick={handleExportCSV}
              disabled={!prices.length}
            >
              <Download className="w-4 h-4" />
              {t('delivery.exportTemplate')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="font-cairo gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {t('delivery.importExcel')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Button
              size="sm"
              className="font-cairo gap-1.5 ms-auto"
              onClick={handleSaveAll}
              disabled={saving || !prices.length}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('costs.saveAll')}
            </Button>
          </div>

          {/* Table */}
          {loadingPrices ? (
            <p className="font-cairo text-sm text-muted-foreground text-center py-8">{t('common.loading')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm w-full min-w-[500px]">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-right font-cairo font-semibold px-3 py-2.5">{t('delivery.wilaya')}</th>
                    <th className="text-right font-cairo font-semibold px-3 py-2.5">{t('delivery.priceOffice')}</th>
                    <th className="text-right font-cairo font-semibold px-3 py-2.5">{t('delivery.priceHome')}</th>
                    <th className="text-right font-cairo font-semibold px-3 py-2.5">{t('delivery.returnPrice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map(row => (
                    <tr key={row.wilaya_id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-3 py-2 font-cairo font-medium text-foreground">
                        {row.wilaya_name}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={row.price_office || ''}
                          onChange={e => updatePrice(row.wilaya_id, 'price_office', e.target.value)}
                          className="font-roboto h-8 w-20 text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={row.price_home || ''}
                          onChange={e => updatePrice(row.wilaya_id, 'price_home', e.target.value)}
                          className="font-roboto h-8 w-20 text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={row.return_price || ''}
                          onChange={e => updatePrice(row.wilaya_id, 'return_price', e.target.value)}
                          className="font-roboto h-8 w-20 text-sm"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
