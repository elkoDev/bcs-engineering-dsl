import { describe, expect, test } from "vitest";
import { createBcsEngineeringServices } from "../../src/language/bcs-engineering-module.js";
import { extractDocuments } from "../../src/cli/cli-util.js";
import * as path from "node:path";
import { NodeFileSystem } from "langium/node";

describe("BCS Control Validation Tests", () => {
  test("No errors in valid control/hardware files", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "control.bcsctrl"),
      services.bcsControl,
      false
    );

    expect(mainDoc.diagnostics ?? []).toEqual([]);

    allDocs.forEach((doc) => {
      expect(doc.diagnostics ?? []).toEqual([]);
    });
  });

  test("Detect Assignment type mismatch", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "invalid", "control.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = allDocs.flatMap((doc) => doc.diagnostics ?? []);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(diagString).toMatch(/Cannot assign "REAL" to "BOOL"/);
  });

  test("Detect Enum type mismatch", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "invalid_enum", "control_enum.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = allDocs.flatMap((doc) => doc.diagnostics ?? []);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(1);

    expect(diagString).toMatch(
      'Type mismatch: Cannot assign "Enum:Status" to "Enum:Mode".'
    );
  });

  test("Detect VarDecl type mismatch", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(
        __dirname,
        "files",
        "invalid_vardecl",
        "control_vardecl.bcsctrl"
      ),
      services.bcsControl,
      false
    );

    const allDiagnostics = allDocs.flatMap((doc) => doc.diagnostics ?? []);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(9);
    const expectedMessages = [
      'Type mismatch: Cannot assign "BOOL" to "INT".',
      'Type mismatch: Cannot assign "INT" to "BOOL".',
      'Type mismatch: Cannot assign "INT" to "STRING".',
      'Type mismatch: Cannot assign "TOD" to "TIME".',
      'Type mismatch: Cannot assign "TIME" to "TOD".',
      'Type mismatch: Cannot assign "Enum:Status" to "Enum:Mode".',
      'Type mismatch: Cannot assign "Enum:Mode" to "Enum:Status".',
      'Type mismatch: Cannot assign "Enum:Status" to "INT".',
    ];

    expectedMessages.forEach((msg) => {
      expect(diagString).toContain(msg);
    });
  });

  test("Test UseStmt errors", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(
        __dirname,
        "files",
        "invalid_usestmt",
        "control_usestmt.bcsctrl"
      ),
      services.bcsControl,
      false
    );

    const allDiagnostics = allDocs.flatMap((doc) => doc.diagnostics ?? []);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(14);
    const expectedMessages = [
      // 1. Too many inputs (duplicate key)
      "Duplicate mapping for input 'iWindow' in use of function block 'HeatingLogicFB'.",
      // 2. Missing input (iMode)
      "Function block 'HeatingLogicFB' expects 3 input arguments, but got 2.",
      // 3. Wrong input types
      "Type mismatch for input 'iWindow': expected 'BOOL', got 'REAL'.",
      "Type mismatch for input 'iMode': expected 'Enum:Mode', got 'Enum:Status'.",
      "Logical operator '||' can only be applied to BOOL operands, but got 'INT' and 'INT'.",
      "Type mismatch for input 'iTemp': expected 'REAL', got 'BOOL'.",
      // 4. Output count mismatch for single assignment
      "Function block 'LightLogicFB' has 2 outputs, cannot use direct assignment. Use mapping instead.",
      // 5. Mapping output count mismatch
      "Function block 'LightLogicFB' expects 2 outputs, but got 1.",
      "Function block 'LightLogicFB' expects 2 outputs, but got 3.",
      // 6. Output type mismatch (single)
      "Type mismatch for output 'oHeating': cannot assign to 'isHeating_should_fail_type_matching' of type 'INT', expected 'BOOL'.",
      // 7. Output type mismatch (mapping)
      "Type mismatch for mapped output 'oHeating': expected 'BOOL', got 'INT'.",
      // 8. Output mapping could not resolve
      "Could not resolve reference to VarDecl named 'oExtra'.",
      "Could not resolve reference to VarDecl named 'oWrong'.",
      // 9. Input mapping could not resolve
      "Could not resolve reference to VarDecl named 'iWrong'.",
    ];

    expectedMessages.forEach((msg) => {
      expect(diagString).toContain(msg);
    });
  });
});
