import { createTextStreamResponse } from "ai";

import { formatAiError } from "@/lib/ai/format-error";

type StreamTextResponseOptions = {
  failurePrefix: string;
  headers?: Record<string, string>;
  logTag?: string;
};

type TextStreamResult = {
  textStream: AsyncIterable<string>;
  text: PromiseLike<string>;
};

/**
 * 将 streamText 结果转为 HTTP 流式响应；空流或 SDK 延迟抛错时写入失败前缀文案。
 */
export function createAiStreamTextResponse(
  result: TextStreamResult,
  options: StreamTextResponseOptions,
): Response {
  const { failurePrefix, headers, logTag = "ai/stream" } = options;

  const textStream = new ReadableStream<string>({
    async start(controller) {
      let hadOutput = false;
      try {
        for await (const chunk of result.textStream) {
          hadOutput = true;
          controller.enqueue(chunk);
        }
        if (!hadOutput) {
          const full = await result.text;
          if (full) {
            controller.enqueue(full);
          }
        }
      } catch (error) {
        console.error(`[${logTag}]`, error);
        controller.enqueue(`${failurePrefix}${formatAiError(error)}`);
      } finally {
        controller.close();
      }
    },
  });

  return createTextStreamResponse({ textStream, headers });
}
