import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/utils/admin";
import { getPlaymatePending, runPlaymateSync } from "@/utils/playmateSyncLogic";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminRoute();
  if (adminCheck.response) return adminCheck.response;

  try {
    const data = await getPlaymatePending();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdminRoute();
  if (adminCheck.response) return adminCheck.response;

  const body = await request.json().catch(() => ({}));
  const targetCodes: string[] | undefined = Array.isArray(body.filecodes) ? body.filecodes : undefined;

  try {
    const result = await runPlaymateSync(targetCodes);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
