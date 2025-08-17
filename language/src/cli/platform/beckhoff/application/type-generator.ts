import { expandToNode, joinToNode, toString } from "langium/generate";
import * as fs from "node:fs";
import * as path from "node:path";
import { ExpressionConverter } from "./expression-converter.js";
import { StatementConverter } from "./statement-converter.js";
import { LoopVariableAnalyzer } from "./loop-variable-analyzer.js";
import { LocalInstanceRegistry } from "./local-instance-registry.js";
import { TypeConverter } from "./type-conversion-utils.js";
import {
  EnumDecl,
  FunctionBlockDecl,
  isOnFallingEdgeStmt,
  isOnRisingEdgeStmt,
  StructDecl,
} from "../../../../language/generated/ast.js";
import {
  getInputs,
  getLocals,
  getLogic,
  getOutputs,
} from "../../../../language/control/utils/function-block-utils.js";

/**
 * Handles writing/generation of type-related files (enums, structs, function blocks)
 */
export class TypeGenerator {
  private readonly destination: string;
  private readonly expressionConverter: ExpressionConverter;
  private readonly statementConverter: StatementConverter;

  constructor(
    destination: string,
    expressionConverter: ExpressionConverter,
    statementConverter: StatementConverter
  ) {
    this.destination = destination;
    this.expressionConverter = expressionConverter;
    this.statementConverter = statementConverter;
  }

  public writeEnum(enumDecl: EnumDecl): string {
    const filePath = path.join(
      this.destination,
      "Enums",
      `${enumDecl.name}.st`
    );

    // Ensure the Enums directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const enumContent = toString(
      expandToNode`
        {attribute 'qualified_only'}
        {attribute 'strict'}
        TYPE ${enumDecl.name} :
        (
            ${joinToNode(
              enumDecl.members.map((member, index) => ({ member, index })),
              ({ member, index }) => expandToNode`
                ${member.name} := ${index}${
                index < enumDecl.members.length - 1 ? "," : ""
              }
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        );
        END_TYPE
      `
    );

    fs.writeFileSync(filePath, enumContent);
    return filePath;
  }

  public writeStruct(structDecl: StructDecl): string {
    const filePath = path.join(
      this.destination,
      "Structs",
      `${structDecl.name}.st`
    );

    // Ensure the Structs directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const structContent = toString(
      expandToNode`
        TYPE ${structDecl.name} :
        STRUCT
            ${joinToNode(
              structDecl.fields,
              (field) => expandToNode`
                ${field.name} : ${TypeConverter.convertTypeRefToST(
                field.typeRef
              )}${
                field.init
                  ? ` := ${this.expressionConverter.emit(field.init)}`
                  : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        END_STRUCT
        END_TYPE
      `
    );

    fs.writeFileSync(filePath, structContent);
    return filePath;
  }

  public writeFunctionBlock(fbDecl: FunctionBlockDecl): string[] {
    const fbComponents = this.extractFunctionBlockComponents(fbDecl);
    const instanceData = this.collectInstanceDeclarations(fbComponents.logic);

    const declFilePath = this.writeFunctionBlockDeclaration(
      fbDecl,
      fbComponents,
      instanceData
    );
    const implFilePath = this.writeFunctionBlockImplementation(
      fbDecl,
      fbComponents.logic,
      instanceData
    );

    return [declFilePath, implFilePath];
  }

  private extractFunctionBlockComponents(fbDecl: FunctionBlockDecl) {
    const inputs = getInputs(fbDecl);
    const outputs = getOutputs(fbDecl);
    const locals = getLocals(fbDecl);
    const logic = getLogic(fbDecl);
    const loopVarsToDeclare = this.determineRequiredLoopVariables(
      locals,
      logic?.stmts ?? []
    );

    return { inputs, outputs, locals, logic, loopVarsToDeclare };
  }

  private determineRequiredLoopVariables(locals: any[], statements: any[]) {
    const allLoopVars = LoopVariableAnalyzer.collectLoopVars(statements);
    const localNames = new Set(locals.map((l) => l.name));
    return allLoopVars.filter((loopVar) => !localNames.has(loopVar.name));
  }

  private collectInstanceDeclarations(logic: any) {
    const statements = logic?.stmts ?? [];
    const { fbInstanceMap, fbAfterMap } = this.collectFBInstances(statements);

    return {
      fbInstanceMap,
      fbAfterMap,
      edgeDetectionDecls: this.extractEdgeDetectionDeclarations(fbInstanceMap),
      timerDecls: this.extractTimerDeclarations(fbAfterMap),
    };
  }

  private extractEdgeDetectionDeclarations(fbInstanceMap: Map<any, string>) {
    const declarations: Array<{ instanceName: string; fbType: string }> = [];

    for (const [stmt, instanceName] of fbInstanceMap) {
      if (isOnRisingEdgeStmt(stmt)) {
        declarations.push({ instanceName, fbType: "R_TRIG" });
      } else if (isOnFallingEdgeStmt(stmt)) {
        declarations.push({ instanceName, fbType: "F_TRIG" });
      }
    }

    return declarations;
  }

  private extractTimerDeclarations(fbAfterMap: Map<any, string>) {
    const declarations: Array<{ tonName: string; ptValue: any }> = [];

    for (const [stmt, tonName] of fbAfterMap) {
      declarations.push({ tonName, ptValue: stmt.time });
    }

    return declarations;
  }

