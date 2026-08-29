"use server";

import { ApiRequestError, authenticatedApiRequest } from "@/lib/server-api";

export type JobAiSummaryResponse = {
  summary: string;
  model: string;
  generatedAt: string;
};

export type JobTaskSuggestion = {
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueDate: string;
  reason: string;
  model: string;
  generatedAt: string;
};

export type JobTaskSuggestionResult =
  | {
      suggestion: JobTaskSuggestion;
      error: null;
    }
  | {
      suggestion: null;
      error: string;
    };

export type JobScheduleSuggestion = {
  title: string;
  description: string;
  type:
    "WORK" | "SITE_VISIT" | "ESTIMATE" | "INSPECTION" | "DELIVERY" | "MEETING" | "OTHER";
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string;
  notes: string;
  reason: string;
  model: string;
  generatedAt: string;
};

export type JobScheduleSuggestionResult =
  | {
      suggestion: JobScheduleSuggestion;
      error: null;
    }
  | {
      suggestion: null;
      error: string;
    };

export async function generateJobAiSummary(jobId: string): Promise<JobAiSummaryResponse> {
  return authenticatedApiRequest<JobAiSummaryResponse>(`/ai/jobs/${jobId}/summary`, {
    method: "POST",
  });
}

export async function generateJobScheduleSuggestion(
  jobId: string,
): Promise<JobScheduleSuggestionResult> {
  try {
    const suggestion = await authenticatedApiRequest<JobScheduleSuggestion>(
      `/ai/jobs/${jobId}/schedule-suggestion`,
      {
        method: "POST",
      },
    );

    return {
      suggestion,
      error: null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return {
        suggestion: null,
        error: getApiErrorMessage(
          error.responseBody,
          "ContractFlow AI could not suggest a schedule.",
        ),
      };
    }

    console.error("Generate job AI schedule suggestion failed:", error);

    return {
      suggestion: null,
      error: "ContractFlow AI could not suggest a schedule.",
    };
  }
}

export async function generateJobTaskSuggestion(
  jobId: string,
): Promise<JobTaskSuggestionResult> {
  try {
    const suggestion = await authenticatedApiRequest<JobTaskSuggestion>(
      `/ai/jobs/${jobId}/task-suggestion`,
      {
        method: "POST",
      },
    );

    return {
      suggestion,
      error: null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return {
        suggestion: null,
        error: getApiErrorMessage(
          error.responseBody,
          "ContractFlow AI could not suggest a task.",
        ),
      };
    }

    console.error("Generate job AI task suggestion failed:", error);

    return {
      suggestion: null,
      error: "ContractFlow AI could not suggest a task.",
    };
  }
}

function getApiErrorMessage(responseBody: string, fallback: string) {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: unknown;
    };

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    if (Array.isArray(parsed.message)) {
      const messages = parsed.message.filter(
        (message): message is string => typeof message === "string",
      );

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
  } catch {
    // API response was not JSON.
  }

  return fallback;
}
