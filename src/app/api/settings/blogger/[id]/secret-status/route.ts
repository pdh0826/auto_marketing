import { NextResponse } from "next/server";
import { getBloggerConnection } from "@/lib/db/blogger-connections";
import { getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";

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

  const status = await getBloggerConnectionSecretStatus(params.id);
  return NextResponse.json({
    data: {
      ...status,
      tokenExchangeImplemented: true,
      bloggerApiImplemented: false as const
    }
  });
}
