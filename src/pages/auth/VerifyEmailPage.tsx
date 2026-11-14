import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, MailCheck, Send, ShieldAlert } from 'lucide-react';
import { Button, Skeleton, toast } from '@/components/ui';
import { markEmailVerified, resendVerification } from '@/api';
import { useAuthStore } from '@/store/auth';
import { useDocumentTitle } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { maskEmail } from '@/lib/format';
import { AuthShell } from './components/AuthShell';
import { AuthStatusPanel } from './components/AuthStatusPanel';

function ResendButton({ pending, onResend }: { pending: boolean; onResend: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      full
      loading={pending}
      onClick={onResend}
      icon={<Send className="h-4 w-4" aria-hidden />}
    >
      {pending ? 'Đang gửi…' : 'Gửi lại email xác thực'}
    </Button>
  );
}

export default function VerifyEmailPage() {
  useDocumentTitle('Xác thực email');

  const params = useParams<{ token: string }>();
  const token = (params.token ?? '').trim();
  const navigate = useNavigate();

  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const handledToken = useRef<string | null>(null);
  const isAuthenticated = status === 'authenticated';
  const isVerified = user?.emailVerified === true;

  const verifyQuery = useQuery({
    queryKey: ['auth', 'verify-email', token, user?.id],
    queryFn: () => markEmailVerified(),
    enabled: isAuthenticated && Boolean(token) && !isVerified,
    retry: 0,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!verifyQuery.data || isVerified || handledToken.current === token) return;
    handledToken.current = token;
    setUser(verifyQuery.data);
    toast.success('Email đã được xác thực', 'Tài khoản của bạn đã sẵn sàng để đặt vé và tích điểm.');
  }, [verifyQuery.data, isVerified, token, setUser]);

  const resend = useMutation({
    mutationFn: () => resendVerification(),
    onSuccess: (result) => toast.success('Đã gửi lại email xác thực', result.message),
    onError: (error) => toast.error('Không gửi được email xác thực', errorMessage(error)),
  });

  const returnToLogin = token
    ? `/dang-nhap?returnTo=${encodeURIComponent(`/xac-thuc-email/${token}`)}`
    : '/dang-nhap';

  let content: ReactNode;

  if (status === 'loading') {
    content = (
      <div className="space-y-4 py-3" aria-label="Đang kiểm tra xác thực email">
        <Skeleton className="mx-auto h-16 w-16 rounded-2xl" />
        <Skeleton className="mx-auto h-5 w-44" />
        <Skeleton className="mx-auto h-3 w-full max-w-xs" />
        <Skeleton className="mx-auto h-3 w-2/3 max-w-[220px]" />
      </div>
    );
  } else if (isAuthenticated && isVerified && user) {
    content = (
      <AuthStatusPanel
        tone="success"
        icon={<CheckCircle2 className="h-7 w-7" aria-hidden />}
        title="Email đã được xác thực"
        description={
          <>
            <p>
              Tài khoản <span className="font-medium text-ink2">{maskEmail(user.email)}</span> đã được xác thực thành
              công.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Bạn có thể nhận vé điện tử qua email và sử dụng đầy đủ quyền lợi thành viên PXU Cinema.
            </p>
          </>
        }
      >
        <Button full onClick={() => navigate('/')}>
          Về trang chủ
        </Button>
        <Button variant="secondary" full onClick={() => navigate('/tai-khoan')}>
          Quản lý tài khoản
        </Button>
      </AuthStatusPanel>
    );
  } else if (!token) {
    content = (
      <AuthStatusPanel
        tone="warning"
        icon={<ShieldAlert className="h-7 w-7" aria-hidden />}
        title="Thiếu mã xác thực"
        description="Liên kết xác thực không hợp lệ hoặc đã bị cắt ngắn. Hãy mở lại liên kết trong email xác thực của bạn."
      >
        {isAuthenticated ? (
          <ResendButton pending={resend.isPending} onResend={() => resend.mutate()} />
        ) : (
          <Button full onClick={() => navigate(returnToLogin)}>
            Đăng nhập để xác thực
          </Button>
        )}
        <Link
          to="/"
          className="inline-flex items-center justify-center text-xs font-semibold text-muted transition hover:text-brand"
        >
          Về trang chủ
        </Link>
      </AuthStatusPanel>
    );
  } else if (!isAuthenticated) {
    content = (
      <AuthStatusPanel
        tone="brand"
        icon={<MailCheck className="h-7 w-7" aria-hidden />}
        title="Đăng nhập để xác thực"
        description="Bạn cần đăng nhập đúng tài khoản đã nhận email xác thực. Sau khi đăng nhập, liên kết này sẽ được áp dụng tự động."
      >
        <Button full onClick={() => navigate(returnToLogin)}>
          Đăng nhập
        </Button>
        <Link
          to="/dang-ky"
          className="inline-flex items-center justify-center text-xs font-semibold text-muted transition hover:text-brand"
        >
          Tạo tài khoản mới
        </Link>
      </AuthStatusPanel>
    );
  } else if (verifyQuery.isError) {
    content = (
      <AuthStatusPanel
        tone="danger"
        icon={<ShieldAlert className="h-7 w-7" aria-hidden />}
        title="Không thể xác thực email"
        description={errorMessage(verifyQuery.error)}
      >
        <Button full loading={verifyQuery.isFetching} onClick={() => void verifyQuery.refetch()}>
          Thử lại
        </Button>
        <ResendButton pending={resend.isPending} onResend={() => resend.mutate()} />
        <Link
          to="/"
          className="inline-flex items-center justify-center text-xs font-semibold text-muted transition hover:text-brand"
        >
          Về trang chủ
        </Link>
      </AuthStatusPanel>
    );
  } else {
    content = (
      <div className="space-y-4 py-3" aria-label="Đang xác thực email">
        <Skeleton className="mx-auto h-16 w-16 rounded-2xl" />
        <Skeleton className="mx-auto h-5 w-48" />
        <Skeleton className="mx-auto h-3 w-full max-w-xs" />
        <Skeleton className="mx-auto h-10 w-full max-w-[240px] rounded-lg" />
      </div>
    );
  }

  return (
    <AuthShell
      eyebrow="Bảo mật tài khoản"
      title="Xác thực email"
      subtitle="Hoàn tất xác thực để nhận vé điện tử và ưu đãi thành viên."
      footer={
        <Link to="/" className="font-semibold text-brand transition hover:text-brand-300">
          Về trang chủ PXU Cinema
        </Link>
      }
    >
      {content}
    </AuthShell>
  );
}
