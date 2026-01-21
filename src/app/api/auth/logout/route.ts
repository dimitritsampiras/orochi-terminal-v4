import { createClient } from '@/lib/clients/supabase-server';
import type { LogoutResponse } from '@/lib/types/api';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest): Promise<NextResponse<LogoutResponse>> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ data: 'success', error: null }, { status: 200 });
}
