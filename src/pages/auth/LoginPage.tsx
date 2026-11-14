import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { Badge, Button, Checkbox, Field, Input, toast } from '@/components/ui';
import { DEMO_ACCOUNTS } from '@/api';
import { useAuthStore } from '@/store/auth';
import { useDocumentTitle } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { AuthShell } from './components/AuthShell';
import { FormAlert } from './components/FormAlert';
import { authErrorHint, destinationFor, isValidEmail, sanitizeReturnTo } from './components/authUtils';

interface Credentials {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

const REMEMBER_KEY = 'pxu.login.remembered-email';

function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? '';
  } catch {
    return '';
  }
}

function persistRememberedEmail(email: string | null): void {
  try {
    if (email) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* Trình duyệt chặn localStorage – bỏ qua tính năng ghi nhớ. */
  }
}

export default function LoginPage() {
  useDocumentTitle('Đăng nhập');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  const [email, setEmail] = useState(() => readRememberedEmail());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => readRememberedEmail().length > 0);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<{ message: string; hint: string | null } | null>(null);

  const mutation = useMutation({
    mutationFn: ({ email: value, password: secret }: Credentials) => login(value, secret),
  });

  useEffect(() => {
    if (status === 'authenticated' && user) {
      navigate(destinationFor(user, returnTo), { replace: true });
    }
  }, [status, user, returnTo, navigate]);

  function validate(): boolean {
    const next: FormErrors = {};
    if (!email.trim()) next.email = 'Vui lòng nhập email.';
    else if (!isValidEmail(email)) next.email = 'Email không hợp lệ.';
    if (!password) next.password = 'Vui lòng nhập mật khẩu.';
    else if (password.length < 8) next.password = 'Mật khẩu tối thiểu 8 ký tự.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function attemptLogin(credentials: Credentials, rememberEmail?: boolean): Promise<void> {
    setFormError(null);
    try {
      const account = await mutation.mutateAsync(credentials);
      if (rememberEmail !== undefined) persistRememberedEmail(rememberEmail ? credentials.email : null);
      toast.success('Đăng nhập thành công', `Chào mừng ${account.name} trở lại PXU Cinema.`);
    } catch (error) {
      const message = errorMessage(error);
      setFormError({ message, hint: authErrorHint(error) });
      toast.error('Không đăng nhập được', message);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mutation.isPending || !validate()) return;
    void attemptLogin({ email: email.trim(), password }, remember);
  }

  async function handleDemoLogin(account: (typeof DEMO_ACCOUNTS)[number]): Promise<void> {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
    await attemptLogin({ email: account.email, password: account.password });
  }

  return (
    <AuthShell
      eyebrow="Chào mừng trở lại"
      title="Đăng nhập"
      subtitle="Tiếp tục hành trình điện ảnh của bạn tại PXU Cinema."
      footer={
        <span>
          Chưa có tài khoản?{' '}
          <Link to="/dang-ky" className="font-semibold text-brand transition hover:text-brand-300">
            Đăng ký ngay
          </Link>
        </span>
      }
    >
      {formError && (
        <FormAlert
          message={formError.message}
          hint={formError.hint}
          onRetry={mutation.isPending ? undefined : () => void attemptLogin({ email: email.trim(), password }, remember)}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Email" htmlFor="login-email" error={errors.email} required>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="ban@pxu.vn"
            autoComplete="email"
            inputMode="email"
            error={Boolean(errors.email)}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field label="Mật khẩu" htmlFor="login-password" error={errors.password} required>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="current-password"
              className="pr-11"
              error={Boolean(errors.password)}
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted transition hover:bg-elevated hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            id="login-remember"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            label="Ghi nhớ email đăng nhập"
          />
          <Link to="/quen-mat-khau" className="text-xs font-semibold text-brand transition hover:text-brand-300">
            Quên mật khẩu?
          </Link>
        </div>

        <Button
          type="submit"
          full
          size="lg"
          loading={mutation.isPending}
          icon={<LogIn className="h-4 w-4" aria-hidden />}
        >
          {mutation.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
          Thông tin đăng nhập được bảo mật. PXU Cinema không bao giờ yêu cầu bạn chia sẻ mật khẩu qua điện thoại.
        </p>
      </form>

      <div className="mt-7">
        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-line/70" />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">Tài khoản demo</span>
          <span className="h-px flex-1 bg-line/70" />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-line/80 bg-base/40 px-3 py-2.5">
          <Badge tone="gold" className="mt-0.5 shrink-0">
            Demo
          </Badge>
          <p className="text-[11px] leading-relaxed text-muted">
            Chỉ dùng cho môi trường demo. Nhấn một tài khoản để điền và đăng nhập ngay.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => void handleDemoLogin(account)}
              disabled={mutation.isPending}
              className="group flex min-w-0 flex-col items-start gap-0.5 rounded-lg border border-line/70 bg-base/40 px-3 py-2 text-left transition hover:border-brand/50 hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-xs font-semibold text-ink transition group-hover:text-brand">{account.label}</span>
              <span className="w-full truncate text-[10px] text-muted">{account.email}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted/80">
          Chỉ dùng cho môi trường demo – không sử dụng cho khách hàng thật.
        </p>
      </div>
    </AuthShell>
  );
}
