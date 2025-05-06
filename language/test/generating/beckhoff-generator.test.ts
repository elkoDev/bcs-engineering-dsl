import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { createBcsEngineeringServices } from "../../src/language/bcs-engineering-module.js";
import { extractDocuments } from "../../src/cli/cli-util.js";
import * as path from "node:path";
import { NodeFileSystem } from "langium/node";
import * as fs from "node:fs";
import { generateBeckhoffCode } from "../../src/cli/beckhoff/beckhoff-generator.js";

// Directory for temporary output files during tests
const TEST_OUTPUT_DIR = path.join(__dirname, "output");
const TEST_DIR = path.join(__dirname, "tests");

/**
 * Compares a generated file with an expected file
 */
interface CompareFilePaths {
  generatedFilePath: string;
  expectedFilePath: string;
}

function compareGeneratedWithExpected({ generatedFilePath, expectedFilePath }: CompareFilePaths): void {
  // Check file exists
  expect(fs.existsSync(generatedFilePath)).toBe(true);
  expect(fs.existsSync(expectedFilePath)).toBe(true);
  
  // Compare file contents (normalize line endings)
  const generatedContent: string = fs.readFileSync(generatedFilePath, "utf8").replace(/\r\n/g, "\n");
  const expectedContent: string = fs.readFileSync(expectedFilePath, "utf8").replace(/\r\n/g, "\n");
  
  // This provides more detailed error messages when content doesn't match
  expect(generatedContent).toBe(expectedContent);
}

