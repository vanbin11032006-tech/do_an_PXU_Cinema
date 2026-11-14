import { cn } from '@/lib/format';
import type { Movie } from '@/types/domain';
import { MovieCard } from '@/components/common/MovieCard';

export function MovieGrid({ movies, className }: { movies: Movie[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5', className)}>
      {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
    </div>
  );
}
