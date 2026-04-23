import { z } from "zod";
import { LogReminderSentBody, LogReviewSentBody } from "@workspace/api-zod";

export { LogReminderSentBody, LogReviewSentBody };

export type LogReminderSentBodyType = z.infer<typeof LogReminderSentBody>;
export type LogReviewSentBodyType = z.infer<typeof LogReviewSentBody>;
