import { NextResponse } from "next/server";
import { readSorobanEvents } from "../../../lib/stellar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID) {
      return NextResponse.json({ events: [], error: "No deployed escrow contract configured yet." });
    }
    const events = await readSorobanEvents();
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { events: [], error: error instanceof Error ? error.message : "Event relay unavailable." },
      { status: 200 },
    );
  }
}
