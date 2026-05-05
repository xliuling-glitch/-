import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  CONFIG_CENTER_V2_KEY,
  coerceConfigV2,
  legacyOptionsFromV2,
  mergeLegacyTextIntoV2,
  DEFAULT_LEGACY,
  LEGACY_OPTION_KEYS,
  type LegacyOptions,
} from '@/lib/config-center-v2';

const DEFAULTS: LegacyOptions = DEFAULT_LEGACY;

export async function GET() {
  const v2row = await prisma.systemSetting.findUnique({ where: { key: CONFIG_CENTER_V2_KEY } });
  if (v2row?.value) {
    try {
      const v2 = coerceConfigV2(JSON.parse(v2row.value));
      return NextResponse.json(legacyOptionsFromV2(v2));
    } catch {
      /* fall through */
    }
  }

  const keys = [...LEGACY_OPTION_KEYS];
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return NextResponse.json(keys.reduce((acc, k) => ({ ...acc, [k]: map[k] || DEFAULTS[k] }), {} as LegacyOptions));
}

export async function POST(req: Request) {
  const body = await req.json();
  const patch: Partial<LegacyOptions> = {};

  for (const key of LEGACY_OPTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const value = body[key];
      if (Array.isArray(value)) {
        patch[key] = value.map(String);
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: JSON.stringify(patch[key]) },
          create: { key, value: JSON.stringify(patch[key]) },
        });
      }
    }
  }

  const v2row = await prisma.systemSetting.findUnique({ where: { key: CONFIG_CENTER_V2_KEY } });
  if (v2row?.value && Object.keys(patch).length > 0) {
    try {
      const current = coerceConfigV2(JSON.parse(v2row.value));
      const merged = mergeLegacyTextIntoV2(current, patch);
      await prisma.systemSetting.update({
        where: { key: CONFIG_CENTER_V2_KEY },
        data: { value: JSON.stringify(merged) },
      });
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true });
}
