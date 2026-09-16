import type { NotificationJob, NotificationPorts } from "@niva/types";

export async function processNotificationJob(
  job: NotificationJob,
  ports: NotificationPorts,
): Promise<void> {
  if (job.channel === "email") {
    await ports.email.sendTemplate(job.payload);
    return;
  }
  if (job.channel === "sms") {
    await ports.sms.send(job.payload);
    return;
  }
  await ports.whatsapp.sendSessionMessage(job.payload);
}
