import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, SupplierWithBalance } from '@/hooks/useSuppliers';
import SupplierKPICards from '@/components/admin/suppliers/SupplierKPICards';
import SupplierDrawer from '@/components/admin/suppliers/SupplierDrawer';
import SupplierCard from '@/components/admin/suppliers/SupplierCard';
import { Button } from '@/components/ui/button';
import TablePagination from '@/components/admin/TablePagination';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Search, LayoutGrid, List, Pencil, Trash2, Eye, Package } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  inactive: 'bg-muted text-muted-foreground border-border',
};

export default function AdminSuppliersPage() {
  const { t, dir } = useTranslation();
  const navigate = useNavigate();
  const { data: suppliers, isLoading } = useSuppliers();
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier();
  const deleteMut = useDeleteSupplier();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => (localStorage.getItem('suppliers-view') as any) || 'table');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<SupplierWithBalance | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const filtered = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(s => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.category || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [suppliers, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedFiltered = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleViewToggle = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('suppliers-view', mode);
  };

  const handleSave = async (data: any) => {
    try {
      if (editSupplier) {
        await updateMut.mutateAsync({ id: editSupplier.id, ...data });
        toast.success(t('suppliers.supplierEdited'));
      } else {
        await createMut.mutateAsync(data);
        toast.success(t('suppliers.supplierAdded'));
      }
      setDrawerOpen(false);
      setEditSupplier(null);
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMut.mutateAsync(deleteId);
      toast.success(t('suppliers.supplierDeleted'));
    } catch {
      toast.error(t('common.errorOccurred'));
    }
    setDeleteId(null);
  };

  const statuses = ['all', 'active', 'pending', 'inactive'];

  return (
    <div className="space-y-6 animate-fade-in min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-cairo font-bold text-2xl">{t('suppliers.title')}</h1>
        <Button onClick={() => { setEditSupplier(null); setDrawerOpen(true); }} className="font-cairo gap-2 hover-lift">
          <Plus className="w-4 h-4" /> {t('suppliers.addSupplier')}
        </Button>
      </div>

      <SupplierKPICards suppliers={suppliers} isLoading={isLoading} />

      {/* Search + Filters + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm glow-focus rounded-lg">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder={t('suppliers.searchPlaceholder')}
            className={`font-cairo ${dir === 'rtl' ? 'pr-9' : 'pl-9'}`}
          />
        </div>
        <div className="flex gap-1">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full font-cairo text-xs transition-colors ${
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s === 'all' ? t('common.all') : t(`suppliers.status${s.charAt(0).toUpperCase() + s.slice(1)}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 border rounded-lg p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => handleViewToggle('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} aria-label={t('suppliers.tableView')}>
                <List className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="font-cairo text-xs">{t('suppliers.tableView')}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => handleViewToggle('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} aria-label={t('suppliers.gridView')}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="font-cairo text-xs">{t('suppliers.gridView')}</p></TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="font-cairo text-lg text-muted-foreground">{t('suppliers.noSuppliers')}</p>
          <Button onClick={() => { setEditSupplier(null); setDrawerOpen(true); }} variant="outline" className="font-cairo mt-4 gap-2">
            <Plus className="w-4 h-4" /> {t('suppliers.addFirst')}
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => <SupplierCard key={s.id} supplier={s} />)}
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-cairo">{t('suppliers.supplierName')}</TableHead>
                  <TableHead className="font-cairo">{t('suppliers.category')}</TableHead>
                  <TableHead className="font-cairo">{t('common.phone')}</TableHead>
                  <TableHead className="font-cairo text-center">{t('suppliers.totalReceived')}</TableHead>
                  <TableHead className="font-cairo text-center">{t('suppliers.totalGiven')}</TableHead>
                  <TableHead className="font-cairo text-center">{t('suppliers.balance')}</TableHead>
                  <TableHead className="font-cairo text-center">{t('common.status')}</TableHead>
                  <TableHead className="font-cairo text-center">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id} className="row-accent cursor-pointer" onClick={() => navigate(`/admin/suppliers/${s.id}`)}>
                    <TableCell className="font-cairo font-medium">{s.name}</TableCell>
                    <TableCell className="font-cairo text-muted-foreground text-sm">{s.category || '—'}</TableCell>
                    <TableCell className="font-roboto text-sm" dir="ltr">{s.contact_phone || '—'}</TableCell>
                    <TableCell className="font-roboto text-center text-sm text-green-600 font-medium">{s.total_received.toLocaleString()}</TableCell>
                    <TableCell className="font-roboto text-center text-sm text-destructive font-medium">{s.total_given.toLocaleString()}</TableCell>
                    <TableCell className={`font-roboto text-center text-sm font-bold ${s.balance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {s.balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`font-cairo text-xs ${statusStyles[s.status] || ''}`}>
                        {t(`suppliers.status${s.status.charAt(0).toUpperCase() + s.status.slice(1)}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/suppliers/${s.id}`)} aria-label={t('suppliers.viewDetails')}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-cairo text-xs">{t('suppliers.viewDetails')}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditSupplier(s); setDrawerOpen(true); }} aria-label={t('common.edit')}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-cairo text-xs">{t('common.edit')}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(s.id)} aria-label={t('common.delete')}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-cairo text-xs">{t('common.delete')}</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <SupplierDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        supplier={editSupplier}
        onSave={handleSave}
        saving={createMut.isPending || updateMut.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cairo">{t('suppliers.deleteSupplier')}</AlertDialogTitle>
            <AlertDialogDescription className="font-cairo">{t('suppliers.deleteMessage')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-cairo">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground font-cairo">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
