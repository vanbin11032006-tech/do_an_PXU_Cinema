import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { listNews } from '@/api';
import { useDocumentTitle } from '@/hooks';
import { EmptyState, Skeleton } from '@/components/ui';
import { PageHero } from './components/PageHero';
import { NewsCard } from './components/NewsCard';
import { SectionError } from './components/States';

export default function NewsListPage() {
  useDocumentTitle('Tin tức & khuyến mãi');
  const newsQuery = useQuery({ queryKey: ['public', 'news'], queryFn: listNews });
  const news = newsQuery.data ?? [];
  const [featured, ...rest] = news;

  return (
    <div>
      <PageHero
        eyebrow="Tin tức & khuyến mãi"
        title="Chuyện rạp và ưu đãi"
        description="Cập nhật phòng chiếu mới, chính sách, hướng dẫn đặt vé và các chương trình ưu đãi đang diễn ra tại PXU Cinema."
        breadcrumb={<nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-xs text-muted"><Link to="/" className="hover:text-ink">Trang chủ</Link><span aria-hidden>›</span><span className="text-ink2">Tin tức</span></nav>}
      />

      <div className="container-page py-8 sm:py-10">
        {newsQuery.isLoading ? (
          <div aria-hidden>
            <Skeleton className="h-64 w-full rounded-card" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-72 w-full rounded-card" />)}
            </div>
          </div>
        ) : newsQuery.isError ? (
          <SectionError error={newsQuery.error} onRetry={() => void newsQuery.refetch()} title="Không tải được tin tức" />
        ) : news.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="h-6 w-6" />}
            title="Chưa có bài viết nào"
            description="Tin tức và chương trình khuyến mãi mới của PXU Cinema sẽ được cập nhật tại đây."
          />
        ) : (
          <>
            <p className="mb-4 text-xs text-muted">{news.length} bài viết đã đăng</p>
            {featured && <NewsCard news={featured} featured />}
            {rest.length > 0 && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((item) => <NewsCard key={item.id} news={item} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
