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

  // Находки аудита М3: «0x2» проходило как число, «2026-02-31» и «0001-01-01» — как даты.
  it("число — только цифры: 0x2, 1e1, 2.0 отклоняются", () => {
    for (const copies of ["0x2", "1e1", "2.0", "-1", "999"]) {
      const r = validatePayload(cert, { purpose: "Банк", copies, format: "Бумажная в учебном офисе" });
      expect(r.ok, copies).toBe(false);
    }
  });

  it("несуществующие и далёкие даты отклоняются, русский формат принимается", () => {
    const now = new Date();
    const y = now.getFullYear();
    for (const d of ["2026-02-31", "0001-01-01", "9999-12-31", `${y}-13-01`]) {
      expect(validatePayload(absence, { dateFrom: d, dateTo: d, reason: "Болезнь" }).ok, d).toBe(false);
    }
    const ok = validatePayload(absence, { dateFrom: `10.11.${y}`, dateTo: `${y}-11-12`, reason: "Болезнь" });
    expect(ok).toEqual({ ok: true, data: { dateFrom: `${y}-11-10`, dateTo: `${y}-11-12`, reason: "Болезнь" } });
  });
});
