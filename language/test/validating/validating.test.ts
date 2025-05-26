import { describe, expect, test } from "vitest";
import { createBcsEngineeringServices } from "../../src/language/bcs-engineering-module.js";
import { extractDocuments } from "../../src/cli/cli-util.js";
import * as path from "node:path";
import { NodeFileSystem } from "langium/node";

// Utility to exclude hints
function getDiagnosticsWithoutHints(allDocs: any[]) {
  return allDocs
    .flatMap((doc) => doc.diagnostics ?? [])
    .filter((d) => d.severity !== 4); // 4 = Hint
}

describe("BCS Control Validation Tests", () => {
  test("No errors in valid control/hardware files", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "valid_control.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);

    expect(allDiagnostics.length).toBe(0);
  });

  test("Detect Assignment type mismatch", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "invalid", "invalid_control.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(3);

    expect(diagString).toMatch(/Cannot assign "REAL" to "BOOL"/);
  });

  test("Detect Enum type mismatch", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "invalid_enum", "control_enum.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(1);

    expect(diagString).toMatch(
      'Type mismatch: Cannot assign "ENUM:Status" to "ENUM:Mode".'
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

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(9);
    const expectedMessages = [
      'Type mismatch: Cannot assign "BOOL" to "INT".',
      'Type mismatch: Cannot assign "INT" to "BOOL".',
      'Type mismatch: Cannot assign "INT" to "STRING".',
      'Type mismatch: Cannot assign "TOD" to "TIME".',
      'Type mismatch: Cannot assign "TIME" to "TOD".',
      'Type mismatch: Cannot assign "ENUM:Status" to "ENUM:Mode".',
      'Type mismatch: Cannot assign "ENUM:Mode" to "ENUM:Status".',
      'Type mismatch: Cannot assign "ENUM:Status" to "INT".',
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

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(14);
    const expectedMessages = [
      // 1. Too many inputs (duplicate key)
      "Duplicate mapping for input 'iWindow' in use of function block 'HeatingLogicFB'.",
      // 2. Missing input (iMode)
      "Function block 'HeatingLogicFB' expects 3 input arguments, but got 2.",
      // 3. Wrong input types
      "Type mismatch for input 'iWindow': expected 'BOOL', got 'REAL'.",
      "Type mismatch for input 'iMode': expected 'ENUM:Mode', got 'ENUM:Status'.",
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

  test("Detect duplicates", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(
        __dirname,
        "files",
        "invalid_duplicate",
        "control_duplicate.bcsctrl"
      ),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(35);
    const expectedMessages = [
      "Duplicate enum 'DuplicateMode'.",
      "Duplicate struct 'DuplicateStruct'.",
      "Only one 'inputs' block allowed in function block 'DuplicateFB', found 2.",
      "Only one 'outputs' block allowed in function block 'DuplicateFB', found 2.",
      "Only one 'locals' block allowed in function block 'DuplicateFB', found 2.",
      "Only one 'logic' block allowed in function block 'DuplicateFB', found 2.",
      "Duplicate variable name 'iDuplicate' in function block 'DuplicateFB'.",
      "Duplicate variable name 'lDuplicate' in function block 'DuplicateFB'.",
      "Duplicate variable name 'oDuplicate' in function block 'DuplicateFB'.",
      "Duplicate variable name 'duplicateFBVar' in function block 'DuplicateFB'.",
      "Duplicate function block 'DuplicateFB'.",
      "Duplicate global variable 'duplicateVar'.",
      "Duplicate local var name 'duplicateUnitVar' in unit 'DuplicateUnit'.",
      "Duplicate control unit 'DuplicateUnit'.",
      "Duplicate component name 'motor' in this controller.",
      "Duplicate component name 'windowContact_duplicate' in this controller.",
    ];

    expectedMessages.forEach((msg) => {
      expect(diagString).toContain(msg);
    });
  });

  test("Test when clause", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "invalid_when", "control_when.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(1);
    const expectedMessages = [
      "Condition in 'when (...)' of unit 'Test' must be of type BOOL, but got 'REAL'.",
    ];

    expectedMessages.forEach((msg) => {
      expect(diagString).toContain(msg);
    });
  });

  test("Test switch-case stmt", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "invalid_switch", "control_switch.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(3);
    const expectedMessages = [
      "Case literal 'Status.OFF' is of type 'ENUM:Status', but switch expression is 'ENUM:Mode'.",
      "Duplicate case literal 'Mode.ECO'.",
      "Case literal 'true' is of type 'BOOL', but switch expression is 'ENUM:Mode'.",
    ];

    expectedMessages.forEach((msg) => {
      expect(diagString).toContain(msg);
    });
  });

  test("Detect Invalid Arrays", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "invalid_array", "control_array.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(47);

    const expectedErrors = [
      'Type mismatch: Cannot assign "INT" to "BOOL".',
      "Array size mismatch: expected 3 elements, but got 2.",
      'Type mismatch: Cannot assign "ARRAY<BOOL>[2]" to "ARRAY<BOOL>[3]".',
      'Type mismatch: Cannot assign "ARRAY<INT>[5][5][5]" to "ARRAY<BOOL>[5][5][5]".',
      "Array index [-1] out of bounds: allowed range is 0 to 2.",
      "Array index [2] out of bounds: allowed range is 0 to 0.",
      "Array index [3] out of bounds: allowed range is 0 to 1.",
      "Array index [4] out of bounds: allowed range is 0 to 2.",
      'Type mismatch: Cannot assign "ARRAY<BOOL>[5]" to "ARRAY<BOOL>[5][5][5]".',
      "Expected nested array with 3 dimensions.",
      'Type mismatch: Cannot assign "ARRAY<INT>[5]" to "ARRAY<INT>[5][5][5]".',
      'Type mismatch: Cannot assign "ARRAY<REAL>[5]" to "ARRAY<REAL>[5][5][5]".',
      "Expected nested array with 2 dimensions.",
      'Type mismatch: Cannot assign "ARRAY<mixed>[5]" to "ARRAY<BOOL>[5][5]".',
      'Type mismatch: Cannot assign "ARRAY<ENUM:Mode>[5]" to "ARRAY<ENUM:Mode>[5][5][5]".',
      'Type mismatch: Cannot assign "ARRAY<INT>[2]" to "ARRAY<BOOL>[2]".',
      "Array size mismatch: expected 3 elements, but got 1.",
      'Type mismatch: Cannot assign "ARRAY<BOOL>[1][3]" to "ARRAY<BOOL>[3][3]".',
      "Cannot infer type for variable initialization: invalidIndex = x",
      "Cannot infer type for variable initialization: invalidAccess = invalidScalarIndex",
      'Array index must be of type INT, but got "STRING".',
      'Type mismatch: Cannot assign "ARRAY<mixed>[2]" to "ARRAY<BOOL>[2]".',
      'Type mismatch: Cannot assign "ARRAY<mixed>[5]" to "ARRAY<BOOL>[5][5]".',
    ];

    for (const expected of expectedErrors) {
      expect(diagString).toMatch(expected);
    }
  });

  test("Detect Invalid Structs", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(__dirname, "files", "invalid_struct", "control_struct.bcsctrl"),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);
    const diagString = allDiagnostics.map((d) => d.message).join("\n");

    expect(allDiagnostics.length).toBe(13);

    const expectedErrors = [
      "Unexpected field 'f' in struct literal for 'Rectangle'.",
      "Missing field 'x' in struct literal for 'Rectangle'.",
      "Duplicate field 'y' in struct literal for 'Rectangle'.",
      "Missing field 'y' in struct literal for 'Rectangle'.",
      'Type mismatch: Cannot assign "STRUCT:Point" to "STRUCT:Rectangle".',
      "Unexpected field 'z' in struct literal for 'Rectangle'.",
      "Cannot use struct declaration 'Rectangle' as a value for input 'i'.",
    ];

    for (const expected of expectedErrors) {
      expect(diagString).toMatch(expected);
    }
  });

  test("No errors in valid library call", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    const [mainDoc, allDocs] = await extractDocuments(
      path.join(
        __dirname,
        "files",
        "valid_library_call",
        "valid_library_call_control.bcsctrl"
      ),
      services.bcsControl,
      false
    );

    const allDiagnostics = getDiagnosticsWithoutHints(allDocs);

    expect(allDiagnostics.length).toBe(0);
  });
});
