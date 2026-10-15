import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION } from "chess.js";
import { classifyMove, cpLoss, evalLabel, pvToSan, type Evaluation } from "../src/lib/analysis";
const evaluation = (cp: number): Evaluation => ({ cp, mate: null, depth: 14, bestMove: "e2e4", pv: [] });
describe("transparent engine analysis", () => {
  it.each([[0,"excellent"],[19,"excellent"],[20,"good"],[49,"good"],[50,"inaccuracy"],[99,"inaccuracy"],[100,"mistake"],[199,"mistake"],[200,"blunder"],[800,"blunder"]] as const)("classifies %i centipawn loss as %s", (loss, label) => { expect(classifyMove(loss, false)).toBe(label); });
  it("recognizes the engine's best move", () => { expect(classifyMove(0, true)).toBe("best"); });
  it("normalizes losses correctly for both colors", () => { expect(cpLoss(evaluation(40), evaluation(-80), "w")).toBe(120); expect(cpLoss(evaluation(-40), evaluation(80), "b")).toBe(120); expect(cpLoss(evaluation(-40), evaluation(80), "w")).toBe(0); });
  it("formats real centipawn and mate scores", () => { expect(evalLabel(evaluation(123))).toBe("+1.23"); expect(evalLabel(evaluation(-45))).toBe("-0.45"); expect(evalLabel({ cp: 99900, mate: 1 })).toBe("M1"); });
  it("converts engine principal variations to legal SAN", () => { expect(pvToSan(DEFAULT_POSITION, ["e2e4","e7e5","g1f3","bad"])).toEqual(["e4","e5","Nf3"]); });
});