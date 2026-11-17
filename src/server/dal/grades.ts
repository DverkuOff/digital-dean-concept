import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { discipline, examAttempt, grade, student } from "../db/schema";
import { requireStudent } from "../session";
import { calcRating, type DisciplineResult } from "@/lib/rating/calc";
import { RATING_CONFIG } from "@/lib/rating/config";

export type GradeView = Awaited<ReturnType<typeof getMyGrades>>[number];

export async function getMyGrades() {
  const me = await requireStudent();
  return db
    .select({
      gradeId: grade.id,
      disciplineId: discipline.id,
      name: discipline.name,
      shortName: discipline.shortName,
      credits: discipline.credits,
      controlType: discipline.controlType,
      semester: discipline.semester,
      teacher: discipline.teacher,
      slice1: grade.slice1,
      slice2: grade.slice2,
      slice3: grade.slice3,
      finalScore: grade.finalScore,
      status: grade.status,
      passedOnRetake: grade.passedOnRetake,
    })
    .from(grade)
    .innerJoin(discipline, eq(discipline.id, grade.disciplineId))
    .where(eq(grade.studentId, me.id))
    .orderBy(asc(discipline.semester), asc(discipline.name));
}

export function toResults(rows: GradeView[]): DisciplineResult[] {
  return rows.map((g) => ({
    disciplineId: g.disciplineId,
    name: g.name,
    credits: g.credits,
    controlType: g.controlType,
    status: g.status,
    finalScore: g.finalScore,
    passedOnRetake: g.passedOnRetake,
  }));
}

export async function getMyAttempts() {
  const me = await requireStudent();
  return db
    .select({
      id: examAttempt.id,
      disciplineId: examAttempt.disciplineId,
      kind: examAttempt.kind,
      scheduledAt: examAttempt.scheduledAt,
      room: examAttempt.room,
      score: examAttempt.score,
      result: examAttempt.result,
    })
    .from(examAttempt)
    .where(eq(examAttempt.studentId, me.id))
    .orderBy(asc(examAttempt.scheduledAt));
}

/**
 * Текущие рейтинги однокурсников — только числа, без имён и оценок.
 * Считаются той же чистой функцией, что и свой рейтинг.
 */
export async function getCohortRatings(): Promise<number[]> {
  const me = await requireStudent();
  const rows = await db
    .select({
      studentId: grade.studentId,
      disciplineId: discipline.id,
      credits: discipline.credits,
      controlType: discipline.controlType,
      status: grade.status,
      finalScore: grade.finalScore,
      passedOnRetake: grade.passedOnRetake,
    })
    .from(grade)
    .innerJoin(discipline, eq(discipline.id, grade.disciplineId))
    .innerJoin(student, eq(student.id, grade.studentId))
    .where(and(eq(student.cohort, me.cohort), ne(student.id, me.id)));

  const byStudent = new Map<string, DisciplineResult[]>();
  for (const r of rows) {
    const list = byStudent.get(r.studentId) ?? [];
    list.push({ ...r, name: "" });
    byStudent.set(r.studentId, list);
  }
  const ratings: number[] = [];
  for (const list of byStudent.values()) {
    const res = calcRating(list, RATING_CONFIG);
    if (res.rating !== null) ratings.push(res.rating);
  }
  // Сортировка убирает связь порядка с id студентов.
  return ratings.sort((a, b) => b - a);
}
