import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CreditCard, Lock, Percent, Save, Settings2, ShieldCheck, Ticket, Timer, Undo2,
} from 'lucide-react';
import { getSettings, saveSettings } from '@/api';
import type { AppSettings } from '@/types/domain';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { money } from '@/lib/format';
import {
  Badge, Button, Card, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, toast,
} from '@/components/ui';

interface NumberFieldMeta {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

const NUMBER_META = {
  holdMinutes: { label: 'Thời gian giữ ghế', hint: 'Hết hạn sẽ tự nhả ghế.', min: 1, max: 30, unit: 'phút' },
  holdExtendMinutes: { label: 'Gia hạn mỗi lần', min: 0, max: 15, unit: 'phút' },
  proofPendingMaxMinutes: { label: 'Hạn xử lý biên lai', min: 5, max: 240, unit: 'phút' },
  maxSeatsPerBooking: { label: 'Số ghế tối đa mỗi đơn', min: 1, max: 20, unit: 'ghế' },
  maxActiveHoldsPerUser: { label: 'Đơn giữ ghế tối đa mỗi khách', min: 1, max: 10, unit: 'đơn' },
  onlineCloseBeforeMinutes: { label: 'Đóng bán online trước giờ chiếu', min: 0, max: 120, unit: 'phút' },
  posCloseBeforeMinutes: { label: 'Đóng bán tại quầy trước giờ chiếu', min: 0, max: 120, unit: 'phút' },
  roomCleaningMinutes: { label: 'Thời gian dọn phòng', min: 0, max: 60, unit: 'phút' },
  adsMinutes: { label: 'Quảng cáo trước phim', min: 0, max: 30, unit: 'phút' },
  checkinOpenBeforeMinutes: { label: 'Mở soát vé trước giờ chiếu', min: 0, max: 240, unit: 'phút' },
  checkinLateAllowMinutes: { label: 'Cho phép khách trễ tối đa', min: 0, max: 120, unit: 'phút' },
  customerCancelBeforeHours: { label: 'Khách được hủy trước', min: 0, max: 72, unit: 'giờ' },
  customerRefundPercent: { label: 'Tỷ lệ hoàn khi khách hủy', min: 0, max: 100, unit: '%' },
  pointsPerVnd: { label: 'Giá trị quy đổi 1 điểm', hint: 'Ví dụ 10.000 nghĩa là 1 điểm cho mỗi 10.000đ.', min: 1000, max: 1000000, step: 1000, unit: 'đ' },
  vatPercent: { label: 'Thuế VAT', min: 0, max: 30, unit: '%' },
  priceRounding: { label: 'Làm tròn giá', hint: '0 = không làm tròn.', min: 0, max: 100000, step: 500, unit: 'đ' },
  receiptMaxMb: { label: 'Dung lượng biên lai tối đa', min: 1, max: 20, unit: 'MB' },
  loginMaxAttempts: { label: 'Số lần đăng nhập sai tối đa', min: 3, max: 20, unit: 'lần' },
  refundApprovalThreshold: { label: 'Ngưỡng hoàn tiền cần duyệt', hint: 'Hoàn tiền lớn hơn ngưỡng cần quản lý phê duyệt.', min: 0, max: 100000000, step: 100000, unit: 'đ' },
} satisfies Record<string, NumberFieldMeta>;

type NumericKey = keyof typeof NUMBER_META;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AppSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const query = useQuery({ queryKey: ['admin', 'settings'], queryFn: getSettings });

  useEffect(() => {
    if (query.data) setForm((prev) => prev ?? query.data ?? null);
  }, [query.data]);

  const patch = (changes: Partial<AppSettings>) => setForm((prev) => (prev ? { ...prev, ...changes } : prev));

  const savedSettings = query.data;
  const changedCount = useMemo(() => {
    if (!form || !savedSettings) return 0;
    let count = 0;
    for (const key of Object.keys(form) as (keyof AppSettings)[]) {
      if (JSON.stringify(form[key]) !== JSON.stringify(savedSettings[key])) count += 1;
    }
    return count;
  }, [form, savedSettings]);

