import { loadKpiDailyCenter, normalizeKpiSubmission, saveKpiDailyCenter } from './storage';
import { syncKpiSubmissionToTodayTasks } from './today-task-bridge';

export function approveKpiSubmission(id: string, auditorName: string): boolean {
  if (typeof window === 'undefined') return false;
  const s = loadKpiDailyCenter();
  const idx = s.submissions.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const sub = s.submissions[idx];
  const next = normalizeKpiSubmission({
    ...sub,
    auditStatus: 'approved',
    auditor: auditorName || '主管',
    updatedAt: new Date().toISOString(),
  });
  const submissions = [...s.submissions];
  submissions[idx] = next;
  saveKpiDailyCenter({ submissions });
  syncKpiSubmissionToTodayTasks({ employeeName: next.employeeName, date: next.date, auditStatus: 'approved' });
  return true;
}

export function rejectKpiSubmission(id: string, auditorName: string, reason: string): boolean {
  if (typeof window === 'undefined') return false;
  const s = loadKpiDailyCenter();
  const idx = s.submissions.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const sub = s.submissions[idx];
  const next = normalizeKpiSubmission({
    ...sub,
    auditStatus: 'rejected',
    rejectReason: reason.trim(),
    auditor: auditorName || '主管',
    updatedAt: new Date().toISOString(),
  });
  const submissions = [...s.submissions];
  submissions[idx] = next;
  saveKpiDailyCenter({ submissions });
  syncKpiSubmissionToTodayTasks({
    employeeName: next.employeeName,
    date: next.date,
    auditStatus: 'rejected',
    rejectReason: reason.trim(),
  });
  return true;
}
