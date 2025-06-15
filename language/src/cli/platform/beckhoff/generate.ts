import {
  ControlModel,
  isEnumDecl,
  isFunctionBlockDecl,
  isStructDecl,
  HardwareModel,
} from "../../../language/generated/ast.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { TcConfigGenerator } from "./config-generator.js";
import { TypeConverter } from "./type-converter.js";
import { ExpressionConverter } from "./expression-converter.js";
import { StatementConverter } from "./statement-converter.js";
import { InstanceManager } from "./instance-manager.js";
import { HardwareProcessor } from "./hardware-processor.js";
import { MainProgramGenerator } from "./main-program-generator.js";
import { GenerateResult } from "../index.js";

/**
 * Main generator context that orchestrates all the sub-generators
 */
class BeckhoffGeneratorContext {
  private readonly controlModel: ControlModel;
  private readonly destination: string;
  private readonly tcConfigGenerator: TcConfigGenerator;
  private readonly instanceManager: InstanceManager;
  private readonly expressionConverter: ExpressionConverter;
  private readonly statementConverter: StatementConverter;
  private readonly typeConverter: TypeConverter;
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
    this.instanceManager = new InstanceManager(controlModel, hardwareModel);
    this.expressionConverter = new ExpressionConverter(new Set());
    this.statementConverter = new StatementConverter(
      this.expressionConverter,
      this.instanceManager
    );
    this.typeConverter = new TypeConverter(
      destination,
      this.expressionConverter.convertExprToST.bind(this.expressionConverter),
      this.statementConverter.collectLoopVars.bind(this.statementConverter),
      this.statementConverter.convertStatementToST.bind(this.statementConverter)
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
        files.push(this.typeConverter.writeEnum(item));
      } else if (isStructDecl(item)) {
        files.push(this.typeConverter.writeStruct(item));
      } else if (isFunctionBlockDecl(item)) {
        files.push(...this.typeConverter.writeFunctionBlock(item));
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
