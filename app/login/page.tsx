'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const r = useRouter();
  const [f, setF] = useState({ username: 'admin', password: '123456' });
  const [e, setE] = useState('');

  const submit = async () => {
    const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(f) });
    if (res.ok) r.push('/dashboard');
    else setE('账号或密码错误');
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_min(420px,100%)]">
      {/* 左侧：与工作台明显区分 — 渐变氛围 + 说明（大屏）；小屏仅顶部条 */}
      <section
        className="relative flex min-h-[42vh] flex-col justify-between px-8 pb-10 pt-12 lg:min-h-screen lg:px-12 lg:pb-16 lg:pt-16"
        style={{
          background:
            'linear-gradient(165deg, rgb(189, 216, 255) 0%, rgb(255, 234, 214) 55%, rgb(247, 243, 235) 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 opacity-[0.35] lg:top-1/3">
          <div
            className="h-full w-full rounded-[20px]"
            style={{
              background: 'linear-gradient(90deg, #10b981 0%, #a855f7 50%, #f59e0b 100%)',
              filter: 'blur(48px)',
              transform: 'scale(1.05)',
            }}
          />
        </div>

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--color-graphite)' }}>
            Ouxin · Entry
          </p>
          <h1 className="font-display mt-4 max-w-lg text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-tight text-[#1c1a17]">
            售前客服数据终端
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed" style={{ color: 'var(--color-slate-mid)' }}>
            登录后可进入工作台侧栏导航；本页为独立登录入口，布局与工作台双栏不同。
          </p>
          <ul className="mt-8 hidden max-w-md space-y-3 text-sm leading-snug text-[#5a5957] lg:block">
            <li className="flex gap-2">
              <span className="font-semibold text-[#05933b]">●</span>
              左侧固定导航 · 暖色纸感数据区
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[#777eff]">●</span>
              模块入口与 KPI 总览统一从「工作台首页」进入
            </li>
          </ul>
        </div>

        <p className="relative text-xs" style={{ color: 'var(--color-stone)' }}>
          还没有账号？请联系管理员开通（此处仅为示意文案）
        </p>
      </section>

      {/* 右侧：登录卡片 */}
      <section className="flex items-center justify-center bg-[#fafafa] px-4 py-12 lg:border-l lg:border-[#f1f1f1]">
        <div className="w-full max-w-md rounded-[14px] border border-[#f1f1f1] bg-white p-8 shadow-[rgba(95,99,106,0.08)_0px_0px_0px_1px,rgba(43,43,48,0.08)_0px_4px_12px_0px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a5957]">Sign in</p>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-[#1c1a17]">登录作战台</h2>
          <p className="mt-2 text-sm text-[#7e7d7b]">输入账号密码后进入仪表盘</p>

          <div className="mt-8 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#5a5957]">账号</span>
              <input
                className="input-field"
                value={f.username}
                onChange={(ev) => setF({ ...f, username: ev.target.value })}
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#5a5957]">密码</span>
              <input
                className="input-field"
                type="password"
                value={f.password}
                onChange={(ev) => setF({ ...f, password: ev.target.value })}
                autoComplete="current-password"
              />
            </label>
          </div>

          <button type="button" onClick={submit} className="btn-primary mt-6 w-full py-3 text-[15px]">
            登录
          </button>
          {e ? <p className="mt-3 text-center text-sm font-medium text-red-700">{e}</p> : null}

          <p className="mt-6 text-center text-xs text-[#969594]">
            登录成功后进入工作台（左侧为导航栏）。直达{' '}
            <Link href="/dashboard" className="font-medium text-[#777eff] underline-offset-2 hover:underline">
              工作台首页
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
