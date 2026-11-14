import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/format';
import { sha256Hex } from '@/mock/crypto';
import { Button } from './primitives';

/* ------------------------------- QR ------------------------------- */

export function QRImage({ value, size = 200, label, fileName = 'pxu-qr', className, dim = false }: {
  value: string; size?: number; label?: string; fileName?: string; className?: string; dim?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  return (
    <div className={cn('inline-flex flex-col items-center gap-2', className)}>
      <div className={cn('rounded-xl bg-white p-3 shadow-lg', dim && 'opacity-40 grayscale')}>
        <QRCodeCanvas value={value} size={size} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#0b0f19" ref={canvasRef} />
      </div>
      {label && <span className="text-center text-[11px] font-medium tracking-wide text-muted">{label}</span>}
      <button type="button" onClick={download} className="inline-flex items-center gap-1 text-[11px] text-muted transition hover:text-brand">
        <Download className="h-3 w-3" /> Tải ảnh QR
      </button>
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} aria-hidden>
      <defs>
        <linearGradient id="lg-pxu" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7d2e" /><stop offset="1" stopColor="#c2410c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#lg-pxu)" />
      <path d="M14 46V18h13.5c6.9 0 11.2 3.9 11.2 9.9 0 6.1-4.4 10-11.3 10H21.4V46H14Zm7.4-14.4h5.2c3 0 4.7-1.4 4.7-3.7 0-2.4-1.7-3.7-4.7-3.7h-5.2v7.4Z" fill="#fff" />
      <path d="M42.5 18h7.1v17.2c0 2.9 1.6 4.5 4.1 4.5 1 0 1.9-.2 2.3-.5v6.2c-.8.4-2.3.7-3.9.7-6.3 0-9.6-3.5-9.6-9.6V18Z" fill="#0b0f19" />
    </svg>
  );
}

/* --------------------------- File uploader --------------------------- */

export interface UploadResult {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  hash: string;
  width: number;
  height: number;
}

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

function readAsDataUrl(file: File): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Không đọc được tệp.'));
  reader.readAsDataURL(file);
  return promise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>();
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Ảnh không hợp lệ.'));
  image.src = src;
  return promise;
}

async function compressImage(dataUrl: string, maxSide = 1600, quality = 0.85): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl, width: image.width, height: image.height };
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height };
}

export function FileUploader({ value, onChange, onClear, maxMb = 5, compress = true, minDimension = 0, className, hint }: {
  value?: string; onChange: (result: UploadResult) => void; onClear?: () => void; maxMb?: number;
  compress?: boolean; minDimension?: number; className?: string; hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!value) setName(null);
  }, [value]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ACCEPT.includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Ảnh tối đa ${maxMb}MB. Vui lòng chọn ảnh nhỏ hơn.`);
      return;
    }
    setBusy(true);
    try {
      const raw = await readAsDataUrl(file);
      const image = await loadImage(raw);
      if (minDimension && (image.width < minDimension || image.height < minDimension)) {
        setError(`Ảnh cần tối thiểu ${minDimension}×${minDimension}px.`);
        return;
      }
      const processed = compress ? await compressImage(raw) : { dataUrl: raw, width: image.width, height: image.height };
      const hash = await sha256Hex(processed.dataUrl);
      setName(file.name);
      onChange({
        dataUrl: processed.dataUrl,
        fileName: file.name,
        mimeType: compress ? 'image/jpeg' : file.type,
        size: file.size,
        hash,
        width: processed.width,
        height: processed.height,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xử lý được ảnh.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => { void handleFile(e.target.files?.[0]); };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className={className}>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-line bg-base">
          <img src={value} alt="Ảnh xem trước" className="max-h-72 w-full object-contain" />
          <div className="flex items-center justify-between gap-2 border-t border-line bg-surface/90 px-3 py-2">
            <span className="truncate text-xs text-muted">{name ?? 'Ảnh đã tải lên'}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>Thay ảnh</Button>
              {onClear && (
                <Button variant="ghost" size="sm" onClick={() => { onClear(); setError(null); }} icon={<Trash2 className="h-3.5 w-3.5" />}>Xóa</Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition',
            dragging ? 'border-brand bg-brand/5' : 'border-line bg-base/40 hover:border-brand/50 hover:bg-brand/5',
          )}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-elevated text-brand">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
          </div>
          <p className="text-sm font-medium text-ink">Kéo thả ảnh vào đây hoặc <span className="text-brand">chọn từ thiết bị</span></p>
          <p className="mt-1 text-[11px] text-muted">{hint ?? `JPG, PNG, WebP · tối đa ${maxMb}MB`}</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT.join(',')} onChange={onInput} className="sr-only" aria-label="Chọn ảnh tải lên" />
      {busy && !value && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" /> Đang xử lý ảnh…</p>}
      {error && <p className="mt-2 text-xs font-medium text-danger" role="alert">{error}</p>}
      {!value && !error && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted"><ImagePlus className="h-3 w-3" /> Ảnh được nén trước khi tải lên để tiết kiệm dung lượng.</p>}
    </div>
  );
}
