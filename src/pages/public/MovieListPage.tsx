import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { listGenres, listMovies } from '@/api';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { Breadcrumb, Button, Chip, EmptyState, Field, Input, Pagination, Select, Tabs } from '@/components/ui';
import { MovieGrid } from './components/MovieGrid';
import { MovieGridSkeleton, SectionError } from './components/States';
import { PageHero } from './components/PageHero';

const AGES = ['P', 'K', 'T13', 'T16', 'T18'] as const;

export default function MovieListPage() {
  useDocumentTitle('Phim');
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [search, setSearch] = useState(urlQuery);
  const debouncedSearch = useDebounce(search, 350);

  const statusParam = params.get('status');
  const status = statusParam === 'coming_soon' ? 'coming_soon' : 'now_showing';
  const genre = params.get('genre') ?? '';
  const ageParam = params.get('age') ?? '';
  const age = AGES.includes(ageParam as (typeof AGES)[number]) ? ageParam : '';
  const sortParam = params.get('sort');
  const sort = sortParam === 'rating' || sortParam === 'title' ? sortParam : 'newest';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  useEffect(() => {
    setSearch(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (debouncedSearch !== search || debouncedSearch === urlQuery) return;
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (debouncedSearch.trim()) next.set('q', debouncedSearch.trim());
      else next.delete('q');
      next.delete('page');
      return next;
    }, { replace: true });
  }, [debouncedSearch, search, urlQuery, setParams]);

  const genresQuery = useQuery({ queryKey: ['public', 'genres'], queryFn: listGenres });
  const moviesQuery = useQuery({
    queryKey: ['public', 'movies', { status, genre, age, q: urlQuery.trim(), sort, page }],
    queryFn: () => listMovies({
      status,
      genre: genre || undefined,
      age: age || undefined,
      q: urlQuery.trim() || undefined,
      sort,
      page,
      perPage: 12,
    }),
  });

  const genres = genresQuery.data ?? [];
  const movies = moviesQuery.data?.items ?? [];
  const total = moviesQuery.data?.total ?? 0;
  const hasFilters = Boolean(urlQuery || genre || age || status !== 'now_showing' || sort !== 'newest');

  const updateFilter = (key: string, value: string | null) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  };

  const clearFilters = () => {
    setSearch('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const goToPage = (nextPage: number) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (nextPage <= 1) next.delete('page');
      else next.set('page', String(nextPage));
      return next;
    }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <PageHero
        eyebrow="Danh mục phim"
        title="Phim tại PXU Cinema"
        description="Tìm phim theo tên, thể loại, độ tuổi và sắp xếp theo điểm đánh giá hoặc ngày khởi chiếu."
        breadcrumb={<Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Phim' }]} />}
      />

      <div className="container-page py-8 sm:py-10">
        <div className="card-surface p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_160px]">
            <Field label="Tìm phim" htmlFor="movie-search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input
                  id="movie-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nhập tên phim, đạo diễn, diễn viên…"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </Field>

            <Field label="Sắp xếp" htmlFor="movie-sort">
              <Select
                id="movie-sort"
                value={sort}
                onChange={(event) => updateFilter('sort', event.target.value === 'newest' ? null : event.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="rating">Điểm cao</option>
                <option value="title">Tên A–Z</option>
              </Select>
            </Field>

            <Field label="Độ tuổi" htmlFor="movie-age">
              <Select id="movie-age" value={age} onChange={(event) => updateFilter('age', event.target.value || null)}>
                <option value="">Mọi độ tuổi</option>
                {AGES.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-line/60 pt-4 xl:flex-row xl:items-center xl:justify-between">
            <Tabs
              variant="segment"
              size="sm"
              items={[
                { value: 'now_showing', label: 'Đang chiếu' },
                { value: 'coming_soon', label: 'Sắp chiếu' },
              ]}
              value={status}
              onChange={(value) => updateFilter('status', value === 'now_showing' ? null : value)}
              className="w-fit max-w-full"
            />
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!genre} onClick={() => updateFilter('genre', null)}>Tất cả thể loại</Chip>
              {genres.map((item) => (
                <Chip key={item} active={genre === item} onClick={() => updateFilter('genre', genre === item ? null : item)}>
                  {item}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
            <p className="inline-flex items-center gap-1.5 text-xs text-muted">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {moviesQuery.isLoading ? 'Đang tìm phim…' : `${total} phim phù hợp`}
            </p>
            {hasFilters && (
              <Button variant="ghost" size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </div>

        <div className="mt-7">
          {moviesQuery.isLoading ? (
            <MovieGridSkeleton count={12} />
          ) : moviesQuery.isError ? (
            <SectionError error={moviesQuery.error} onRetry={() => void moviesQuery.refetch()} title="Không tải được danh sách phim" />
          ) : movies.length === 0 ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="Không tìm thấy phim phù hợp"
              description="Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ phim tại PXU Cinema."
              action={<Button variant="outline" onClick={clearFilters}>Xóa bộ lọc</Button>}
            />
          ) : (
            <>
              <MovieGrid movies={movies} />
              <Pagination page={page} perPage={12} total={total} onChange={goToPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
