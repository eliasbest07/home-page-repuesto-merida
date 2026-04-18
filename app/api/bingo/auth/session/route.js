import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { BINGO_SESSION_COOKIE, readBingoSession } from '@/lib/bingoSession';

export async function GET() {
  const raw = cookies().get(BINGO_SESSION_COOKIE)?.value;
  const session = readBingoSession(raw);

  if (!session?.phone) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    phone: session.phone,
  });
}
