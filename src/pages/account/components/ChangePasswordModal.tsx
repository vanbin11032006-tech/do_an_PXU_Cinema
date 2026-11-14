import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { changePassword } from '@/api';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { Button, Field, Input, Modal, toast } from '@/components/ui';

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => changePassword(oldPassword, newPassword),
    onSuccess: (result) => {
      toast.success('Đã đổi mật khẩu', result.message);
      onClose();
    },
    onError: (error) => {
      setErrors(fieldErrors(error));
      toast.error('Không đổi được mật khẩu', errorMessage(error));
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!oldPassword) next.oldPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      next.newPassword = 'Tối thiểu 8 ký tự, bao gồm chữ và số.';
    }
    if (confirmPassword !== newPassword) next.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Đổi mật khẩu"
      description="Sau khi đổi, các phiên đăng nhập khác sẽ được thu hồi."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
          <Button onClick={submit} loading={mutation.isPending} icon={<KeyRound className="h-4 w-4" />}>Cập nhật</Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Mật khẩu hiện tại" htmlFor="old-password" required error={errors.oldPassword}>
          <Input
            id="old-password"
            type="password"
            autoComplete="current-password"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            error={Boolean(errors.oldPassword)}
            placeholder="Nhập mật khẩu hiện tại"
          />
        </Field>
        <Field label="Mật khẩu mới" htmlFor="new-password" required error={errors.newPassword} hint="Tối thiểu 8 ký tự, gồm chữ và số.">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            error={Boolean(errors.newPassword)}
            placeholder="Nhập mật khẩu mới"
          />
        </Field>
        <Field label="Xác nhận mật khẩu mới" htmlFor="confirm-password" required error={errors.confirmPassword}>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={Boolean(errors.confirmPassword)}
            placeholder="Nhập lại mật khẩu mới"
          />
        </Field>
        <button type="submit" className="sr-only">Cập nhật mật khẩu</button>
      </form>
    </Modal>
  );
}
