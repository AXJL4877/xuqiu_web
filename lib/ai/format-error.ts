/** 将 AI SDK / 网关错误转为用户可读文案 */
export function formatAiError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "模型调用失败";
  }

  let message = error.message;

  const withBody = error as Error & {
    responseBody?: string;
    data?: { error?: { message?: string } };
  };

  if (withBody.data?.error?.message) {
    message = withBody.data.error.message;
  } else if (typeof withBody.responseBody === "string") {
    try {
      const parsed = JSON.parse(withBody.responseBody) as {
        error?: { message?: string };
      };
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      /* use error.message */
    }
  }

  if (
    /supported API model names/i.test(message) ||
    /invalid_request_error/i.test(message)
  ) {
    if (/falsh|flsh/i.test(message)) {
      return "模型名称拼写错误：请使用 deepseek-v4-flash（flash 不要写成 falsh）或 deepseek-v4-pro。";
    }
    return `模型名称无效：${message}`;
  }

  return message;
}
