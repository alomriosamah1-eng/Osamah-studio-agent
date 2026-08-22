import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";

if (process.argv.includes("--check")) {
  process.stdout.write("Hermes ACP check OK\n");
  process.exit(0);
}

const promptCounts = new Map();
const textFromPrompt = (blocks) => {
  const textBlock = Array.isArray(blocks) ? blocks.find((block) => block?.type === "text") : undefined;
  return typeof textBlock?.text === "string" ? textBlock.text : "";
};

const agent = acp.agent({ name: "hermes-acp-fixture" })
  .onRequest(acp.methods.agent.initialize, async () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { promptCapabilities: { image: false, audio: false, embeddedContext: false } },
    agentInfo: { name: "hermes-acp-fixture", version: "0.1.0" },
  }))
  .onRequest(acp.methods.agent.session.new, async () => ({ sessionId: `fixture-session-${Date.now()}` }))
  .onRequest(acp.methods.agent.session.prompt, async (context) => {
    const input = textFromPrompt(context.params.prompt);
    const count = (promptCounts.get(context.params.sessionId) ?? 0) + 1;
    promptCounts.set(context.params.sessionId, count);
    let text = `fixture:${count}:${input}`;
    if (input === "read") {
      const response = await context.client.request(acp.methods.client.fs.readTextFile, {
        sessionId: context.params.sessionId,
        path: join(process.cwd(), "note.txt"),
      });
      text = `read:${response.content}`;
    }
    if (input === "read-outside") {
      try {
        const response = await context.client.request(acp.methods.client.fs.readTextFile, {
          sessionId: context.params.sessionId,
          path: process.env.HERMES_FIXTURE_OUTSIDE ?? "/tmp/hermes-acp-outside.txt",
        });
        text = `outside:${response.content}`;
      } catch {
        text = "read-denied";
      }
    }
    await context.client.notify(acp.methods.client.session.update, {
      sessionId: context.params.sessionId,
      update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text }, messageId: `fixture-message-${count}` },
    });
    return { stopReason: "end_turn" };
  });

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));
agent.connect(stream);
