import { auth } from '@/lib/auth/server';
import { toCsv } from '@/lib/csv';
import { getGrades } from '@/features/masters/grades/queries';
import { getPriceCsv } from '@/features/masters/prices/queries';

/** One stone type's price grid as CSV: the file the price import reads back. */
export async function GET(req: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const type = new URL(req.url).searchParams.get('type') ?? '';
  const known = (await getGrades({ retired: true })).stoneType.some((t) => t.name === type);
  if (!known) return new Response('Unknown stone type', { status: 400 });

  const { cols, rows } = await getPriceCsv(type);
  const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return new Response(toCsv(cols, rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="prices-${slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
