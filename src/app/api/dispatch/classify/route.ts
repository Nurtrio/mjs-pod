import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { classifyByZip, classifyWithAI } from '@/lib/territories';
import type { TerritoryAssignment } from '@/types';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  // Expect: { invoices: [{ index, address, invoice_number, customer_name }] }
  const invoices: { index: number; address: string; invoice_number: string; customer_name: string }[] = body.invoices;

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ error: 'No invoices provided' }, { status: 400 });
  }

  // Fetch territories with driver names
  const { data: territories, error: tErr } = await supabase
    .from('driver_territories')
    .select('*, driver:drivers(name)')
    .order('priority', { ascending: false });

  if (tErr || !territories || territories.length === 0) {
    return NextResponse.json({ error: 'No territories configured' }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = territories.map((t: any) => ({
    ...t,
    driver_name: t.driver?.name ?? 'Unknown',
  }));

  // Phase 1: Zip code matching
  const addressItems = invoices.map((inv) => ({ index: inv.index, address: inv.address || '' }));
  const { classified, unclassified } = classifyByZip(addressItems, enriched);

  // Phase 2: AI classification for remaining
  let aiClassified: TerritoryAssignment[] = [];
  if (unclassified.length > 0) {
    try {
      aiClassified = await classifyWithAI(unclassified, enriched);
    } catch (err) {
      // If AI fails, do load-balancing fallback
      const erikCount = classified.filter((c) => enriched.find((e) => e.driver_id === c.driver_id)?.driver_name === 'Erik').length;
      const joseCount = classified.filter((c) => enriched.find((e) => e.driver_id === c.driver_id)?.driver_name === 'Jose').length;

      aiClassified = unclassified.map((item) => {
        // Assign to driver with fewer stops
        const target = erikCount <= joseCount ? enriched.find((e) => e.driver_name === 'Erik') : enriched.find((e) => e.driver_name === 'Jose');
        if (erikCount <= joseCount) {
          // Don't actually mutate, just use count for this batch
        }
        return {
          invoice_index: item.index,
          driver_id: target?.driver_id ?? enriched[0].driver_id,
          driver_name: target?.driver_name ?? enriched[0].driver_name,
          confidence: 'low' as const,
          reasoning: `AI classification failed (${err instanceof Error ? err.message : 'unknown'}), assigned by load balancing`,
        };
      });
    }
  }

  const allAssignments = [...classified, ...aiClassified].sort((a, b) => a.invoice_index - b.invoice_index);

  return NextResponse.json({ assignments: allAssignments });
}
