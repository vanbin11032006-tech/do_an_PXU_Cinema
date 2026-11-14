import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Film, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Movie, MovieStatus } from '@/types/domain';
import { errorCode, errorMessage } from '@/lib/errors';
import { listGenres, adminListMovies, deleteMovie, setMovieStatus } from '@/api';
import type { MovieQuery } from '@/api';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageHeader,
  Pagination, Select, Skeleton, StatusBadge, Tabs, toast,
} from '@/components/ui';
import { useDebounce } from '@/hooks';
import { MovieTable } from './catalog/MovieTable';
import { MOVIE_STATUS_LABELS, MOVIE_STATUS_OPTIONS, StatTile } from './catalog/shared';

const PER_PAGE = 10;

export default function MoviesAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MovieStatus | 'all'>('all');
  const [genre, setGenre] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounce(q, 300);

  const [statusTarget, setStatusTarget] = useState<Movie | null>(null);
  const [nextStatus, setNextStatus] = useState<MovieStatus>('now_showing');
  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null);
  const [blockedMovie, setBlockedMovie] = useState<Movie | null>(null);

  useEffect(() => { setPage(1); }, [status, genre, debouncedQ]);

  const params: MovieQuery = { status, genre: genre || undefined, q: debouncedQ || undefined, page, perPage: PER_PAGE };
  const moviesQuery = useQuery({
    queryKey: ['admin', 'movies', params],
    queryFn: () => adminListMovies(params),
  });
  const genresQuery = useQuery({ queryKey: ['genres'], queryFn: listGenres, staleTime: 300_000 });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'movies'] });
    void queryClient.invalidateQueries({ queryKey: ['movies'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, value }: { id: number; value: MovieStatus }) => setMovieStatus(id, value),
    onSuccess: (movie) => {
      toast.success('Đã cập nhật trạng thái', `${movie.title}: ${MOVIE_STATUS_LABELS[movie.status]}`);
      setStatusTarget(null);
      invalidate();
    },
    onError: (error: unknown) => toast.error('Không cập nhật được trạng thái', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMovie(id),
    onSuccess: (result) => {
      toast.success('Đã xóa phim', result.message);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error: unknown) => {
      const target = deleteTarget;
      if (errorCode(error) === 'MOVIE_HAS_SHOWTIMES' && target) {
        setDeleteTarget(null);
        setBlockedMovie(target);
      } else {
        toast.error('Không thể xóa phim', errorMessage(error));
      }
    },
  });

  const openStatus = (movie: Movie) => {
    setNextStatus(movie.status);
    setStatusTarget(movie);
  };

  const data = moviesQuery.data;
  const movies = useMemo(() => data?.items ?? [], [data]);

  useEffect(() => {
    if (!data || page === 1) return;
    if ((page - 1) * PER_PAGE >= data.total) setPage(Math.max(1, Math.ceil(data.total / PER_PAGE)));
  }, [data, page]);

  const filterActive = Boolean(genre || q.trim()) || status !== 'all';

  return (
    <div>
      <PageHeader
        title="Quản lý phim"
        description="Danh mục phim, trạng thái phát hành và thông tin trình chiếu."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/admin/phim/new')}>Thêm phim</Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tổng phim" value={data?.total ?? '—'} icon={<Film className="h-5 w-5" />} hint="Theo bộ lọc hiện tại" />
        <StatTile label="Đang hiển thị" value={movies.length} icon={<SlidersHorizontal className="h-5 w-5" />} tone="info" hint={`Trang ${page}/${Math.max(1, Math.ceil((data?.total ?? 0) / PER_PAGE))}`} />
        <StatTile label="Đang chiếu" value={movies.filter((m) => m.status === 'now_showing').length} tone="success" hint="Trên trang này" />
        <StatTile label="Nổi bật" value={movies.filter((m) => m.featured).length} tone="warning" hint="Được ghim trang chủ" />
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            items={[
              { value: 'all', label: 'Tất cả' },
              { value: 'now_showing', label: 'Đang chiếu' },
              { value: 'coming_soon', label: 'Sắp chiếu' },
              { value: 'ended', label: 'Đã kết thúc' },
            ]}
            value={status}
            onChange={(value) => setStatus(value)}
            className="min-w-0"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Tìm tên phim hoặc slug…"
                className="pl-9"
                aria-label="Tìm phim"
              />
              {q && (
                <button type="button" onClick={() => setQ('')} aria-label="Xóa tìm kiếm" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              aria-label="Lọc theo thể loại"
              className="sm:w-44"
            >
              <option value="">Mọi thể loại</option>
              {(genresQuery.data ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            {filterActive && (
              <Button variant="ghost" size="sm" onClick={() => { setStatus('all'); setGenre(''); setQ(''); }}>
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </div>
      </Card>

      {moviesQuery.isLoading ? (
        <div className="space-y-2.5"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : moviesQuery.isError ? (
        <ErrorState message={errorMessage(moviesQuery.error)} onRetry={() => void moviesQuery.refetch()} />
      ) : movies.length === 0 ? (
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title={filterActive ? 'Không có phim phù hợp' : 'Chưa có phim nào'}
          description={filterActive ? 'Thử xóa bộ lọc hoặc tìm với từ khóa khác.' : 'Bắt đầu bằng việc thêm phim đầu tiên vào danh mục.'}
          action={
            filterActive
              ? <Button variant="secondary" onClick={() => { setStatus('all'); setGenre(''); setQ(''); }}>Xóa bộ lọc</Button>
              : <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/admin/phim/new')}>Thêm phim</Button>
          }
        />
      ) : (
        <>
          <MovieTable
            movies={movies}
            onEdit={(movie) => navigate(`/admin/phim/${movie.id}`)}
            onStatus={openStatus}
            onDelete={(movie) => setDeleteTarget(movie)}
          />
          <Pagination page={data?.page ?? 1} perPage={PER_PAGE} total={data?.total ?? 0} onChange={setPage} />
        </>
      )}

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title="Đổi trạng thái phim"
        description={statusTarget?.title}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStatusTarget(null)}>Hủy</Button>
            <Button
              loading={statusMutation.isPending}
              disabled={!statusTarget || nextStatus === statusTarget.status}
              onClick={() => { if (statusTarget) statusMutation.mutate({ id: statusTarget.id, value: nextStatus }); }}
            >
              Lưu trạng thái
            </Button>
          </div>
        }
      >
        <div className="space-y-2.5">
          {MOVIE_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setNextStatus(option.value)}
              aria-pressed={nextStatus === option.value}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${nextStatus === option.value ? 'border-brand bg-brand/10' : 'border-line bg-base/40 hover:border-brand/40'}`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${nextStatus === option.value ? 'border-brand bg-brand' : 'border-line'}`}>
                {nextStatus === option.value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {option.label}
                  <StatusBadge status={option.value} />
                </span>
                <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
              </span>
            </button>
          ))}
          {statusTarget && statusTarget.status === 'ended' && nextStatus !== 'ended' && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              Đưa phim trở lại sẽ không tự tạo suất chiếu. Hãy kiểm tra lại lịch chiếu sau khi đổi trạng thái.
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        title="Xóa phim?"
        description={deleteTarget ? `Phim “${deleteTarget.title}” sẽ bị ẩn khỏi hệ thống. Nếu phim đã có suất chiếu hoặc đơn hàng, API sẽ chặn thao tác và gợi ý chuyển sang trạng thái Đã kết thúc.` : undefined}
        confirmText="Xóa phim"
        danger
        loading={deleteMutation.isPending}
      />

      <Modal
        open={Boolean(blockedMovie)}
        onClose={() => setBlockedMovie(null)}
        title="Không thể xóa phim"
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setBlockedMovie(null)}>Đóng</Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!blockedMovie) return;
                statusMutation.mutate({ id: blockedMovie.id, value: 'ended' }, {
                  onSuccess: () => setBlockedMovie(null),
                });
              }}
              loading={statusMutation.isPending}
            >
              Chuyển sang Đã kết thúc
            </Button>
          </div>
        }
      >
        {blockedMovie && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-warning/35 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="text-sm leading-relaxed text-ink2">
                <p className="font-semibold text-ink">“{blockedMovie.title}” đã có suất chiếu hoặc đơn hàng liên quan.</p>
                <p className="mt-1">Hệ thống giữ lại phim để bảo toàn lịch sử bán vé. Thay vì xóa, hãy chuyển phim sang trạng thái <strong className="text-ink">Đã kết thúc</strong> để ngừng mở bán và ẩn khỏi lịch chiếu.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge tone="outline">{blockedMovie.genres.join(' · ')}</Badge>
              <span>{blockedMovie.duration} phút</span>
              <StatusBadge status={blockedMovie.status} label={MOVIE_STATUS_LABELS[blockedMovie.status]} />
            </div>
            <p className="text-xs text-muted">Nếu cần xóa hoàn toàn, hãy hủy hoặc dời toàn bộ suất chiếu và xử lý đơn hàng trước.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
