import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Mail, MailCheck } from 'lucide-react';
import { Badge, Button, Field, Input, toast } from '@/components/ui';
import { forgotPassword } from '@/api';
import { useDocumentTitle } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { AuthShell } from './components/AuthShell';
import { AuthStatusPanel } from './components/AuthStatusPanel';
import { FormAlert } from './components/FormAlert';
import { isValidEmail } from './components/authUtils';

interface ForgotResult {
  message: string;
  demoToken?: string;
}

export default function ForgotPasswordPage() {
  useDocumentTitle('Quên mật khẩu');

  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sent, setSent] = useState<ForgotResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({ mutationFn: (value: string) => forgotPassword(value) });

  async function send(): Promise<void> {
    if (mutation.isPending) return;
    setFormError(null);
    const value = email.trim();
    if (!value) {
      setEmailError('Vui lòng nhập email.');
      return;
    }
    if (!isValidEmail(value)) {
      setEmailError('Email không hợp lệ.');
      return;
    }
    setEmailError(undefined);
    try {
      const result = await mutation.mutateAsync(value);
      setSent(result);
      toast.success('Đã gửi hướng dẫn', 'Vui lòng kiểm tra hộp thư email của bạn.');
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Không gửi được yêu cầu', message);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mutation.isPending) return;
    void send();
  }

  function resetForm(): void {
    setSent(null);
    setFormError(null);
    setEmailError(undefined);
  }

  return (
    <AuthShell
      eyebrow="Khôi phục truy cập"
      title="Quên mật khẩu"
      subtitle="Nhập email đăng ký để nhận hướng dẫn đặt lại mật khẩu."
      footer={
        <span>
          Đã nhớ mật khẩu?{' '}
          <Link to="/dang-nhap" className="font-semibold text-brand transition hover:text-brand-300">
            Quay lại đăng nhập
          </Link>
        </span>
      }
    >
      {sent ? (
        <AuthStatusPanel
          tone="success"
          icon={<MailCheck className="h-7 w-7" aria-hidden />}
          title="Kiểm tra hộp thư"
          description={
            <>
              <p>{sent.message}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Không thấy email? Hãy kiểm tra thư mục thư rác hoặc thử lại sau vài phút. Liên kết đặt lại chỉ có hiệu
                lực trong 30 phút.
              </p>
            </>
          }
        >
          {sent.demoToken && (
            <div className="rounded-lg border border-dashed border-gold/40 bg-gold/5 px-3.5 py-3 text-left">
              <div className="flex items-center gap-2">
                <Badge tone="gold">Chỉ dành cho demo</Badge>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Không gửi email thật</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Môi trường demo tạo sẵn liên kết đặt lại. Bạn có thể mở ngay để tiếp tục kiểm thử luồng khôi phục.
              </p>
              <Button
                type="button"
                variant="gold"
                size="sm"
                full
                className="mt-2.5"
                icon={<KeyRound className="h-4 w-4" aria-hidden />}
                onClick={() => navigate(`/dat-lai-mat-khau/${encodeURIComponent(sent.demoToken ?? '')}`)}
              >
                Mở liên kết đặt lại (demo)
              </Button>
            </div>
          )}
          <Button type="button" variant="secondary" full onClick={resetForm}>
            Dùng email khác
          </Button>
          <Link
            to="/dang-nhap"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-brand"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Quay lại đăng nhập
          </Link>
        </AuthStatusPanel>
      ) : (
        <>
          {formError && <FormAlert message={formError} onRetry={mutation.isPending ? undefined : () => void send()} />}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Field
              label="Email đăng ký"
              htmlFor="forgot-email"
              error={emailError}
              hint="Chúng tôi sẽ gửi hướng dẫn nếu email tồn tại trong hệ thống."
              required
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (emailError) setEmailError(undefined);
                  }}
                  placeholder="ban@pxu.vn"
                  autoComplete="email"
                  inputMode="email"
                  className="pl-9"
                  error={Boolean(emailError)}
                  aria-invalid={Boolean(emailError)}
                />
              </div>
            </Field>

            <Button
              type="submit"
              full
              size="lg"
              loading={mutation.isPending}
              icon={<Mail className="h-4 w-4" aria-hidden />}
            >
              {mutation.isPending ? 'Đang gửi…' : 'Gửi hướng dẫn'}
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-muted">
              Vì lý do bảo mật, phản hồi luôn giống nhau dù email có tồn tại hay không.
            </p>
          </form>
        </>
      )}
    </AuthShell>
  );
}
