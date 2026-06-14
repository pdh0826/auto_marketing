import { NextResponse } from "next/server";
import { runBloggerSecretSelfTest, safeBloggerSecretError } from "@/lib/blogger/secrets";
import { getBloggerConnection } from "@/lib/db/blogger-connections";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  const connection = await getBloggerConnection(params.id);

  if (!connection) {
    return NextResponse.json({ error: "Blogger connection not found." }, { status: 404 });
  }

  try {
    const result = runBloggerSecretSelfTest();
    return NextResponse.json({
      data: {
        ...result,
        secretMaterialReturned: false as const,
        tokenExchangeImplemented: false as const,
        bloggerApiImplemented: false as const
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: safeBloggerSecretError(error instanceof Error ? error.message : "Blogger secret self-test failed."),
        data: {
          keyConfigured: false,
          selfTestPassed: false,
          keyVersion: "v1",
          message: "Blogger token encryption self-test failed.",
          secretMaterialReturned: false,
          tokenExchangeImplemented: false,
          bloggerApiImplemented: false
        }
      },
      { status: 400 }
    );
  }
}
