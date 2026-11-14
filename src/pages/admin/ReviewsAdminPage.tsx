import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, MessageSquare, Search, Star } from 'lucide-react';
import { adminListMovies, listReviewsAdmin, setReviewVisibility } from '@/api';
import type { Review } from '@/types/domain';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, number } from '@/lib/format';
import { useDebounce } from '@/hooks';
import {
  Avatar, DataTable, ErrorState, Input, PageHeader, Rating, Select, Skeleton, Switch, toast, type Column,
} from '@/components/ui';
import { StatCard } from './system/StatCard';

type VisibilityFilter = 'all' | 'visible' | 'hidden';

export default function ReviewsAdminPage() {
  const queryClient = useQueryClient();
  const [movieId, setMovieId] = useState<'all' | string>('all');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const reviewsQuery = useQuery({ queryKey: ['admin', 'reviews'], queryFn: listReviewsAdmin });
  const moviesQuery = useQuery({
    queryKey: ['admin', 'movies', 'options'],
    queryFn: () => adminListMovies({ status: 'all', perPage: 200 }),
  });

  const reviews = reviewsQuery.data ?? [];
  const movies = moviesQuery.data?.items ?? [];

  const toggle = useMutation({
    mutationFn: ({ id, visible }: { id: number; visible: boolean }) => setReviewVisibility(id, visible),
    onSuccess: (_result, variables) => {
      toast.success(variables.visible ? 'Đã hiển thị đánh giá' : 'Đã ẩn đánh giá', 'Thay đổi đã được ghi nhật ký.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
    onError: (error) => toast.error('Không cập nhật được đánh giá', errorMessage(error)),
  });

  const stats = useMemo(() => ({
    visible: reviews.filter((review) => review.visible).length,
    hidden: reviews.filter((review) => !review.visible).length,
    average: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0,
  }), [reviews]);

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return reviews.filter((review) => {
      if (movieId !== 'all' && review.movieId !== Number(movieId)) return false;
      if (visibility === 'visible' && !review.visible) return false;
      if (visibility === 'hidden' && review.visible) return false;
      if (!needle) return true;
      return review.userName.toLowerCase().includes(needle) || review.comment.toLowerCase().includes(needle);
    });
  }, [reviews, movieId, visibility, debouncedSearch]);

  const movieTitle = (id: number) => movies.find((movie) => movie.id === id)?.title ?? `Phim #${id}`;

  const columns: Column<Review>[] = [
    {
      key: 'movie',
      header: 'Phim',
      sortValue: (review) => movieTitle(review.movieId),
      render: (review) => <span className="font-semibold text-ink">{movieTitle(review.movieId)}</span>,
    },
    {
      key: 'user',
      header: 'Khách hàng',
      sortValue: (review) => review.userName,
      render: (review) => (
        <div className="flex items-center gap-2">
          <Avatar name={review.userName} seed={review.id} size="sm" />
          <span className="text-sm text-ink2">{review.userName}</span>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Điểm',
      align: 'center',
      sortValue: (review) => review.rating,
      render: (review) => <Rating value={review.rating} outOf={10} />,
    },
    {
      key: 'comment',
      header: 'Nội dung',
      render: (review) => <p className="max-w-[380px] text-sm leading-relaxed text-ink2">{review.comment}</p>,
    },
    {
      key: 'createdAt',
      header: 'Thời gian',
      align: 'right',
      sortValue: (review) => review.createdAt,
      render: (review) => <span className="text-xs text-muted">{formatDateTime(review.createdAt)}</span>,
    },
    {
      key: 'visibility',
      header: 'Hiển thị',
      align: 'center',
      render: (review) => (
        <div className="flex items-center justify-center">
          <Switch
            checked={review.visible}
            disabled={toggle.isPending && toggle.variables?.id === review.id}
            onChange={(checked) => toggle.mutate({ id: review.id, visible: checked })}
            label={review.visible ? 'Đang hiển thị' : 'Đang ẩn'}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kiểm duyệt đánh giá"
        description="Theo dõi phản hồi của khách hàng và ẩn các nội dung không phù hợp khỏi trang phim."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tổng đánh giá"
          value={reviewsQuery.isLoading ? <Skeleton className="h-6 w-14" /> : number(reviews.length)}
          hint="Toàn bộ phản hồi"
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Đang hiển thị"
          value={reviewsQuery.isLoading ? <Skeleton className="h-6 w-14" /> : number(stats.visible)}
          hint="Công khai trên trang phim"
          icon={<Eye className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Đang ẩn"
          value={reviewsQuery.isLoading ? <Skeleton className="h-6 w-14" /> : number(stats.hidden)}
          hint="Chờ xem xét hoặc bị ẩn"
          icon={<EyeOff className="h-4 w-4" />}
          tone="danger"
        />
        <StatCard
          label="Điểm trung bình"
          value={reviewsQuery.isLoading ? <Skeleton className="h-6 w-14" /> : `${stats.average.toFixed(1)}/10`}
          hint="Trên tất cả đánh giá"
          icon={<Star className="h-4 w-4" />}
          tone="gold"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_240px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo khách hàng hoặc nội dung…"
            className="pl-9"
            aria-label="Tìm đánh giá"
          />
        </div>
        <Select value={movieId} onChange={(e) => setMovieId(e.target.value)} aria-label="Lọc theo phim">
          <option value="all">Tất cả phim</option>
          {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
        </Select>
        <Select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as VisibilityFilter)}
          aria-label="Lọc theo trạng thái hiển thị"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="visible">Đang hiển thị</option>
          <option value="hidden">Đang ẩn</option>
        </Select>
      </div>

      {reviewsQuery.isError ? (
        <ErrorState message={errorMessage(reviewsQuery.error)} onRetry={() => { void reviewsQuery.refetch(); }} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(review) => review.id}
          loading={reviewsQuery.isLoading}
          empty={reviews.length ? 'Không có đánh giá phù hợp bộ lọc.' : 'Chưa có đánh giá nào.'}
          mobileCard={(review) => (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={review.userName} seed={review.id} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{review.userName}</p>
                    <p className="truncate text-xs text-muted">{movieTitle(review.movieId)}</p>
                  </div>
                </div>
                <Rating value={review.rating} outOf={10} />
              </div>
              <p className="text-sm leading-relaxed text-ink2">{review.comment}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">{formatDateTime(review.createdAt)}</span>
                <Switch
                  checked={review.visible}
                  disabled={toggle.isPending && toggle.variables?.id === review.id}
                  onChange={(checked) => toggle.mutate({ id: review.id, visible: checked })}
                  label={review.visible ? 'Đang hiển thị' : 'Đang ẩn'}
                />
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
