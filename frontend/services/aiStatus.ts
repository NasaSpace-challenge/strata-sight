/** Is the optional AI explainer configured on this server? `null` means "could not find out" (treated as available). */
export async function fetchAiAvailability(): Promise<boolean | null> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body.available === 'boolean' ? body.available : null;
  } catch {
    return null;
  }
}
