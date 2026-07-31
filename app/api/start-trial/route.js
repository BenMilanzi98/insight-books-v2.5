import { CRM_CAPTURE_SOURCE } from '@/lib/admin/crm';
import { handlePublicCapturePost } from '@/lib/admin/crm/publicFormApi.js';

export async function POST(request) {
  return handlePublicCapturePost(request, CRM_CAPTURE_SOURCE.START_TRIAL);
}
