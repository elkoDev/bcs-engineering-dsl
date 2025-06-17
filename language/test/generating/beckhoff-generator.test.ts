import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { createBcsEngineeringServices } from "../../src/language/bcs-engineering-module.js";
import { extractControlModelWithHardwareModels } from "../../src/cli/cli-util.js";
import * as path from "node:path";
import { NodeFileSystem } from "langium/node";
import * as fs from "node:fs";
import { generate as genBeckhoff } from "../../src/cli/platform/beckhoff/generate.js";

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
  expect(fs.existsSync(generatedFilePath)).toBe(true);
  expect(fs.existsSync(expectedFilePath)).toBe(true);

  const generatedContent: string = fs
    .readFileSync(generatedFilePath, "utf8")
    .replace(/\r\n/g, "\n");
  const expectedContent: string = fs
    .readFileSync(expectedFilePath, "utf8")
    .replace(/\r\n/g, "\n");

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

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return { testCaseDir, inputDir, expectedDir, outputDir };
}

describe("Beckhoff Generator Tests", () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }

    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(4);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Enums", "Mode.st"),
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(6);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Structs", "Circle.st"),
      expectedFilePath: path.join(expectedDir, "Circle.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Structs", "Point.st"),
      expectedFilePath: path.join(expectedDir, "Point.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Structs", "Rectangle.st"),
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(5);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "SimpleLogicFB_decl.st"
      ),
      expectedFilePath: path.join(expectedDir, "SimpleLogicFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "SimpleLogicFB_impl.st"
      ),
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(5);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "IfLogicFB_decl.st"
      ),
      expectedFilePath: path.join(expectedDir, "IfLogicFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "IfLogicFB_impl.st"
      ),
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(3);

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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(5);

    // Check declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "ArrayTestFB_decl.st"
      ),
      expectedFilePath: path.join(expectedDir, "ArrayTestFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "ArrayTestFB_impl.st"
      ),
      expectedFilePath: path.join(expectedDir, "ArrayTestFB_impl.st"),
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(3);

    // Check declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "tc-config.json"),
      expectedFilePath: path.join(expectedDir, "tc-config.json"),
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(5);

    // Check declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "LoopsFB_decl.st"
      ),
      expectedFilePath: path.join(expectedDir, "LoopsFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "LoopsFB_impl.st"
      ),
      expectedFilePath: path.join(expectedDir, "LoopsFB_impl.st"),
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(6);

    // Check declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Enums", "OperationMode.st"),
      expectedFilePath: path.join(expectedDir, "OperationMode.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "SwitchFB_decl.st"
      ),
      expectedFilePath: path.join(expectedDir, "SwitchFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "SwitchFB_impl.st"
      ),
      expectedFilePath: path.join(expectedDir, "SwitchFB_impl.st"),
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
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(6);

    // Check declaration and implementation files
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "Enums", "ProcessState.st"),
      expectedFilePath: path.join(expectedDir, "ProcessState.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "NestedControlsFB_decl.st"
      ),
      expectedFilePath: path.join(expectedDir, "NestedControlsFB_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(
        outputDir,
        "FunctionBlocks",
        "NestedControlsFB_impl.st"
      ),
      expectedFilePath: path.join(expectedDir, "NestedControlsFB_impl.st"),
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

  test("Generate library call correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "library_call_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "library_call_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(3);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate scheduled and conditional units correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "when_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "when_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const generateResult = genBeckhoff(
      controlModel,
      hardwareModels[0],
      outputDir
    );

    expect(generateResult.files.length).toBe(3);

    // Compare each expected file with the generated file
    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_decl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_decl.st"),
    });

    compareGeneratedWithExpected({
      generatedFilePath: path.join(outputDir, "MAIN_impl.st"),
      expectedFilePath: path.join(expectedDir, "MAIN_impl.st"),
    });
  });

  test("Generate after units correctly", async () => {
    const services = createBcsEngineeringServices(NodeFileSystem);

    // Test case directories
    const testCaseName = "after_test";
    const { inputDir, expectedDir, outputDir } =
      setupTestDirectories(testCaseName);

    // Parse the test files
    const [controlModel, hardwareModels] =
      await extractControlModelWithHardwareModels(
        path.join(inputDir, "after_test.bcsctrl"),
        services.bcsControl
      );

    // Generate code
    const generateResult = genBeckhoff(controlModel, hardwareModels[0], outputDir);

    expect(generateResult.files.length).toBe(3);

    // Compare each expected file with the generated file
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
