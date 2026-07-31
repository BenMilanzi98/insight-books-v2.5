import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  coerceLocale,
  isSupportedLocale,
  buildLocaleCookieOptions,
  normalizeLocale,
} from '@/lib/i18n';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    const cookieLocale = normalizeLocale(
      request.cookies?.get?.('ib_locale')?.value ||
        request.headers.get('cookie')?.match(/(?:^|;\s*)ib_locale=([^;]+)/)?.[1]
    );

    let preferredLanguage = null;
    let tenantDefaultLanguage = null;
    if (user?.id) {
      try {
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            preferredLanguage: true,
            tenant: { select: { settings: { select: { defaultLanguage: true } } } },
          },
        });
        preferredLanguage = row?.preferredLanguage || null;
        tenantDefaultLanguage = row?.tenant?.settings?.defaultLanguage || null;
      } catch {
        // Column may be missing until migrate
      }
    }

    return NextResponse.json({
      language: coerceLocale(
        cookieLocale || preferredLanguage || tenantDefaultLanguage || 'en'
      ),
      preferredLanguage,
      tenantDefaultLanguage,
      cookieLocale,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const language = normalizeLocale(body.language);
    if (!language || !isSupportedLocale(language)) {
      return NextResponse.json(
        { error: 'Unsupported language', code: 'INVALID_LOCALE', messageKey: 'errors.invalidLocale' },
        { status: 400 }
      );
    }

    const user = await getUserFromSession(request);
    if (user?.id) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { preferredLanguage: language },
        });
      } catch (err) {
        console.warn('preferredLanguage update skipped:', err?.message || err);
      }
    }

    const res = NextResponse.json({
      success: true,
      language,
      persistedToUser: Boolean(user?.id),
    });
    const cookie = buildLocaleCookieOptions(language);
    res.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      maxAge: cookie.maxAge,
      sameSite: cookie.sameSite,
      httpOnly: cookie.httpOnly,
    });
    return res;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
