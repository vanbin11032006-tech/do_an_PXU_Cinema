import { Film, Play } from 'lucide-react';
import type { Movie } from '@/types/domain';
import { Modal } from '@/components/ui';
import { PosterArt } from './PosterArt';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function TrailerModal({ movie, open, onClose }: {
  movie: Movie | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!movie) return null;
  const trailerId = movie.trailerId?.trim() ?? '';
  const valid = YOUTUBE_ID.test(trailerId);

  return (
    <Modal open={open} onClose={onClose} title={`Trailer · ${movie.title}`} size="xl">
      {valid ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-line bg-black">
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${trailerId}?rel=0&modestbranding=1`}
                title={`Trailer phim ${movie.title}`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
          <a
            href={`https://www.youtube.com/watch?v=${trailerId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-brand"
          >
            <Play className="h-3 w-3" /> Video không phát? Mở trailer trên YouTube
          </a>
        </div>
      ) : (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-line/70">
          <PosterArt movie={movie} variant="banner" showTitle={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-base/20" aria-hidden />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur">
              <Film className="h-6 w-6" />
            </div>
            <p className="font-display text-xl font-semibold uppercase tracking-wide text-white">Trailer đang được cập nhật</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">
              Đội ngũ PXU Cinema chưa có trailer chính thức cho phim này. Bạn vẫn có thể xem thông tin và đặt vé tại cụm rạp gần nhất.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
              <Play className="h-3 w-3" /> {movie.duration} phút · {movie.genres.slice(0, 2).join(' · ')}
            </span>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} trailer`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <Play className="h-3.5 w-3.5" /> Tìm trailer trên YouTube
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
