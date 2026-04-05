import Anthropic from '@anthropic-ai/sdk';
import type { DriverTerritory, TerritoryAssignment } from '@/types';

const HOME_BASE = '3066 E La Palma Ave, Anaheim, CA 92806';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/** Extract zip code from an address string */
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

/** Phase 1: Fast zip-code-based classification */
export function classifyByZip(
  addresses: { index: number; address: string }[],
  territories: (DriverTerritory & { driver_name: string })[],
): { classified: TerritoryAssignment[]; unclassified: { index: number; address: string }[] } {
  const classified: TerritoryAssignment[] = [];
  const unclassified: { index: number; address: string }[] = [];

  for (const item of addresses) {
    const zip = extractZip(item.address);
    if (!zip) {
      unclassified.push(item);
      continue;
    }

    // Sort territories by priority desc so higher priority wins ties
    const sorted = [...territories].sort((a, b) => b.priority - a.priority);
    const match = sorted.find((t) => t.zip_codes.includes(zip));

    if (match) {
      classified.push({
        invoice_index: item.index,
        driver_id: match.driver_id,
        driver_name: match.driver_name,
        confidence: 'high',
        reasoning: `Zip code ${zip} is in ${match.territory_name}`,
      });
    } else {
      unclassified.push(item);
    }
  }

  return { classified, unclassified };
}

/** Phase 2: Claude AI classification for ambiguous addresses */
export async function classifyWithAI(
  addresses: { index: number; address: string }[],
  territories: (DriverTerritory & { driver_name: string })[],
): Promise<TerritoryAssignment[]> {
  if (addresses.length === 0) return [];

  const territoryDescriptions = territories
    .map((t) => `Driver: ${t.driver_name} (ID: ${t.driver_id})\nTerritory: ${t.territory_name}\nDescription: ${t.description}`)
    .join('\n\n');

  const addressList = addresses
    .map((a) => `[${a.index}] ${a.address}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a delivery territory classifier for Mobile Janitorial Supply based at ${HOME_BASE}.

TERRITORIES:
${territoryDescriptions}

DELIVERY ADDRESSES TO CLASSIFY:
${addressList}

For each address, determine which driver's territory it belongs to based on geographic location and the territory descriptions.

If an address is ambiguous or doesn't clearly fit either territory, assign it to the driver whose territory is closest geographically. Include your reasoning.

Return ONLY a JSON array, no markdown:
[{"invoice_index": 0, "driver_id": "...", "driver_name": "...", "confidence": "high|medium|low", "reasoning": "..."}]`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

/** Route optimization: order stops to minimize driving distance */
export async function optimizeRouteOrder(
  stops: { index: number; address: string; invoice_number: string }[],
): Promise<number[]> {
  if (stops.length <= 1) return stops.map((s) => s.index);

  const stopList = stops
    .map((s) => `[${s.index}] ${s.address} (INV #${s.invoice_number})`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are a delivery route optimizer for Southern California.

HOME BASE (start point): ${HOME_BASE}

DELIVERY STOPS:
${stopList}

Order these stops to minimize total driving distance and time from the home base. Consider:
- Start from home base, end at the last delivery (no return trip needed)
- Group nearby addresses together
- Consider freeway access and SoCal traffic patterns
- Prefer a logical geographic flow (don't backtrack)

Return ONLY a JSON array of the index numbers in optimized order, no markdown:
[3, 1, 0, 2]`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return stops.map((s) => s.index);

  try {
    const order: number[] = JSON.parse(jsonMatch[0]);
    // Validate all indices are present
    const valid = order.every((i) => stops.some((s) => s.index === i)) && order.length === stops.length;
    return valid ? order : stops.map((s) => s.index);
  } catch {
    return stops.map((s) => s.index);
  }
}
