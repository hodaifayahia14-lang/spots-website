import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Home, Sparkles, Watch, ArrowLeft, ShoppingBag, Gift, Star, Heart, Shirt,
  Laptop, Smartphone, Car, Utensils, Baby, Headphones, Camera, Sofa, Dumbbell, Palette,
  Book, Gem, Zap, Flame, Leaf, Music, Plane, Pizza, Coffee, Glasses, Footprints, Dog,
  Wrench, Gamepad2, Crown, Flower2, Bike, Briefcase, Stethoscope,
  Truck, Shield, Clock, HeadphonesIcon, BadgeCheck, MapPin, CreditCard,
  ChevronLeft, Search, TrendingUp, Award, Droplets, Package, CheckCircle,
  ArrowDown, Eye, Sparkle, Timer, ThumbsUp,
  type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProductCard from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/LoadingSkeleton';
import { useCategories } from '@/hooks/useCategories';
import heroImage from '@/assets/hero-dates-honey.jpg';
import AnimatedSection from '@/components/AnimatedSection';
import MinimalTemplate from '@/components/templates/MinimalTemplate';
import BoldTemplate from '@/components/templates/BoldTemplate';
import LiquidTemplate from '@/components/templates/LiquidTemplate';
import DigitalTemplate from '@/components/templates/DigitalTemplate';

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Sparkles, Watch, ShoppingBag, Gift, Star, Heart, Shirt,
  Laptop, Smartphone, Car, Utensils, Baby, Headphones, Camera, Sofa, Dumbbell, Palette,
  Book, Gem, Zap, Flame, Leaf, Music, Plane, Pizza, Coffee, Glasses, Footprints, Dog,
  Wrench, Gamepad2, Crown, Flower2, Bike, Briefcase, Stethoscope,
};

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (target <= 0 || !ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        let frame: number;
        const duration = 1800;
        const start = performance.now();
        const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          setCount(Math.floor(easeOutQuart(progress) * target));
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{count}</span>;
}

