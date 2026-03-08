import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, SlidersHorizontal, X, ShoppingBag, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ProductCard from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/LoadingSkeleton';
import { useCategories } from '@/hooks/useCategories';
import { formatPrice } from '@/lib/format';
import { useCart } from '@/contexts/CartContext';

const SORT_OPTIONS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'cheapest', label: 'الأرخص' },
  { value: 'expensive', label: 'الأغلى' },
];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategory ? [initialCategory] : []);
  const [sort, setSort] = useState('newest');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { items, subtotal } = useCart();

  const { data: categoriesData } = useCategories();
  const categoryNames = categoriesData?.map(c => c.name) || [];

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', sort],
    queryFn: async () => {
      let query = supabase.from('products').select('*').eq('is_active', true);
      if (sort === 'newest') query = query.order('created_at', { ascending: false });
      else if (sort === 'cheapest') query = query.order('price', { ascending: true });
      else if (sort === 'expensive') query = query.order('price', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Compute max price for slider
  const maxPrice = useMemo(() => {
    if (!products) return 100000;
    return Math.max(...products.map(p => Number(p.price)), 10000);
  }, [products]);

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      if (search) {
        const normalize = (s: string) => s.toLowerCase().replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '');
        if (!normalize(p.name).includes(normalize(search))) return false;
      }
      if (selectedCategories.length > 0) {
        const pCats = p.category || [];
        if (!selectedCategories.some(sc => pCats.includes(sc))) return false;
      }
      const price = Number(p.price);
      if (price < priceRange[0] || price > priceRange[1]) return false;
      if (inStockOnly && (p.stock ?? 0) <= 0) return false;
      return true;
    });
  }, [products, search, selectedCategories, priceRange, inStockOnly]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategories([]);
    setPriceRange([0, maxPrice]);
    setInStockOnly(false);
    setSort('newest');
    searchParams.delete('category');
    setSearchParams(searchParams);
  };

  const activeFilterCount = [
    selectedCategories.length > 0,
    priceRange[0] > 0 || priceRange[1] < maxPrice,
    inStockOnly,
    search.length > 0,
  ].filter(Boolean).length;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <Label className="font-cairo font-semibold text-sm mb-2 block">البحث</Label>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث عن منتج..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-10 font-cairo"
          />
        </div>
      </div>

      {/* Categories */}
      {categoryNames.length > 0 && (
        <div>
          <Label className="font-cairo font-semibold text-sm mb-3 block">الفئات</Label>
          <div className="space-y-2.5">
            {categoryNames.map(cat => (
              <label key={cat} className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={selectedCategories.includes(cat)}
                  onCheckedChange={() => toggleCategory(cat)}
                />
                <span className="font-cairo text-sm">{cat}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div>
        <Label className="font-cairo font-semibold text-sm mb-3 block">نطاق السعر</Label>
        <Slider
          min={0}
          max={maxPrice}
          step={100}
          value={priceRange}
          onValueChange={(v) => setPriceRange(v as [number, number])}
          className="mb-3"
        />
        <div className="flex items-center justify-between text-xs font-roboto text-muted-foreground">
          <span>{formatPrice(priceRange[0])}</span>
          <span>{formatPrice(priceRange[1])}</span>
        </div>
      </div>

      {/* In Stock */}
      <div className="flex items-center justify-between">
        <Label className="font-cairo font-semibold text-sm">متوفر فقط</Label>
        <Switch checked={inStockOnly} onCheckedChange={setInStockOnly} />
      </div>

      {/* Sort */}
      <div>
        <Label className="font-cairo font-semibold text-sm mb-2 block">الترتيب</Label>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="font-cairo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="font-cairo">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear */}
      {activeFilterCount > 0 && (
        <Button variant="outline" onClick={clearFilters} className="w-full font-cairo gap-2 rounded-xl">
          <X className="w-4 h-4" />
          مسح الكل
        </Button>
      )}
    </div>
  );

  const categoryEmojis: Record<string, string> = {
    'كرة القدم': '⚽',
    'كرة السلة': '🏀',
    'لياقة بدنية': '💪',
    'جري': '🏃',
    'تنس': '🎾',
    'سباحة': '🏊',
    'ملابس رياضية': '👕',
    'أحذية': '👟',
  };

  return (
    <div className="container py-8 pb-24">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-cairo font-black text-3xl md:text-4xl bg-gradient-to-l from-foreground to-foreground/80 bg-clip-text">المنتجات</h1>
          <p className="font-cairo text-sm text-muted-foreground mt-1">اكتشف تشكيلتنا المميزة</p>
        </div>
        {/* Mobile filter trigger */}
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden font-cairo gap-2 rounded-xl border-primary/20 hover:border-primary/40">
              <SlidersHorizontal className="w-4 h-4" />
              الفلاتر
              {activeFilterCount > 0 && (
                <Badge className="font-roboto text-[10px] h-5 w-5 p-0 flex items-center justify-center bg-primary">{activeFilterCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-cairo">الفلاتر</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <FilterContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Category Boxes - Horizontal scroll */}
      {categoryNames.length > 0 && (
        <div className="mb-6 -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {/* All categories button */}
            <button
              onClick={() => setSelectedCategories([])}
              className={`shrink-0 flex items-center gap-2.5 px-5 py-3 rounded-2xl border transition-all duration-300 font-cairo font-semibold text-sm ${
                selectedCategories.length === 0
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                  : 'bg-card border-border/50 text-foreground hover:border-primary/30 hover:bg-primary/5'
              }`}
            >
              <span className="text-lg">✨</span>
              الكل
            </button>
            {categoryNames.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  if (selectedCategories.includes(cat)) {
                    setSelectedCategories([]);
                  } else {
                    setSelectedCategories([cat]);
                  }
                }}
                className={`shrink-0 flex items-center gap-2.5 px-5 py-3 rounded-2xl border transition-all duration-300 font-cairo font-semibold text-sm group ${
                  selectedCategories.includes(cat)
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                    : 'bg-card border-border/50 text-foreground hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm'
                }`}
              >
                <span className="text-lg group-hover:scale-110 transition-transform">{categoryEmojis[cat] || '📦'}</span>
                {cat}
                {products && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    selectedCategories.includes(cat) ? 'bg-primary-foreground/20' : 'bg-muted'
                  }`}>
                    {products.filter(p => p.category?.includes(cat)).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filters badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 p-3 bg-muted/50 rounded-2xl border border-border/50">
          <span className="font-cairo text-xs text-muted-foreground self-center ml-2">تصفية:</span>
          {selectedCategories.map(cat => (
            <Badge key={cat} variant="secondary" className="font-cairo gap-1.5 cursor-pointer hover:bg-destructive/10 rounded-full px-3 transition-colors" onClick={() => toggleCategory(cat)}>
              {cat}
              <X className="w-3 h-3" />
            </Badge>
          ))}
          {inStockOnly && (
            <Badge variant="secondary" className="font-cairo gap-1.5 cursor-pointer hover:bg-destructive/10 rounded-full px-3 transition-colors" onClick={() => setInStockOnly(false)}>
              متوفر فقط
              <X className="w-3 h-3" />
            </Badge>
          )}
          {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
            <Badge variant="secondary" className="font-cairo gap-1.5 cursor-pointer hover:bg-destructive/10 rounded-full px-3 transition-colors" onClick={() => setPriceRange([0, maxPrice])}>
              {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
              <X className="w-3 h-3" />
            </Badge>
          )}
          {search && (
            <Badge variant="secondary" className="font-cairo gap-1.5 cursor-pointer hover:bg-destructive/10 rounded-full px-3 transition-colors" onClick={() => setSearch('')}>
              "{search}"
              <X className="w-3 h-3" />
            </Badge>
          )}
        </div>
      )}

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20 bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-sm">
            <h2 className="font-cairo font-bold text-lg mb-6 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
              </div>
              الفلاتر
            </h2>
            <FilterContent />
          </div>
        </aside>

        {/* Products Grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5 bg-muted/30 rounded-2xl px-4 py-3 border border-border/30">
            <p className="font-cairo text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{filtered.length}</span> منتج
            </p>
            <div className="flex items-center gap-2">
              <span className="font-cairo text-xs text-muted-foreground hidden sm:inline">الترتيب:</span>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="font-cairo w-28 h-8 text-xs rounded-xl border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="font-cairo text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isLoading ? (
            <ProductGridSkeleton />
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filtered.map((p, i) => (
                <div key={p.id} style={{ animationDelay: `${i * 0.05}s` }} className="animate-fade-in opacity-0 [animation-fill-mode:forwards]">
                  <ProductCard
                    id={p.id}
                    name={p.name}
                    price={Number(p.price)}
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
          ) : (
            <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border/50">
              <ShoppingBag className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-cairo text-muted-foreground text-lg font-semibold">لا توجد منتجات مطابقة لبحثك</p>
              <p className="font-cairo text-muted-foreground/60 text-sm mt-1">جرب تعديل الفلاتر أو البحث بكلمات مختلفة</p>
              <Button variant="outline" onClick={clearFilters} className="font-cairo mt-4 rounded-xl gap-2">
                <X className="w-4 h-4" />
                مسح الفلاتر
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Floating Cart Bar — enhanced ─── */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <div className="container flex items-center gap-3 py-3.5">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                <ShoppingBag className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-cairo font-bold text-sm">{items.length} منتج في السلة</p>
                <p className="font-roboto font-bold text-primary text-sm">{formatPrice(subtotal)}</p>
              </div>
            </div>
            <Link to="/cart">
              <Button variant="outline" className="font-cairo text-sm rounded-xl h-10 shrink-0 border-primary/20 hover:border-primary/40">
                عرض السلة
              </Button>
            </Link>
            <Link to="/checkout">
              <Button className="font-cairo font-semibold text-sm gap-1.5 rounded-xl h-10 shrink-0 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">
                <Zap className="w-4 h-4" />
                إتمام الطلب
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
