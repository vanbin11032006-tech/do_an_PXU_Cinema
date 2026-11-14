import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Film, Plus, Save, Sparkles, X } from 'lucide-react';
import type { Movie } from '@/types/domain';
import type { MovieInput } from '@/api';
import { getMovieById, listGenres, saveMovie } from '@/api';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatDate, slugify } from '@/lib/format';
import {
  AgeBadge, Button, Card, Chip, EmptyState, ErrorState, Field, Input, PageHeader, Rating, Select,
  Skeleton, StatusBadge, Switch, Textarea, toast,
} from '@/components/ui';
import { PosterArt } from '@/components/common';
import { AGE_OPTIONS, FormSection, MOVIE_STATUS_OPTIONS } from './catalog/shared';

interface ArtPreset { id: string; label: string; art: Movie['art'] }

const ART_PRESETS: ArtPreset[] = [
  { id: 'amber', label: 'Hổ phách', art: { from: '#f59e0b', via: '#b45309', to: '#451a03', accent: '#fde68a' } },
  { id: 'ocean', label: 'Đêm xanh', art: { from: '#38bdf8', via: '#1d4ed8', to: '#0b1120', accent: '#bae6fd' } },
  { id: 'ember', label: 'Đỏ rực', art: { from: '#ef4444', via: '#991b1b', to: '#1c0a0a', accent: '#fecaca' } },
  { id: 'violet', label: 'Tím mộng', art: { from: '#a855f7', via: '#6d28d9', to: '#1e1033', accent: '#e9d5ff' } },
  { id: 'jade', label: 'Xanh ngọc', art: { from: '#10b981', via: '#065f46', to: '#04140f', accent: '#a7f3d0' } },
  { id: 'sunset', label: 'Hồng hoàng hôn', art: { from: '#f472b6', via: '#be185d', to: '#2a0a18', accent: '#fbcfe8' } },
];

interface MovieFormState {
  title: string;
  slug: string;
  tagline: string;
  description: string;
  director: string;
  cast: string;
  genres: string[];
  duration: string;
  releaseDate: string;
  language: string;
  age: Movie['age'];
  rating: string;
  status: Movie['status'];
  featured: boolean;
  trailerId: string;
  posterUrl: string;
  backdropUrl: string;
  art: Movie['art'];
}

function toForm(movie: Movie): MovieFormState {
  return {
    title: movie.title,
    slug: movie.slug,
    tagline: movie.tagline,
    description: movie.description,
    director: movie.director,
    cast: movie.cast.join(', '),
    genres: movie.genres,
    duration: String(movie.duration),
    releaseDate: movie.releaseDate,
    language: movie.language,
    age: movie.age,
    rating: String(movie.rating),
    status: movie.status,
    featured: movie.featured,
    trailerId: movie.trailerId ?? '',
    posterUrl: movie.posterUrl ?? '',
    backdropUrl: movie.backdropUrl ?? '',
    art: movie.art,
  };
}

function validate(form: MovieFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = 'Vui lòng nhập tên phim.';
  if (!form.slug.trim()) errors.slug = 'Vui lòng nhập slug.';
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) errors.slug = 'Slug chỉ gồm chữ thường, số và dấu gạch nối.';
  if (!form.director.trim()) errors.director = 'Vui lòng nhập đạo diễn.';
  if (!form.description.trim()) errors.description = 'Vui lòng nhập mô tả.';
  if (!form.releaseDate) errors.releaseDate = 'Chọn ngày khởi chiếu.';
  if (!form.language.trim()) errors.language = 'Vui lòng nhập ngôn ngữ.';
  if (!form.genres.length) errors.genres = 'Chọn ít nhất một thể loại.';
  const duration = Number(form.duration);
  if (!Number.isFinite(duration) || duration < 30 || duration > 240) errors.duration = 'Thời lượng phải từ 30 đến 240 phút.';
  const rating = Number(form.rating);
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) errors.rating = 'Điểm đánh giá từ 0 đến 10.';
  return errors;
}

