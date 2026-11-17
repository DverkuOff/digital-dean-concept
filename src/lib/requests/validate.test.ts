import { describe, expect, it } from "vitest";
import { getRequestType } from "./catalog";
import { validatePayload } from "./validate";

describe("validatePayload", () => {
  const cert = getRequestType("study_certificate")!;
  const absence = getRequestType("absence_excuse")!;

  it("принимает корректные поля и отбрасывает лишние", () => {
    const r = validatePayload(cert, { purpose: "Банк", copies: "2", format: "Бумажная в учебном офисе", studentId: "чужой" });
    expect(r).toEqual({ ok: true, data: { purpose: "Банк", copies: "2", format: "Бумажная в учебном офисе" } });
  });

  it("обязательные поля, диапазон чисел и список вариантов", () => {
    const r = validatePayload(cert, { purpose: "", copies: "9", format: "Голубиная почта" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["copies", "format", "purpose"]);
  });

  it("дата окончания не раньше начала", () => {
    const r = validatePayload(absence, { dateFrom: "2026-11-12", dateTo: "2026-11-10", reason: "Болезнь" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.dateTo).toBeDefined();
  });
});
