import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import {
  ArrowLeft, ShoppingBag, Star, Truck, Shield, Headphones, Zap, Dumbbell,
  ChevronLeft, Search, TrendingUp, Award, Package, Timer, BadgeCheck,
  Target, Trophy, Flame, Heart,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProductCard from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/LoadingSkeleton';
import { useCategories } from '@/hooks/useCategories';
import heroSportsImage from '@/assets/hero-sports-v2.jpg';
import AnimatedSection from '@/components/AnimatedSection';
import MinimalTemplate from '@/components/templates/MinimalTemplate';
import BoldTemplate from '@/components/templates/BoldTemplate';
import LiquidTemplate from '@/components/templates/LiquidTemplate';
import DigitalTemplate from '@/components/templates/DigitalTemplate';

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (target <= 0 || !ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        const duration = 1800;
        const start = performance.now();
        const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          setCount(Math.floor(easeOutQuart(progress) * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{count}</span>;
}

function useParallax() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return offset;
}

export default function IndexPage() {
  const { data: categoriesData } = useCategories();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: allProducts, isLoading } = useQuery({
    queryKey: ['all-active-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: heroSlides } = useQuery({
    queryKey: ['hero-slides'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'hero_slides').maybeSingle();
      try { return JSON.parse(data?.value || '[]') as { url: string; link?: string; alt?: string }[]; } catch { return []; }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: storeTemplate } = useQuery({
    queryKey: ['store-template'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'store_template').maybeSingle();
      return data?.value || 'classic';
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: reviews } = useQuery({
    queryKey: ['all-reviews-homepage'],
    queryFn: async () => {
      const { data } = await supabase.from('reviews').select('*').gte('rating', 4).order('created_at', { ascending: false }).limit(6);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const [emblaRef] = useEmblaCarousel({ direction: 'rtl', loop: true }, [Autoplay({ delay: 5000 })]);

  const newestProducts = allProducts?.slice(0, 8) || [];
  const bestProducts = [...(allProducts || [])].sort((a, b) => Number(b.price) - Number(a.price)).slice(0, 4);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  // Template routing
  if (storeTemplate === 'minimal') return <MinimalTemplate products={allProducts} isLoading={isLoading} categories={categoriesData} />;
  if (storeTemplate === 'bold') return <BoldTemplate products={allProducts} isLoading={isLoading} categories={categoriesData} heroSlides={heroSlides} />;
  if (storeTemplate === 'liquid') return <LiquidTemplate products={allProducts} isLoading={isLoading} categories={categoriesData} heroSlides={heroSlides} />;
  if (storeTemplate === 'digital') return <DigitalTemplate products={allProducts} isLoading={isLoading} categories={categoriesData} heroSlides={heroSlides} />;

  const scrollY = useParallax();

  const sportCategories = [
    { name: 'كرة القدم', emoji: '⚽', gradient: 'from-emerald-600 to-green-700', iconBg: 'bg-emerald-500/20' },
    { name: 'كرة السلة', emoji: '🏀', gradient: 'from-orange-600 to-amber-600', iconBg: 'bg-orange-500/20' },
    { name: 'لياقة بدنية', emoji: '💪', gradient: 'from-blue-600 to-indigo-700', iconBg: 'bg-blue-500/20' },
    { name: 'جري', emoji: '🏃', gradient: 'from-violet-600 to-purple-700', iconBg: 'bg-violet-500/20' },
    { name: 'تنس', emoji: '🎾', gradient: 'from-lime-600 to-green-600', iconBg: 'bg-lime-500/20' },
    { name: 'سباحة', emoji: '🏊', gradient: 'from-cyan-600 to-blue-600', iconBg: 'bg-cyan-500/20' },
  ];

  const trustItems = [
    { icon: Truck, label: 'شحن سريع', desc: 'لجميع الولايات', color: 'from-primary to-emerald-600' },
    { icon: Shield, label: 'ضمان الجودة', desc: 'منتجات أصلية 100%', color: 'from-secondary to-blue-600' },
    { icon: Award, label: 'علامات عالمية', desc: 'أفضل الماركات', color: 'from-accent to-amber-500' },
    { icon: Headphones, label: 'دعم متواصل', desc: 'خدمة عملاء 24/7', color: 'from-violet-500 to-purple-600' },
  ];

  const renderProductGrid = (products: typeof newestProducts, columns?: string) => (
    <div className={columns || "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"}>
      {products.map((p, i) => (
        <div key={p.id} style={{ animationDelay: `${i * 0.08}s` }} className="animate-fade-in opacity-0 [animation-fill-mode:forwards]">
          <ProductCard
            id={p.id}
            name={p.name}
            price={Number(p.price)}
            oldPrice={p.old_price ? Number(p.old_price) : undefined}
            image={p.images?.[p.main_image_index ?? 0] || p.images?.[0] || ''}
            images={p.images || []}
            mainImageIndex={p.main_image_index ?? 0}
            category={p.category || []}
            stock={p.stock ?? 0}
            shippingPrice={Number(p.shipping_price) || 0}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ─── HERO SECTION ─── */}
      {heroSlides && heroSlides.length > 0 ? (
        <section className="relative isolate overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {heroSlides.map((slide, i) => (
              <div key={i} className="flex-[0_0_100%] min-w-0 relative">
                {slide.link ? (
                  <Link to={slide.link}>
                    <img src={slide.url} alt={slide.alt || `Slide ${i + 1}`} className="w-full h-[320px] sm:h-[420px] lg:h-[540px] object-cover" />
                  </Link>
                ) : (
                  <img src={slide.url} alt={slide.alt || `Slide ${i + 1}`} className="w-full h-[320px] sm:h-[420px] lg:h-[540px] object-cover" />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="relative isolate overflow-hidden min-h-[100vh] flex items-center">
          {/* Parallax BG */}
          <div className="absolute inset-0" style={{ transform: `translateY(${scrollY * 0.25}px)` }}>
            <img src={heroSportsImage} alt="" aria-hidden className="w-full h-[130%] object-cover scale-110" />
          </div>
          {/* Dark cinematic overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#000]/90 via-[#000]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#000]/90 via-transparent to-[#000]/30" />
          {/* Animated neon grid lines */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-pulse" />
            <div className="absolute bottom-20 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse" style={{ animationDelay: '0.5s' }} />
            {/* Floating particles */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute w-1 h-1 bg-primary/40 rounded-full animate-pulse"
                style={{
                  top: `${15 + i * 10}%`,
                  left: `${10 + i * 12}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: `${2 + i * 0.5}s`,
                }}
              />
            ))}
            {/* Speed lines */}
            {[...Array(6)].map((_, i) => (
              <div key={`line-${i}`} className="absolute h-[1px]"
                style={{
                  width: `${150 + i * 80}px`,
                  background: `linear-gradient(90deg, transparent, hsl(145 80% 48% / ${0.15 + i * 0.05}), transparent)`,
                  top: `${15 + i * 13}%`,
                  right: `${-5 + i * 8}%`,
                  transform: `rotate(-${3 + i}deg)`,
                  animation: `pulse ${2 + i * 0.4}s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>

          <div className="container relative z-10 py-20 md:py-28 lg:py-36">
            <div className="max-w-3xl space-y-7">
              {/* Animated badge */}
              <div className="animate-fade-in">
                <span className="inline-flex items-center gap-2.5 font-cairo text-xs sm:text-sm font-bold tracking-wide bg-primary/15 text-primary backdrop-blur-xl rounded-full px-5 py-2 border border-primary/30 shadow-lg shadow-primary/10">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  🏆 المتجر الرياضي #1 في الجزائر
                </span>
              </div>

              {/* Massive hero title with layered glow */}
              <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <h1 className="font-cairo font-black text-5xl sm:text-6xl lg:text-8xl leading-[1.05] tracking-tight">
                  <span className="block text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">جهّز نفسك</span>
                  <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-l from-primary via-emerald-300 to-primary" style={{ textShadow: '0 0 60px hsl(145 80% 48% / 0.3)' }}>
                    للتحدي القادم
                  </span>
                </h1>
              </div>

              {/* Subtitle with accent bar */}
              <div className="animate-fade-in flex items-start gap-4" style={{ animationDelay: '0.2s' }}>
                <div className="w-1 h-16 bg-gradient-to-b from-primary to-transparent rounded-full mt-1 shrink-0" />
                <p className="font-cairo text-white/70 text-lg sm:text-xl lg:text-2xl leading-relaxed max-w-xl">
                  أحذية رياضية، معدات تدريب، ملابس رياضية — كل ما تحتاجه لتكون <span className="text-primary font-bold">بطلاً</span>
                </p>
              </div>

              {/* Search with glass effect */}
              <form onSubmit={handleSearch} className="flex gap-2 max-w-lg animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <div className="relative flex-1">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن معدات رياضية..."
                    className="pr-12 font-cairo bg-white/[0.07] backdrop-blur-2xl border-white/[0.12] text-white placeholder:text-white/30 rounded-2xl h-14 text-base focus:bg-white/[0.12] focus:border-primary/50 shadow-inner shadow-black/20 transition-all duration-300"
                  />
                </div>
                <Button type="submit" size="lg" className="font-cairo font-bold rounded-2xl h-14 px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 transition-all duration-300">بحث</Button>
              </form>

              {/* CTA Buttons - enhanced */}
              <div className="flex flex-wrap items-center gap-4 pt-2 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <Link to="/products">
                  <Button size="lg" className="font-cairo font-bold text-base sm:text-lg px-10 h-14 gap-2.5 rounded-2xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/50 hover:scale-[1.04] transition-all duration-300 bg-primary hover:bg-primary/90 group relative overflow-hidden">
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative flex items-center gap-2.5">
                      تسوّق الآن
                      <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1.5 transition-transform" />
                    </span>
                  </Button>
                </Link>
                <Link to="/products">
                  <Button size="lg" variant="outline" className="font-cairo font-semibold text-base sm:text-lg px-10 h-14 rounded-2xl border-white/15 text-white hover:bg-white/10 hover:border-white/30 backdrop-blur-xl bg-white/[0.05] transition-all duration-300 shadow-lg shadow-black/10">
                    عروض اليوم 🔥
                  </Button>
                </Link>
              </div>

              {/* Mini stats row in hero */}
              <div className="flex flex-wrap gap-6 pt-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                {[
                  { value: '500+', label: 'منتج رياضي' },
                  { value: '15K+', label: 'عميل راضٍ' },
                  { value: '48', label: 'ولاية تغطية' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="font-roboto font-black text-xl sm:text-2xl text-primary">{s.value}</span>
                    <span className="font-cairo text-xs text-white/50">{s.label}</span>
                    {i < 2 && <div className="w-[1px] h-6 bg-white/10 mr-3" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom gradient fade to content */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
        </section>
      )}

      {/* ─── TRUST BAR ─── */}
      <AnimatedSection>
        <section className="relative -mt-8 z-20">
          <div className="container">
            <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-xl shadow-black/5 p-6 md:p-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {trustItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group cursor-default p-3 rounded-2xl hover:bg-primary/5 transition-all duration-300">
                    <div className={`shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-md`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-cairo font-bold text-sm text-foreground truncate">{item.label}</p>
                      <p className="font-cairo text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ─── SPORT CATEGORIES ─── */}
      <section className="py-16 md:py-24">
        <div className="container">
          <AnimatedSection>
            <div className="text-center mb-12">
              <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block mb-4">
                <Target className="w-4 h-4 inline -mt-0.5 ml-1" />
                تصنيفات رياضية
              </span>
              <h2 className="font-cairo font-black text-3xl md:text-4xl text-foreground">اختر رياضتك المفضلة</h2>
              <p className="font-cairo text-muted-foreground mt-2 text-sm md:text-base">معدات احترافية لكل أنواع الرياضة</p>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {(categoriesData && categoriesData.length > 0 ? categoriesData : sportCategories).slice(0, 6).map((cat, i) => {
              const sportCat = sportCategories[i] || sportCategories[0];
              const catName = 'name' in cat ? cat.name : '';
              return (
                <AnimatedSection key={catName} delay={i * 80}>
                  <Link to={`/products?category=${encodeURIComponent(catName)}`}>
                    <div className={`relative rounded-3xl overflow-hidden group cursor-pointer bg-gradient-to-br ${sportCat.gradient} p-6 text-center hover:shadow-2xl hover:scale-[1.04] transition-all duration-400 min-h-[160px] flex flex-col items-center justify-center`}>
                      {/* Shimmer on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1200ms]" />
                      <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/5 rounded-full blur-sm group-hover:scale-150 transition-transform duration-700" />
                      
                      <div className={`w-16 h-16 rounded-2xl ${sportCat.iconBg} backdrop-blur-sm flex items-center justify-center mb-3 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-400 border border-white/10`}>
                        <span className="text-3xl">{sportCat.emoji}</span>
                      </div>
                      <h3 className="font-cairo font-bold text-sm text-white relative z-10">{catName}</h3>
                    </div>
                  </Link>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── NEWEST PRODUCTS ─── */}
      <section className="py-16 md:py-24 bg-muted/30 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.05),transparent)]" />
        <div className="container relative">
          <AnimatedSection>
            <div className="flex items-end justify-between gap-4 mb-10">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-md shadow-primary/20">
                    <Flame className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-cairo text-xs font-bold text-primary bg-primary/10 rounded-full px-3 py-1">جديد</span>
                </div>
                <SectionHeader title="أحدث المنتجات" subtitle="آخر ما وصل من المعدات الرياضية" />
                <div className="h-[3px] w-20 bg-gradient-to-l from-primary to-secondary rounded-full mt-3" />
              </div>
              <Link to="/products" className="shrink-0">
                <Button variant="outline" className="font-cairo font-semibold gap-1.5 text-primary border-primary/20 hover:border-primary/40 hover:bg-primary/5 rounded-xl group">
                  عرض الكل
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={100}>
            {isLoading ? <ProductGridSkeleton /> : newestProducts.length > 0 ? renderProductGrid(newestProducts) : (
              <div className="text-center py-24 bg-card rounded-3xl border border-dashed">
                <ShoppingBag className="w-14 h-14 text-muted-foreground/30 mx-auto mb-5" />
                <p className="font-cairo text-muted-foreground text-lg">لا توجد منتجات حالياً</p>
                <p className="font-cairo text-muted-foreground/60 text-sm mt-1">ترقبوا منتجات جديدة قريباً!</p>
              </div>
            )}
          </AnimatedSection>
        </div>
      </section>

      {/* ─── BRAND STORY / STATS ─── */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-20 -right-32 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -left-32 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />
        <div className="container relative">
          <AnimatedSection>
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="space-y-8 order-2 md:order-1">
                <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block">
                  <Trophy className="w-4 h-4 inline -mt-0.5 ml-1" />
                  لماذا نحن
                </span>
                <h2 className="font-cairo font-black text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight">
                  المتجر الرياضي <span className="text-primary">#1</span> في الجزائر
                </h2>
                <p className="font-cairo text-muted-foreground leading-relaxed text-base">
                  نوفر لك أفضل المعدات والملابس الرياضية من أشهر الماركات العالمية. 
                  من أحذية الجري إلى معدات كمال الأجسام، كل ما تحتاجه لتحقيق أهدافك الرياضية.
                </p>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                  {[
                    { icon: '🏆', value: 500, suffix: '+', label: 'منتج رياضي', color: 'from-primary/10 to-emerald-500/5' },
                    { icon: '⭐', value: 15000, suffix: '+', label: 'عميل راضٍ', color: 'from-secondary/10 to-blue-500/5' },
                    { icon: '🚀', value: 48, suffix: '', label: 'ولاية تغطية', color: 'from-accent/10 to-amber-500/5' },
                  ].map((stat, i) => (
                    <div key={i} className={`text-center bg-gradient-to-br ${stat.color} border border-border/50 rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 hover:shadow-lg`}>
                      <span className="text-3xl">{stat.icon}</span>
                      <p className="font-roboto font-black text-3xl text-primary mt-2">
                        <AnimatedCounter target={stat.value} />{stat.suffix}
                      </p>
                      <p className="font-cairo text-xs text-muted-foreground mt-1 font-medium">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Image */}
              <div className="relative order-1 md:order-2">
                <div className="rounded-3xl overflow-hidden border-2 border-primary/20 shadow-2xl shadow-primary/15 relative group">
                  <img src={heroSportsImage} alt="معداتنا الرياضية" className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
                <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-primary/20 rounded-full blur-2xl" />
                <div className="absolute -top-6 -left-6 w-36 h-36 bg-secondary/10 rounded-full blur-3xl" />
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      {reviews && reviews.length > 0 && (
        <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_120%,hsl(var(--primary)/0.08),transparent)]" />
          <div className="container relative">
            <AnimatedSection>
              <div className="text-center mb-14">
                <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block mb-4">⭐ آراء الرياضيين</span>
                <SectionHeader title="ماذا يقول عملاؤنا" subtitle="آراء حقيقية من رياضيين يثقون بنا" center />
              </div>
            </AnimatedSection>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              {reviews.slice(0, 6).map((review, i) => (
                <AnimatedSection key={review.id} delay={i * 100}>
                  <div className="bg-card border border-border/50 rounded-3xl p-7 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 relative group">
                    <span className="absolute top-4 left-5 text-5xl text-primary/10 font-serif leading-none">❝</span>
                    <div className="flex gap-1 mb-4" dir="ltr">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-4 h-4 ${s <= review.rating ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`} />
                      ))}
                    </div>
                    <p className="font-cairo text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3 relative z-10">{review.comment}</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-sm">
                        <span className="font-cairo font-bold text-sm text-white">{review.reviewer_name[0]}</span>
                      </div>
                      <div>
                        <span className="font-cairo font-bold text-sm text-foreground block">{review.reviewer_name}</span>
                        <span className="font-cairo text-xs text-muted-foreground">رياضي موثق ✓</span>
                      </div>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── PREMIUM PRODUCTS ─── */}
      {bestProducts.length > 0 && (
        <section className="py-16 md:py-24 relative">
          <div className="container">
            <AnimatedSection>
              <div className="flex items-end justify-between gap-4 mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center shadow-lg shadow-accent/20">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <SectionHeader title="الأكثر مبيعاً" subtitle="المنتجات المفضلة لدى الرياضيين" />
                  </div>
                </div>
                <Link to="/products" className="shrink-0">
                  <Button variant="outline" className="font-cairo font-semibold gap-1.5 text-primary border-primary/20 hover:border-primary/40 hover:bg-primary/5 rounded-xl group">
                    عرض الكل
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={100}>
              {renderProductGrid(bestProducts)}
            </AnimatedSection>
          </div>
        </section>
      )}

      {/* ─── WHY CHOOSE US ─── */}
      <section className="py-20 md:py-28 bg-muted/20">
        <div className="container">
          <AnimatedSection>
            <div className="text-center mb-14">
              <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block mb-4">💎 ما يميزنا</span>
              <SectionHeader title="لماذا يختارنا الرياضيون" subtitle="نقدم تجربة تسوق رياضية استثنائية" center />
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Timer, title: 'شحن سريع', desc: 'نوصل طلبك خلال 24-72 ساعة لجميع الولايات الـ 48', gradient: 'from-primary to-emerald-600' },
              { icon: BadgeCheck, title: 'منتجات أصلية', desc: 'جميع منتجاتنا أصلية 100% مع ضمان من الماركات العالمية', gradient: 'from-secondary to-blue-700' },
              { icon: Dumbbell, title: 'استشارة مجانية', desc: 'فريق رياضي متخصص لمساعدتك في اختيار المعدات المناسبة', gradient: 'from-accent to-orange-600' },
            ].map((feat, i) => (
              <AnimatedSection key={i} delay={i * 120}>
                <div className="bg-card border border-border/50 rounded-3xl p-8 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center mx-auto mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <feat.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-cairo font-bold text-lg text-foreground mb-2">{feat.title}</h3>
                  <p className="font-cairo text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-emerald-600 to-primary animated-gradient" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-sm" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3 blur-sm" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
        <div className="container relative z-10 py-20 md:py-28 text-center">
          <AnimatedSection>
            <span className="inline-block mb-5 text-4xl">🏆</span>
            <h2 className="font-cairo font-black text-3xl md:text-4xl lg:text-5xl text-primary-foreground mb-4">
              ابدأ رحلتك الرياضية اليوم
            </h2>
            <p className="font-cairo text-primary-foreground/80 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
              اكتشف مجموعتنا الواسعة من المعدات والملابس الرياضية واستفد من عروضنا الحصرية
            </p>
            <Link to="/products">
              <Button size="lg" variant="secondary" className="font-cairo font-bold text-lg px-12 h-14 rounded-2xl gap-2.5 shadow-xl shadow-black/20 hover:shadow-2xl hover:scale-[1.04] transition-all duration-300 group">
                تصفح المنتجات
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, subtitle, center }: { title: string; subtitle?: string; center?: boolean }) {
  return (
    <div className={center ? 'text-center mb-0' : 'mb-0'}>
      <h2 className="font-cairo font-extrabold text-2xl md:text-3xl text-foreground">{title}</h2>
      {subtitle && <p className="font-cairo text-muted-foreground mt-1.5 text-sm md:text-base">{subtitle}</p>}
    </div>
  );
}
