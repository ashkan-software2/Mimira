import type { SettingsBlob } from "./db";
import { getSettings, updateSettings } from "./repo";
import {
  isOutboundQuotaExceeded,
  quotaExceededReply,
} from "./settings-runtime";

export type OutboundGate =
  | { allowed: true }
  | { allowed: false; replyText: string };

/** Check billing quota before sending an outbound LINE message. */
export async function gateOutboundMessage(): Promise<OutboundGate> {
  const settings = await getSettings();
  if (!isOutboundQuotaExceeded(settings)) {
    return { allowed: true };
  }
  return { allowed: false, replyText: quotaExceededReply(settings) };
}

/** Increment outbound counter after a message is actually sent. */
export async function recordOutboundMessage(): Promise<SettingsBlob> {
  const settings = await getSettings();
  if (settings.billing.msg_count >= settings.billing.msg_quota) {
    return settings;
  }
  return updateSettings("billing", {
    msg_count: settings.billing.msg_count + 1,
  });
}
