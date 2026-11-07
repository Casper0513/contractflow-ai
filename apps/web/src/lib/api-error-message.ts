export function getApiErrorMessage(
  responseBody: string,
  status: number | undefined,
  fallback: string,
): string {
  return parseApiErrorMessage(responseBody, status) ?? fallback;
}

export function parseApiErrorMessage(
  responseBody: string,
  status?: number,
): string | null {
  if (status !== undefined && status >= 500) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(responseBody);

    if (!isRecord(parsed)) {
      return null;
    }

    if (Array.isArray(parsed.message)) {
      const messages = parsed.message.filter(
        (value): value is string => typeof value === "string",
      );

      return messages.length > 0 ? messages.join(" ") : null;
    }

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }

    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }

    return null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
