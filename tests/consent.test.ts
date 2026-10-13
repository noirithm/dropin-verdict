import { describe, expect, it } from "vitest";
import { clearConsent, readConsent, saveConsent } from "@/widget/consent";

function memStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe("consent record", () => {
  it("is empty at first, then saved and read back", () => {
    const s = memStore();
    expect(readConsent(s)).toBeNull();
    saveConsent(s, new Date("2026-10-12T00:00:00Z"));
    expect(readConsent(s)?.at).toBe("2026-10-12T00:00:00.000Z");
  });

  it("stores only a version and a timestamp, never an image", () => {
    const s = memStore();
    saveConsent(s);
    const stored = JSON.parse([...s.raw.values()][0]);
    expect(Object.keys(stored).sort()).toEqual(["at", "version"]);
  });

  it("ignores a record from another version", () => {
    const s = memStore();
    s.setItem("shadewise:consent", JSON.stringify({ version: "0", at: "x" }));
    expect(readConsent(s)).toBeNull();
  });

  it("clears on delete", () => {
    const s = memStore();
    saveConsent(s);
    clearConsent(s);
    expect(readConsent(s)).toBeNull();
  });

  it("survives unavailable storage", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readConsent(broken)).toBeNull();
    expect(() => saveConsent(broken)).not.toThrow();
    expect(() => clearConsent(broken)).not.toThrow();
  });
});
