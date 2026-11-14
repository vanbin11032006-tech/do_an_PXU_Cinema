import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, Mail, MailCheck, Phone, User, UserPlus } from 'lucide-react';
import { Button, Checkbox, Field, Input, toast } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { useDocumentTitle } from '@/hooks';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { AuthShell } from './components/AuthShell';
import { FormAlert } from './components/FormAlert';
import { PasswordStrength } from './components/PasswordStrength';
import {
  authErrorHint,
  destinationFor,
  isStrongEnough,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  sanitizeReturnTo,
} from './components/authUtils';

interface RegisterForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
}

export default function RegisterPage() {
  useDocumentTitle('Đăng ký');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

  const register = useAuthStore((state) => state.register);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState<RegisterForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<{ message: string; hint: string | null } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: RegisterForm) =>
      register({
        name: payload.name.trim(),
        email: payload.email.trim(),
        phone: normalizePhone(payload.phone),
        password: payload.password,
        acceptTerms: payload.acceptTerms,
      }),
  });

  useEffect(() => {
    if (status === 'authenticated' && user) {
      navigate(destinationFor(user, returnTo), { replace: true });
    }
  }, [status, user, returnTo, navigate]);

  function update<K extends keyof RegisterForm>(key: K, value: RegisterForm[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [key]: undefined,
        ...(key === 'password' ? { confirmPassword: undefined } : {}),
      }));
    }
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = 'Vui lòng nhập họ và tên.';
    else if (form.name.trim().length < 2) next.name = 'Họ tên tối thiểu 2 ký tự.';

    if (!form.email.trim()) next.email = 'Vui lòng nhập email.';
    else if (!isValidEmail(form.email)) next.email = 'Email không hợp lệ.';

    if (!form.phone.trim()) next.phone = 'Vui lòng nhập số điện thoại.';
    else if (!isValidPhone(form.phone)) next.phone = 'Số điện thoại không hợp lệ (ví dụ 0901234567).';

    if (!form.password) next.password = 'Vui lòng nhập mật khẩu.';
    else if (!isStrongEnough(form.password)) next.password = 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số.';

    if (!form.confirmPassword) next.confirmPassword = 'Vui lòng nhập lại mật khẩu.';
    else if (form.confirmPassword !== form.password) next.confirmPassword = 'Mật khẩu nhập lại không khớp.';

    if (!form.acceptTerms) next.acceptTerms = 'Bạn cần đồng ý với điều khoản sử dụng.';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function attemptRegister(): Promise<void> {
    setFormError(null);
    try {
      await mutation.mutateAsync(form);
      toast.success(
        'Tạo tài khoản thành công',
        'Chúng tôi đã gửi email xác thực. Hãy kiểm tra hộp thư để hoàn tất.',
      );
    } catch (error) {
      const message = errorMessage(error);
      const serverErrors = fieldErrors(error);
      setErrors((prev) => ({
        ...prev,
        name: serverErrors.name ?? prev.name,
        email: serverErrors.email ?? prev.email,
        phone: serverErrors.phone ?? prev.phone,
        password: serverErrors.password ?? prev.password,
        acceptTerms: serverErrors.acceptTerms ?? prev.acceptTerms,
      }));
      setFormError({ message, hint: authErrorHint(error) });
      toast.error('Không tạo được tài khoản', message);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mutation.isPending || !validate()) return;
    void attemptRegister();
  }

  return (
    <AuthShell
      eyebrow="Thành viên mới"
      title="Đăng ký"
      subtitle="Tạo tài khoản để đặt vé nhanh, tích điểm và nhận ưu đãi thành viên."
      footer={
        <span>
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="font-semibold text-brand transition hover:text-brand-300">
            Đăng nhập
          </Link>
        </span>
      }
    >
      {formError && (
        <FormAlert
          message={formError.message}
          hint={formError.hint}
          onRetry={mutation.isPending ? undefined : () => void attemptRegister()}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Họ và tên" htmlFor="register-name" error={errors.name} required>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="register-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Nguyễn Minh Anh"
              autoComplete="name"
              className="pl-9"
              error={Boolean(errors.name)}
              aria-invalid={Boolean(errors.name)}
            />
          </div>
        </Field>

        <Field label="Email" htmlFor="register-email" error={errors.email} required>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="register-email"
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="ban@pxu.vn"
              autoComplete="email"
              inputMode="email"
              className="pl-9"
              error={Boolean(errors.email)}
              aria-invalid={Boolean(errors.email)}
            />
          </div>
        </Field>

        <Field label="Số điện thoại" htmlFor="register-phone" error={errors.phone} required>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="register-phone"
              type="tel"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              placeholder="0901234567"
              autoComplete="tel"
              inputMode="tel"
              className="pl-9"
              error={Boolean(errors.phone)}
              aria-invalid={Boolean(errors.phone)}
            />
          </div>
        </Field>

        <Field
          label="Mật khẩu"
          htmlFor="register-password"
          error={errors.password}
          hint="Tối thiểu 8 ký tự, bao gồm chữ cái và chữ số."
          required
        >
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="Tạo mật khẩu an toàn"
              autoComplete="new-password"
              className="pl-9 pr-11"
              error={Boolean(errors.password)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="register-password-strength"
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
          <PasswordStrength password={form.password} id="register-password-strength" />
        </Field>

        <Field label="Nhập lại mật khẩu" htmlFor="register-confirm" error={errors.confirmPassword} required>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="register-confirm"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => update('confirmPassword', event.target.value)}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              className="pl-9"
              error={Boolean(errors.confirmPassword)}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
          </div>
        </Field>

        <div>
          <Checkbox
            id="register-terms"
            checked={form.acceptTerms}
            onChange={(event) => update('acceptTerms', event.target.checked)}
            label={
              <span>
                Tôi đồng ý với{' '}
                <Link
                  to="/trang/dieu-khoan"
                  onClick={(event) => event.stopPropagation()}
                  className="font-semibold text-brand underline-offset-2 hover:underline"
                >
                  Điều khoản sử dụng
                </Link>{' '}
                và quy định đặt vé của PXU Cinema.
              </span>
            }
            aria-invalid={Boolean(errors.acceptTerms)}
            aria-describedby={errors.acceptTerms ? 'register-terms-error' : undefined}
          />
          {errors.acceptTerms && (
            <p id="register-terms-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {errors.acceptTerms}
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/5 px-3 py-2.5">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          <p className="text-[11px] leading-relaxed text-muted">
            Sau khi tạo tài khoản, PXU Cinema gửi liên kết xác thực tới email của bạn. Hãy xác thực email để nhận vé
            điện tử và ưu đãi thành viên.
          </p>
        </div>

        <Button
          type="submit"
          full
          size="lg"
          loading={mutation.isPending}
          icon={<UserPlus className="h-4 w-4" aria-hidden />}
        >
          {mutation.isPending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
        </Button>
      </form>
    </AuthShell>
  );
}
