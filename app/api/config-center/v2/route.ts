import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  CONFIG_CENTER_V2_KEY,
  coerceConfigV2,
  createDefaultV2,
  legacyOptionsFromV2,
  mergeLegacyTextIntoV2,
  type ConfigCenterV2,
  type LegacyOptions,
  LEGACY_OPTION_KEYS,
  DEFAULT_LEGACY,
  buildV2FromLegacy,
} from '@/lib/config-center-v2';

function requireAuth() {
  const s = getSession();
  if (!s) return null;
  return s;
}

function requireAdmin(s: NonNullable<ReturnType<typeof getSession>>) {
  return s.role === 'admin' || s.role === 'manager';
}

async function readLegacyFromDb(): Promise<Partial<LegacyOptions>> {
  const out: Partial<LegacyOptions> = {};
  for (const key of LEGACY_OPTION_KEYS) {
    const r = await prisma.systemSetting.findUnique({ where: { key } });
    if (r) {
      try {
        const v = JSON.parse(r.value);
        if (Array.isArray(v)) out[key] = v.map(String);
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

async function persistV2AndLegacy(config: ConfigCenterV2) {
  const normalized = coerceConfigV2(config);
  await prisma.systemSetting.upsert({
    where: { key: CONFIG_CENTER_V2_KEY },
    update: { value: JSON.stringify(normalized) },
    create: { key: CONFIG_CENTER_V2_KEY, value: JSON.stringify(normalized) },
  });
  const legacy = legacyOptionsFromV2(normalized);
  for (const key of LEGACY_OPTION_KEYS) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(legacy[key]) },
      create: { key, value: JSON.stringify(legacy[key]) },
    });
  }
  return normalized;
}

/** 系统配置中心 2.0：读写结构化配置，并与旧版 options 六键同步 */
export async function GET() {
  const session = requireAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: '未登录' }, { status: 401 });
  }

  const row = await prisma.systemSetting.findUnique({ where: { key: CONFIG_CENTER_V2_KEY } });
  let config: ConfigCenterV2;
  if (row?.value) {
    try {
      config = coerceConfigV2(JSON.parse(row.value));
    } catch {
      config = buildV2FromLegacy({ ...DEFAULT_LEGACY, ...(await readLegacyFromDb()) });
    }
  } else {
    config = buildV2FromLegacy({ ...DEFAULT_LEGACY, ...(await readLegacyFromDb()) });
  }

  return NextResponse.json({
    ok: true,
    config,
    legacyPreview: legacyOptionsFromV2(config),
    canEdit: requireAdmin(session),
  });
}

export async function POST(req: Request) {
  const session = requireAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: '未登录' }, { status: 401 });
  }
  if (!requireAdmin(session)) {
    return NextResponse.json({ ok: false, error: '仅管理员或主管可保存配置' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体无效' }, { status: 400 });
  }

  const action = String(body.action ?? 'save');

  if (action === 'save') {
    const config = coerceConfigV2(body.config);
    const saved = await persistV2AndLegacy(config);
    return NextResponse.json({ ok: true, config: saved });
  }

  if (action === 'restore_default') {
    const fresh = createDefaultV2();
    const saved = await persistV2AndLegacy(fresh);
    return NextResponse.json({ ok: true, config: saved });
  }

  if (action === 'import_legacy') {
    const legacy = body.legacy as Partial<LegacyOptions>;
    const row = await prisma.systemSetting.findUnique({ where: { key: CONFIG_CENTER_V2_KEY } });
    const current = row?.value ? coerceConfigV2(JSON.parse(row.value)) : buildV2FromLegacy(await readLegacyFromDb());
    const merged = mergeLegacyTextIntoV2(current, legacy);
    const saved = await persistV2AndLegacy(merged);
    return NextResponse.json({ ok: true, config: saved });
  }

  if (action === 'import_json') {
    const config = coerceConfigV2(body.config);
    const saved = await persistV2AndLegacy(config);
    return NextResponse.json({ ok: true, config: saved });
  }

  return NextResponse.json({ ok: false, error: '未知 action' }, { status: 400 });
}
