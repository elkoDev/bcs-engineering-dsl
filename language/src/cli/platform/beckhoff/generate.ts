import * as fs from "node:fs";
import * as path from "node:path";
import {
  ControlModel,
  HardwareModel,
  isEnumDecl,
  isStructDecl,
  isFunctionBlockDecl,
} from "../../../language/generated/ast.js";
import { GenerateResult } from "../index.js";
import { ExpressionConverter } from "./application/expression-converter.js";
import { HardwareProcessor } from "./application/hardware-processor.js";
import { GlobalInstanceManager } from "./application/global-instance-manager.js";
import { MainProgramGenerator } from "./application/main-program-generator.js";
import { StatementConverter } from "./application/statement-converter.js";
import { TcConfigGenerator } from "./application/tc-config-generator.js";
import { TypeWriter } from "./application/type-writer.js";

/**
 * Main generator context that orchestrates all the sub-generators
 */
class BeckhoffGeneratorContext {
  private readonly controlModel: ControlModel;
  private readonly destination: string;
  private readonly tcConfigGenerator: TcConfigGenerator;
  private readonly instanceManager: GlobalInstanceManager;
  private readonly expressionConverter: ExpressionConverter;
  private readonly statementConverter: StatementConverter;
  private readonly typeWriter: TypeWriter;
  private readonly hardwareProcessor: HardwareProcessor;
  private readonly mainProgramGenerator: MainProgramGenerator;
  constructor(
    controlModel: ControlModel,
    hardwareModel: HardwareModel,
    destination: string
  ) {
    this.controlModel = controlModel;
    this.destination = destination;

    // Initialize all components
    this.tcConfigGenerator = new TcConfigGenerator(controlModel, hardwareModel);
    this.instanceManager = new GlobalInstanceManager(
      controlModel,
      hardwareModel
    );
    this.expressionConverter = new ExpressionConverter(new Set());
    this.statementConverter = new StatementConverter(
      this.expressionConverter,
      this.instanceManager
    );
    this.typeWriter = new TypeWriter(
      destination,
      this.expressionConverter,
      this.statementConverter
    );
    this.hardwareProcessor = new HardwareProcessor(hardwareModel);
    this.mainProgramGenerator = new MainProgramGenerator(
      controlModel,
      hardwareModel,
      destination,
      this.instanceManager,
      this.statementConverter,
      this.expressionConverter,
      this.hardwareProcessor
    );
  }

  generateBeckhoffArtifacts(): GenerateResult {
    const files: string[] = [];

    // Generate main program
    files.push(...this.mainProgramGenerator.writeProgramMain());

    // Generate types
    for (const item of this.controlModel.controlBlock.items) {
      if ("isExtern" in item && item.isExtern) continue;
      if (isEnumDecl(item)) {
        files.push(this.typeWriter.writeEnum(item));
      } else if (isStructDecl(item)) {
        files.push(this.typeWriter.writeStruct(item));
      } else if (isFunctionBlockDecl(item)) {
        files.push(...this.typeWriter.writeFunctionBlock(item));
      }
    }

    // Write tc-config.json
    const tcConfigJson = this.tcConfigGenerator.generateTcConfigJson();
    const tcConfigJsonPath = path.join(this.destination, "tc-config.json");
    fs.writeFileSync(tcConfigJsonPath, JSON.stringify(tcConfigJson, null, 2));
    files.push(tcConfigJsonPath);

    return { files };
  }
}

export function generate(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  destination: string
): GenerateResult {
  const ctx = new BeckhoffGeneratorContext(
    controlModel,
    hardwareModel,
    destination
  );
  return ctx.generateBeckhoffArtifacts();
}
