import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileQuestion, LifeBuoy } from 'lucide-react';
import { getStaticPage } from '@/api';
import { useDocumentTitle } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { PageHero } from './components/PageHero';
import { ActionLink } from './components/ActionLink';

const RELATED_PAGES = [
  { slug: 'dieu-khoan', label: 'Điều khoản sử dụng' },
  { slug: 'chinh-sach-hoan-huy', label: 'Chính sách hoàn hủy' },
  { slug: 'bao-mat', label: 'Chính sách bảo mật' },
  { slug: 'faq', label: 'Câu hỏi thường gặp' },
  { slug: 'quy-che-rap', label: 'Quy chế rạp' },
];

export default function StaticPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const pageQuery = useQuery({
    queryKey: ['public', 'static-page', slug],
    queryFn: () => getStaticPage(slug),
    enabled: Boolean(slug),
  });
  const page = pageQuery.data;
  useDocumentTitle(page?.title);

  if (pageQuery.isLoading) {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-64 w-full rounded-card" />
      </div>
    );
  }

  if (pageQuery.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState title="Không tải được nội dung" message={errorMessage(pageQuery.error)} onRetry={() => void pageQuery.refetch()} />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<FileQuestion className="h-6 w-6" />}
          title="Không tìm thấy trang"
          description={`Trang “${slug}” không tồn tại hoặc đã được di chuyển. Bạn có thể quay về trang chủ hoặc xem các chính sách của PXU Cinema.`}
          action={<ActionLink to="/" variant="secondary">Về trang chủ</ActionLink>}
        />
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
          {RELATED_PAGES.map((item) => (
            <Link key={item.slug} to={`/trang/${item.slug}`} className="rounded-full border border-line/70 bg-surface/70 px-3 py-1.5 text-xs font-medium text-ink2 transition hover:border-brand/40 hover:text-brand">
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const paragraphs = page.body.split(/\n{2,}/).filter((paragraph) => paragraph.trim());

  return (
    <div>
      <PageHero
        eyebrow="Thông tin PXU"
        title={page.title}
        description="Thông tin chính thức được cập nhật bởi PXU Cinema."
        breadcrumb={(
          <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Link to="/" className="hover:text-ink">Trang chủ</Link>
            <span aria-hidden>›</span>
            <span className="text-ink2">{page.title}</span>
          </nav>
        )}
      />

      <div className="container-page py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <article className="rounded-card border border-line/70 bg-surface/80 p-6 shadow-card sm:p-9">
            <p className="eyebrow">Nội dung</p>
            <div className="mt-4 space-y-4 text-[15px] leading-8 text-ink2">
              {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
            <p className="mt-8 border-t border-line/60 pt-4 text-xs text-muted">
              Cập nhật lần cuối bởi bộ phận vận hành PXU Cinema. Nếu có thắc mắc, vui lòng liên hệ quầy vé hoặc bộ phận chăm sóc khách hàng tại rạp.
            </p>
          </article>

          <aside className="h-fit rounded-card border border-line/60 bg-surface/50 p-5">
            <p className="eyebrow flex items-center gap-2"><LifeBuoy className="h-3.5 w-3.5" /> Trang liên quan</p>
            <nav className="mt-3 space-y-1">
              {RELATED_PAGES.map((item) => (
                <Link
                  key={item.slug}
                  to={`/trang/${item.slug}`}
                  className={`block rounded-lg px-3 py-2 text-sm transition ${item.slug === slug ? 'bg-brand/10 font-semibold text-brand' : 'text-ink2 hover:bg-elevated hover:text-ink'}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-line/60 pt-4">
              <ActionLink to="/trang/faq" variant="outline" size="sm" className="w-full">Câu hỏi thường gặp</ActionLink>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
