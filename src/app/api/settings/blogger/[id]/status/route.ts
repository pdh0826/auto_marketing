import { NextResponse } from "next/server";
import { getBloggerConnection, toBloggerConnectionStatusSummary } from "@/lib/db/blogger-connections";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const connection = await getBloggerConnection(params.id);

  if (!connection) {
    return NextResponse.json({ error: "Blogger connection not found." }, { status: 404 });
  }

  return NextResponse.json({ data: toBloggerConnectionStatusSummary(connection) });
}
