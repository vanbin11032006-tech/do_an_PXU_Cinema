import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, BellOff, CheckCheck, CreditCard, ExternalLink, Info, Megaphone, Ticket,
} from 'lucide-react';
import type { Notification } from '@/types/domain';
import { listNotifications, markNotificationsRead } from '@/api';
import { errorMessage } from '@/lib/errors';
import { isInternalPath, relativeTime } from '@/lib/format';
import { useDocumentTitle } from '@/hooks';
import {
  Button, Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton, Tabs, toast,
} from '@/components/ui';
import { cn } from '@/lib/format';

type ReadTab = 'all' | 'unread' | 'read';
type TypeFilter = Notification['type'] | 'all';

const TYPE_META: Record<Notification['type'], { label: string; icon: ReactNode; className: string }> = {
  booking: { label: 'Đặt vé', icon: <Ticket className="h-4 w-4" />, className: 'text-brand bg-brand/10 border-brand/25' },
  payment: { label: 'Thanh toán', icon: <CreditCard className="h-4 w-4" />, className: 'text-gold bg-gold/10 border-gold/25' },
  system: { label: 'Hệ thống', icon: <Info className="h-4 w-4" />, className: 'text-info bg-info/10 border-info/25' },
  promo: { label: 'Khuyến mãi', icon: <Megaphone className="h-4 w-4" />, className: 'text-purple-300 bg-purple-400/10 border-purple-400/25' },
};

const FILTERS: TypeFilter[] = ['all', 'booking', 'payment', 'system', 'promo'];

export default function NotificationsPage() {
  useDocumentTitle('Thông báo');
  const queryClient = useQueryClient();
  const [readTab, setReadTab] = useState<ReadTab>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const query = useQuery({ queryKey: ['account', 'notifications'], queryFn: () => listNotifications(50) });

  const markMutation = useMutation({
    mutationFn: (ids?: number[]) => markNotificationsRead(ids),
    onSuccess: (_, ids) => {
      toast.success(ids ? 'Đã đánh dấu đã đọc' : 'Đã đánh dấu tất cả đã đọc');
      queryClient.invalidateQueries({ queryKey: ['account', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['account', 'notifications', 'unread'] });
    },
    onError: (error) => toast.error('Không cập nhật được thông báo', errorMessage(error)),
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((item) => !item.read).length;
  const readCount = notifications.length - unreadCount;

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      if (readTab === 'unread' && item.read) return false;
      if (readTab === 'read' && !item.read) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, readTab, typeFilter]);

  const tabItems = [
    { value: 'all' as const, label: 'Tất cả', count: notifications.length },
    { value: 'unread' as const, label: 'Chưa đọc', count: unreadCount },
    { value: 'read' as const, label: 'Đã đọc', count: readCount },
  ];

  return (
    <div>
      <PageHeader
        title="Thông báo"
        description="Cập nhật trạng thái đơn vé, thanh toán và ưu đãi dành riêng cho bạn."
        actions={
          <Button
            variant="secondary"
            disabled={unreadCount === 0 || markMutation.isPending}
            loading={markMutation.isPending && markMutation.variables === undefined}
            onClick={() => markMutation.mutate(undefined)}
            icon={<CheckCheck className="h-4 w-4" />}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <Tabs items={tabItems} value={readTab} onChange={setReadTab} />
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => (
            <Chip key={filter} active={typeFilter === filter} onClick={() => setTypeFilter(filter)}>
              {filter === 'all' ? 'Mọi loại' : TYPE_META[filter].label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {query.isLoading && (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 w-full rounded-card" />)}
          </div>
        )}

        {query.isError && (
          <ErrorState
            title="Không tải được thông báo"
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        )}

        {!query.isLoading && !query.isError && filtered.length === 0 && (
          <EmptyState
            icon={<BellOff className="h-6 w-6" />}
            title={readTab === 'unread' ? 'Không còn thông báo chưa đọc' : 'Không có thông báo phù hợp'}
            description="Bạn đã xem hết thông báo trong bộ lọc này. Thông báo mới về vé và khuyến mãi sẽ xuất hiện tại đây."
            action={
              (readTab !== 'all' || typeFilter !== 'all') && (
                <Button variant="secondary" onClick={() => { setReadTab('all'); setTypeFilter('all'); }}>
                  Xóa bộ lọc
                </Button>
              )
            }
          />
        )}

        {!query.isLoading && !query.isError && filtered.length > 0 && (
          <div className="space-y-2.5">
            {filtered.map((item) => {
              const meta = TYPE_META[item.type];
              const pending = markMutation.isPending && markMutation.variables?.[0] === item.id;
              return (
                <Card
                  key={item.id}
                  className={cn('p-4 transition', !item.read && 'border-brand/30 bg-brand/[0.04]')}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', meta.className)}>
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                          {!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-label="Chưa đọc" />}
                          {item.title}
                        </h3>
                        <span className="shrink-0 text-[11px] text-muted">{relativeTime(item.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink2">{item.body}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-line/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {meta.label}
                        </span>
                        {item.link && isInternalPath(item.link) && (
                          <Link
                            to={item.link}
                            onClick={() => {
                              if (!item.read) markMutation.mutate([item.id]);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                          >
                            Xem chi tiết <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {!item.read && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => markMutation.mutate([item.id])}
                            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-ink2 transition hover:bg-elevated hover:text-ink disabled:opacity-50"
                          >
                            <Bell className="h-3 w-3" /> Đánh dấu đã đọc
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
