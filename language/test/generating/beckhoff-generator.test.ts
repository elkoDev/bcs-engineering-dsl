import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { createBcsEngineeringServices } from "../../src/language/bcs-engineering-module.js";
import { extractControlModelWithHardwareModels } from "../../src/cli/cli-util.js";
import * as path from "node:path";
import { NodeFileSystem } from "langium/node";
import * as fs from "node:fs";
import { generateBeckhoffCode } from "../../src/cli/beckhoff/beckhoff-generator.js";

// Directory for temporary output files during tests
const TEST_OUTPUT_DIR = path.join(__dirname, "output");
const TEST_DIR = path.join(__dirname);

/**
 * Compares a generated file with an expected file
 */
interface CompareFilePaths {
  generatedFilePath: string;
  expectedFilePath: string;
}

function compareGeneratedWithExpected({
  generatedFilePath,
  expectedFilePath,
}: CompareFilePaths): void {
  // Check file exists
  expect(fs.existsSync(generatedFilePath)).toBe(true);
  expect(fs.existsSync(expectedFilePath)).toBe(true);

  // Compare file contents (normalize line endings)
  const generatedContent: string = fs
    .readFileSync(generatedFilePath, "utf8")
    .replace(/\r\n/g, "\n");
  const expectedContent: string = fs
    .readFileSync(expectedFilePath, "utf8")
    .replace(/\r\n/g, "\n");

  // This provides more detailed error messages when content doesn't match
  expect(generatedContent).toBe(expectedContent);
}

/**
 * Ensures test case directories exist
 */
function setupTestDirectories(testCaseName: string): {
  testCaseDir: string;
  inputDir: string;
  expectedDir: string;
  outputDir: string;
} {
  const testCaseDir = path.join(TEST_DIR, testCaseName);
  const inputDir = path.join(testCaseDir, "input");
  const expectedDir = path.join(testCaseDir, "expected");
  const outputDir = path.join(TEST_OUTPUT_DIR, testCaseName);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return { testCaseDir, inputDir, expectedDir, outputDir };
}

describe("Beckhoff Generator Tests", () => {
  // Create output directory before tests
  beforeAll(() => {
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }

    // Create tests directory structure if it doesn't exist
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  // Clean up output directory after tests
  afterAll(() => {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      //fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  test("Generate enum correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "enum_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "enum_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    // Verify the generated files
    expect(Object.keys(result.csharpStrings).length).toBe(2);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Mode.st"),
      expectedFilePath: path.join(expectedDir, "Mode.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate struct correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "struct_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "struct_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(Object.keys(result.csharpStrings).length).toBe(4);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Circle.st"),
      expectedFilePath: path.join(expectedDir, "Circle.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Point.st"),
      expectedFilePath: path.join(expectedDir, "Point.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Rectangle.st"),
      expectedFilePath: path.join(expectedDir, "Rectangle.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate function block correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "functionblock_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "functionblock_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(Object.keys(result.csharpStrings).length).toBe(2);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "SimpleLogicFB_decl.st"),
      expectedFilePath: path.join(expectedDir, "SimpleLogicFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "SimpleLogicFB_impl.st"),
      expectedFilePath: path.join(expectedDir, "SimpleLogicFB_impl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate logic with if statement correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "if_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "if_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(Object.keys(result.csharpStrings).length).toBe(2);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "IfLogicFB_decl.st"),
      expectedFilePath: path.join(expectedDir, "IfLogicFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "IfLogicFB_impl.st"),
      expectedFilePath: path.join(expectedDir, "IfLogicFB_impl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate edge detection correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "edge_detection_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "edge_detection_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    // Check declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate arrays correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "array_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "array_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    // Check array declaration and implementation
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "ArrayTestFB_decl.st"),
      expectedFilePath: path.join(expectedDir, "ArrayTestFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "ArrayTestFB_impl.st"),
      expectedFilePath: path.join(expectedDir, "ArrayTestFB_impl.st"),
    });
  });

  test("Generate hardware IO mappings correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "hardware_io_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "hardware_io_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    // Check MAIN declaration
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    // Check MAIN implementation
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate loop statements correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "loop_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "loop_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    // Verify the FB declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "LoopsFB_decl.st"),
      expectedFilePath: path.join(expectedDir, "LoopsFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "LoopsFB_impl.st"),
      expectedFilePath: path.join(expectedDir, "LoopsFB_impl.st"),
    });

    // Verify MAIN declaration and implementation
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate switch statements correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "switch_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "switch_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    // Verify the enum file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "OperationMode.st"),
      expectedFilePath: path.join(expectedDir, "OperationMode.st"),
    });

    // Verify the FB declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "SwitchFB_decl.st"),
      expectedFilePath: path.join(expectedDir, "SwitchFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "SwitchFB_impl.st"),
      expectedFilePath: path.join(expectedDir, "SwitchFB_impl.st"),
    });

    // Verify MAIN declaration and implementation
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate nested control structures correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "nested_control_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "nested_control_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const result = generateBeckhoffCode(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    // Verify the enum file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "ProcessState.st"),
      expectedFilePath: path.join(expectedDir, "ProcessState.st"),
    });

    // Verify the FB declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "NestedControlsFB_decl.st"),
      expectedFilePath: path.join(expectedDir, "NestedControlsFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "NestedControlsFB_impl.st"),
      expectedFilePath: path.join(expectedDir, "NestedControlsFB_impl.st"),
    });

    // Verify MAIN declaration and implementation
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });
});