describe("Beckhoff Generator Tests", () => {
  // Create output directory before tests
  beforeAll(() => {
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  // Clean up output directory after tests
  afterAll(() => {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  test("Generate enum correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "enum_test";
    const testCaseDir = path.join(TEST_DIR, testCaseName);
    const inputDir = path.join(testCaseDir, "input");
    const expectedDir = path.join(testCaseDir, "expected");
    const outputDir = path.join(TEST_OUTPUT_DIR, testCaseName);
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Parse the test files
    const [controlDoc, allControlDocs] = await extractDocuments(
      path.join(inputDir, "enum_test.bcsctrl"),
      services.bcsControl,
      false
    );

    const [hardwareDoc, allHardwareDocs] = await extractDocuments(
      path.join(inputDir, "enum_test.bcshw"),
      services.bcsHardware,
      false
    );

    // Generate code
    const result = generateBeckhoffCode(
      controlDoc.parseResult.value,
      hardwareDoc.parseResult.value,
      outputDir
    );

    // Verify the generated files
    expect(result.files.length).toBeGreaterThan(0);
    
    // Compare each expected file with the generated file
    // Mode.st
    compareGeneratedWithExpected(
      path.join(outputDir, "Mode.st"),
      path.join(expectedDir, "Mode.st")
    );
    
    // MAIN_decl.st
    compareGeneratedWithExpected(
      path.join(outputDir, "MAIN_decl.st"),
      path.join(expectedDir, "MAIN_decl.st")
    );
    
    // MAIN_impl.st
    compareGeneratedWithExpected(
      path.join(outputDir, "MAIN_impl.st"),
      path.join(expectedDir, "MAIN_impl.st")
    );
  });

  // TODO: Update other tests to use the new structure with input/expected files
  // The struct test, function block test, if test, edge detection test, etc.
  
  test("Generate struct correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Parse the test files
    const [controlDoc, allControlDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "struct_test.bcsctrl"),
      services.bcsControl,
      false
    );

    const [hardwareDoc, allHardwareDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "struct_test.bcshw"),
      services.bcsHardware,
      false
    );

    // Generate code
    const outputDir = path.join(TEST_OUTPUT_DIR, "struct_test");
    const result = generateBeckhoffCode(
      controlDoc.parseResult.value,
      hardwareDoc.parseResult.value,
      outputDir
    );

    // Verify Point.st was generated
    const pointFilePath = path.join(outputDir, "Point.st");
    expect(fs.existsSync(pointFilePath)).toBe(true);
    
    // Check content of Point.st
    const pointContent = fs.readFileSync(pointFilePath, "utf8");
    expect(pointContent).toContain("TYPE Point :");
    expect(pointContent).toContain("STRUCT");
    expect(pointContent).toContain("x : INT;");
    expect(fbDeclContent).toContain("VAR_INPUT");
    expect(fbDeclContent).toContain("iInput: BOOL;");
    expect(fbDeclContent).toContain("END_VAR");
    expect(fbDeclContent).toContain("VAR_OUTPUT");
    expect(fbDeclContent).toContain("oOutput: BOOL;");
    expect(fbDeclContent).toContain("END_VAR");
    
    // Verify SimpleLogicFB_impl.st was generated
    const fbImplFilePath = path.join(outputDir, "SimpleLogicFB_impl.st");
    expect(fs.existsSync(fbImplFilePath)).toBe(true);
    
    // Check content of SimpleLogicFB_impl.st
    const fbImplContent = fs.readFileSync(fbImplFilePath, "utf8");
    expect(fbImplContent).toContain("oOutput := iInput;");
  });

  test("Generate logic with if statement correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Parse the test files
    const [controlDoc, allControlDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "if_test.bcsctrl"),
      services.bcsControl,
      false
    );

    const [hardwareDoc, allHardwareDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "if_test.bcshw"),
      services.bcsHardware,
      false
    );

    // Generate code
    const outputDir = path.join(TEST_OUTPUT_DIR, "if_test");
    const result = generateBeckhoffCode(
      controlDoc.parseResult.value,
      hardwareDoc.parseResult.value,
      outputDir
    );

    // Check implementation file
    const implFilePath = path.join(outputDir, "IfLogicFB_impl.st");
    expect(fs.existsSync(implFilePath)).toBe(true);
    
    const implContent = fs.readFileSync(implFilePath, "utf8");
    expect(implContent).toContain("IF iCondition THEN");
    expect(implContent).toContain("oResult := TRUE;");
    expect(implContent).toContain("ELSE");
    expect(implContent).toContain("oResult := FALSE;");
    expect(implContent).toContain("END_IF;");
  });

  test("Generate edge detection correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Parse the test files
    const [controlDoc, allControlDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "edge_detection_test.bcsctrl"),
      services.bcsControl,
      false
    );

    const [hardwareDoc, allHardwareDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "edge_detection_test.bcshw"),
      services.bcsHardware,
      false
    );

    // Generate code
    const outputDir = path.join(TEST_OUTPUT_DIR, "edge_detection_test");
    const result = generateBeckhoffCode(
      controlDoc.parseResult.value,
      hardwareDoc.parseResult.value,
      outputDir
    );

    // Check MAIN_decl.st contains R_TRIG/F_TRIG instances
    const declFilePath = path.join(outputDir, "MAIN_decl.st");
    expect(fs.existsSync(declFilePath)).toBe(true);
    
    const declContent = fs.readFileSync(declFilePath, "utf8");
    expect(declContent).toContain("R_TRIG_");
    expect(declContent).toContain("F_TRIG_");
    
    // Check implementation contains edge detection code
    const implFilePath = path.join(outputDir, "MAIN_impl.st");
    expect(fs.existsSync(implFilePath)).toBe(true);
    
    const implContent = fs.readFileSync(implFilePath, "utf8");
    expect(implContent).toContain("// Rising edge detection");
    expect(implContent).toContain("(CLK := ");
    expect(implContent).toContain("IF ");
    expect(implContent).toContain(".Q THEN");
  });

  test("Generate arrays correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Parse the test files
    const [controlDoc, allControlDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "array_test.bcsctrl"),
      services.bcsControl,
      false
    );

    const [hardwareDoc, allHardwareDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "array_test.bcshw"),
      services.bcsHardware,
      false
    );

    // Generate code
    const outputDir = path.join(TEST_OUTPUT_DIR, "array_test");
    const result = generateBeckhoffCode(
      controlDoc.parseResult.value,
      hardwareDoc.parseResult.value,
      outputDir
    );

    // Check array declaration and initialization
    const fbDeclFilePath = path.join(outputDir, "ArrayTestFB_decl.st");
    expect(fs.existsSync(fbDeclFilePath)).toBe(true);
    
    const fbDeclContent = fs.readFileSync(fbDeclFilePath, "utf8");
    expect(fbDeclContent).toContain("ARRAY [0..4] OF INT");
    expect(fbDeclContent).toContain("ARRAY [0..2, 0..3] OF BOOL");
    
    // Check array access in implementation
    const fbImplFilePath = path.join(outputDir, "ArrayTestFB_impl.st");
    expect(fs.existsSync(fbImplFilePath)).toBe(true);
    
    const fbImplContent = fs.readFileSync(fbImplFilePath, "utf8");
    expect(fbImplContent).toContain("array1D[0]");
    expect(fbImplContent).toContain("array2D[1, 2]");
  });

  test("Generate hardware IO mappings correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Parse the test files
    const [controlDoc, allControlDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "hardware_io_test.bcsctrl"),
      services.bcsControl,
      false
    );

    const [hardwareDoc, allHardwareDocs] = await extractDocuments(
      path.join(__dirname, "files", "valid", "hardware_io_test.bcshw"),
      services.bcsHardware,
      false
    );

    // Generate code
    const outputDir = path.join(TEST_OUTPUT_DIR, "hardware_io_test");
    const result = generateBeckhoffCode(
      controlDoc.parseResult.value,
      hardwareDoc.parseResult.value,
      outputDir
    );

    // Check MAIN contains hardware I/O declarations
    const mainDeclFilePath = path.join(outputDir, "MAIN_decl.st");
    expect(fs.existsSync(mainDeclFilePath)).toBe(true);
    
    const mainDeclContent = fs.readFileSync(mainDeclFilePath, "utf8");
    expect(mainDeclContent).toContain("VAR_INPUT");
    expect(mainDeclContent).toContain("AT %I");  // Input variable binding
    expect(mainDeclContent).toContain("VAR_OUTPUT");
    expect(mainDeclContent).toContain("AT %Q");  // Output variable binding
  });
});