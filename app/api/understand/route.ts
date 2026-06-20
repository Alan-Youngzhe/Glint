import { NextResponse } from "next/server";
import { understand } from "@/lib/understand";
import { understandStream } from "@/lib/understand/stream";
import type { UnderstandRequest } from "@/types/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as UnderstandRequest;

  // ⌥1 选中代码 → SSE 流式
  if (body.dimension === 1 && body.focus.type === "selection") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of understandStream(body)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch (e) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: e instanceof Error ? e.message : String(e) })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  }

  // 其余维度 → JSON
  try {
    return NextResponse.json(await understand(body));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
