"use server";
// Глобальный поиск только по своим данным: заявки и оценки фильтруются по student_id из сессии.
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { discipline, grade, news, request } from "../db/schema";
import { studentForAction } from "../session";
import { getRequestType, REQUEST_TYPES, STATUS_META } from "@/lib/requests/catalog";
import { matches, MAX_QUERY, MIN_QUERY, normalize, SECTIONS, type SearchHit } from "@/lib/search/match";

const LIMIT = 5;

export async function searchAction(raw: unknown): Promise<SearchHit[]> {
  const me = await studentForAction();
  if (!me || typeof raw !== "string") return [];
  const q = normalize(raw).slice(0, MAX_QUERY);
  if (q.length < MIN_QUERY) return [];

  const hits: SearchHit[] = [];
  hits.push(
    ...SECTIONS.filter((s) => matches(q, s.title, s.keywords))
      .slice(0, LIMIT)
      .map((s) => ({ group: "Разделы" as const, title: s.title, href: s.href })),
  );
  hits.push(
    ...REQUEST_TYPES.filter((t) => matches(q, t.title, t.description))
      .slice(0, LIMIT)
      .map((t) => ({ group: "Заказать" as const, title: t.title, subtitle: t.eta, href: `/requests/new?type=${t.key}` })),
  );

  const [myGrades, myRequests, foundNews] = await Promise.all([
    db
      .select({ name: discipline.name, status: grade.status, teacher: discipline.teacher })
      .from(grade)
      .innerJoin(discipline, eq(discipline.id, grade.disciplineId))
      .where(eq(grade.studentId, me.id)),
    db
      .select({ id: request.id, number: request.number, type: request.type, status: request.status, payload: request.payload })
      .from(request)
      .where(eq(request.studentId, me.id))
      .orderBy(desc(request.updatedAt)),
    db
      .select({ id: news.id, title: news.title })
      .from(news)
      .where(
        and(
          or(isNull(news.faculty), eq(news.faculty, me.faculty)),
          or(ilike(news.title, `%${escapeLike(q)}%`), ilike(news.body, `%${escapeLike(q)}%`)),
        ),
      )
      .orderBy(desc(news.publishedAt))
      .limit(LIMIT),
  ]);

  hits.push(
    ...myGrades
      .filter((g) => matches(q, g.name, g.teacher))
      .slice(0, LIMIT)
      .map((g) => ({
        group: "Дисциплины" as const,
        title: g.name,
        subtitle: g.status === "debt" ? "долг — план пересдачи" : g.status === "open" ? "текущий семестр" : "закрыта",
        href: g.status === "debt" ? "/rating" : "/grades",
      })),
  );
  hits.push(
    ...myRequests
      .filter((r) => matches(q, getRequestType(r.type)?.title, r.number, ...Object.values(r.payload)))
      .slice(0, LIMIT)
      .map((r) => ({
        group: "Мои заявки" as const,
        title: getRequestType(r.type)?.title ?? r.type,
        subtitle: `№ ${r.number} · ${STATUS_META[r.status].label}`,
        href: `/requests/${r.id}`,
      })),
  );
  hits.push(...foundNews.map((n) => ({ group: "Объявления" as const, title: n.title, href: "/notifications?tab=news" })));
  // Сначала своё: заявки и дисциплины, потом разделы и каталог.
  const ORDER: SearchHit["group"][] = ["Мои заявки", "Дисциплины", "Разделы", "Заказать", "Объявления"];
  return hits.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
