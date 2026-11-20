import { describe, expect, it } from "vitest";
import { pendingSteps } from "./catalog";

describe("pendingSteps", () => {
  it("новая заявка: впереди «В работе», «Готова», «Выдана»", () => {
    expect(pendingSteps(["submitted"], "submitted")).toEqual(["in_progress", "ready", "done"]);
  });
  // ПМИ-2 (Д-21): после переподачи в будущих шагах пропадало «В работе».
  it("после возврата и переподачи «В работе» снова впереди", () => {
    expect(pendingSteps(["submitted", "in_progress", "returned", "submitted"], "submitted")).toEqual(["in_progress", "ready", "done"]);
  });
  it("вернули: впереди всё после подачи; отклонили: ничего", () => {
    expect(pendingSteps(["submitted", "in_progress", "returned"], "returned")).toEqual(["in_progress", "ready", "done"]);
    expect(pendingSteps(["submitted", "rejected"], "rejected")).toEqual([]);
    expect(pendingSteps(["submitted", "in_progress", "ready"], "ready")).toEqual(["done"]);
  });
});
