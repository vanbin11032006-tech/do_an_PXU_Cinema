import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Link2, RefreshCw, RotateCcw, ShieldCheck, Undo2,
} from 'lucide-react';
import { listPaymentExceptions, resolvePaymentException } from '@/api';
import type { PaymentException } from '@/types/domain';
import { errorMessage } from '@/lib/errors';
import { cn, formatDateTime, money } from '@/lib/format';
import {
  Badge, Button, Card, DataTable, ErrorState, Field, Input, Modal, PageHeader, Select,
  StatusBadge, Tabs, Textarea, toast,
} from '@/components/ui';
import type { Column } from '@/components/ui';

type ResolveAction = 'link' | 'restore' | 'refund' | 'ignore';
type StatusTab = 'open' | 'resolved' | 'all';

const ACTIONS: { value: ResolveAction; label: string; description: string; requiresBooking?: boolean; icon: typeof Link2 }[] = [
  {
    value: 'link',
    label: 'Liên kết với đơn hàng',
    description: 'Gắn khoản chuyển khoản này vào một đơn đã có, dùng khi khách chuyển đúng nhưng nội dung ghi sai.',
    requiresBooking: true,
    icon: Link2,
  },
  {
    value: 'restore',
    label: 'Khôi phục đơn',
    description: 'Ghi nhận khoản tiền thuộc một đơn bị hủy hoặc hết hạn; đội vận hành khôi phục đơn theo quy trình thủ công.',
    icon: Undo2,
  },
  {
    value: 'refund',
    label: 'Ghi nhận hoàn tiền',
    description: 'Khoản tiền không gắn được với đơn và đã được hoàn lại cho khách; đánh dấu để đóng đối soát.',
    icon: RotateCcw,
  },
  {
    value: 'ignore',
    label: 'Bỏ qua',
    description: 'Đánh dấu đã kiểm tra nhưng không cần xử lý thêm, ví dụ giao dịch trùng hoặc tiền vào không hợp lệ.',
    icon: ShieldCheck,
  },
];

const ACTION_LABEL: Record<ResolveAction, string> = {
  link: 'Liên kết đơn',
  restore: 'Khôi phục đơn',
  refund: 'Hoàn tiền',
  ignore: 'Bỏ qua',
};

