import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/utils/admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdminRoute();
  if (adminCheck.response) return adminCheck.response;

  const { adminSupabase } = adminCheck.context;
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.embed_url !== undefined) updates.embed_url = body.embed_url;
  if (body.title !== undefined) updates.title = body.title;
  if (body.active !== undefined) updates.active = body.active;
  if (body.season !== undefined) updates.season = body.season;
  if (body.episode !== undefined) updates.episode = body.episode;

  const { error } = await adminSupabase
    .from("custom_embeds" as any)
    .update(updates)
    .eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Embed updated" });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminRoute();
  if (adminCheck.response) return adminCheck.response;

  const { adminSupabase } = adminCheck.context;
  const { id } = await params;

  const { error } = await adminSupabase.from("custom_embeds" as any).delete().eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Embed deleted" });
}
