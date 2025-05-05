import { describe, test, expect } from "vitest";
import { exprToST } from "../../src/cli/beckhoff/beckhoff-generator.js";
import {
  Primary,
  Ref,
  NegExpr,
  NotExpr,
  ParenExpr,
  BinExpr,
  TypeRef,
  VarDecl,
} from "../../src/language/generated/ast.js";
import { parseHelper } from "langium/test";
import { createBcsEngineeringServices } from "../../src/language/bcs-engineering-module.js";
import { NodeFileSystem } from "langium/node";

const services = createBcsEngineeringServices(NodeFileSystem);

describe("exprToST (IEC 61131-3)", () => {
  // --- Primary literals ----------------------------------------------------

  test("integer literal", () => {
    const text = `
      42
    `;
    await parseHelper<Primary>(services)(text);

    const expr: Primary = { $type: "Primary", val: 42 };
    expect(exprToST(expr)).toBe("42");
  });

  test("real literal", () => {
    const expr: Primary = { $type: "Primary", val: 3.14 };
    expect(exprToST(expr)).toBe("3.14");
  });

  test("boolean literal TRUE/FALSE", () => {
    expect(exprToST({ $type: "Primary", val: true })).toBe("TRUE");
    expect(exprToST({ $type: "Primary", val: false })).toBe("FALSE");
  });

  test("string literal", () => {
    const expr: Primary = { $type: "Primary", val: "hello" };
    expect(exprToST(expr)).toBe(`"hello"`);
  });

  test("time literal (duration)", () => {
    const expr: Primary = { $type: "Primary", val: "T#5s" };
    expect(exprToST(expr)).toBe("T#5s");
  });

  test("TOD literal (time-of-day)", () => {
    const expr: Primary = { $type: "Primary", val: "TOD#07:00:00" };
    expect(exprToST(expr)).toBe("TOD#07:00:00");
  });

  // --- Variable & Enum references ----------------------------------------

  test("simple variable Ref", () => {
    // 1) Make a VarDecl stub for “myVar : BOOL”
    const varDecl = makeVarDecl("myVar", "BOOL");

    // 2) Stub a Ref node that points to it
    const refExpr = {
      $type: "Ref",
      ref: { ref: varDecl },
      properties: [],
      indices: [],
      // satisfy the AST bookkeeping
      $container: null!,
      $containerProperty: "",
      $containerIndex: 0,
    } as unknown as Ref;

    // 3) Now your generator can read `.ref.ref.name` without blowing up
    expect(exprToST(refExpr)).toBe("myVar");
  });

  test("enum member Ref", () => {
    const expr: Ref = {
      $type: "Ref",
      ref: { ref: { name: "Mode" } },
      properties: [{ ref: { name: "COMFORT" } }],
      indices: [],
    };
    expect(exprToST(expr)).toBe("Mode.COMFORT");
  });

  // --- Array & Struct literals -------------------------------------------

  test("array literal", () => {
    const expr: Primary = {
      $type: "Primary",
      val: {
        elements: [
          { $type: "Primary", val: 1 },
          { $type: "Primary", val: 2 },
          { $type: "Primary", val: 3 },
        ],
      },
    };
    expect(exprToST(expr)).toBe(`[1,2,3]`);
  });

  test("nested array literal", () => {
    const expr: Primary = {
      $type: "Primary",
      val: {
        elements: [
          {
            $type: "Primary",
            val: {
              elements: [
                { $type: "Primary", val: 1 },
                { $type: "Primary", val: 2 },
              ],
            },
          },
          {
            $type: "Primary",
            val: {
              elements: [
                { $type: "Primary", val: 3 },
                { $type: "Primary", val: 4 },
              ],
            },
          },
        ],
      },
    };
    expect(exprToST(expr)).toBe(`[[1,2],[3,4]]`);
  });

  test("struct literal", () => {
    const expr: Primary = {
      $type: "Primary",
      val: {
        fields: [
          { name: "x", value: { $type: "Primary", val: 1 } },
          { name: "y", value: { $type: "Primary", val: 2 } },
        ],
      },
    };
    expect(exprToST(expr)).toBe(`{ x: 1, y: 2 }`);
  });

  // --- Unary expressions --------------------------------------------------

  test("unary minus", () => {
    const expr: NegExpr = {
      $type: "NegExpr",
      expr: { $type: "Primary", val: 5 },
    };
    expect(exprToST(expr)).toBe(`-5`);
  });

  test("logical NOT", () => {
    const expr: NotExpr = {
      $type: "NotExpr",
      expr: { $type: "Primary", val: false },
    };
    expect(exprToST(expr)).toBe(`NOT FALSE`);
  });

  test("parenthesized expression", () => {
    const expr: ParenExpr = {
      $type: "ParenExpr",
      expr: {
        $type: "BinExpr",
        e1: { $type: "Primary", val: 1 },
        op: "+",
        e2: { $type: "Primary", val: 2 },
      },
    };
    expect(exprToST(expr)).toBe(`(1 + 2)`);
  });

  // --- Binary expressions -------------------------------------------------

  const arithOps = ["+", "-", "*", "/"] as const;
  for (const op of arithOps) {
    test(`binary arithmetic ${op}`, () => {
      const expr: BinExpr = {
        $type: "BinExpr",
        e1: { $type: "Primary", val: 7 },
        op,
        e2: { $type: "Primary", val: 3 },
      };
      expect(exprToST(expr)).toBe(`7 ${op} 3`);
    });
  }

  const compOps: Record<string, string> = {
    "==": "=",
    "!=": "<>",
    "<": "<",
    ">": ">",
    "<=": "<=",
    ">=": ">=",
  };
  for (const [tok, stOp] of Object.entries(compOps)) {
    test(`comparison ${tok}`, () => {
      const expr: BinExpr = {
        $type: "BinExpr",
        e1: { $type: "Primary", val: 4 },
        op: tok as any,
        e2: { $type: "Primary", val: 5 },
      };
      expect(exprToST(expr)).toBe(`4 ${stOp} 5`);
    });
  }

  const logicOps: Record<string, string> = {
    "&&": "AND",
    "||": "OR",
  };
  for (const [tok, stOp] of Object.entries(logicOps)) {
    test(`logical ${tok}`, () => {
      const expr: BinExpr = {
        $type: "BinExpr",
        e1: { $type: "Primary", val: true },
        op: tok as any,
        e2: { $type: "Primary", val: false },
      };
      expect(exprToST(expr)).toBe(`TRUE ${stOp} FALSE`);
    });
  }
});
