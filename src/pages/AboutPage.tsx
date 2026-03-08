import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Zap, Shield, Truck, Target, Medal, Phone, Mail, MapPin, Star, Users, Award, Dumbbell } from 'lucide-react';
import AnimatedSection from '@/components/AnimatedSection';

const teamMembers = [
  { name: 'كريم بن علي', role: 'المؤسس والرئيس', number: '01', position: 'القائد', stats: 'رؤية رياضية | 10+ سنوات خبرة' },
  { name: 'سارة حداد', role: 'مديرة التسويق', number: '07', position: 'الاستراتيجية', stats: 'حملات ناجحة | إبداع رقمي' },
  { name: 'أمين رحماني', role: 'مدير المنتجات', number: '10', position: 'صانع اللعب', stats: 'اختيار دقيق | جودة عالية' },
  { name: 'ياسمين بوعزيز', role: 'خدمة العملاء', number: '05', position: 'خط الدفاع', stats: 'رضا العملاء | حلول سريعة' },
];

const milestones = [
  { year: '2020', title: 'انطلاق المتجر', desc: 'بدأنا رحلتنا مع 50 منتجاً رياضياً فقط', icon: Zap },
  { year: '2021', title: 'أول 1000 عميل', desc: 'حققنا أول 1000 طلب ناجح في الجزائر', icon: Users },
  { year: '2022', title: 'توسع وطني', desc: 'توصيل إلى جميع الولايات الـ 48', icon: Truck },
  { year: '2023', title: 'شراكات عالمية', desc: 'شراكات رسمية مع Nike و Adidas و Puma', icon: Award },
  { year: '2024', title: '+500 منتج', desc: 'أكبر تشكيلة رياضية أونلاين في الجزائر', icon: Trophy },
];

const values = [
  { icon: Trophy, title: 'عقلية البطل', desc: 'نسعى للتفوق في كل ما نقدمه. نؤمن أن كل رياضي يستحق معدات بمستوى الأبطال.' },
  { icon: Shield, title: 'أصالة مضمونة', desc: 'كل منتج في متجرنا أصلي 100% من المصنع مباشرة. لا مجال للتنازل عن الجودة.' },
  { icon: Truck, title: 'سرعة التوصيل', desc: 'نوصل طلبك خلال 24-72 ساعة. لأن الرياضي لا ينتظر طويلاً.' },
  { icon: Target, title: 'خدمة استثنائية', desc: 'فريق رياضي متخصص يساعدك في اختيار المعدات المثالية لأدائك.' },
];

