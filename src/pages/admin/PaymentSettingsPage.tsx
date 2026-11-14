import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CreditCard, Lock, QrCode, RotateCcw, Save, ShieldCheck,
} from 'lucide-react';
import { getPaymentSettings, savePaymentSettings, testQr } from '@/api';
import type { PaymentSettings } from '@/api';
import { errorCode, errorMessage, fieldErrors } from '@/lib/errors';
import { maskPhone, money } from '@/lib/format';
import {
  Badge, Button, Card, CopyField, ErrorState, Field, FileUploader, InfoRow, Input, Modal, PageHeader,
  QRImage, Select, Skeleton, Switch, toast,
} from '@/components/ui';

const BANKS = [
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'MB', name: 'MB Bank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'ICB', name: 'VietinBank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'AGR', name: 'Agribank' },
] as const;

const PREVIEW_AMOUNT = 100_000;
const PREVIEW_CONTENT = 'PXU DEMO01';

export default function PaymentSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PaymentSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['admin', 'payment-settings'], queryFn: getPaymentSettings });

  useEffect(() => {
    if (query.data) setForm((prev) => prev ?? query.data ?? null);
  }, [query.data]);

  const patch = (changes: Partial<PaymentSettings>) => setForm((prev) => (prev ? { ...prev, ...changes } : prev));

  const saveMutation = useMutation({
    mutationFn: ({ input, secret }: { input: PaymentSettings; secret: string }) => savePaymentSettings(input, secret),
    onSuccess: (result) => {
      toast.success('Đã cập nhật cấu hình thanh toán', 'Thay đổi đã được ghi vào nhật ký hệ thống.');
      setForm(result);
      setPasswordOpen(false);
      setPassword('');
      setPasswordError(null);
      setSaveError(null);
      setTestResult(null);
      queryClient.setQueryData(['admin', 'payment-settings'], result);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payment-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (error) => {
      const message = errorMessage(error);
      if (errorCode(error) === 'FORBIDDEN') {
        setPasswordError(message);
      } else {
        setErrors((prev) => ({ ...prev, ...fieldErrors(error) }));
        setSaveError(message);
      }
      toast.error('Không lưu được cấu hình', message);
    },
  });

  const testMutation = useMutation({
    mutationFn: (value: PaymentSettings) => testQr({
      bankCode: value.bankCode,
      accountNumber: value.accountNumber,
      accountName: value.accountName,
      amount: PREVIEW_AMOUNT,
      content: PREVIEW_CONTENT,
    }),
    onSuccess: (result) => {
      setTestResult(result.qrValue);
      toast.success('Đã sinh QR thử', 'QR chỉ dùng để kiểm tra, không lưu vào hệ thống.');
    },
    onError: (error) => toast.error('Không sinh được QR thử', errorMessage(error)),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Cấu hình thanh toán QR" description="Đang tải cấu hình tài khoản nhận tiền." />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-48 w-full" /></div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (query.isError || !form) {
    return (
      <div className="space-y-5">
        <PageHeader title="Cấu hình thanh toán QR" />
        <ErrorState message={query.isError ? errorMessage(query.error) : 'Không tải được cấu hình thanh toán.'} onRetry={() => { void query.refetch(); }} />
      </div>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(query.data);
  const isDemoBank = form.bankCode === 'VCB' && form.accountNumber === '0123456789';
  const qrValue = `${form.bankCode}|${form.accountNumber}|${PREVIEW_AMOUNT}|${PREVIEW_CONTENT}`;
  const bankName = BANKS.find((bank) => bank.code === form.bankCode)?.name ?? form.bankName;

  const validate = (value: PaymentSettings): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!value.bankCode) next.bankCode = 'Chọn ngân hàng nhận tiền.';
    if (!/^\d{6,19}$/.test(value.accountNumber)) next.accountNumber = 'Số tài khoản gồm 6–19 chữ số.';
    if (value.accountName.trim().length < 3) next.accountName = 'Nhập tên chủ tài khoản.';
    if (!/^[A-Z0-9]{2,6}$/.test(value.transferPrefix)) next.transferPrefix = 'Tiền tố gồm 2–6 ký tự A-Z0-9.';
    if (value.useCustomQr && !value.customQrUrl) next.customQrUrl = 'Tải ảnh QR trước khi bật chế độ tùy chỉnh.';
    return next;
  };

  const requestSave = () => {
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error('Vui lòng kiểm tra lại thông tin', 'Một số trường chưa hợp lệ.');
      return;
    }
    setPassword('');
    setPasswordError(null);
    setSaveError(null);
    setPasswordOpen(true);
  };

  const reset = () => {
    setForm(query.data ?? null);
    setErrors({});
    setTestResult(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cấu hình thanh toán QR"
        description="Tài khoản nhận tiền, nội dung chuyển khoản và chế độ xác nhận thanh toán của toàn hệ thống."
        actions={(
          <Badge tone={form.paymentConfirmMode === 'manual' ? 'warning' : 'success'}>
            {form.paymentConfirmMode === 'manual' ? 'Duyệt thủ công' : 'Xác nhận tự động'}
          </Badge>
        )}
      />

      {isDemoBank && (
        <div className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger/10 p-4 text-danger">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Đang dùng thông tin ngân hàng mẫu</p>
            <p className="mt-1 text-xs leading-relaxed text-danger/90">
              Tài khoản <span className="font-mono">{form.accountNumber}</span> chỉ là dữ liệu ví dụ.
              Vui lòng thay bằng tài khoản thật trước khi vận hành để tránh khách chuyển nhầm.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-brand" />
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">Tài khoản nhận tiền</h2>
            </div>
            <p className="mt-1 text-sm text-muted">Thông tin dùng để tạo mã QR VietQR cho khách hàng.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Ngân hàng" htmlFor="bank-code" required error={errors.bankCode} hint="Mã chuẩn VietQR.">
                <Select
                  id="bank-code"
                  value={form.bankCode}
                  error={Boolean(errors.bankCode)}
                  onChange={(e) => {
                    const bank = BANKS.find((item) => item.code === e.target.value);
                    patch({ bankCode: e.target.value, bankName: bank?.name ?? e.target.value });
                  }}
                >
                  {BANKS.map((bank) => <option key={bank.code} value={bank.code}>{bank.name} ({bank.code})</option>)}
                </Select>
              </Field>
              <Field label="Số tài khoản" htmlFor="bank-account" required error={errors.accountNumber} hint="Chỉ nhận chữ số, 6–19 ký tự.">
                <Input
                  id="bank-account"
                  inputMode="numeric"
                  value={form.accountNumber}
                  error={Boolean(errors.accountNumber)}
                  onChange={(e) => patch({ accountNumber: e.target.value.replace(/\D/g, '').slice(0, 19) })}
                />
              </Field>
              <Field label="Tên chủ tài khoản" htmlFor="bank-name" required error={errors.accountName} hint="Tự động in hoa, bỏ dấu.">
                <Input
                  id="bank-name"
                  value={form.accountName}
                  error={Boolean(errors.accountName)}
                  onChange={(e) => patch({
                    accountName: e.target.value
                      .toUpperCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/Đ/g, 'D')
                      .replace(/[^A-Z0-9 ]/g, '')
                      .replace(/\s+/g, ' ')
                      .trimStart(),
                  })}
                />
              </Field>
              <Field label="Tiền tố nội dung" htmlFor="bank-prefix" required error={errors.transferPrefix} hint="Ví dụ PXU, tối đa 6 ký tự.">
                <Input
                  id="bank-prefix"
                  value={form.transferPrefix}
                  error={Boolean(errors.transferPrefix)}
                  maxLength={6}
                  onChange={(e) => patch({ transferPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-brand" />
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">Mã QR & xác nhận</h2>
            </div>
            <div className="mt-4 space-y-4">
              <Switch
                checked={form.useCustomQr}
                disabled={!form.customQrUrl}
                onChange={(checked) => patch({ useCustomQr: checked })}
                label="Dùng ảnh QR tùy chỉnh"
                description={form.customQrUrl ? 'Ảnh tải lên sẽ thay cho QR VietQR tự sinh.' : 'Tải ảnh QR trước khi bật tùy chọn này.'}
              />
              <Field label="Ảnh QR tùy chỉnh" error={errors.customQrUrl} hint="PNG, JPG hoặc WebP · tối đa 2MB · tối thiểu 300×300px.">
                <FileUploader
                  value={form.customQrUrl}
                  compress={false}
                  maxMb={2}
                  minDimension={300}
                  onChange={(result) => patch({ customQrUrl: result.dataUrl })}
                  onClear={() => patch({ customQrUrl: undefined, useCustomQr: false })}
                />
              </Field>
              <Field label="Chế độ xác nhận thanh toán" htmlFor="confirm-mode" hint="Tự động chỉ áp dụng khi cổng ngân hàng đã kết nối.">
                <Select
                  id="confirm-mode"
                  value={form.paymentConfirmMode}
                  onChange={(e) => patch({ paymentConfirmMode: e.target.value as PaymentSettings['paymentConfirmMode'] })}
                >
                  <option value="manual">Duyệt thủ công (đối soát biên lai)</option>
                  <option value="auto">Tự động xác nhận qua webhook</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">Bảo mật</h2>
            </div>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-line bg-base/40 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Lock className="h-3.5 w-3.5" />
                  Webhook secret
                </div>
                <p className="mt-2 font-mono text-sm text-ink">{form.webhookSecretHint}</p>
                <p className="mt-1 text-xs text-muted">
                  Secret chỉ hiển thị một lần khi tạo. Hệ thống lưu bản che, không thể xem lại toàn bộ.
                </p>
              </div>
              <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Mỗi lần lưu cấu hình thanh toán, bạn phải xác nhận bằng mật khẩu quản trị. Thay đổi được ghi nhật ký.
              </p>
            </div>
          </Card>

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface/95 p-3 shadow-lift backdrop-blur">
            <p className="text-sm text-muted">
              {dirty ? <span className="font-semibold text-warning">Có thay đổi chưa lưu</span> : 'Không có thay đổi'}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} disabled={!dirty || saveMutation.isPending} onClick={reset}>
                Hoàn tác
              </Button>
              <Button icon={<Save className="h-4 w-4" />} disabled={!dirty} loading={saveMutation.isPending} onClick={requestSave}>
                Lưu cấu hình
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">Xem trước QR</h2>
              <Badge tone="info">Dữ liệu mẫu</Badge>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex justify-center rounded-xl bg-white p-4">
                {form.useCustomQr && form.customQrUrl ? (
                  <img src={form.customQrUrl} alt="Ảnh QR tùy chỉnh" className="max-h-[240px] w-auto max-w-full rounded-lg object-contain" />
                ) : (
                  <QRImage value={qrValue} size={200} label="QR chuyển khoản mẫu" />
                )}
              </div>
              <div className="space-y-2 text-sm">
                <InfoRow label="Khách hàng mẫu" value="Nguyễn Minh Anh" />
                <InfoRow label="Số điện thoại" value={maskPhone('0901234567')} />
                <InfoRow label="Ngân hàng" value={`${bankName} (${form.bankCode})`} />
                <InfoRow label="Số tài khoản" value={<span className="font-mono">{form.accountNumber}</span>} />
                <InfoRow label="Chủ tài khoản" value={form.accountName} />
                <InfoRow label="Số tiền" value={<span className="text-money font-semibold text-gold">{money(PREVIEW_AMOUNT)}</span>} />
                <InfoRow label="Nội dung" value={<span className="font-mono">{PREVIEW_CONTENT}</span>} />
                <InfoRow label="Xác nhận" value={form.paymentConfirmMode === 'manual' ? 'Duyệt thủ công' : 'Tự động'} />
              </div>
              <Button
                variant="outline"
                full
                icon={<QrCode className="h-4 w-4" />}
                loading={testMutation.isPending}
                onClick={() => testMutation.mutate(form)}
              >
                Kiểm tra tạo QR
              </Button>
              {testResult && <CopyField label="Giá trị QR thử" value={testResult} />}
              <p className="text-[11px] leading-relaxed text-muted">
                QR mẫu dùng số tiền {money(PREVIEW_AMOUNT)} và nội dung {PREVIEW_CONTENT}. Khách thật sẽ nhận nội dung
                {' '}{form.transferPrefix} + mã đơn hàng.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={passwordOpen}
        onClose={() => { setPasswordOpen(false); setPassword(''); setPasswordError(null); setSaveError(null); }}
        size="sm"
        title="Xác nhận mật khẩu"
        description="Cấu hình thanh toán là thao tác nhạy cảm. Nhập mật khẩu quản trị để tiếp tục."
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setPasswordOpen(false); setPassword(''); setPasswordError(null); setSaveError(null); }}>Hủy</Button>
            <Button
              loading={saveMutation.isPending}
              onClick={() => {
                if (!password) { setPasswordError('Nhập mật khẩu để xác nhận.'); return; }
                setPasswordError(null);
                saveMutation.mutate({ input: form, secret: password });
              }}
            >
              Xác nhận & lưu
            </Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <Field label="Mật khẩu quản trị" htmlFor="confirm-password" required error={passwordError ?? undefined}>
            <Input
              id="confirm-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              error={Boolean(passwordError)}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || saveMutation.isPending) return;
                if (!password) { setPasswordError('Nhập mật khẩu để xác nhận.'); return; }
                saveMutation.mutate({ input: form, secret: password });
              }}
            />
          </Field>
          <p className="flex items-start gap-2 rounded-lg border border-line bg-base/40 px-3 py-2 text-xs leading-relaxed text-muted">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Mật khẩu chỉ dùng để xác thực thao tác và không được lưu lại.
          </p>
          {saveError && <p className="text-xs text-danger" role="alert">{saveError}</p>}
          {Object.keys(errors).length > 0 && (
            <p className="text-xs text-danger" role="alert">Vui lòng sửa các trường chưa hợp lệ trước khi lưu.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