/* Parallax scroll hook for hero */
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
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Template routing
  if (storeTemplate === 'minimal') return <MinimalTemplate products={allProducts} isLoading={isLoading} categories={categoriesData} />;
  if (storeTemplate === 'bold') return <BoldTemplate products={allProducts} isLoading={isLoading} categories={categoriesData} heroSlides={heroSlides} />;
  if (storeTemplate === 'liquid') return <LiquidTemplate products={allProducts} isLoading={isLoading} categories={categoriesData} heroSlides={heroSlides} />;
  if (storeTemplate === 'digital') return <DigitalTemplate products={allProducts} isLoading={isLoading} categories={categoriesData} heroSlides={heroSlides} />;

  const scrollY = useParallax();

  const trustItems = [
    { icon: Droplets, label: 'عسل طبيعي 100%', desc: 'بدون إضافات', color: 'from-amber-500 to-yellow-500' },
    { icon: Truck, label: 'توصيل سريع', desc: 'لجميع الولايات', color: 'from-amber-600 to-orange-500' },
    { icon: Shield, label: 'جودة معتمدة', desc: 'منتجات مختارة', color: 'from-amber-500 to-yellow-500' },
    { icon: Leaf, label: 'بدون مواد حافظة', desc: '100% طبيعي', color: 'from-yellow-600 to-amber-500' },
  ];

  const categoryCards = [
    { name: 'تمور', subtitle: 'أجود أنواع التمور الجزائرية', emoji: '🌴', gradient: 'from-amber-900/90 via-amber-800/80 to-amber-700/60', decorEmoji: '✨', iconBg: 'bg-amber-500/20', count: allProducts?.filter(p => p.category?.includes('تمور')).length || 0 },
    { name: 'عسل', subtitle: 'عسل طبيعي خام من الجبال', emoji: '🍯', gradient: 'from-yellow-900/90 via-yellow-800/80 to-yellow-600/60', decorEmoji: '🐝', iconBg: 'bg-yellow-500/20', count: allProducts?.filter(p => p.category?.includes('عسل')).length || 0 },
    { name: 'هدايا وتشكيلات', subtitle: 'علب هدايا فاخرة للمناسبات', emoji: '🎁', gradient: 'from-amber-950/90 via-amber-900/80 to-yellow-800/60', decorEmoji: '🎀', iconBg: 'bg-yellow-500/20', count: allProducts?.filter(p => p.category?.includes('هدايا وتشكيلات') || p.category?.includes('هدايا')).length || 0 },
    { name: 'مشتقات', subtitle: 'دبس التمر ومنتجات طبيعية', emoji: '🫙', gradient: 'from-orange-900/90 via-orange-800/80 to-orange-700/60', decorEmoji: '🌿', iconBg: 'bg-orange-500/20', count: allProducts?.filter(p => p.category?.includes('مشتقات')).length || 0 },
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

      {/* ─── Hero Section ─── */}
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
        <section className="relative isolate overflow-hidden min-h-[85vh] sm:min-h-[90vh] flex items-center grain-texture">
          {/* Parallax background image */}
          <div className="absolute inset-0" style={{ transform: `translateY(${scrollY * 0.3}px)` }}>
            <img src={heroImage} alt="" aria-hidden className="w-full h-[120%] object-cover" />
          </div>
          {/* Multi-layer gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#1C1005]/95 via-[#1C1005]/75 to-[#1C1005]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1005]/80 via-transparent to-transparent" />

          {/* Floating decorative particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute rounded-full opacity-20 animate-pulse"
                style={{
                  width: `${8 + i * 4}px`, height: `${8 + i * 4}px`,
                  background: 'radial-gradient(circle, hsl(40,96%,50%), transparent)',
                  top: `${15 + i * 14}%`, left: `${10 + i * 15}%`,
                  animationDelay: `${i * 0.7}s`, animationDuration: `${3 + i}s`,
                }}
              />
            ))}
          </div>

          <div className="container relative z-10 py-24 md:py-32 lg:py-40 flex justify-center">
            <div className="max-w-3xl text-center space-y-8">
              {/* Floating badge with glow */}
              <div className="animate-fade-in">
                <span className="inline-flex items-center gap-2.5 font-cairo text-sm font-semibold tracking-wide text-amber-100 bg-amber-900/40 backdrop-blur-md rounded-full px-6 py-2.5 border border-amber-400/20 shadow-lg shadow-amber-500/10">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                  </span>
                  🌿 100% طبيعي — Natural & Pure
                </span>
              </div>

              <h1 className="font-cairo font-black text-4xl sm:text-5xl lg:text-7xl text-amber-50 leading-[1.1] tracking-tight animate-fade-in" style={{ animationDelay: '0.15s' }}>
                أجود <span className="text-transparent bg-clip-text bg-gradient-to-l from-secondary via-amber-400 to-secondary">التمور</span> والعسل الطبيعي
              </h1>

              {/* Golden decorative line with glow */}
              <div className="flex items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-secondary/60" />
                <Sparkle className="w-4 h-4 text-secondary animate-pulse" />
                <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-secondary/60" />
              </div>

              <p className="font-playfair text-amber-200/80 text-lg sm:text-xl lg:text-2xl leading-relaxed max-w-xl mx-auto animate-fade-in italic" style={{ animationDelay: '0.25s' }}>
                The finest dates & natural honey — crafted by nature
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4 animate-fade-in" style={{ animationDelay: '0.35s' }}>
                <Link to="/products">
                  <Button size="lg" className="font-cairo font-bold text-base sm:text-lg px-10 h-14 gap-2.5 rounded-2xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.03] transition-all duration-300 bg-primary hover:bg-primary/90 group">
                    تسوّق الآن
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/products">
                  <Button size="lg" variant="outline" className="font-cairo font-semibold text-base sm:text-lg px-10 h-14 rounded-2xl border-amber-300/30 text-amber-100 hover:bg-amber-100/10 hover:text-amber-50 hover:border-amber-300/50 backdrop-blur-md bg-white/5 transition-all duration-300">
                    اكتشف المنتجات
                  </Button>
                </Link>
              </div>

              {/* Scroll indicator */}
              <div className="pt-8 animate-fade-in flex justify-center" style={{ animationDelay: '0.5s' }}>
                <div className="flex flex-col items-center gap-2 opacity-60 animate-bounce" style={{ animationDuration: '2s' }}>
                  <span className="font-cairo text-xs text-amber-200/60">اكتشف المزيد</span>
                  <ArrowDown className="w-4 h-4 text-amber-200/60" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Trust Bar — with hover animations and gradient icons ─── */}
      <AnimatedSection>
        <section className="border-b bg-gradient-to-b from-card to-background relative -mt-6 z-20">
          <div className="container py-0">
            <div className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl shadow-xl shadow-black/5 p-6 md:p-8 -mt-6">
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

      {/* ─── Featured Categories — Premium Bento Grid ─── */}
      <section className="py-20 md:py-28">
        <div className="container">
          <AnimatedSection>
            <div className="text-center mb-14">
              <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block mb-4">تصنيفاتنا</span>
              <SectionHeader title="تصفح حسب الفئة" subtitle="اختر الفئة المناسبة واستمتع بتجربة تسوق فريدة" center />
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mt-10">
            {categoryCards.map((cat, i) => (
              <AnimatedSection key={cat.name} delay={i * 100}>
                <Link to={`/products?category=${encodeURIComponent(cat.name)}`}>
                  <div className={`relative rounded-3xl overflow-hidden group cursor-pointer border border-border/50 hover:border-secondary/40 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1.5 ${i === 0 ? 'lg:col-span-1 h-72 sm:h-80' : 'h-72 sm:h-80'}`}>
                    {/* Background gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-t ${cat.gradient}`} />
                    {/* Animated shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1200ms]" />
                    {/* Decorative circles */}
                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full blur-sm group-hover:scale-150 transition-transform duration-700" />
                    <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full blur-sm" />
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-10">
                      {/* Floating decor */}
                      <span className="absolute top-4 left-4 text-xl opacity-20 group-hover:opacity-50 group-hover:rotate-12 transition-all duration-500">{cat.decorEmoji}</span>
                      <span className="absolute bottom-4 right-4 text-lg opacity-15 group-hover:opacity-40 transition-opacity duration-500">{cat.decorEmoji}</span>
                      
                      {/* Icon container */}
                      <div className={`w-20 h-20 rounded-3xl ${cat.iconBg} backdrop-blur-sm flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 border border-white/10 shadow-xl`}>
                        <span className="text-4xl drop-shadow-lg">{cat.emoji}</span>
                      </div>
                      
                      <h3 className="font-cairo font-extrabold text-xl sm:text-2xl text-amber-50 mb-1.5 tracking-tight">{cat.name}</h3>
                      <p className="font-cairo text-xs sm:text-sm text-amber-200/60 max-w-[180px] leading-relaxed">{cat.subtitle}</p>
                      
                      {/* Product count badge */}
                      {cat.count > 0 && (
                        <span className="mt-3 font-cairo text-[11px] text-amber-100/80 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 border border-white/10">
                          {cat.count} منتج
                        </span>
                      )}
                      
                      {/* Hover CTA */}
                      <div className="mt-4 opacity-0 group-hover:opacity-100 transform translate-y-3 group-hover:translate-y-0 transition-all duration-300">
                        <span className="font-cairo text-xs text-amber-100 bg-white/15 backdrop-blur-sm rounded-full px-5 py-2 border border-white/20 inline-flex items-center gap-1.5 shadow-lg">
                          تصفح الآن
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bestsellers — enhanced header ─── */}
      <section className="py-16 md:py-24 bg-muted/30 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.05),transparent)]" />
        <div className="container relative">
          <AnimatedSection>
            <div className="flex items-end justify-between gap-4 mb-10">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-cairo text-xs font-bold text-primary bg-primary/10 rounded-full px-3 py-1">الأكثر طلباً</span>
                </div>
                <SectionHeader title="الأكثر مبيعاً" subtitle="أفضل منتجاتنا المختارة بعناية لكم" />
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

      {/* ─── Brand Story Section — with floating accents ─── */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        {/* Decorative Background Blobs */}
        <div className="absolute top-20 -right-32 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -left-32 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />
        <div className="container relative">
          <AnimatedSection>
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="space-y-8 order-2 md:order-1">
                <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block">🌿 قصتنا</span>
                <h2 className="font-cairo font-black text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight">
                  من قلب <span className="text-primary">الطبيعة</span> إلى مائدتكم
                </h2>
                <blockquote className="font-playfair text-xl text-muted-foreground italic border-r-4 border-gradient-to-b from-secondary to-primary pr-5 leading-relaxed" style={{ borderImage: 'linear-gradient(to bottom, hsl(40,96%,50%), hsl(25,95%,37%)) 1' }}>
                  "نختار لكم أجود المنتجات الطبيعية من أفضل المزارع والمناحل"
                </blockquote>
                <p className="font-cairo text-muted-foreground leading-relaxed text-base">
                  نؤمن بأن الطبيعة تقدم أفضل ما يمكن لصحتكم. لذلك نختار بعناية فائقة كل منتج نقدمه لكم، 
                  من تمور المجهول الفاخرة إلى عسل السدر الطبيعي، لنضمن لكم تجربة استثنائية بجودة لا مثيل لها.
                </p>
                {/* Animated counters with gradient backgrounds */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                  {[
                    { icon: '🌴', value: 50, suffix: '+', label: 'نوع من التمور', color: 'from-amber-500/10 to-amber-600/5' },
                    { icon: '🍯', value: 20, suffix: '+', label: 'نوع من العسل', color: 'from-yellow-500/10 to-yellow-600/5' },
                    { icon: '⭐', value: 10000, suffix: '+', label: 'عميل راضٍ', color: 'from-orange-500/10 to-orange-600/5' },
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
              {/* Image with decorative frame */}
              <div className="relative order-1 md:order-2">
                <div className="rounded-3xl overflow-hidden border-2 border-secondary/20 shadow-2xl shadow-primary/15 relative group">
                  <img src={heroImage} alt="منتجاتنا الطبيعية" className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                {/* Floating accent cards */}
                <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-secondary/20 rounded-full blur-2xl" />
                <div className="absolute -top-6 -left-6 w-36 h-36 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-4 left-6 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-3 shadow-xl animate-fade-in hidden sm:flex items-center gap-3" style={{ animationDelay: '0.5s' }}>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <ThumbsUp className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-cairo font-bold text-sm">+10,000</p>
                    <p className="font-cairo text-xs text-muted-foreground">عميل سعيد</p>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Testimonials — enhanced cards ─── */}
      {reviews && reviews.length > 0 && (
        <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_120%,hsl(var(--secondary)/0.08),transparent)]" />
          <div className="container relative">
            <AnimatedSection>
              <div className="text-center mb-14">
                <span className="font-cairo text-sm font-bold text-secondary bg-secondary/10 rounded-full px-5 py-2 inline-block mb-4">⭐ شهادات العملاء</span>
                <SectionHeader title="ماذا يقول عملاؤنا" subtitle="آراء حقيقية من عملائنا الكرام" center />
              </div>
            </AnimatedSection>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              {reviews.slice(0, 6).map((review, i) => (
                <AnimatedSection key={review.id} delay={i * 100}>
                  <div className="bg-card border border-border/50 rounded-3xl p-7 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 relative group">
                    {/* Quote mark */}
                    <span className="absolute top-4 left-5 text-5xl text-primary/10 font-serif leading-none">❝</span>
                    <div className="flex gap-1 mb-4" dir="ltr">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-4 h-4 ${s <= review.rating ? 'fill-secondary text-secondary' : 'text-muted-foreground/20'}`} />
                      ))}
                    </div>
                    <p className="font-cairo text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3 relative z-10">
                      {review.comment}
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                        <span className="font-cairo font-bold text-sm text-white">{review.reviewer_name[0]}</span>
                      </div>
                      <div>
                        <span className="font-cairo font-bold text-sm text-foreground block">{review.reviewer_name}</span>
                        <span className="font-cairo text-xs text-muted-foreground">عميل موثق ✓</span>
                      </div>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Premium Products ─── */}
      {bestProducts.length > 0 && (
        <section className="py-16 md:py-24 relative">
          <div className="container">
            <AnimatedSection>
              <div className="flex items-end justify-between gap-4 mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-secondary to-amber-500 flex items-center justify-center shadow-lg shadow-secondary/20">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <SectionHeader title="منتجات مميزة" subtitle="أفخم المنتجات في متجرنا" />
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

      {/* ─── Why Choose Us — new section ─── */}
      <section className="py-20 md:py-28 bg-muted/20">
        <div className="container">
          <AnimatedSection>
            <div className="text-center mb-14">
              <span className="font-cairo text-sm font-bold text-primary bg-primary/10 rounded-full px-5 py-2 inline-block mb-4">لماذا نحن؟</span>
              <SectionHeader title="ما يميزنا عن غيرنا" subtitle="نقدم لكم تجربة تسوق لا مثيل لها" center />
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Timer, title: 'شحن سريع', desc: 'نوصل طلبك في أسرع وقت ممكن لجميع الولايات', gradient: 'from-amber-600 to-orange-600' },
              { icon: BadgeCheck, title: 'جودة مضمونة', desc: 'جميع منتجاتنا طبيعية 100% وتخضع لفحص دقيق', gradient: 'from-yellow-600 to-amber-600' },
              { icon: HeadphonesIcon, title: 'خدمة عملاء متميزة', desc: 'فريق دعم جاهز لمساعدتك على مدار الساعة', gradient: 'from-amber-500 to-orange-600' },
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

      {/* ─── Newsletter CTA — premium version ─── */}
      <section className="relative overflow-hidden grain-texture">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/90 animated-gradient" />
        {/* Decorative shapes */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-secondary/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-sm" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full translate-x-1/3 translate-y-1/3 blur-sm" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5" />
        <div className="container relative z-10 py-20 md:py-28 text-center">
          <AnimatedSection>
            <span className="inline-block mb-5 text-4xl">🍯</span>
            <h2 className="font-cairo font-black text-3xl md:text-4xl lg:text-5xl text-primary-foreground mb-4">
              احصل على عروض حصرية
            </h2>
            <p className="font-cairo text-primary-foreground/80 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
              اكتشف مجموعتنا الواسعة من التمور والعسل الطبيعي واستفد من عروضنا الحصرية يومياً.
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