export default function AboutPage() {
  const { data: settings } = useQuery({
    queryKey: ['about-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*');
      const map: Record<string, string> = {};
      data?.forEach(s => { map[s.key] = s.value || ''; });
      return map;
    },
  });

  const storeName = settings?.store_name || 'DZ Sports';
  const phone = settings?.footer_phone;
  const email = settings?.footer_email;
  const address = settings?.footer_address || 'الجزائر';

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/5" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        <div className="container relative text-center">
          <AnimatedSection>
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 border border-primary/20">
              <Trophy className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-barlow font-bold text-5xl md:text-7xl uppercase tracking-wide text-foreground mb-4">
              من <span className="text-primary neon-glow">نحن</span>
            </h1>
            <p className="font-cairo text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              <span className="text-primary font-bold">{storeName}</span> — نحن لسنا مجرد متجر. نحن شريكك في رحلتك الرياضية.
              نزوّد الرياضيين في كل ولاية بأفضل المعدات والملابس من الماركات العالمية.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24">
        <div className="container">
          <AnimatedSection>
            <div className="text-center mb-14">
              <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block mb-4">💎 قيمنا</span>
              <h2 className="font-barlow font-bold text-3xl md:text-4xl uppercase tracking-wide text-foreground">عقلية البطل</h2>
              <p className="font-cairo text-muted-foreground mt-2">نؤمن أن الرياضة أكثر من مجرد لعبة — إنها أسلوب حياة</p>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <AnimatedSection key={v.title} delay={i * 100}>
                <div className="bg-card border border-border/50 rounded-2xl p-6 text-center hover:border-primary/30 hover:shadow-[0_0_30px_hsl(var(--primary)/0.08)] transition-all duration-300 group">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <v.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-barlow font-bold text-lg uppercase tracking-wide text-foreground mb-2">{v.title}</h3>
                  <p className="font-cairo text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Team — Athlete cards */}
      <section className="py-16 md:py-24 bg-muted/20">
        <div className="container">
          <AnimatedSection>
            <div className="text-center mb-14">
              <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block mb-4">⚡ الفريق</span>
              <h2 className="font-barlow font-bold text-3xl md:text-4xl uppercase tracking-wide text-foreground">فريقنا الرياضي</h2>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member, i) => (
              <AnimatedSection key={member.name} delay={i * 100}>
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 group">
                  {/* Jersey number header */}
                  <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 text-center relative">
                    <span className="font-bebas text-7xl text-primary/30 absolute top-2 right-4 leading-none">{member.number}</span>
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto border-2 border-primary/30">
                      <Dumbbell className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <div className="p-5 text-center">
                    <h3 className="font-cairo font-bold text-lg text-foreground">{member.name}</h3>
                    <p className="font-barlow font-semibold text-sm text-primary uppercase tracking-wide">{member.position}</p>
                    <p className="font-cairo text-xs text-muted-foreground mt-1">{member.role}</p>
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="font-cairo text-[11px] text-muted-foreground">{member.stats}</p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline — Match history */}
      <section className="py-16 md:py-24">
        <div className="container">
          <AnimatedSection>
            <div className="text-center mb-14">
              <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block mb-4">🏆 إنجازاتنا</span>
              <h2 className="font-barlow font-bold text-3xl md:text-4xl uppercase tracking-wide text-foreground">سجل الإنجازات</h2>
            </div>
          </AnimatedSection>
          <div className="max-w-2xl mx-auto space-y-0">
            {milestones.map((m, i) => (
              <AnimatedSection key={m.year} delay={i * 100}>
                <div className="flex gap-5 group">
                  {/* Line */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors shrink-0">
                      <m.icon className="w-5 h-5 text-primary" />
                    </div>
                    {i < milestones.length - 1 && <div className="w-[2px] flex-1 bg-border/50 my-1" />}
                  </div>
                  {/* Content */}
                  <div className="pb-8">
                    <span className="font-bebas text-2xl text-primary tracking-wider">{m.year}</span>
                    <h3 className="font-cairo font-bold text-lg text-foreground mt-1">{m.title}</h3>
                    <p className="font-cairo text-sm text-muted-foreground">{m.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 md:py-24 bg-muted/20">
        <div className="container">
          <AnimatedSection>
            <h2 className="font-barlow font-bold text-3xl uppercase tracking-wide text-foreground text-center mb-12">تواصل معنا</h2>
          </AnimatedSection>
          <div className="max-w-xl mx-auto space-y-4">
            {phone && (
              <AnimatedSection delay={100}>
                <a href={`tel:${phone}`} className="flex items-center gap-4 bg-card border border-border/50 rounded-xl p-5 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.05)] transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-cairo font-semibold text-foreground">الهاتف</p>
                    <p className="font-roboto text-muted-foreground" dir="ltr">{phone}</p>
                  </div>
                </a>
              </AnimatedSection>
            )}
            {email && (
              <AnimatedSection delay={200}>
                <a href={`mailto:${email}`} className="flex items-center gap-4 bg-card border border-border/50 rounded-xl p-5 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.05)] transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                    <Mail className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-cairo font-semibold text-foreground">البريد الإلكتروني</p>
                    <p className="font-roboto text-muted-foreground" dir="ltr">{email}</p>
                  </div>
                </a>
              </AnimatedSection>
            )}
            <AnimatedSection delay={300}>
              <div className="flex items-center gap-4 bg-card border border-border/50 rounded-xl p-5">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-cairo font-semibold text-foreground">العنوان</p>
                  <p className="font-cairo text-muted-foreground">{address}</p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    </div>
  );
}
