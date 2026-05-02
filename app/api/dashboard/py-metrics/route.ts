import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const y = new Date(date); y.setDate(y.getDate()-1); const yesterday = y.toISOString().slice(0,10);
  const [leads, logs, daily, rosterSetting, dailyYesterday] = await Promise.all([
    prisma.lead.findMany({ where: { date } }),
    prisma.followupLog.findMany({ where: { date } }),
    prisma.dailyActivity.findMany({ where: { date }, orderBy: { lastSubmitAt: 'desc' } }),
    prisma.systemSetting.findUnique({ where: { key: 'staff_roster' } }),
    prisma.dailyActivity.findMany({ where: { date: yesterday } }),
  ]);
  const staffRoster: string[] = rosterSetting ? JSON.parse(rosterSetting.value) : [];

  const salesRankMap = new Map<string, number>(), shopMap = new Map<string, number>(), lostMap = new Map<string, number>();
  for (const l of logs) { const amt = Number(l.dealAmount || 0); salesRankMap.set(l.staff,(salesRankMap.get(l.staff)||0)+amt); shopMap.set(l.shop,(shopMap.get(l.shop)||0)+amt); if(!l.isDeal&&l.lostReason) lostMap.set(l.lostReason,(lostMap.get(l.lostReason)||0)+1); }
  const inquiryMap = new Map<string, number>(); for (const l of leads) inquiryMap.set(l.inquiryType,(inquiryMap.get(l.inquiryType)||0)+1);
  const submitted = [...new Set(daily.map((d) => d.staff))];
  const notSubmitted = staffRoster.filter((s) => !submitted.includes(s));
  const rateToday = staffRoster.length?((staffRoster.length-notSubmitted.length)/staffRoster.length)*100:0;
  const submittedY = [...new Set(dailyYesterday.map((d) => d.staff))];
  const notSubmittedY = staffRoster.filter((s) => !submittedY.includes(s));
  const rateYesterday = staffRoster.length?((staffRoster.length-notSubmittedY.length)/staffRoster.length)*100:0;

  return NextResponse.json({
    salesRank: [...salesRankMap.entries()].map(([staff, amount]) => ({ staff, amount })).sort((a, b) => b.amount - a.amount),
    shopShare: [...shopMap.entries()].map(([shop, amount]) => ({ shop, amount })),
    lostTop: [...lostMap.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    inquiryTop: [...inquiryMap.entries()].map(([product, count]) => ({ product, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    submitted, notSubmitted, daily, rateToday: Math.round(rateToday), rateYesterday: Math.round(rateYesterday),
  });
}
