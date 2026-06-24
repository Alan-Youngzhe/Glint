import { agentLoop } from "@/lib/agent";
import type { AgentRequest } from "@/types/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Agent Bar SSE（V3 §7.1）。 */
export async function POST(req: Request) {
  const body = (await req.json()) as AgentRequest;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of agentLoop(body.projectId, body.message, body.sessionId)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "token", delta: `\n[error] ${e instanceof Error ? e.message : String(e)}` })}\n\n`,
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
