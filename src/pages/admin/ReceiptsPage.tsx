import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Clock3, ImageOff, Inbox, Keyboard, RefreshCw, SkipForward,
  ThumbsDown, ThumbsUp,
} from 'lucide-react';
import { approvePayment, listReceiptQueue, rejectionReasons, rejectPayment } from '@/api';
import type { ReceiptQueueItem } from '@/api';
import { errorMessage } from '@/lib/errors';
import { cn, formatDate, formatDateTime, formatTime, money } from '@/lib/format';
import {
  Badge, Button, Card, ConfirmDialog, CopyField, ErrorState, Field, InfoRow, Modal, PageHeader,
  Select, Skeleton, StatusBadge, Textarea, useCountdown, toast,
} from '@/components/ui';
import { ReceiptImage } from './commerce/ReceiptImage';
import {
  ChannelBadge, Notice, PaymentMethodBadge,
} from './commerce/shared';

const REJECT_REASON_LABEL: Record<string, string> = {
  unclear_proof: 'Ảnh biên lai không rõ ràng',
  wrong_amount: 'Số tiền chuyển không khớp',
  wrong_content: 'Nội dung chuyển khoản không đúng',
  not_received: 'Chưa nhận được tiền',
  other: 'Lý do khác',
};

export default function ReceiptsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [resolvedIds, setResolvedIds] = useState<number[]>([]);
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCode, setRejectCode] = useState<string>(rejectionReasons[0]);
  const [rejectNote, setRejectNote] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [actionTarget, setActionTarget] = useState<ReceiptQueueItem | null>(null);

  const queueQuery = useQuery({
    queryKey: ['admin', 'receipts'],
    queryFn: listReceiptQueue,
    refetchInterval: 15_000,
  });
  const queue = useMemo(() => queueQuery.data ?? [], [queueQuery.data]);
  const visibleQueue = useMemo(
    () => queue.filter((item) => !resolvedIds.includes(item.booking.id)),
    [queue, resolvedIds],
  );
  const selected = visibleQueue.find((item) => item.booking.id === selectedId) ?? null;
  const hasDeclaredAmount = selected?.payment.paidAmount !== undefined;
  const mismatch = selected && hasDeclaredAmount
    ? selected.payment.paidAmount !== selected.booking.finalAmount
    : false;

  const approveMutation = useMutation({
    mutationFn: (input: { target: ReceiptQueueItem; allowMismatch: boolean }) => approvePayment(
      input.target.booking.id,
      { allowMismatch: input.allowMismatch },
    ),
    onSuccess: (result, input) => {
      toast.success('Đã duyệt biên lai', result.message);
      setMismatchOpen(false);
      setActionTarget(null);
      resolveCurrent(input.target, 'Đã duyệt');
    },
    onError: (error) => toast.error('Không duyệt được biên lai', errorMessage(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { target: ReceiptQueueItem; reasonCode: string; note: string }) => rejectPayment(
      input.target.booking.id,
      input.reasonCode,
      input.note,
    ),
    onSuccess: (result, input) => {
      toast.success('Đã từ chối biên lai', result.message);
      setRejectOpen(false);
      setActionTarget(null);
      resolveCurrent(input.target, 'Đã từ chối');
    },
    onError: (error) => toast.error('Không từ chối được biên lai', errorMessage(error)),
  });

  useEffect(() => {
    setResolvedIds((previous) => {
      const next = previous.filter((id) => queue.some((item) => item.booking.id === id));
      return next.length === previous.length ? previous : next;
    });
  }, [queue]);

  useEffect(() => {
    if (!visibleQueue.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId === null || !visibleQueue.some((item) => item.booking.id === selectedId)) {
      setSelectedId(visibleQueue[0].booking.id);
    }
  }, [visibleQueue, selectedId]);

  function invalidateAfterAction() {
    void qc.invalidateQueries({ queryKey: ['admin', 'receipts'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'badges'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'order'] });
  }

  function nextItemAfter(currentId: number): ReceiptQueueItem | null {
    const index = visibleQueue.findIndex((item) => item.booking.id === currentId);
    if (index >= 0) {
      const after = visibleQueue.slice(index + 1).find((item) => item.booking.id !== currentId);
      if (after) return after;
    }
    return visibleQueue.find((item) => item.booking.id !== currentId) ?? null;
  }

  function resolveCurrent(current: ReceiptQueueItem, label: string) {
    setResolvedIds((previous) => (
      previous.includes(current.booking.id) ? previous : [...previous, current.booking.id]
    ));
    const next = nextItemAfter(current.booking.id);
    setSelectedId(next?.booking.id ?? null);
    setLastAction(`${label} đơn ${current.booking.code} lúc ${formatDateTime(new Date().toISOString())}`);
    invalidateAfterAction();
    void queueQuery.refetch();
  }

  function requestApprove() {
    if (!selected || approveMutation.isPending) return;
    if (mismatch) {
      setActionTarget(selected);
      setMismatchOpen(true);
    } else {
      approveMutation.mutate({ target: selected, allowMismatch: false });
    }
  }

  function openReject() {
    if (!selected) return;
    setActionTarget(selected);
    setRejectCode(rejectionReasons[0]);
    setRejectNote('');
    setRejectOpen(true);
  }

  function submitReject() {
    if (!actionTarget) return;
    rejectMutation.mutate({ target: actionTarget, reasonCode: rejectCode, note: rejectNote.trim() });
  }

  function skipCurrent() {
    if (!selected) return;
    const next = nextItemAfter(selected.booking.id);
    if (!next) {
      toast.info('Không còn biên lai khác', 'Đây là biên lai cuối cùng trong hàng chờ.');
      return;
    }
    setSelectedId(next.booking.id);
    setLastAction(`Đã bỏ qua đơn ${selected.booking.code}`);
    toast.info('Đã bỏ qua biên lai', `Đơn ${selected.booking.code} vẫn nằm trong hàng chờ.`);
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (rejectOpen || mismatchOpen || approveMutation.isPending || rejectMutation.isPending) return;
      if (!selected) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
        || target.isContentEditable
      )) return;
      if (event.key === 'Enter') {
        if (target && (target.tagName === 'BUTTON' || target.tagName === 'A')) return;
        event.preventDefault();
        requestApprove();
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        openReject();
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        skipCurrent();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Duyệt biên lai"
        description="Hàng chờ chuyển khoản theo thứ tự cũ nhất trước. Duyệt hoặc từ chối nhanh bằng bàn phím."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={visibleQueue.length ? 'warning' : 'success'} className="h-8 px-3 text-xs">
              {visibleQueue.length} biên lai chờ
            </Badge>
            <Button
              variant="secondary"
              icon={<RefreshCw className={queueQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={() => void queueQuery.refetch()}
              disabled={queueQuery.isFetching}
            >
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><Keyboard className="h-3.5 w-3.5" /> Phím tắt:</span>
        <span><kbd className="rounded border border-line bg-surface px-1.5 text-[9px]">Enter</kbd> duyệt</span>
        <span><kbd className="rounded border border-line bg-surface px-1.5 text-[9px]">R</kbd> từ chối</span>
        <span><kbd className="rounded border border-line bg-surface px-1.5 text-[9px]">S</kbd> bỏ qua</span>
        <span className="ml-auto">Tự động làm mới mỗi 15 giây</span>
      </div>
      <p className="sr-only" aria-live="polite">{lastAction}</p>

      {queueQuery.isError ? (
        <ErrorState
          title="Không tải được hàng chờ biên lai"
          message={errorMessage(queueQuery.error)}
          onRetry={() => void queueQuery.refetch()}
        />
      ) : queueQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-[520px] w-full" />
          <Skeleton className="h-[520px] w-full" />
        </div>
      ) : visibleQueue.length === 0 ? (
        <Card className="p-6">
          <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">Hàng chờ đã trống</h2>
            <p className="mt-2 text-sm text-muted">Không còn biên lai nào cần duyệt. Hệ thống tự kiểm tra lại sau 15 giây.</p>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" onClick={() => void queueQuery.refetch()}>Kiểm tra lại</Button>
              <Link
                to="/admin/don-hang"
                className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-ink2 transition hover:bg-elevated hover:text-ink"
              >
                Xem đơn hàng
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="overflow-hidden lg:sticky lg:top-20">
            <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
              <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">Hàng chờ</p>
              <Badge tone="warning">{visibleQueue.length}</Badge>
            </div>
            <ul className="max-h-[calc(100dvh-220px)] divide-y divide-line/60 overflow-y-auto">
              {visibleQueue.map((item, index) => {
                const itemMismatch = item.payment.paidAmount !== undefined
                  && item.payment.paidAmount !== item.booking.finalAmount;
                const active = item.booking.id === selectedId;
                return (
                  <li key={item.booking.id}>
                    <button
                      type="button"
                      onClick={(event) => {
                        setSelectedId(item.booking.id);
                        event.currentTarget.blur();
                      }}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'w-full border-l-2 px-3.5 py-3 text-left transition',
                        active ? 'border-brand bg-brand/10' : 'border-transparent hover:bg-elevated/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-mono text-xs font-semibold text-brand">
                            <span className="text-[10px] text-muted">#{index + 1}</span>
                            {item.booking.code}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-medium text-ink">{item.customerName}</p>
                          <p className="truncate text-[11px] text-muted">{item.movieTitle}</p>
                          <p className="text-[11px] text-muted">
                            {formatDate(item.showtime.showDate)} · {item.showtime.startTime} · {item.cinemaName}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-money text-xs font-semibold text-ink">{money(item.booking.finalAmount)}</p>
                          <p className="mt-0.5 text-[10px] text-muted">{item.waitMinutes} phút</p>
                          <p className="text-[10px] text-muted">SLA {formatTime(item.slaDeadlineAt)}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge tone={item.waitMinutes > 10 ? 'danger' : item.waitMinutes > 5 ? 'warning' : 'neutral'}>
                          Chờ {item.waitMinutes}p
                        </Badge>
                        {item.duplicateOf.length > 0 && <Badge tone="danger">Trùng ảnh</Badge>}
                        {itemMismatch && <Badge tone="warning">Lệch tiền</Badge>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected ? (
            <div className="space-y-4">
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">{selected.booking.code}</h2>
                      <StatusBadge status={selected.payment.status} />
                      <ChannelBadge channel={selected.booking.channel} />
                    </div>
                    <p className="mt-1 text-sm text-ink2">{selected.customerName} · {selected.customerPhone}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {selected.movieTitle} · {formatDate(selected.showtime.showDate)} {selected.showtime.startTime} · {selected.cinemaName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <SlaTimer deadline={selected.slaDeadlineAt} />
                    <span className="text-[11px] text-muted">Đã chờ {selected.waitMinutes} phút</span>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {selected.duplicateOf.length > 0 && (
                    <Notice tone="danger" title="Ảnh biên lai trùng với giao dịch khác">
                      Mã đơn trùng: <span className="font-mono text-ink">{selected.duplicateOf.join(', ')}</span>. Kiểm tra trước khi duyệt để tránh ghi nhận trùng tiền.
                    </Notice>
                  )}
                  {mismatch && (
                    <Notice tone="danger" title="Số tiền khách khai báo không khớp">
                      Cần thu <strong className="text-ink">{money(selected.booking.finalAmount)}</strong> nhưng khách khai báo{' '}
                      <strong className="text-ink">{money(selected.payment.paidAmount)}</strong>.
                    </Notice>
                  )}
                  {selected.waitMinutes > 10 && (
                    <Notice tone="warning" title="Biên lai đã chờ quá 10 phút">
                      Đơn đang giữ ghế sát SLA, ưu tiên xử lý để không mất chỗ của khách.
                    </Notice>
                  )}
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                  <div>
                    {selected.payment.proofUrl ? (
                      <ReceiptImage
                        src={selected.payment.proofUrl}
                        alt={`Biên lai chuyển khoản đơn ${selected.booking.code}`}
                        fileName={`bien-lai-${selected.booking.code}`}
                      />
                    ) : (
                      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-card border border-dashed border-line bg-base/40 p-6 text-center">
                        <ImageOff className="mb-2 h-8 w-8 text-muted" />
                        <p className="text-sm font-medium text-ink">Không có ảnh biên lai</p>
                        <p className="mt-1 text-xs text-muted">Liên hệ khách để bổ sung ảnh trước khi duyệt.</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className={cn(
                      'rounded-card border p-3',
                      mismatch
                        ? 'border-danger/40 bg-danger/5'
                        : hasDeclaredAmount
                          ? 'border-success/30 bg-success/5'
                          : 'border-warning/30 bg-warning/5',
                    )}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted">Số tiền cần thu</span>
                        <span className="text-money text-base font-bold text-ink">{money(selected.booking.finalAmount)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted">Khách khai báo</span>
                        <span className={cn('text-money text-sm font-bold', mismatch ? 'text-danger' : hasDeclaredAmount ? 'text-success' : 'text-warning')}>
                          {selected.payment.paidAmount === undefined ? 'Không nhập' : money(selected.payment.paidAmount)}
                        </span>
                      </div>
                      <p className={cn('mt-1.5 text-[11px]', mismatch ? 'text-danger' : hasDeclaredAmount ? 'text-success' : 'text-warning')}>
                        {mismatch
                          ? 'Số tiền không khớp — bắt buộc xác nhận khi duyệt.'
                          : hasDeclaredAmount
                            ? 'Số tiền khớp với giá trị đơn.'
                            : 'Khách không nhập số tiền — đối chiếu kỹ ảnh biên lai.'}
                      </p>
                    </div>

                    <CopyField label="Nội dung chuyển khoản" value={selected.payment.transferContent} emphasis />
                    <CopyField label="Mã đơn" value={selected.booking.code} />

                    <div className="divide-y divide-line/60 rounded-card border border-line/70 bg-base/35 px-3">
                      <InfoRow label="Thời gian gửi" value={formatDateTime(selected.payment.submittedAt)} />
                      <InfoRow label="Hạn SLA" value={<span className="text-money">{formatDateTime(selected.slaDeadlineAt)}</span>} />
                      <InfoRow label="Giữ ghế đến" value={formatDateTime(selected.booking.holdExpiresAt)} />
                      <InfoRow label="Phương thức" value={<PaymentMethodBadge method={selected.payment.method} />} />
                      <InfoRow label="Mã giao dịch" value={selected.payment.reference ? <span className="font-mono text-xs">{selected.payment.reference}</span> : '—'} />
                      <InfoRow label="Định dạng" value={selected.showtime.format} />
                      <InfoRow
                        label="Ghế"
                        value={selected.booking.seats.filter((seat) => seat.active).map((seat) => seat.code).join(', ') || '—'}
                      />
                      <InfoRow label="Tổng đơn" value={<span className="text-money font-semibold text-brand">{money(selected.booking.finalAmount)}</span>} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted">
                      <Clock3 className="h-3.5 w-3.5" /> Kiểm tra kỹ ảnh, số tiền và nội dung chuyển khoản.
                    </span>
                    {lastAction && <span className="hidden text-[11px] font-medium text-success sm:inline">{lastAction}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" icon={<SkipForward className="h-4 w-4" />} disabled={approveMutation.isPending || rejectMutation.isPending} onClick={skipCurrent}>
                      Bỏ qua (S)
                    </Button>
                    <Button variant="danger" icon={<ThumbsDown className="h-4 w-4" />} disabled={approveMutation.isPending || rejectMutation.isPending} onClick={openReject}>
                      Từ chối (R)
                    </Button>
                    <Button
                      variant="success"
                      icon={<ThumbsUp className="h-4 w-4" />}
                      loading={approveMutation.isPending}
                      disabled={rejectMutation.isPending}
                      onClick={requestApprove}
                    >
                      Duyệt (Enter)
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="flex min-h-[320px] items-center justify-center p-6">
              <div className="text-center">
                <Inbox className="mx-auto h-8 w-8 text-muted" />
                <p className="mt-2 text-sm font-medium text-ink">Chọn một biên lai trong hàng chờ</p>
                <p className="mt-1 text-xs text-muted">Danh sách được sắp xếp theo thời điểm gửi cũ nhất trước.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={mismatchOpen}
        onClose={() => { setMismatchOpen(false); setActionTarget(null); }}
        onConfirm={() => {
          if (actionTarget) approveMutation.mutate({ target: actionTarget, allowMismatch: true });
        }}
        title="Duyệt biên lai lệch tiền"
        danger
        confirmText="Vẫn duyệt"
        loading={approveMutation.isPending}
        description={
          actionTarget ? (
            <div className="space-y-2">
              <p>Khách khai báo <strong className="text-ink">{money(actionTarget.payment.paidAmount)}</strong> nhưng đơn cần thu <strong className="text-ink">{money(actionTarget.booking.finalAmount)}</strong>.</p>
              {actionTarget.duplicateOf.length > 0 && (
                <p className="rounded-md border border-danger/30 bg-danger/5 px-2 py-1 text-xs text-danger">
                  Ảnh biên lai trùng với đơn {actionTarget.duplicateOf.join(', ')}.
                </p>
              )}
              <p className="text-xs text-muted">Chỉ duyệt sau khi đối chiếu sao kê ngân hàng. Thao tác được ghi vào nhật ký.</p>
            </div>
          ) : undefined
        }
      />

      <Modal
        open={rejectOpen}
        onClose={() => { setRejectOpen(false); setActionTarget(null); }}
        title="Từ chối biên lai"
        description={actionTarget ? `Đơn ${actionTarget.booking.code} · ${actionTarget.customerName}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setRejectOpen(false); setActionTarget(null); }}>Hủy</Button>
            <Button variant="danger" loading={rejectMutation.isPending} disabled={!actionTarget} onClick={submitReject}>
              Từ chối biên lai
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Lý do từ chối" htmlFor="receipt-reject-reason" required>
            <Select id="receipt-reject-reason" value={rejectCode} onChange={(event) => setRejectCode(event.target.value)}>
              {rejectionReasons.map((reason) => (
                <option key={reason} value={reason}>{REJECT_REASON_LABEL[reason] ?? reason}</option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú gửi khách" htmlFor="receipt-reject-note" hint="Nêu rõ vấn đề để khách gửi lại biên lai đúng.">
            <Textarea
              id="receipt-reject-note"
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder="Ví dụ: Ảnh mờ không đọc được số tiền, vui lòng gửi ảnh rõ hơn…"
            />
          </Field>
          <Notice tone="warning">
            Hệ thống sẽ mở lại thời gian giữ ghế cho khách và gửi thông báo để gửi lại biên lai.
          </Notice>
        </div>
      </Modal>
    </div>
  );
}

function SlaTimer({ deadline }: { deadline: string }) {
  const { text, expired, critical } = useCountdown(deadline);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums',
        expired
          ? 'border-danger/40 bg-danger/10 text-danger'
          : critical
            ? 'animate-pulse-soft border-warning/50 bg-warning/10 text-warning'
            : 'border-line bg-elevated/70 text-ink2',
      )}
      role="timer"
      aria-label={expired ? 'Đã quá hạn SLA' : `SLA còn ${text}`}
    >
      <Clock3 className="h-3.5 w-3.5" />
      {expired ? 'Quá SLA' : `SLA ${text}`}
    </span>
  );
}