  const saveMutation = useMutation({
    mutationFn: (value: AppSettings) => saveSettings(value),
    onSuccess: (result) => {
      setForm(result);
      setErrors({});
      toast.success('Đã lưu cài đặt', 'Thay đổi đã được ghi vào nhật ký hệ thống.');
      queryClient.setQueryData(['admin', 'settings'], result);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payment-settings'] });
    },
    onError: (error) => {
      setErrors((prev) => ({ ...prev, ...fieldErrors(error) }));
      toast.error('Không lưu được cài đặt', errorMessage(error));
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Cài đặt hệ thống" description="Đang tải cấu hình vận hành." />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-56 w-full" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (query.isError || !form) {
    return (
      <div className="space-y-5">
        <PageHeader title="Cài đặt hệ thống" />
        <ErrorState message={query.isError ? errorMessage(query.error) : 'Không tải được cài đặt.'} onRetry={() => { void query.refetch(); }} />
      </div>
    );
  }

  const validate = (value: AppSettings): Record<string, string> => {
    const next: Record<string, string> = {};
    if (value.cinemaName.trim().length < 2) next.cinemaName = 'Nhập tên rạp.';
    if (!/^[0-9+\s.-]{8,16}$/.test(value.hotline.trim())) next.hotline = 'Hotline không hợp lệ.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) next.email = 'Email không hợp lệ.';
    if (value.address.trim().length < 5) next.address = 'Nhập địa chỉ tối thiểu 5 ký tự.';
    for (const key of Object.keys(NUMBER_META) as NumericKey[]) {
      const meta = NUMBER_META[key];
      const current = value[key];
      if (!Number.isFinite(current) || current < meta.min || current > meta.max) {
        next[key] = `${meta.label} phải từ ${meta.min}–${meta.max}${meta.unit ? ` ${meta.unit}` : ''}.`;
      }
    }
    for (const [seatType, label] of [['standard', 'ghế thường'], ['vip', 'ghế VIP'], ['couple', 'ghế đôi']] as const) {
      const current = value.seatSurcharge[seatType];
      if (!Number.isFinite(current) || current < 0 || current > 1000000) {
        next[`seatSurcharge.${seatType}`] = `Phụ thu ${label} không hợp lệ.`;
      }
    }
    return next;
  };

  const submit = () => {
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error('Vui lòng kiểm tra lại cài đặt', 'Một số giá trị chưa hợp lệ.');
      return;
    }
    saveMutation.mutate(form);
  };

  const reset = () => {
    setForm(query.data ?? null);
    setErrors({});
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cài đặt hệ thống"
        description="Cấu hình vận hành rạp: thời gian giữ ghế, soát vé, hoàn tiền, điểm thưởng và bảo mật."
        actions={<Badge tone={changedCount ? 'warning' : 'neutral'}>{changedCount ? `${changedCount} thay đổi` : 'Đã đồng bộ'}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <SettingsSection
            title="Chung"
            description="Thông tin hiển thị công khai và liên hệ hỗ trợ."
            icon={<Settings2 className="h-4 w-4" />}
          >
            <Field label="Tên hệ thống" htmlFor="setting-cinema-name" required error={errors.cinemaName}>
              <Input id="setting-cinema-name" value={form.cinemaName} error={Boolean(errors.cinemaName)} onChange={(e) => patch({ cinemaName: e.target.value })} />
            </Field>
            <Field label="Hotline" htmlFor="setting-hotline" required error={errors.hotline}>
              <Input id="setting-hotline" value={form.hotline} error={Boolean(errors.hotline)} onChange={(e) => patch({ hotline: e.target.value })} />
            </Field>
            <Field label="Email hỗ trợ" htmlFor="setting-email" required error={errors.email}>
              <Input id="setting-email" type="email" value={form.email} error={Boolean(errors.email)} onChange={(e) => patch({ email: e.target.value })} />
            </Field>
            <Field label="Địa chỉ" htmlFor="setting-address" required error={errors.address}>
              <Input id="setting-address" value={form.address} error={Boolean(errors.address)} onChange={(e) => patch({ address: e.target.value })} />
            </Field>
          </SettingsSection>

          <SettingsSection
            title="Đặt vé"
            description="Thời gian giữ ghế và giới hạn mua vé trực tuyến."
            icon={<Ticket className="h-4 w-4" />}
          >
            <NumberSetting id="holdMinutes" meta={NUMBER_META.holdMinutes} value={form.holdMinutes} error={errors.holdMinutes} onChange={(value) => patch({ holdMinutes: value })} />
            <NumberSetting id="holdExtendMinutes" meta={NUMBER_META.holdExtendMinutes} value={form.holdExtendMinutes} error={errors.holdExtendMinutes} onChange={(value) => patch({ holdExtendMinutes: value })} />
            <NumberSetting id="proofPendingMaxMinutes" meta={NUMBER_META.proofPendingMaxMinutes} value={form.proofPendingMaxMinutes} error={errors.proofPendingMaxMinutes} onChange={(value) => patch({ proofPendingMaxMinutes: value })} />
            <NumberSetting id="maxSeatsPerBooking" meta={NUMBER_META.maxSeatsPerBooking} value={form.maxSeatsPerBooking} error={errors.maxSeatsPerBooking} onChange={(value) => patch({ maxSeatsPerBooking: value })} />
            <NumberSetting id="maxActiveHoldsPerUser" meta={NUMBER_META.maxActiveHoldsPerUser} value={form.maxActiveHoldsPerUser} error={errors.maxActiveHoldsPerUser} onChange={(value) => patch({ maxActiveHoldsPerUser: value })} />
            <NumberSetting id="onlineCloseBeforeMinutes" meta={NUMBER_META.onlineCloseBeforeMinutes} value={form.onlineCloseBeforeMinutes} error={errors.onlineCloseBeforeMinutes} onChange={(value) => patch({ onlineCloseBeforeMinutes: value })} />
            <NumberSetting id="posCloseBeforeMinutes" meta={NUMBER_META.posCloseBeforeMinutes} value={form.posCloseBeforeMinutes} error={errors.posCloseBeforeMinutes} onChange={(value) => patch({ posCloseBeforeMinutes: value })} />
          </SettingsSection>

          <SettingsSection
            title="Soát vé"
            description="Khung giờ cho phép check-in và thời gian dọn phòng giữa các suất."
            icon={<Timer className="h-4 w-4" />}
          >
            <NumberSetting id="checkinOpenBeforeMinutes" meta={NUMBER_META.checkinOpenBeforeMinutes} value={form.checkinOpenBeforeMinutes} error={errors.checkinOpenBeforeMinutes} onChange={(value) => patch({ checkinOpenBeforeMinutes: value })} />
            <NumberSetting id="checkinLateAllowMinutes" meta={NUMBER_META.checkinLateAllowMinutes} value={form.checkinLateAllowMinutes} error={errors.checkinLateAllowMinutes} onChange={(value) => patch({ checkinLateAllowMinutes: value })} />
            <NumberSetting id="roomCleaningMinutes" meta={NUMBER_META.roomCleaningMinutes} value={form.roomCleaningMinutes} error={errors.roomCleaningMinutes} onChange={(value) => patch({ roomCleaningMinutes: value })} />
            <NumberSetting id="adsMinutes" meta={NUMBER_META.adsMinutes} value={form.adsMinutes} error={errors.adsMinutes} onChange={(value) => patch({ adsMinutes: value })} />
          </SettingsSection>

          <SettingsSection
            title="Hủy & hoàn"
            description="Quyền tự hủy của khách và ngưỡng phê duyệt hoàn tiền."
            icon={<Undo2 className="h-4 w-4" />}
          >
            <div className="sm:col-span-2">
              <Switch
                checked={form.customerCancelAllowed}
                onChange={(checked) => patch({ customerCancelAllowed: checked })}
                label="Cho phép khách tự hủy vé"
                description="Khi tắt, mọi yêu cầu hủy phải do nhân viên xử lý."
              />
            </div>
            <NumberSetting id="customerCancelBeforeHours" meta={NUMBER_META.customerCancelBeforeHours} value={form.customerCancelBeforeHours} error={errors.customerCancelBeforeHours} onChange={(value) => patch({ customerCancelBeforeHours: value })} />
            <NumberSetting id="customerRefundPercent" meta={NUMBER_META.customerRefundPercent} value={form.customerRefundPercent} error={errors.customerRefundPercent} onChange={(value) => patch({ customerRefundPercent: value })} />
            <NumberSetting id="refundApprovalThreshold" meta={NUMBER_META.refundApprovalThreshold} value={form.refundApprovalThreshold} error={errors.refundApprovalThreshold} onChange={(value) => patch({ refundApprovalThreshold: value })} />
            <div className="rounded-lg border border-line bg-base/40 px-3 py-2 text-xs leading-relaxed text-muted">
              Hoàn tiền từ <span className="text-money font-semibold text-gold">{money(form.refundApprovalThreshold)}</span> trở lên cần quản lý phê duyệt.
            </div>
          </SettingsSection>

          <SettingsSection
            title="Điểm & thuế"
            description="Tích điểm, VAT và cách làm tròn giá vé."
            icon={<Percent className="h-4 w-4" />}
          >
            <NumberSetting id="pointsPerVnd" meta={NUMBER_META.pointsPerVnd} value={form.pointsPerVnd} error={errors.pointsPerVnd} onChange={(value) => patch({ pointsPerVnd: value })} />
            <NumberSetting id="vatPercent" meta={NUMBER_META.vatPercent} value={form.vatPercent} error={errors.vatPercent} onChange={(value) => patch({ vatPercent: value })} />
            <NumberSetting id="priceRounding" meta={NUMBER_META.priceRounding} value={form.priceRounding} error={errors.priceRounding} onChange={(value) => patch({ priceRounding: value })} />
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
              <Field label="Phụ thu ghế thường" htmlFor="surcharge-standard" error={errors['seatSurcharge.standard']}>
                <Input
                  id="surcharge-standard"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.seatSurcharge.standard}
                  error={Boolean(errors['seatSurcharge.standard'])}
                  onChange={(e) => patch({ seatSurcharge: { ...form.seatSurcharge, standard: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Phụ thu ghế VIP" htmlFor="surcharge-vip" error={errors['seatSurcharge.vip']}>
                <Input
                  id="surcharge-vip"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.seatSurcharge.vip}
                  error={Boolean(errors['seatSurcharge.vip'])}
                  onChange={(e) => patch({ seatSurcharge: { ...form.seatSurcharge, vip: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Phụ thu ghế đôi" htmlFor="surcharge-couple" error={errors['seatSurcharge.couple']}>
                <Input
                  id="surcharge-couple"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.seatSurcharge.couple}
                  error={Boolean(errors['seatSurcharge.couple'])}
                  onChange={(e) => patch({ seatSurcharge: { ...form.seatSurcharge, couple: Number(e.target.value) } })}
                />
              </Field>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Thanh toán"
            description="Chế độ xác nhận và giới hạn tệp biên lai."
            icon={<CreditCard className="h-4 w-4" />}
          >
            <Field label="Chế độ xác nhận thanh toán" htmlFor="setting-confirm-mode" hint="Tự động chỉ áp dụng khi đã kết nối webhook ngân hàng.">
              <Select
                id="setting-confirm-mode"
                value={form.paymentConfirmMode}
                onChange={(e) => patch({ paymentConfirmMode: e.target.value as AppSettings['paymentConfirmMode'] })}
              >
                <option value="manual">Duyệt thủ công</option>
                <option value="auto">Tự động qua webhook</option>
              </Select>
            </Field>
            <NumberSetting id="receiptMaxMb" meta={NUMBER_META.receiptMaxMb} value={form.receiptMaxMb} error={errors.receiptMaxMb} onChange={(value) => patch({ receiptMaxMb: value })} />
            <div className="sm:col-span-2 space-y-2 rounded-lg border border-line bg-base/40 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <Lock className="h-3.5 w-3.5" /> Webhook secret
              </p>
              <p className="font-mono text-sm text-ink">{form.webhookSecretHint}</p>
              <p className="text-xs text-muted">Secret được che và không thể xem đầy đủ. Đổi cấu hình tại trang thanh toán QR.</p>
              <Link
                to="/admin/thanh-toan-qr"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand/60 bg-brand/5 px-3 text-xs font-semibold text-brand transition hover:bg-brand/15"
              >
                Mở cấu hình thanh toán QR
              </Link>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Bảo mật"
            description="Giới hạn đăng nhập và khóa ký vé điện tử."
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <NumberSetting id="loginMaxAttempts" meta={NUMBER_META.loginMaxAttempts} value={form.loginMaxAttempts} error={errors.loginMaxAttempts} onChange={(value) => patch({ loginMaxAttempts: value })} />
            <div className="space-y-1 rounded-lg border border-line bg-base/40 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Khóa ký vé</p>
              <p className="font-mono text-sm text-ink">••••••••••••</p>
              <p className="text-[11px] text-muted">Không hiển thị giá trị đầy đủ vì lý do bảo mật.</p>
            </div>
            <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Thiết lập ảnh hưởng toàn bộ luồng bán vé. Mọi thay đổi đều được ghi nhật ký kèm người thực hiện.
            </div>
          </SettingsSection>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">Tóm tắt nhanh</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Giữ ghế</dt>
                <dd className="font-semibold text-ink">{form.holdMinutes} phút</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Ghế tối đa / đơn</dt>
                <dd className="font-semibold text-ink">{form.maxSeatsPerBooking}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">VAT</dt>
                <dd className="font-semibold text-ink">{form.vatPercent}%</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">1 điểm</dt>
                <dd className="text-money font-semibold text-gold">{money(form.pointsPerVnd)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Xác nhận thanh toán</dt>
                <dd className="font-semibold text-ink">{form.paymentConfirmMode === 'manual' ? 'Thủ công' : 'Tự động'}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4">
            <p className={`text-sm font-semibold ${changedCount ? 'text-warning' : 'text-ink'}`}>
              {changedCount ? `${changedCount} thay đổi chưa lưu` : 'Không có thay đổi'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {changedCount ? 'Kiểm tra kỹ trước khi áp dụng cho toàn hệ thống.' : 'Cài đặt đang khớp với cấu hình đã lưu.'}
            </p>
            <div className="mt-3 space-y-2">
              <Button full icon={<Save className="h-4 w-4" />} disabled={!changedCount} loading={saveMutation.isPending} onClick={submit}>
                Lưu cài đặt
              </Button>
              <Button full variant="ghost" icon={<Undo2 className="h-4 w-4" />} disabled={!changedCount || saveMutation.isPending} onClick={reset}>
                Hoàn tác thay đổi
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, description, icon, children }: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function NumberSetting({ id, meta, value, error, onChange }: {
  id: string;
  meta: NumberFieldMeta;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={meta.label} htmlFor={id} error={error} hint={meta.hint}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={meta.min}
          max={meta.max}
          step={meta.step ?? 1}
          value={Number.isFinite(value) ? value : ''}
          error={Boolean(error)}
          className={meta.unit ? 'pr-14' : undefined}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {meta.unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{meta.unit}</span>
        )}
      </div>
    </Field>
  );
}
