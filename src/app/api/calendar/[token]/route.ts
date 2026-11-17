import { getCalendarByToken } from "@/server/dal/calendar";
import { buildIcs } from "@/lib/calendar/ics";

// Подписка на расписание: GET /api/calendar/<токен>.ics. Без сессии — доступ по секретному токену.
export async function GET(req: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token } = await ctx.params;
  const cal = await getCalendarByToken(token);
  if (!cal) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const host = new URL(req.url).host;
  const body = buildIcs({ calName: `Ориентир · ${cal.groupCode} (концепт)`, lessons: cal.lessons, now: new Date(), host });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="orientir-schedule.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
