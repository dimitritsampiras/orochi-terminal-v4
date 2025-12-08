import { db } from '@/lib/clients/db';
import { createClient } from '@/lib/clients/supabase-server';
import { type NextRequest, NextResponse } from 'next/server';
import { labResults, orders, users } from '../../../../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { uploadLabResultsSchema } from '@/lib/schemas/orders-schema';
import type { ApiResponse } from '@/lib/types/misc';
import { env } from '@/lib/env';
import { sleep } from '@/lib/utils';
import { reduceResults } from '@/lib/helpers/reduce-edenai-results';
import type { EdenAIResponse } from '@/lib/types/edenai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
): Promise<NextResponse<ApiResponse<'success'>>> {
  const supabase = await createClient();

  const {
    data: { user: authUser }
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, authUser.id));

  if (!user) {
    return NextResponse.json({ data: null, error: 'User not found' }, { status: 404 });
  }

  if (!['super_admin', 'admin', 'nurse'].includes(user.role) || user.active === false) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const { order_id } = await params;

  // Verify order exists
  const [order] = await db.select().from(orders).where(eq(orders.id, order_id));
  if (!order) {
    return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
  }

  const rawBody = await request.json();
  const { success, data: body } = uploadLabResultsSchema.safeParse(rawBody);

  if (!success) {
    return NextResponse.json({ data: null, error: 'Invalid request body' }, { status: 400 });
  }

  const edenResponse = await fetch('https://api.edenai.run/v2/ocr/ocr_tables_async', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EDENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      file_url: body.file_url,
      file_password: body.filePassword,
      providers: 'microsoft,google',
      language: 'en'
    })
  });

  if (!edenResponse.ok) {
    return NextResponse.json(
      { data: null, error: 'Failed to submit to Eden AI' },
      { status: 500 }
    );
  }

  const edenData = (await edenResponse.json()) as { public_id: string };

  if (!edenData?.public_id) {
    return NextResponse.json(
      { data: null, error: 'Invalid response from Eden AI' },
      { status: 500 }
    );
  }

  if (edenData?.public_id) {
    console.log('public id good, starting polling...', edenData.public_id);
    let tries = 22;
    const interval = 3000;
    while (tries > 0) {
      await sleep(interval);
      tries--;
      console.log('tries', tries);

      const processingResponse = await fetch(
        `https://api.edenai.run/v2/ocr/ocr_tables_async/${edenData.public_id}?response_as_dict=true&show_base_64=true&show_original_response=false`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${env.EDENAI_API_KEY}`
          }
        }
      );

      const processingData = (await processingResponse.json()) as {
        status: 'finished' | 'pending' | 'failed';
      };
      console.log('processingData', processingData);
      if (processingData.status === 'finished') {
        await db.insert(labResults).values({
          fileUrl: body.file_url,
          orderId: order_id,
          rawJson: JSON.stringify(reduceResults(processingData as EdenAIResponse)),
          status: 'finished'
        });

        return NextResponse.json({ data: 'success', error: null });
      }
    }

    if (tries === 0) {
      return NextResponse.json(
        { data: null, error: 'Failed to upload lab results. Request timed out.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { data: null, error: 'Failed to upload lab results' },
    { status: 500 }
  );
}
