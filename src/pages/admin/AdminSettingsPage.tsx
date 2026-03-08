import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, CreditCard, Bot, RotateCcw, FormInput, Paintbrush, Shield, Facebook, Database, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SETTINGS_CARDS = [
  { href: '/admin/settings/identity', key: 'settings.storeIdentity', descKey: 'settings.identityDesc', icon: Store },
  { href: '/admin/settings/payment', key: 'settings.paymentDelivery', descKey: 'settings.paymentDesc', icon: CreditCard },
  { href: '/admin/settings/telegram', key: 'settings.telegram', descKey: 'settings.telegramDescCard', icon: Bot },
  { href: '/admin/settings/returns', key: 'settings.returnsTab', descKey: 'settings.returnsDesc', icon: RotateCcw },
  { href: '/admin/settings/form', key: 'sidebar.form', descKey: 'settings.formDesc', icon: FormInput },
  { href: '/admin/settings/appearance', key: 'sidebar.appearance', descKey: 'settings.appearanceDesc', icon: Paintbrush },
  { href: '/admin/settings/security', key: 'settings.security', descKey: 'settings.securityDesc', icon: Shield },
  { href: '/admin/settings/pixels', key: 'pixels.title', descKey: 'pixels.description', icon: Facebook },
];

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);

  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-database', {
        method: 'POST',
        body: {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const summary = data?.summary || {};
      const totalRecords = Object.values(summary).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

      toast({
        title: `✅ تم ملء قاعدة البيانات بنجاح`,
        description: `تم إضافة ${totalRecords} سجل عبر ${Object.keys(summary).length} جدول`,
      });
    } catch (err: any) {
      toast({
        title: 'فشل ملء قاعدة البيانات',
        description: err.message || 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="font-cairo font-bold text-2xl">{t('sidebar.settings')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS_CARDS.map((card) => (
          <Card
            key={card.href}
            className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
            onClick={() => navigate(card.href)}
          >
            <CardHeader className="flex flex-row items-start gap-4 p-5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <card.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base font-cairo">{t(card.key)}</CardTitle>
                <CardDescription className="text-xs font-cairo">{t(card.descKey)}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Dev Tools Section */}
      <div className="border-t pt-6">
        <h2 className="font-cairo font-semibold text-lg mb-4 text-muted-foreground">أدوات المطور</h2>
        <Card className="max-w-md">
          <CardHeader className="flex flex-row items-start gap-4 p-5">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-orange-500" />
            </div>
            <div className="space-y-2 flex-1">
              <CardTitle className="text-base font-cairo">ملء قاعدة البيانات</CardTitle>
              <CardDescription className="text-xs font-cairo">
                إضافة بيانات تجريبية (منتجات، طلبات، عملاء، موردين...) مع صور مُولّدة بالذكاء الاصطناعي
              </CardDescription>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={seeding} className="mt-2">
                    {seeding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جارٍ الملء...
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        ملء البيانات
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-cairo">ملء قاعدة البيانات؟</AlertDialogTitle>
                    <AlertDialogDescription className="font-cairo">
                      سيتم إضافة بيانات تجريبية تشمل: 15 منتج مع صور، 30 طلب، 15 عميل، 5 موردين، كوبونات، تقييمات، وبيانات أخرى.
                      <br /><br />
                      <strong>ملاحظة:</strong> قد يستغرق هذا بضع دقائق بسبب توليد صور المنتجات.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-cairo">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSeedDatabase} className="font-cairo">
                      تأكيد الملء
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
