import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Loader2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui';

export function CameraScanner({ onDetected, disabled }: { onDetected: (text: string) => void; disabled?: boolean }) {
  const elementId = `pxu-scanner-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const callbackRef = useRef(onDetected);
  callbackRef.current = onDetected;

  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (mountedRef.current) setActive(false);
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* camera chưa khởi động hoặc đã dừng */
    }
    try {
      scanner.clear();
    } catch {
      /* phần tử đã bị gỡ */
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stop();
    };
  }, [stop]);

  const start = async () => {
    if (scannerRef.current) return;
    setStarting(true);
    setError(null);
    try {
      // Nạp động: thư viện quét QR chỉ cần khi nhân viên chủ động bật camera.
      const { Html5Qrcode } = await import('html5-qrcode');
      const element = document.getElementById(elementId);
      if (!element) throw new Error('Không tìm thấy khung camera.');
      const scanner = new Html5Qrcode(elementId, false);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
        (decodedText) => {
          const value = decodedText.trim();
          if (!value) return;
          void stop();
          callbackRef.current(value);
        },
        () => {
          /* bỏ qua lỗi đọc từng khung hình */
        },
      );
      if (!mountedRef.current) {
        try {
          await scanner.stop();
        } catch {
          /* camera dừng cùng lúc component bị gỡ */
        }
        scanner.clear();
        return;
      }
      setActive(true);
    } catch (err) {
      scannerRef.current = null;
      document.getElementById(elementId)?.replaceChildren();
      if (mountedRef.current) {
        setError(
          err instanceof Error && err.message
            ? `Không mở được camera: ${err.message}. Bạn vẫn có thể nhập mã vé thủ công.`
            : 'Không mở được camera trên thiết bị này. Vui lòng nhập mã vé thủ công.',
        );
      }
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  };

  return (
    <div className="rounded-xl border border-line/70 bg-base/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <ScanLine className="h-3.5 w-3.5 text-brand" /> Quét bằng camera
        </p>
        {active ? (
          <Button size="sm" variant="secondary" onClick={() => void stop()} icon={<CameraOff className="h-3.5 w-3.5" />}>
            Tắt camera
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void start()}
            loading={starting}
            disabled={disabled}
            icon={starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          >
            Bật camera
          </Button>
        )}
      </div>

      <div
        id={elementId}
        className={active || starting ? 'mt-3 min-h-[220px] overflow-hidden rounded-lg border border-line bg-black [&_video]:w-full' : 'hidden'}
        aria-label="Khung quét mã QR bằng camera"
      />

      {!active && !error && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Camera là tùy chọn. Nếu thiết bị không có camera hoặc quyền bị từ chối, hãy nhập mã vé ở ô bên trên.
        </p>
      )}
      {active && <p className="mt-2 text-center text-[11px] text-muted" aria-live="polite">Đưa mã QR vào giữa khung hình để soát vé.</p>}
      {error && (
        <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11px] leading-relaxed text-warning" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
