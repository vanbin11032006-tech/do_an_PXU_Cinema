import { useEffect, useRef, useState } from 'react';
import { Download, Maximize2, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/format';
import { Button, Modal, Tooltip, toast } from '@/components/ui';

export function ReceiptImage({ src, alt, fileName }: { src: string; alt: string; fileName: string }) {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setZoom(1);
    setRotate(0);
  }, [src]);

  function download() {
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchor.click();
    toast.success('Đang tải biên lai', downloadName);
  }

  function rotateRight() {
    setRotate((value) => (value + 90) % 360);
  }

  function rotateLeft() {
    setRotate((value) => (value + 270) % 360);
  }

  const imageStyle = { transform: `scale(${zoom}) rotate(${rotate}deg)` };
  const extension = src.startsWith('data:image/svg')
    ? 'svg'
    : src.startsWith('data:image/png')
      ? 'png'
      : src.startsWith('data:image/webp')
        ? 'webp'
        : 'jpg';
  const downloadName = fileName.includes('.') ? fileName : `${fileName}.${extension}`;

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line/70 bg-base/50">
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-line/60 bg-surface/60 px-2.5 py-2">
          <div className="flex items-center gap-1">
            <Tooltip content="Thu nhỏ">
              <Button variant="secondary" size="icon-sm" aria-label="Thu nhỏ ảnh" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.25))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <span className="w-10 text-center text-[10px] font-semibold tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
            <Tooltip content="Phóng to">
              <Button variant="secondary" size="icon-sm" aria-label="Phóng to ảnh" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.25))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip content="Xoay trái">
              <Button variant="secondary" size="icon-sm" aria-label="Xoay ảnh sang trái" onClick={rotateLeft}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content="Xoay phải">
              <Button variant="secondary" size="icon-sm" aria-label="Xoay ảnh sang phải" onClick={rotateRight}>
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content="Toàn màn hình">
              <Button variant="secondary" size="icon-sm" aria-label="Xem toàn màn hình" onClick={() => setFullscreen(true)}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content="Tải ảnh">
              <Button variant="secondary" size="icon-sm" aria-label="Tải ảnh biên lai" onClick={download}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="max-h-[520px] min-h-[260px] overflow-auto p-3">
          <img
            src={src}
            alt={alt}
            style={imageStyle}
            className={cn('mx-auto max-h-[480px] w-auto origin-center rounded-md transition-transform duration-200')}
          />
        </div>
      </div>
      <a ref={anchorRef} href={src} download={downloadName} className="hidden" aria-hidden tabIndex={-1}>Tải biên lai</a>

      <Modal open={fullscreen} onClose={() => setFullscreen(false)} title="Ảnh biên lai" size="full">
        <div className="flex max-h-[78vh] items-center justify-center overflow-auto rounded-lg bg-base/60 p-3">
          <img
            src={src}
            alt={alt}
            style={{ transform: `rotate(${rotate}deg)` }}
            className="max-h-[74vh] w-auto max-w-full rounded-md object-contain"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted">Dùng nút xoay trong khung xem để điều chỉnh hướng ảnh.</p>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={rotateLeft}>Xoay trái</Button>
            <Button variant="secondary" size="sm" icon={<RotateCw className="h-3.5 w-3.5" />} onClick={rotateRight}>Xoay phải</Button>
            <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={download}>Tải ảnh</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
