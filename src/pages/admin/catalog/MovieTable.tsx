import { CalendarClock, Clock, Pencil, Trash2 } from 'lucide-react';
import type { Movie } from '@/types/domain';
import { formatDate } from '@/lib/format';
import { AgeBadge, Badge, DataTable, IconButton, Rating, StatusBadge, type Column } from '@/components/ui';
import { PosterArt } from '@/components/common';
import { MOVIE_STATUS_LABELS } from './shared';

export function MovieTable({ movies, loading, onEdit, onStatus, onDelete }: {
  movies: Movie[]; loading?: boolean;
  onEdit: (movie: Movie) => void;
  onStatus: (movie: Movie) => void;
  onDelete: (movie: Movie) => void;
}) {
  const columns: Column<Movie>[] = [
    {
      key: 'title',
      header: 'Phim',
      sortValue: (movie) => movie.title,
      render: (movie) => (
        <div className="flex min-w-[240px] items-center gap-3">
          <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md border border-line/70">
            <PosterArt movie={movie} variant="thumb" showTitle={false} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{movie.title}</p>
            <p className="truncate text-[11px] text-muted">/{movie.slug}</p>
            {movie.featured && <Badge tone="gold" className="mt-1">Nổi bật</Badge>}
          </div>
        </div>
      ),
    },
    {
      key: 'genres',
      header: 'Thể loại',
      hideOnMobile: true,
      render: (movie) => (
        <div className="flex max-w-[190px] flex-wrap gap-1">
          {movie.genres.slice(0, 2).map((genre) => <Badge key={genre} tone="outline">{genre}</Badge>)}
          {movie.genres.length > 2 && <Badge tone="neutral">+{movie.genres.length - 2}</Badge>}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Thời lượng',
      align: 'center',
      hideOnMobile: true,
      render: (movie) => (
        <span className="inline-flex items-center gap-1 text-xs text-ink2"><Clock className="h-3.5 w-3.5 text-muted" />{movie.duration}′</span>
      ),
    },
    { key: 'age', header: 'Độ tuổi', align: 'center', render: (movie) => <AgeBadge age={movie.age} /> },
    {
      key: 'releaseDate',
      header: 'Khởi chiếu',
      sortValue: (movie) => movie.releaseDate,
      hideOnMobile: true,
      render: (movie) => <span className="text-xs text-ink2">{formatDate(movie.releaseDate)}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (movie) => <StatusBadge status={movie.status} label={MOVIE_STATUS_LABELS[movie.status]} />,
    },
    {
      key: 'rating',
      header: 'Đánh giá',
      align: 'center',
      hideOnMobile: true,
      sortValue: (movie) => movie.rating,
      render: (movie) => <Rating value={movie.rating} size="xs" />,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (movie) => (
        <div className="flex items-center justify-end gap-1.5">
          <IconButton label={`Sửa ${movie.title}`} size="sm" onClick={() => onEdit(movie)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label={`Đổi trạng thái ${movie.title}`} size="sm" onClick={() => onStatus(movie)}>
            <CalendarClock className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label={`Xóa ${movie.title}`} size="sm" className="hover:border-danger/50 hover:text-danger" onClick={() => onDelete(movie)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={movies}
      rowKey={(movie) => movie.id}
      loading={loading}
      empty="Chưa có phim nào phù hợp bộ lọc."
      mobileCard={(movie) => (
        <div className="flex gap-3">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-line/70">
            <PosterArt movie={movie} variant="thumb" showTitle={false} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 font-semibold text-ink">{movie.title}</p>
              <AgeBadge age={movie.age} />
            </div>
            <p className="mt-0.5 text-[11px] text-muted">{movie.genres.slice(0, 3).join(' · ')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink2">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{movie.duration} phút</span>
              <span>·</span>
              <span>{formatDate(movie.releaseDate)}</span>
              <Rating value={movie.rating} size="xs" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <StatusBadge status={movie.status} label={MOVIE_STATUS_LABELS[movie.status]} />
              <div className="flex gap-1">
                <IconButton label={`Sửa ${movie.title}`} size="sm" onClick={() => onEdit(movie)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                <IconButton label={`Đổi trạng thái ${movie.title}`} size="sm" onClick={() => onStatus(movie)}><CalendarClock className="h-3.5 w-3.5" /></IconButton>
                <IconButton label={`Xóa ${movie.title}`} size="sm" className="hover:border-danger/50 hover:text-danger" onClick={() => onDelete(movie)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
              </div>
            </div>
          </div>
        </div>
      )}
      className="min-w-0"
    />
  );
}
