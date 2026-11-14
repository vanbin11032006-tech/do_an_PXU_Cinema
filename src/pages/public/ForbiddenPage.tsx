import { useDocumentTitle } from '@/hooks';
import { ForbiddenContent } from '@/components/common/ProtectedRoute';

export default function ForbiddenPage() {
  useDocumentTitle('Không có quyền truy cập');
  return <ForbiddenContent />;
}