export default function ExceptionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<StatusTab>('open');
  const [target, setTarget] = useState<PaymentException | null>(null);
  const [action, setAction] = useState<ResolveAction>('link');
  const [bookingCode, setBookingCode] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  const exceptionsQuery = useQuery({
    queryKey: ['admin', 'exceptions'],
    queryFn: listPaymentExceptions,
  });
  const rows = exceptionsQuery.data ?? [];
  const openRows = rows.filter((row) => row.status === 'open');
  const resolvedRows = rows.filter((row) => row.status === 'resolved');
  const filtered = tab === 'open' ? openRows : tab === 'resolved' ? resolvedRows : rows;
  const selectedAction = ACTIONS.find((item) => item.value === action) ?? ACTIONS[0];
  const SelectedActionIcon = selectedAction.icon;

  const resolveMutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error('Chưa chọn giao dịch.');
      return resolvePaymentException(target.id, {
        action,
        bookingCode: bookingCode.trim() || undefined,
        note: note.trim(),
      });
    },
    onSuccess: (result) => {
      toast.success('Đã xử lý giao dịch', result.message);
      setTarget(null);
      setBookingCode('');
      setNote('');
      setFormError('');
      void qc.invalidateQueries({ queryKey: ['admin', 'exceptions'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'badges'] });
    },
    onError: (error) => toast.error('Không xử lý được giao dịch', errorMessage(error)),
  });

  function openResolve(row: PaymentException) {
    setTarget(row);
    setAction(row.action ?? 'link');
    setBookingCode('');
    setNote(row.note ?? '');
    setFormError('');
  }

  function submitResolve() {
    if (!note.trim()) {
      setFormError('Vui lòng nhập ghi chú xử lý.');
      return;
    }
    if (action === 'link' && !bookingCode.trim()) {
      setFormError('Vui lòng nhập mã đơn cần liên kết.');
      return;
    }
    setFormError('');
    resolveMutation.mutate();
  }

  const columns: Column<PaymentException>[] = [
    {
      key: 'ref',
      header: 'Mã giao dịch',
      sortValue: (row) => row.bankRef,
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold text-brand">{row.bankRef}</p>
          <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(row.receivedAt)}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Số tiền',
      align: 'right',
      sortValue: (row) => row.amount,
      render: (row) => <span className="text-money font-semibold text-ink">{money(row.amount)}</span>,
    },
    {
      key: 'content',
      header: 'Nội dung chuyển khoản',
      render: (row) => <p className="line-clamp-2 max-w-[280px] font-mono text-[11px] text-ink2">{row.content}</p>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      hideOnMobile: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'action',
      header: 'Cách xử lý',
      hideOnMobile: true,
      render: (row) => (
        row.action
          ? <Badge tone="outline">{ACTION_LABEL[row.action]}</Badge>
          : <span className="text-xs text-muted">Chưa xử lý</span>
      ),
    },
    {
      key: 'note',
      header: 'Ghi chú',
      hideOnMobile: true,
      render: (row) => <p className="line-clamp-2 max-w-[200px] text-xs text-muted">{row.note ?? '—'}</p>,
    },
    {
      key: 'resolve',
      header: '',
      align: 'right',
      render: (row) => (
        row.status === 'open' ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              openResolve(row);
            }}
          >
            Xử lý
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => openResolve(row)}>Xem</Button>
        )
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Giao dịch bất thường"
        description="Các khoản chuyển khoản chưa liên kết được với đơn hàng. Đối soát và xử lý để tránh thất thoát doanh thu."
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className={exceptionsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            onClick={() => void exceptionsQuery.refetch()}
            disabled={exceptionsQuery.isFetching}
          >
            Làm mới
          </Button>
        }
      />

      <Tabs
        items={[
          { value: 'open', label: 'Đang mở', count: openRows.length },
          { value: 'resolved', label: 'Đã xử lý', count: resolvedRows.length },
          { value: 'all', label: 'Tất cả', count: rows.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {exceptionsQuery.isError ? (
        <ErrorState
          title="Không tải được giao dịch bất thường"
          message={errorMessage(exceptionsQuery.error)}
          onRetry={() => void exceptionsQuery.refetch()}
        />
      ) : (
        <>
          {tab === 'open' && openRows.length > 0 && (
            <Card className="flex flex-wrap items-start gap-3 border-warning/30 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-ink">{openRows.length} giao dịch cần đối soát</p>
                <p className="mt-0.5 text-xs text-muted">
                  Kiểm tra sao kê ngân hàng, liên kết đúng đơn hoặc ghi nhận hoàn tiền. Mọi thao tác cần ghi chú.
                </p>
              </div>
            </Card>
          )}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-ink">
                <AlertTriangle className="h-4 w-4 text-warning" /> Danh sách giao dịch
              </p>
              <p className="text-xs text-muted">{filtered.length} giao dịch</p>
            </div>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(row) => row.id}
              loading={exceptionsQuery.isLoading}
              empty={tab === 'open' ? 'Không có giao dịch bất thường đang mở' : 'Không có giao dịch ở trạng thái này'}
              mobileCard={(row) => (
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-semibold text-brand">{row.bankRef}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(row.receivedAt)}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-money text-base font-semibold text-ink">{money(row.amount)}</p>
                  <p className="line-clamp-2 font-mono text-[11px] text-ink2">{row.content}</p>
                  {row.action && <Badge tone="outline">{ACTION_LABEL[row.action]}</Badge>}
                  {row.note && <p className="line-clamp-2 text-[11px] text-muted">{row.note}</p>}
                  {row.status === 'open' && (
                    <Button variant="secondary" size="sm" onClick={() => openResolve(row)}>Xử lý giao dịch</Button>
                  )}
                </div>
              )}
            />
          </Card>
        </>
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Xử lý giao dịch bất thường"
        description={target ? `${target.bankRef} · ${money(target.amount)}` : undefined}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)}>Hủy</Button>
            <Button
              variant="primary"
              loading={resolveMutation.isPending}
              disabled={target?.status === 'resolved'}
              onClick={submitResolve}
            >
              {target?.status === 'resolved' ? 'Đã xử lý' : 'Xác nhận xử lý'}
            </Button>
          </div>
        }
      >
        {target && (
          <div className="space-y-4">
            <div className="rounded-card border border-line/70 bg-base/40 p-3">
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Mã giao dịch</p>
                  <p className="mt-0.5 font-mono font-semibold text-ink">{target.bankRef}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Số tiền</p>
                  <p className="text-money mt-0.5 font-semibold text-brand">{money(target.amount)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Nội dung</p>
                  <p className="mt-0.5 break-words font-mono text-ink2">{target.content}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Thời điểm nhận</p>
                  <p className="mt-0.5 text-ink2">{formatDateTime(target.receivedAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Trạng thái</p>
                  <p className="mt-0.5"><StatusBadge status={target.status} /></p>
                </div>
              </div>
            </div>

            <Field label="Cách xử lý" htmlFor="exception-action" required>
              <Select
                id="exception-action"
                value={action}
                onChange={(event) => {
                  setAction(event.target.value as ResolveAction);
                  setFormError('');
                }}
                disabled={target.status === 'resolved'}
              >
                {ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            </Field>
            <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-[11px] text-ink2">
              <SelectedActionIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
              <span>{selectedAction.description}</span>
            </div>

            <Field
              label="Mã đơn cần liên kết"
              htmlFor="exception-booking"
              required={selectedAction.requiresBooking}
              hint={selectedAction.requiresBooking ? 'Bắt buộc khi chọn liên kết đơn.' : 'Không bắt buộc với cách xử lý này.'}
            >
              <Input
                id="exception-booking"
                value={bookingCode}
                onChange={(event) => setBookingCode(event.target.value)}
                placeholder="Ví dụ: PXU-AB12CD"
                disabled={target.status === 'resolved'}
                error={Boolean(formError) && selectedAction.requiresBooking && !bookingCode.trim()}
              />
            </Field>

            <Field label="Ghi chú xử lý" htmlFor="exception-note" required error={formError || undefined}>
              <Textarea
                id="exception-note"
                value={note}
                onChange={(event) => { setNote(event.target.value); setFormError(''); }}
                placeholder="Mô tả đối soát, người xác nhận, hướng xử lý…"
                disabled={target.status === 'resolved'}
              />
            </Field>

            {target.status === 'resolved' ? (
              <div className="rounded-lg border border-line bg-base/40 p-3 text-xs text-muted">
                <p>Đã xử lý: <strong className="text-ink">{target.action ? ACTION_LABEL[target.action] : '—'}</strong></p>
                {target.note && <p className="mt-1">Ghi chú: {target.note}</p>}
              </div>
            ) : (
              <p className={cn('text-[11px]', formError ? 'text-danger' : 'text-muted')}>
                {formError || 'Ghi chú bắt buộc, lưu vào nhật ký hệ thống cùng giao dịch.'}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
