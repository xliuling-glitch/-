import { redirect } from 'next/navigation';

/** 「任务规则」已从侧栏下线，旧链接跳转首页 */
export default function TaskRulesRedirectPage() {
  redirect('/dashboard');
}
