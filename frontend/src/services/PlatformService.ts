export type PlatformPulse = {
  projectsShared: number;
  logsCreated: number;
  developers: number;
  generatedAt: string;
};

type Envelope<T> = { success: boolean; data: T; message?: string };

export async function getPlatformPulse(): Promise<PlatformPulse> {
  const response = await fetch("/api/public/pulse");
  const payload = (await response.json().catch(() => null)) as Envelope<PlatformPulse> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Could not load live platform statistics.");
  }
  return payload.data;
}
