import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { BINGO_SESSION_COOKIE, getBingoCookieOptions } from '@/lib/bingoSession';

export async function POST() {
  cookies().set(BINGO_SESSION_COOKIE, '', {
    ...getBingoCookieOptions(),
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
