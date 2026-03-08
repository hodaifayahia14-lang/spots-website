import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { setCacheIDB, getCacheIDB } from '@/lib/offlineQueue';

const PRODUCTS_KEY = 'products';
const CATEGORIES_KEY = 'categories';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// Migrate old localStorage caches to IndexedDB on first load
async function migrateLocalStorageToIDB() {
  const migrated = sessionStorage.getItem('idb-migrated');
  if (migrated) return;
  try {
    for (const key of ['dz-store-products-cache', 'dz-store-categories-cache']) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const idbKey = key.includes('products') ? PRODUCTS_KEY : CATEGORIES_KEY;
        await setCacheIDB(idbKey, parsed.data, CACHE_EXPIRY);
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore migration errors
  }
  sessionStorage.setItem('idb-migrated', '1');
}
migrateLocalStorageToIDB();

export function useOfflineProducts() {
  const [placeholderData, setPlaceholderData] = useState<any[] | undefined>(undefined);

  // Load IDB cache as placeholder
  useEffect(() => {
    getCacheIDB<any[]>(PRODUCTS_KEY).then(data => {
      if (data && data.length > 0) setPlaceholderData(data);
    });
  }, []);

  const query = useQuery({
    queryKey: ['offline-products-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: placeholderData ? () => placeholderData : undefined,
  });

  // Cache fresh data to IndexedDB
  useEffect(() => {
    if (query.data && query.data.length > 0 && !query.isPlaceholderData) {
      setCacheIDB(PRODUCTS_KEY, query.data, CACHE_EXPIRY);
    }
  }, [query.data, query.isPlaceholderData]);

  return query;
}

export function useOfflineCategories() {
  const [placeholderData, setPlaceholderData] = useState<any[] | undefined>(undefined);

  useEffect(() => {
    getCacheIDB<any[]>(CATEGORIES_KEY).then(data => {
      if (data && data.length > 0) setPlaceholderData(data);
    });
  }, []);

  const query = useQuery({
    queryKey: ['offline-categories-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .eq('is_active', true);
      if (error) throw error;
      // Extract unique categories from products
      const allCats = new Set<string>();
      (data || []).forEach((p: any) => {
        if (Array.isArray(p.category)) p.category.forEach((c: string) => allCats.add(c));
      });
      return Array.from(allCats).map(c => ({ name: c, is_active: true }));
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: placeholderData ? () => placeholderData : undefined,
  });

  useEffect(() => {
    if (query.data && query.data.length > 0 && !query.isPlaceholderData) {
      setCacheIDB(CATEGORIES_KEY, query.data, CACHE_EXPIRY);
    }
  }, [query.data, query.isPlaceholderData]);

  return query;
}