  private writeFunctionBlockDeclaration(
    fbDecl: FunctionBlockDecl,
    components: any,
    instanceData: any
  ): string {
    const filePath = path.join(
      this.destination,
      "FunctionBlocks",
      `${fbDecl.name}_decl.st`
    );
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const content = toString(
      expandToNode`
        FUNCTION_BLOCK ${fbDecl.name}
        VAR_INPUT
            ${this.generateVariableDeclarations(components.inputs)}
        END_VAR
        VAR_OUTPUT
            ${this.generateVariableDeclarations(components.outputs)}
        END_VAR
        VAR
            ${this.generateVariableDeclarations(
              components.locals
            )}${this.generateLoopVariableDeclarations(
        components.loopVarsToDeclare
      )}${this.generateInstanceDeclarations(
        instanceData.edgeDetectionDecls,
        instanceData.timerDecls
      )}
        END_VAR
      `
    );

    fs.writeFileSync(filePath, content);
    return filePath;
  }

  private generateVariableDeclarations(variables: any[]) {
    return joinToNode(
      variables,
      (variable) => expandToNode`
        ${variable.name}: ${TypeConverter.convertTypeRefToST(
        variable.typeRef
      )}${
        variable.init
          ? ` := ${this.expressionConverter.emit(variable.init)}`
          : ""
      };
      `,
      { appendNewLineIfNotEmpty: true }
    );
  }

  private generateLoopVariableDeclarations(loopVars: any[]) {
    return joinToNode(
      loopVars,
      (loopVar) => expandToNode`
        ${loopVar.name}: ${loopVar.type}${
        loopVar.init ? ` := ${this.expressionConverter.emit(loopVar.init)}` : ""
      };
      `,
      { appendNewLineIfNotEmpty: true }
    );
  }

  private generateInstanceDeclarations(edgeDecls: any[], timerDecls: any[]) {
    const edgeDeclarations = joinToNode(
      edgeDecls,
      (decl) =>
        expandToNode`${decl.instanceName}: ${decl.fbType}; (* Function block instance *)`,
      { appendNewLineIfNotEmpty: true }
    );

    const timerDeclarations = joinToNode(
      timerDecls,
      (decl) =>
        expandToNode`${decl.tonName}: TON := (PT := ${decl.ptValue}); (* Function block instance *)`,
      { appendNewLineIfNotEmpty: true }
    );

    return expandToNode`${edgeDeclarations}${timerDeclarations}`;
  }

  private writeFunctionBlockImplementation(
    fbDecl: FunctionBlockDecl,
    logic: any,
    instanceData: any
  ): string {
    const filePath = path.join(
      this.destination,
      "FunctionBlocks",
      `${fbDecl.name}_impl.st`
    );
    const converter = this.createLocalStatementConverter(instanceData);
    const content = (logic?.stmts ?? [])
      .map((stmt: any) => converter(stmt, 0).trimEnd())
      .join("\n");

    fs.writeFileSync(filePath, content);
    return filePath;
  }

  private createLocalStatementConverter(instanceData: any) {
    const { fbInstanceMap, fbAfterMap } = instanceData;

    return (stmt: any, indent: number): string => {
      switch (stmt.$type) {
        case "OnRisingEdgeStmt":
        case "OnFallingEdgeStmt":
          return this.convertEdgeStatement(stmt, fbInstanceMap, indent);
        case "AfterStmt":
          return this.convertAfterStatement(stmt, fbAfterMap, indent);
        default:
          return this.statementConverter.emit(stmt, indent);
      }
    };
  }

  private convertEdgeStatement(
    stmt: any,
    fbInstanceMap: Map<any, string>,
    indent: number
  ): string {
    const triggerInstance = fbInstanceMap.get(stmt);
    if (!triggerInstance) return "";

    const signal = this.expressionConverter.emit(stmt.signal);
    const body = this.convertStatementBody(
      stmt.stmts,
      fbInstanceMap,
      indent + 1
    );

    return `${triggerInstance}(CLK := ${signal});\nIF ${triggerInstance}.Q THEN\n${body}\nEND_IF;`;
  }

  private convertAfterStatement(
    stmt: any,
    fbAfterMap: Map<any, string>,
    indent: number
  ): string {
    const timerInstance = fbAfterMap.get(stmt);
    if (!timerInstance) return "";

    const condition = this.expressionConverter.emit(stmt.condition);
    const body = this.convertStatementBody(stmt.stmts, fbAfterMap, indent + 1);

    return `${timerInstance}(IN := ${condition});\nIF ${timerInstance}.Q THEN\n${body}\n    ${timerInstance}(IN := FALSE);\nEND_IF`;
  }

  private convertStatementBody(
    statements: any[],
    instanceMap: Map<any, string>,
    indent: number
  ): string {
    const converter = this.createLocalStatementConverter({
      fbInstanceMap: instanceMap,
      fbAfterMap: instanceMap,
    });
    return (statements ?? []).map((s: any) => converter(s, indent)).join("\n");
  }

  // Helper method to collect function block instances recursively
  private collectFBInstances(stmts: any[]): {
    fbInstanceMap: Map<any, string>;
    fbAfterMap: Map<any, string>;
  } {
    const collector = new LocalInstanceRegistry();
    collector.collectFromStatements(stmts);
    return {
      fbInstanceMap: collector.getFBInstanceMap(),
      fbAfterMap: collector.getFBAfterMap(),
    };
  }
}
