import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface Props {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export default function TablePagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }: Props) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate visible page numbers
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      pages.push(i);
    }
  }

  return (
    <div className="flex items-center justify-between pt-3 flex-wrap gap-2">
      <p className="font-cairo text-xs text-muted-foreground">
        {t('common.showing')} {start}-{end} / {totalItems} {t('common.results')}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        {pages.map((page, idx) => (
          <span key={page}>
            {idx > 0 && pages[idx - 1] !== page - 1 && <span className="px-1 text-muted-foreground text-xs">...</span>}
            <Button
              variant={page === currentPage ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8 font-roboto text-xs"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          </span>
        ))}
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
