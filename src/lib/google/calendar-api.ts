export type GoogleCalendarEventBody = {
  summary: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  source?: { title: string; url: string };
};

async function calendarFetch(
  accessToken: string,
  calendarId: string,
  path: string,
  init?: RequestInit,
) {
  const encoded = encodeURIComponent(calendarId);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encoded}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export async function insertCalendarEvent(
  accessToken: string,
  calendarId: string,
  body: GoogleCalendarEventBody,
): Promise<{ id: string }> {
  const res = await calendarFetch(accessToken, calendarId, "/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Google insert failed: ${(await res.text()).slice(0, 240)}`);
  }
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

export async function patchCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: GoogleCalendarEventBody,
): Promise<void> {
  const res = await calendarFetch(
    accessToken,
    calendarId,
    `/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  }
  if (!res.ok) {
    throw new Error(`Google patch failed: ${(await res.text()).slice(0, 240)}`);
  }
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await calendarFetch(
    accessToken,
    calendarId,
    `/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  if (res.status === 404 || res.status === 410) return;
  if (!res.ok) {
    throw new Error(`Google delete failed: ${(await res.text()).slice(0, 240)}`);
  }
}
