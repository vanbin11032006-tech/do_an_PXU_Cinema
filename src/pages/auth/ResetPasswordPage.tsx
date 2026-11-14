import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Eye, EyeOff, KeyRound, Link2Off, Lock, ArrowLeft } from 'lucide-react';
import { Button, Field, Input, toast } from '@/components/ui';
import { resetPassword } from '@/api';
import { useDocumentTitle } from '@/hooks';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { AuthShell } from './components/AuthShell';
import { AuthStatusPanel } from './components/AuthStatusPanel';
import { FormAlert } from './components/FormAlert';
import { PasswordStrength } from './components/PasswordStrength';
import { isStrongEnough } from './components/authUtils';

interface FormErrors {
  password?: string;
  confirmPassword?: string;
}

export default function ResetPasswordPage() {
  useDocumentTitle('Đặt lại mật khẩu');

  const params = useParams<{ token: string }>();
  const navigate = useNavigate();
  const token = params.token ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [completed, setCompleted] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (newPassword: string) => resetPassword(token, newPassword),
  });

  function validate(): boolean {
    const next: FormErrors = {};
    if (!password) next.password = 'Vui lòng nhập mật khẩu mới.';
    else if (!isStrongEnough(password)) next.password = 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số.';
    if (!confirmPassword) next.confirmPassword = 'Vui lòng nhập lại mật khẩu mới.';
    else if (confirmPassword !== password) next.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function attemptReset(): Promise<void> {
    setFormError(null);
    try {
      const result = await mutation.mutateAsync(password);
      setCompleted(result.message);
      toast.success('Mật khẩu đã được cập nhật', 'Vui lòng đăng nhập lại bằng mật khẩu mới.');
    } catch (error) {
      const message = errorMessage(error);
      const serverErrors = fieldErrors(error);
      setErrors((prev) => ({
        ...prev,
        password: serverErrors.password ?? prev.password,
      }));
      if (/liên kết/i.test(message)) {
        setInvalidToken(true);
      } else {
        setFormError(message);
        toast.error('Không đặt lại được mật khẩu', message);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mutation.isPending || !validate()) return;
    void attemptReset();
  }

  const shellProps = {
    eyebrow: 'Bảo mật tài khoản',
    title: 'Đặt lại mật khẩu',
    subtitle: 'Tạo mật khẩu mới cho tài khoản PXU Cinema của bạn.',
    footer: (
      <Link to="/dang-nhap" className="font-semibold text-brand transition hover:text-brand-300">
        Quay lại đăng nhập
      </Link>
    ),
  } as const;

  if (!token) {
    return (
      <AuthShell {...shellProps}>
        <AuthStatusPanel
          tone="warning"
          icon={<Link2Off className="h-7 w-7" aria-hidden />}
          title="Thiếu liên kết đặt lại"
          description="Đường dẫn không có mã xác thực. Hãy mở liên kết trong email hoặc yêu cầu một liên kết mới."
        >
          <Button full onClick={() => navigate('/quen-mat-khau')} icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
            Yêu cầu liên kết mới
          </Button>
        </AuthStatusPanel>
      </AuthShell>
    );
  }

  if (completed) {
    return (
      <AuthShell {...shellProps}>
        <AuthStatusPanel
          tone="success"
          icon={<CheckCircle2 className="h-7 w-7" aria-hidden />}
          title="Đặt lại thành công"
          description={completed}
        >
          <Button full onClick={() => navigate('/dang-nhap')} icon={<KeyRound className="h-4 w-4" aria-hidden />}>
            Đăng nhập ngay
          </Button>
        </AuthStatusPanel>
      </AuthShell>
    );
  }

  if (invalidToken) {
    return (
      <AuthShell {...shellProps}>
        <AuthStatusPanel
          tone="danger"
          icon={<Link2Off className="h-7 w-7" aria-hidden />}
          title="Liên kết đã hết hạn"
          description="Liên kết đặt lại mật khẩu đã hết hạn hoặc không còn hợp lệ. Vì lý do bảo mật, mỗi liên kết chỉ dùng được một lần trong 30 phút."
        >
          <Button full onClick={() => navigate('/quen-mat-khau')} icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
            Yêu cầu liên kết mới
          </Button>
          <Link
            to="/dang-nhap"
            className="inline-flex items-center justify-center text-xs font-semibold text-muted transition hover:text-brand"
          >
            Quay lại đăng nhập
          </Link>
        </AuthStatusPanel>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shellProps}>
      {formError && (
        <FormAlert message={formError} onRetry={mutation.isPending ? undefined : () => void attemptReset()} />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Mật khẩu mới"
          htmlFor="reset-password"
          error={errors.password}
          hint="Tối thiểu 8 ký tự, bao gồm chữ cái và chữ số."
          required
        >
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Tạo mật khẩu mới"
              autoComplete="new-password"
              className="pl-9 pr-11"
              error={Boolean(errors.password)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="reset-password-strength"
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
          <PasswordStrength password={password} id="reset-password-strength" />
        </Field>

        <Field label="Nhập lại mật khẩu mới" htmlFor="reset-confirm" error={errors.confirmPassword} required>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              placeholder="Nhập lại mật khẩu mới"
              autoComplete="new-password"
              className="pl-9"
              error={Boolean(errors.confirmPassword)}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
          </div>
        </Field>

        <Button
          type="submit"
          full
          size="lg"
          loading={mutation.isPending}
          icon={<KeyRound className="h-4 w-4" aria-hidden />}
        >
          {mutation.isPending ? 'Đang cập nhật…' : 'Đặt lại mật khẩu'}
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-muted">
          Bạn sẽ cần dùng mật khẩu mới cho lần đăng nhập tiếp theo. Liên kết đặt lại chỉ có hiệu lực một lần.
        </p>
      </form>
    </AuthShell>
  );
}
