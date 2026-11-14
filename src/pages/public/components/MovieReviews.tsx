import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send } from 'lucide-react';
import { canReviewMovie, listMovieReviews, submitReview } from '@/api';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/errors';
import { relativeTime } from '@/lib/format';
import { Avatar, Button, Chip, EmptyState, Field, Rating, Skeleton, Textarea, toast } from '@/components/ui';
import { SectionError } from './States';
import { AuthPromptModal } from './AuthPromptModal';

export function MovieReviews({ movieId, movieTitle, movieSlug }: { movieId: number; movieTitle: string; movieSlug: string }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [authOpen, setAuthOpen] = useState(false);

  const reviewsQuery = useQuery({
    queryKey: ['public', 'movie-reviews', movieId],
    queryFn: () => listMovieReviews(movieId),
  });

  const canReviewQuery = useQuery({
    queryKey: ['public', 'can-review', movieId, user?.id],
    queryFn: () => canReviewMovie(movieId),
    enabled: authStatus === 'authenticated' && Boolean(user),
  });

  const submitMutation = useMutation({
    mutationFn: submitReview,
    onSuccess: () => {
      toast.success('Đã gửi đánh giá', 'Cảm ơn bạn đã chia sẻ cảm nhận về phim.');
      setRating(0);
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['public', 'movie-reviews', movieId] });
    },
    onError: (error) => toast.error('Không gửi được đánh giá', errorMessage(error)),
  });

  const reviews = reviewsQuery.data ?? [];
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const alreadyReviewed = Boolean(user && reviews.some((review) => review.userId === user.id));
  const canReview = canReviewQuery.data === true;

  const handleSubmit = () => {
    if (!canReview || rating === 0 || !comment.trim() || submitMutation.isPending) return;
    submitMutation.mutate({ movieId, rating, comment: comment.trim() });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-card border border-line/60 bg-surface/50 p-5">
          <p className="eyebrow">Đánh giá cộng đồng</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="font-display text-5xl font-bold leading-none text-gold">{reviews.length ? average.toFixed(1) : '—'}</span>
            <div className="pb-1">
              <Rating value={average} />
              <p className="mt-1 text-[11px] text-muted">{reviews.length} lượt đánh giá đã kiểm duyệt</p>
            </div>
          </div>
        </div>

        {authStatus !== 'authenticated' ? (
          <div className="rounded-card border border-brand/30 bg-brand/5 p-5">
            <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">Chia sẻ cảm nhận của bạn</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">Đăng nhập và xem phim tại PXU Cinema để gửi đánh giá cho {movieTitle}.</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => setAuthOpen(true)}>Đăng nhập để đánh giá</Button>
          </div>
        ) : canReviewQuery.isLoading ? (
          <Skeleton className="h-56 w-full rounded-card" />
        ) : alreadyReviewed ? (
          <div className="rounded-card border border-success/30 bg-success/5 p-5 text-sm text-ink2">
            Bạn đã gửi đánh giá cho phim này. Cảm ơn bạn đã chia sẻ cùng cộng đồng PXU Cinema.
          </div>
        ) : canReview ? (
          <div className="card-surface p-5">
            <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">Đánh giá của bạn</p>
            <div className="mt-3">
              <p className="label">Điểm đánh giá</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn điểm đánh giá từ 1 đến 10">
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <Chip
                    key={value}
                    active={rating === value}
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
                    className="min-w-8 justify-center px-2"
                  >
                    {value}
                  </Chip>
                ))}
              </div>
            </div>
            <Field label="Nhận xét" htmlFor="review-comment" className="mt-3" hint={`${comment.length}/600 ký tự`}>
              <Textarea
                id="review-comment"
                value={comment}
                maxLength={600}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Điều gì khiến bạn thích hoặc chưa hài lòng về phim?"
                className="min-h-[110px]"
              />
            </Field>
            <Button
              className="mt-3"
              full
              icon={<Send className="h-4 w-4" />}
              loading={submitMutation.isPending}
              disabled={rating === 0 || !comment.trim()}
              onClick={handleSubmit}
            >
              Gửi đánh giá
            </Button>
          </div>
        ) : (
          <div className="rounded-card border border-line/60 bg-surface/50 p-5 text-sm leading-relaxed text-muted">
            Chỉ khách đã xem phim tại PXU Cinema mới có thể đánh giá. Hãy đặt vé và check-in để mở khóa tính năng này.
          </div>
        )}
      </div>

      <div>
        {reviewsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-28 w-full rounded-card" />)}
          </div>
        ) : reviewsQuery.isError ? (
          <SectionError error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} title="Không tải được đánh giá" />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" />}
            title="Chưa có đánh giá nào"
            description="Hãy là người đầu tiên chia sẻ cảm nhận về bộ phim này."
          />
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-card border border-line/60 bg-surface/50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={review.userName} seed={review.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{review.userName}</p>
                      <span className="text-[11px] text-muted">{relativeTime(review.createdAt)}</span>
                    </div>
                    <div className="mt-1"><Rating value={review.rating} size="xs" /></div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink2">{review.comment}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <AuthPromptModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        returnTo={`/phim/${movieSlug}#danh-gia`}
        title="Đăng nhập để đánh giá"
        description="Đăng nhập tài khoản đã xem phim tại PXU Cinema để gửi đánh giá của bạn."
      />
    </div>
  );
}