export default function MovieFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const movieId = isNew ? undefined : Number(id);
  const invalidId = !isNew && !Number.isFinite(movieId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<MovieFormState | null>(isNew ? {
    title: '', slug: '', tagline: '', description: '', director: '', cast: '', genres: [],
    duration: '120', releaseDate: '', language: 'Tiếng Anh – Phụ đề Việt', age: 'T13',
    rating: '0', status: 'coming_soon', featured: false, trailerId: '', posterUrl: '', backdropUrl: '', art: ART_PRESETS[0].art,
  } : null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [presetId, setPresetId] = useState<string | null>(isNew ? ART_PRESETS[0].id : null);
  const [customGenre, setCustomGenre] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const loadedIdRef = useRef<number | null>(null);

  const movieQuery = useQuery({
    queryKey: ['admin', 'movie', movieId],
    queryFn: () => getMovieById(movieId!),
    enabled: Boolean(movieId),
    retry: false,
  });
  const genresQuery = useQuery({ queryKey: ['genres'], queryFn: listGenres, staleTime: 300_000 });

  useEffect(() => {
    if (!movieQuery.data || loadedIdRef.current === movieQuery.data.id) return;
    loadedIdRef.current = movieQuery.data.id;
    setForm(toForm(movieQuery.data));
    setSlugTouched(true);
    setPresetId(ART_PRESETS.find((preset) => preset.art.from === movieQuery.data.art.from)?.id ?? null);
  }, [movieQuery.data]);

  const mutation = useMutation({
    mutationFn: (payload: MovieInput) => saveMovie(payload),
    onSuccess: (movie) => {
      toast.success(isNew ? 'Đã thêm phim' : 'Đã lưu thay đổi', movie.title);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'movies'] });
      void queryClient.invalidateQueries({ queryKey: ['movies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'movie', movie.id] });
      navigate('/admin/phim');
    },
    onError: (error: unknown) => {
      setServerFields(fieldErrors(error));
      toast.error('Không lưu được phim', errorMessage(error));
    },
  });

  const patch = (next: Partial<MovieFormState>) => {
    setForm((current) => (current ? { ...current, ...next } : current));
    setServerFields((current) => {
      if (!Object.keys(next).length) return current;
      const clone = { ...current };
      for (const key of Object.keys(next)) delete clone[key];
      return clone;
    });
  };

  const errors = form ? validate(form) : {};
  const fieldError = (key: string) => serverFields[key] ?? (attempted ? errors[key] : undefined);

  const addGenre = (genre: string) => {
    if (!form) return;
    const value = genre.trim();
    if (!value || form.genres.includes(value)) return;
    patch({ genres: [...form.genres, value] });
    if (serverFields.genres) setServerFields((current) => { const clone = { ...current }; delete clone.genres; return clone; });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setAttempted(true);
    const validationErrors = validate(form);
    const firstKey = Object.keys(validationErrors)[0];
    if (firstKey) {
      toast.error('Vui lòng kiểm tra lại thông tin', validationErrors[firstKey]);
      document.getElementById(`movie-${firstKey}`)?.focus();
      return;
    }
    const payload: MovieInput = {
      id: movieId,
      title: form.title.trim(),
      slug: form.slug.trim(),
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      director: form.director.trim(),
      cast: form.cast.split(',').map((part) => part.trim()).filter(Boolean),
      genres: form.genres,
      duration: Number(form.duration),
      releaseDate: form.releaseDate,
      language: form.language.trim(),
      age: form.age,
      rating: Number(form.rating),
      status: form.status,
      featured: form.featured,
      trailerId: form.trailerId.trim() || undefined,
      posterUrl: form.posterUrl.trim() || undefined,
      backdropUrl: form.backdropUrl.trim() || undefined,
      art: form.art,
    };
    mutation.mutate(payload);
  };

  if (invalidId) {
    return (
      <div>
        <PageHeader title="Chi tiết phim" />
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title="Mã phim không hợp lệ"
          description="Đường dẫn không chứa mã phim hợp lệ. Hãy quay lại danh sách phim."
          action={<Button variant="secondary" onClick={() => navigate('/admin/phim')}>Về danh sách phim</Button>}
        />
      </div>
    );
  }

  if ((!isNew && movieQuery.isLoading) || !form) {
    if (movieQuery.isError) {
      return (
        <div>
          <PageHeader title="Chi tiết phim" />
          <ErrorState message={errorMessage(movieQuery.error)} onRetry={() => void movieQuery.refetch()} />
        </div>
      );
    }
    return (
      <div>
        <PageHeader title={isNew ? 'Thêm phim' : 'Chi tiết phim'} />
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4"><Skeleton className="h-72 w-full" /><Skeleton className="h-72 w-full" /><Skeleton className="h-48 w-full" /></div>
          <Skeleton className="h-[520px] w-full" />
        </div>
      </div>
    );
  }

  const previewMovie = {
    id: movieId ?? 0,
    title: form.title || 'Tên phim mới',
    art: form.art,
    tagline: form.tagline,
    genres: form.genres.length ? form.genres : ['Thể loại'],
    duration: Number(form.duration) || 0,
    age: form.age,
    rating: Number(form.rating) || 0,
    status: form.status,
    posterUrl: form.posterUrl.trim() || undefined,
    backdropUrl: form.backdropUrl.trim() || undefined,
  };
  const genres = Array.from(new Set([...(genresQuery.data ?? []), ...form.genres])).sort((a, b) => a.localeCompare(b, 'vi'));

  return (
    <div>
      <PageHeader
        title={isNew ? 'Thêm phim mới' : 'Chi tiết phim'}
        description={isNew ? 'Tạo hồ sơ phim trước khi xếp lịch chiếu.' : `${form.title || 'Phim'} · /${form.slug || 'slug'}`}
        actions={
          <>
            <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/admin/phim')}>Quay lại</Button>
            <Button type="submit" form="movie-form" loading={mutation.isPending} icon={<Save className="h-4 w-4" />}>
              {isNew ? 'Tạo phim' : 'Lưu thay đổi'}
            </Button>
          </>
        }
      />

      <form id="movie-form" onSubmit={onSubmit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <FormSection title="Thông tin phim" description="Những thông tin xuất hiện trên trang phim và lịch chiếu.">
            <div className="space-y-4">
              <Field label="Tên phim" htmlFor="movie-title" required error={fieldError('title')}>
                <Input
                  id="movie-title"
                  value={form.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    patch({ title, ...(slugTouched ? {} : { slug: slugify(title) }) });
                  }}
                  error={Boolean(fieldError('title'))}
                  placeholder="Ví dụ: Dune: Hành Tinh Cát – Phần Hai"
                />
              </Field>

              <Field label="Slug" htmlFor="movie-slug" required error={fieldError('slug')} hint={`Đường dẫn công khai: /phim/${form.slug || 'slug-cua-phim'}`}>
                <Input
                  id="movie-slug"
                  value={form.slug}
                  onChange={(event) => { setSlugTouched(true); patch({ slug: event.target.value }); }}
                  error={Boolean(fieldError('slug'))}
                  placeholder="hai-phuong"
                />
              </Field>

              <Field label="Tagline" htmlFor="movie-tagline" hint="Một dòng giới thiệu ngắn, hiển thị trên poster.">
                <Input id="movie-tagline" value={form.tagline} onChange={(event) => patch({ tagline: event.target.value })} placeholder="Định mệnh đã gọi tên người được chọn." />
              </Field>

              <Field label="Mô tả" htmlFor="movie-description" required error={fieldError('description')}>
                <Textarea
                  id="movie-description"
                  value={form.description}
                  onChange={(event) => patch({ description: event.target.value })}
                  error={Boolean(fieldError('description'))}
                  rows={5}
                  placeholder="Tóm tắt nội dung phim…"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Đạo diễn" htmlFor="movie-director" required error={fieldError('director')}>
                  <Input id="movie-director" value={form.director} onChange={(event) => patch({ director: event.target.value })} error={Boolean(fieldError('director'))} />
                </Field>
                <Field label="Diễn viên" htmlFor="movie-cast" hint="Phân tách bằng dấu phẩy.">
                  <Input id="movie-cast" value={form.cast} onChange={(event) => patch({ cast: event.target.value })} placeholder="Timothée Chalamet, Zendaya…" />
                </Field>
              </div>

              <Field label="Thể loại" required error={fieldError('genres')}>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((genre) => {
                    const active = form.genres.includes(genre);
                    return (
                      <Chip
                        key={genre}
                        active={active}
                        onClick={() => (active ? patch({ genres: form.genres.filter((item) => item !== genre) }) : addGenre(genre))}
                        className="h-8 px-3 text-[11px]"
                      >
                        {active && <Check className="h-3 w-3" />}{genre}
                      </Chip>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={customGenre}
                    onChange={(event) => setCustomGenre(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      addGenre(customGenre);
                      setCustomGenre('');
                    }}
                    placeholder="Thêm thể loại khác…"
                    aria-label="Thể loại tùy chỉnh"
                    className="h-9"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => { addGenre(customGenre); setCustomGenre(''); }} icon={<Plus className="h-3.5 w-3.5" />}>
                    Thêm
                  </Button>
                </div>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Thông số trình chiếu" description="Dữ liệu dùng để xếp suất chiếu và kiểm tra độ tuổi.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Thời lượng (phút)" htmlFor="movie-duration" required error={fieldError('duration')}>
                <Input
                  id="movie-duration"
                  type="number"
                  min={30}
                  max={240}
                  value={form.duration}
                  onChange={(event) => patch({ duration: event.target.value })}
                  error={Boolean(fieldError('duration'))}
                />
              </Field>
              <Field label="Khởi chiếu" htmlFor="movie-releaseDate" required error={fieldError('releaseDate')}>
                <Input id="movie-releaseDate" type="date" value={form.releaseDate} onChange={(event) => patch({ releaseDate: event.target.value })} error={Boolean(fieldError('releaseDate'))} />
              </Field>
              <Field label="Độ tuổi" htmlFor="movie-age">
                <Select id="movie-age" value={form.age} onChange={(event) => patch({ age: event.target.value as Movie['age'] })}>
                  {AGE_OPTIONS.map((age) => <option key={age} value={age}>{age}</option>)}
                </Select>
              </Field>
              <Field label="Ngôn ngữ" htmlFor="movie-language" required error={fieldError('language')}>
                <Input id="movie-language" value={form.language} onChange={(event) => patch({ language: event.target.value })} error={Boolean(fieldError('language'))} />
              </Field>
              <Field label="Điểm đánh giá (0–10)" htmlFor="movie-rating" required error={fieldError('rating')}>
                <Input id="movie-rating" type="number" min={0} max={10} step={0.1} value={form.rating} onChange={(event) => patch({ rating: event.target.value })} error={Boolean(fieldError('rating'))} />
              </Field>
              <Field label="Trạng thái" htmlFor="movie-status">
                <Select id="movie-status" value={form.status} onChange={(event) => patch({ status: event.target.value as Movie['status'] })}>
                  {MOVIE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-4">
              <Switch checked={form.featured} onChange={(featured) => patch({ featured })} label="Phim nổi bật" description="Ưu tiên hiển thị trên banner và trang chủ." />
            </div>
          </FormSection>

          <FormSection title="Nhận diện & trailer" description="Dùng ảnh poster/backdrop có sẵn trong /public hoặc dán URL ngoài. Bỏ trống để dùng poster nghệ thuật theo bảng màu.">
            <Field label="Trailer ID" htmlFor="movie-trailer" hint="ID video YouTube, không bắt buộc.">
              <Input id="movie-trailer" value={form.trailerId} onChange={(event) => patch({ trailerId: event.target.value })} placeholder="dQw4w9WgXcQ" />
            </Field>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Poster URL" htmlFor="movie-poster" hint="Ảnh dọc 2:3, ví dụ /posters/ten-phim.jpg">
                <Input id="movie-poster" value={form.posterUrl} onChange={(event) => patch({ posterUrl: event.target.value })} placeholder="/posters/ten-phim.jpg" />
              </Field>
              <Field label="Backdrop URL" htmlFor="movie-backdrop" hint="Ảnh ngang 16:9 cho banner/hero.">
                <Input id="movie-backdrop" value={form.backdropUrl} onChange={(event) => patch({ backdropUrl: event.target.value })} placeholder="/backdrops/ten-phim.jpg" />
              </Field>
            </div>
            <div className="mt-4">
              <p className="label">Bảng màu poster</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ART_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={presetId === preset.id}
                    onClick={() => { setPresetId(preset.id); patch({ art: preset.art }); }}
                    className={`group overflow-hidden rounded-lg border p-1 text-left transition ${presetId === preset.id ? 'border-brand ring-1 ring-brand/40' : 'border-line hover:border-brand/40'}`}
                  >
                    <span className="block h-12 w-full rounded-md" style={{ background: `linear-gradient(135deg, ${preset.art.from}, ${preset.art.via}, ${preset.art.to})` }} />
                    <span className="mt-1 flex items-center justify-between px-1 pb-0.5 text-[11px] text-ink2">
                      {preset.label}
                      {presetId === preset.id && <Check className="h-3 w-3 text-brand" />}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted"><Sparkles className="h-3 w-3" /> Poster cập nhật trực tiếp ở khung xem trước.</p>
            </div>
          </FormSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card className="overflow-hidden">
            <div className="aspect-[2/3] w-full">
              <PosterArt movie={previewMovie} variant="poster" />
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <AgeBadge age={form.age} />
                <Rating value={Number(form.rating) || 0} size="sm" />
                <StatusBadge status={form.status} />
              </div>
              <div className="space-y-1.5 text-xs text-ink2">
                <p className="flex items-center justify-between gap-2"><span className="text-muted">Thời lượng</span><span>{Number(form.duration) || 0} phút</span></p>
                <p className="flex items-center justify-between gap-2"><span className="text-muted">Khởi chiếu</span><span>{formatDate(form.releaseDate)}</span></p>
                <p className="flex items-center justify-between gap-2"><span className="text-muted">Ngôn ngữ</span><span className="truncate text-right">{form.language || '—'}</span></p>
                <p className="flex items-center justify-between gap-2"><span className="text-muted">Đạo diễn</span><span className="truncate text-right">{form.director || '—'}</span></p>
              </div>
              <div className="flex flex-wrap gap-1 border-t border-line/60 pt-3">
                {form.genres.length ? form.genres.map((genre) => (
                  <span key={genre} className="inline-flex items-center gap-1 rounded-full border border-line bg-base/50 px-2 py-0.5 text-[10px] text-ink2">
                    {genre}
                    <button type="button" onClick={() => patch({ genres: form.genres.filter((item) => item !== genre) })} aria-label={`Bỏ thể loại ${genre}`} className="text-muted hover:text-danger">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )) : <span className="text-[11px] text-muted">Chưa chọn thể loại</span>}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Lưu ý nghiệp vụ</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>• Slug phải duy nhất trong toàn hệ thống.</li>
              <li>• Thời lượng ảnh hưởng trực tiếp tới việc kiểm tra trùng suất chiếu.</li>
              <li>• Phim đã phát sinh suất chiếu không thể xóa cứng, chỉ chuyển sang Đã kết thúc.</li>
              <li>• Nhãn T16/T18 sẽ bắt buộc khách xác nhận độ tuổi khi đặt vé.</li>
            </ul>
          </Card>
        </aside>
      </form>
    </div>
  );
}
