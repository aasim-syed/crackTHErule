export type Evidence = { bits: string; open: boolean; source: "probe" | "exam" };

export function isEvidenceList(x: unknown): x is Evidence[] {
  return (
    Array.isArray(x) &&
    x.length <= 64 &&
    x.every(
      (e) =>
        e &&
        typeof e.bits === "string" &&
        /^[01]{6}$/.test(e.bits) &&
        typeof e.open === "boolean" &&
        (e.source === "probe" || e.source === "exam"),
    )
  );
}
