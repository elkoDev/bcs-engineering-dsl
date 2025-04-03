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

  test("Detect type mismatch between REAL and BOOL", async () => {
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
});
