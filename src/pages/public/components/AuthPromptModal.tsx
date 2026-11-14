import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

export function AuthPromptModal({ open, onClose, returnTo, title, description }: {
  open: boolean;
  onClose: () => void;
  returnTo: string;
  title?: string;
  description?: string;
}) {
  const navigate = useNavigate();
  const query = `?returnTo=${encodeURIComponent(returnTo)}`;

  const go = (path: string) => {
    onClose();
    navigate(`${path}${query}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? 'Đăng nhập để tiếp tục'}
      description={description ?? 'Bạn cần đăng nhập tài khoản PXU Cinema để hoàn tất đặt vé và nhận ưu đãi thành viên.'}
      size="sm"
      footer={(
        <div className="flex flex-col gap-2">
          <Button full icon={<LogIn className="h-4 w-4" />} onClick={() => go('/dang-nhap')}>Đăng nhập</Button>
          <Button full variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => go('/dang-ky')}>Tạo tài khoản mới</Button>
        </div>
      )}
    >
      <ul className="space-y-2 text-sm text-ink2">
        <li className="rounded-lg border border-line/60 bg-base/40 px-3 py-2">Giữ ghế và thanh toán an toàn trong một luồng duy nhất.</li>
        <li className="rounded-lg border border-line/60 bg-base/40 px-3 py-2">Nhận vé QR, xem lại đơn hàng và tích điểm thành viên.</li>
      </ul>
    </Modal>
  );
}
