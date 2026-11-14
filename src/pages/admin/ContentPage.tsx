import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GalleryHorizontal, ImagePlus, Newspaper, Pencil, Plus, Trash2,
} from 'lucide-react';
import {
  adminListMovies, deleteBanner, listBannersAdmin, listNewsAdmin, saveBanner, saveNews,
} from '@/api';
import type { Banner, Movie, News } from '@/types/domain';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, slugify } from '@/lib/format';
import {
  Badge, Button, Card, Chip, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, Input, Modal,
  PageHeader, Select, Skeleton, StatusBadge, Switch, Tabs, Textarea, toast, type Column,
} from '@/components/ui';

type TabValue = 'banners' | 'news';
type NewsStatusFilter = 'all' | News['status'];

export default function ContentPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabValue>('banners');
  const [newsFilter, setNewsFilter] = useState<NewsStatusFilter>('all');
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [newsFormOpen, setNewsFormOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);

  const bannersQuery = useQuery({ queryKey: ['admin', 'content', 'banners'], queryFn: listBannersAdmin });
  const newsQuery = useQuery({ queryKey: ['admin', 'content', 'news'], queryFn: listNewsAdmin });
  const moviesQuery = useQuery({
    queryKey: ['admin', 'movies', 'options'],
    queryFn: () => adminListMovies({ status: 'all', perPage: 200 }),
  });

  const banners = bannersQuery.data ?? [];
  const news = newsQuery.data ?? [];
  const movies = moviesQuery.data?.items ?? [];

  const filteredNews = useMemo(
    () => (newsFilter === 'all' ? news : news.filter((item) => item.status === newsFilter)),
    [news, newsFilter],
  );

  const toggleBanner = useMutation({
    mutationFn: (banner: Banner) => saveBanner({ ...banner, active: !banner.active }),
    onSuccess: (banner) => {
      toast.success(banner.active ? 'Đã bật banner' : 'Đã tạm ẩn banner', banner.title);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'content', 'banners'] });
    },
    onError: (error) => toast.error('Không cập nhật được banner', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (banner: Banner) => deleteBanner(banner.id),
    onSuccess: () => {
      toast.success('Đã xóa banner', 'Banner đã được gỡ khỏi trang chủ.');
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'content', 'banners'] });
    },
    onError: (error) => toast.error('Không xóa được banner', errorMessage(error)),
  });

  const newsColumns: Column<News>[] = [
    {
      key: 'title',
      header: 'Bài viết',
      sortValue: (item) => item.title,
      render: (item) => (
        <div className="min-w-0 max-w-[420px]">
          <p className="font-semibold text-ink">{item.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{item.excerpt}</p>
          <p className="mt-1 font-mono text-[11px] text-brand/80">/{item.slug}</p>
        </div>
      ),
    },
    {
      key: 'tag',
      header: 'Chuyên mục',
      render: (item) => <Badge tone="info">{item.tag}</Badge>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'publishedAt',
      header: 'Ngày tạo',
      align: 'right',
      sortValue: (item) => item.publishedAt,
      render: (item) => <span className="text-xs text-muted">{formatDateTime(item.publishedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditingNews(item); setNewsFormOpen(true); }}>
          Sửa
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Banner & tin tức"
        description="Điều phối nội dung hiển thị trên trang chủ và xuất bản tin tức, khuyến mãi."
        actions={tab === 'banners' ? (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditingBanner(null); setBannerFormOpen(true); }}>
            Thêm banner
          </Button>
        ) : (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditingNews(null); setNewsFormOpen(true); }}>
            Viết bài
          </Button>
        )}
      />

      <Tabs
        items={[
          { value: 'banners', label: 'Banner', count: banners.length, icon: <GalleryHorizontal className="h-4 w-4" /> },
          { value: 'news', label: 'Tin tức', count: news.length, icon: <Newspaper className="h-4 w-4" /> },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'banners' && (
        <section className="space-y-3" aria-label="Danh sách banner">
          {bannersQuery.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
          ) : bannersQuery.isError ? (
            <ErrorState message={errorMessage(bannersQuery.error)} onRetry={() => { void bannersQuery.refetch(); }} />
          ) : banners.length === 0 ? (
            <EmptyState
              icon={<ImagePlus className="h-6 w-6" />}
              title="Chưa có banner nào"
              description="Thêm banner để hiển thị ưu đãi nổi bật trên trang chủ."
              action={<Button variant="outline" size="sm" onClick={() => { setEditingBanner(null); setBannerFormOpen(true); }}>Thêm banner đầu tiên</Button>}
            />
          ) : (
            <div className="space-y-3">
              {banners.map((banner) => {
                const movie = banner.movieId ? movies.find((item) => item.id === banner.movieId) : undefined;
                const pending = toggleBanner.isPending && toggleBanner.variables?.id === banner.id;
                return (
                  <Card key={banner.id} className="overflow-hidden">
                    <div className="flex flex-col sm:flex-row">
                      <div
                        className="relative flex min-h-[150px] shrink-0 flex-col justify-end p-4 sm:w-80"
                        style={{ backgroundImage: `linear-gradient(115deg, ${banner.tone.from}, ${banner.tone.to})` }}
                      >
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: banner.tone.accent }}>
                          Vị trí #{banner.order} · {banner.active ? 'Đang hiển thị' : 'Tạm ẩn'}
                        </span>
                        <p className="mt-1 font-display text-xl font-semibold uppercase leading-tight text-white">{banner.title}</p>
                        {banner.subtitle && <p className="mt-1 line-clamp-1 text-xs text-white/75">{banner.subtitle}</p>}
                        <span className="mt-2 w-fit rounded border border-white/25 bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {banner.ctaLabel}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={banner.active ? 'success' : 'neutral'}>{banner.active ? 'Đang bật' : 'Đang ẩn'}</Badge>
                          {movie && <Badge tone="info">{movie.title}</Badge>}
                          <span className="text-xs text-muted">Cập nhật gần nhất theo thứ tự hiển thị</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Switch
                            checked={banner.active}
                            disabled={pending}
                            onChange={() => toggleBanner.mutate(banner)}
                            label="Hiển thị banner"
                            description="Bật để xuất hiện trên trang chủ."
                          />
                          <div className="flex items-center gap-1.5">
                            <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditingBanner(banner); setBannerFormOpen(true); }}>
                              Sửa
                            </Button>
                            <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(banner)}>
                              Xóa
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'news' && (
        <section className="space-y-3" aria-label="Danh sách tin tức">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {(['all', 'published', 'draft'] as NewsStatusFilter[]).map((status) => (
              <Chip key={status} active={newsFilter === status} onClick={() => setNewsFilter(status)}>
                {status === 'all' ? 'Tất cả' : status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                <span className="text-[11px] opacity-70">
                  {status === 'all' ? news.length : news.filter((item) => item.status === status).length}
                </span>
              </Chip>
            ))}
          </div>
          {newsQuery.isError ? (
            <ErrorState message={errorMessage(newsQuery.error)} onRetry={() => { void newsQuery.refetch(); }} />
          ) : (
            <DataTable
              columns={newsColumns}
              rows={filteredNews}
              rowKey={(item) => item.id}
              loading={newsQuery.isLoading}
              empty={news.length ? 'Không có bài viết phù hợp bộ lọc.' : 'Chưa có bài viết nào.'}
              emptyAction={!news.length
                ? <Button variant="outline" size="sm" onClick={() => { setEditingNews(null); setNewsFormOpen(true); }}>Viết bài đầu tiên</Button>
                : undefined}
              mobileCard={(item) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{item.title}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted">{item.excerpt}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <Badge tone="info">{item.tag}</Badge>
                    <span className="font-mono text-brand/80">/{item.slug}</span>
                    <span>{formatDateTime(item.publishedAt)}</span>
                  </div>
                  <Button variant="secondary" size="sm" full onClick={() => { setEditingNews(item); setNewsFormOpen(true); }}>Chỉnh sửa bài viết</Button>
                </div>
              )}
            />
          )}
        </section>
      )}

      {bannerFormOpen && (
        <BannerFormModal
          banner={editingBanner}
          movies={movies}
          moviesLoading={moviesQuery.isLoading}
          onClose={() => { setBannerFormOpen(false); setEditingBanner(null); }}
        />
      )}
      {newsFormOpen && (
        <NewsFormModal
          news={editingNews}
          allNews={news}
          onClose={() => { setNewsFormOpen(false); setEditingNews(null); }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget); }}
        title="Xóa banner"
        description={deleteTarget ? `Banner “${deleteTarget.title}” sẽ bị gỡ vĩnh viễn khỏi trang chủ.` : undefined}
        confirmText="Xóa banner"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

interface BannerFormState {
  title: string;
  subtitle: string;
  movieId: string;
  ctaLabel: string;
  order: string;
  from: string;
  to: string;
  accent: string;
  active: boolean;
}

function BannerFormModal({ banner, movies, moviesLoading, onClose }: {
  banner: Banner | null;
  movies: Movie[];
  moviesLoading: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BannerFormState>(() => ({
    title: banner?.title ?? '',
    subtitle: banner?.subtitle ?? '',
    movieId: banner?.movieId ? String(banner.movieId) : '',
    ctaLabel: banner?.ctaLabel ?? 'Mua vé',
    order: banner ? String(banner.order) : '1',
    from: banner?.tone.from ?? '#ff6600',
    to: banner?.tone.to ?? '#431407',
    accent: banner?.tone.accent ?? '#fed7aa',
    active: banner?.active ?? true,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const patch = (changes: Partial<BannerFormState>) => setForm((prev) => ({ ...prev, ...changes }));

  const mutation = useMutation({
    mutationFn: () => saveBanner({
      id: banner?.id,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      movieId: form.movieId ? Number(form.movieId) : undefined,
      ctaLabel: form.ctaLabel.trim(),
      order: Number(form.order),
      active: form.active,
      tone: { from: form.from, to: form.to, accent: form.accent },
    }),
    onSuccess: () => {
      toast.success(banner ? 'Đã cập nhật banner' : 'Đã thêm banner', form.title.trim());
      void queryClient.invalidateQueries({ queryKey: ['admin', 'content', 'banners'] });
      onClose();
    },
    onError: (error) => toast.error('Không lưu được banner', errorMessage(error)),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    const order = Number(form.order);
    if (form.title.trim().length < 3) next.title = 'Nhập tiêu đề tối thiểu 3 ký tự.';
    if (form.ctaLabel.trim().length < 2) next.ctaLabel = 'Nhập nhãn nút.';
    if (!Number.isInteger(order) || order < 1) next.order = 'Thứ tự phải là số nguyên từ 1.';
    if (!/^#[0-9a-f]{6}$/i.test(form.from)) next.from = 'Mã màu không hợp lệ.';
    if (!/^#[0-9a-f]{6}$/i.test(form.to)) next.to = 'Mã màu không hợp lệ.';
    if (!/^#[0-9a-f]{6}$/i.test(form.accent)) next.accent = 'Mã màu không hợp lệ.';
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={banner ? 'Sửa banner' : 'Thêm banner'}
      description="Banner hiển thị theo thứ tự tăng dần trên trang chủ."
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={submit}>{banner ? 'Lưu thay đổi' : 'Thêm banner'}</Button>
        </div>
      )}
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <Field label="Tiêu đề" htmlFor="banner-title" required error={errors.title} className="sm:col-span-2">
          <Input id="banner-title" value={form.title} error={Boolean(errors.title)} autoFocus onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Mô tả ngắn" htmlFor="banner-subtitle" className="sm:col-span-2">
          <Input id="banner-subtitle" value={form.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="VD: Chỉ từ 50.000đ cho suất 2D" />
        </Field>
        <Field label="Phim liên kết" htmlFor="banner-movie" hint="Không bắt buộc.">
          <Select id="banner-movie" value={form.movieId} disabled={moviesLoading} onChange={(e) => patch({ movieId: e.target.value })}>
            <option value="">Không liên kết phim</option>
            {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
          </Select>
        </Field>
        <Field label="Nhãn nút" htmlFor="banner-cta" required error={errors.ctaLabel}>
          <Input id="banner-cta" value={form.ctaLabel} error={Boolean(errors.ctaLabel)} maxLength={24} onChange={(e) => patch({ ctaLabel: e.target.value })} />
        </Field>
        <Field label="Thứ tự hiển thị" htmlFor="banner-order" required error={errors.order}>
          <Input id="banner-order" type="number" min={1} step={1} value={form.order} error={Boolean(errors.order)} onChange={(e) => patch({ order: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={form.active} onChange={(checked) => patch({ active: checked })} label="Hiển thị ngay" description="Bạn có thể bật/tắt nhanh từ danh sách." />
        </div>
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
          <Field label="Màu bắt đầu" htmlFor="banner-from" error={errors.from}>
            <input id="banner-from" type="color" value={form.from} onChange={(e) => patch({ from: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-line bg-base p-1" />
          </Field>
          <Field label="Màu kết thúc" htmlFor="banner-to" error={errors.to}>
            <input id="banner-to" type="color" value={form.to} onChange={(e) => patch({ to: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-line bg-base p-1" />
          </Field>
          <Field label="Màu chữ nhấn" htmlFor="banner-accent" error={errors.accent}>
            <input id="banner-accent" type="color" value={form.accent} onChange={(e) => patch({ accent: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-line bg-base p-1" />
          </Field>
        </div>
        <div
          className="sm:col-span-2 flex min-h-[110px] flex-col justify-end rounded-xl p-4"
          style={{ backgroundImage: `linear-gradient(115deg, ${form.from}, ${form.to})` }}
          aria-label="Xem trước gradient banner"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: form.accent }}>Xem trước</span>
          <p className="font-display text-xl font-semibold uppercase leading-tight text-white">{form.title || 'Tiêu đề banner'}</p>
          <p className="line-clamp-1 text-xs text-white/75">{form.subtitle || 'Mô tả ngắn hiển thị tại đây'}</p>
          <span className="mt-2 w-fit rounded border border-white/25 bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white">
            {form.ctaLabel || 'Mua vé'}
          </span>
        </div>
      </form>
    </Modal>
  );
}

interface NewsFormState {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  tag: string;
  status: News['status'];
}

function NewsFormModal({ news, allNews, onClose }: { news: News | null; allNews: News[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewsFormState>(() => ({
    title: news?.title ?? '',
    slug: news?.slug ?? '',
    excerpt: news?.excerpt ?? '',
    body: news?.body ?? '',
    tag: news?.tag ?? 'Tin tức',
    status: news?.status ?? 'draft',
  }));
  const [slugTouched, setSlugTouched] = useState(Boolean(news));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const patch = (changes: Partial<NewsFormState>) => setForm((prev) => ({ ...prev, ...changes }));

  const mutation = useMutation({
    mutationFn: () => saveNews({
      id: news?.id,
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim(),
      body: form.body.trim(),
      tag: form.tag.trim(),
      status: form.status,
    }),
    onSuccess: (saved) => {
      toast.success(news ? 'Đã cập nhật bài viết' : 'Đã tạo bài viết', saved.title);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'content', 'news'] });
      onClose();
    },
    onError: (error) => {
      setFormError(errorMessage(error));
      toast.error('Không lưu được bài viết', errorMessage(error));
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    const slug = form.slug.trim();
    if (form.title.trim().length < 5) next.title = 'Tiêu đề tối thiểu 5 ký tự.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) next.slug = 'Slug chỉ gồm chữ thường, số và dấu gạch nối.';
    if (allNews.some((item) => item.slug === slug && item.id !== news?.id)) next.slug = 'Slug đã được sử dụng.';
    if (form.excerpt.trim().length < 10) next.excerpt = 'Mô tả tối thiểu 10 ký tự.';
    if (form.body.trim().length < 20) next.body = 'Nội dung tối thiểu 20 ký tự.';
    if (form.tag.trim().length < 2) next.tag = 'Nhập chuyên mục.';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={news ? 'Sửa bài viết' : 'Viết bài mới'}
      description="Bài nháp chỉ hiển thị trong trang quản trị cho đến khi xuất bản."
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={submit}>{news ? 'Lưu thay đổi' : 'Tạo bài viết'}</Button>
        </div>
      )}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <Field label="Tiêu đề" htmlFor="news-title" required error={errors.title}>
          <Input
            id="news-title"
            value={form.title}
            error={Boolean(errors.title)}
            autoFocus
            onChange={(e) => {
              const title = e.target.value;
              setForm((prev) => ({ ...prev, title, slug: slugTouched ? prev.slug : slugify(title) }));
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug" htmlFor="news-slug" required error={errors.slug} hint="Dùng cho đường dẫn công khai.">
            <Input
              id="news-slug"
              value={form.slug}
              error={Boolean(errors.slug)}
              onChange={(e) => { setSlugTouched(true); patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }); }}
            />
          </Field>
          <Field label="Chuyên mục" htmlFor="news-tag" required error={errors.tag}>
            <Input id="news-tag" value={form.tag} error={Boolean(errors.tag)} onChange={(e) => patch({ tag: e.target.value })} />
          </Field>
        </div>
        <Field label="Mô tả ngắn" htmlFor="news-excerpt" required error={errors.excerpt} hint="Hiển thị ở danh sách tin tức.">
          <Textarea
            id="news-excerpt"
            value={form.excerpt}
            error={Boolean(errors.excerpt)}
            maxLength={220}
            onChange={(e) => patch({ excerpt: e.target.value })}
          />
        </Field>
        <Field label="Nội dung" htmlFor="news-body" required error={errors.body}>
          <Textarea
            id="news-body"
            value={form.body}
            error={Boolean(errors.body)}
            className="min-h-[220px]"
            placeholder="Nội dung bài viết (văn bản thuần)…"
            onChange={(e) => patch({ body: e.target.value })}
          />
        </Field>
        <Field label="Trạng thái" htmlFor="news-status">
          <Select id="news-status" value={form.status} onChange={(e) => patch({ status: e.target.value as News['status'] })}>
            <option value="draft">Bản nháp</option>
            <option value="published">Đã đăng</option>
          </Select>
        </Field>
        {formError && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}
      </form>
    </Modal>
  );
}
