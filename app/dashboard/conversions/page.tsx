import { redirect } from 'next/navigation';

/** 询单转化已并入「留资跟进表」，保留旧路径以免书签失效 */
export default function ConversionsRedirectPage() {
  redirect('/dashboard/lead-follow');
}
