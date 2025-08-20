import { expandToNode, joinToNode, toString } from "langium/generate";
import * as fs from "node:fs";
import * as path from "node:path";
import { ExpressionConverter } from "./expression-converter.js";
import { StatementConverter } from "./statement-converter.js";
import { LoopVariableAnalyzer } from "./loop-variable-analyzer.js";
import { LocalInstanceRegistry } from "./local-instance-registry.js";
import { TypeRefConverter } from "./type-ref-converter.js";
import {
  AfterStmt,
  EnumDecl,
  FunctionBlockDecl,
  FunctionBlockLogic,
  isOnFallingEdgeStmt,
  isOnRisingEdgeStmt,
  Statement,
  StructDecl,
  VarDecl,
} from "../../../../language/generated/ast.js";
import {
  getInputs,
  getLocals,
  getLogic,
  getOutputs,
} from "../../../../language/control/utils/function-block-utils.js";
import {
  AfterStmtInstanceInfo,
  EdgeStmtInstanceInfo,
  UseStmtInstanceInfo,
} from "../models/types.js";

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
                ${field.name} : ${TypeRefConverter.emit(field.typeRef)}${
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

  private determineRequiredLoopVariables(
    locals: VarDecl[],
    statements: Statement[]
  ) {
    const allLoopVars = LoopVariableAnalyzer.collectLoopVars(statements);
    const localNames = new Set(locals.map((l) => l.name));
    return allLoopVars.filter((loopVar) => !localNames.has(loopVar.name));
  }

  private collectInstanceDeclarations(logic: any) {
    const statements = logic?.stmts ?? [];
    const { edgeStmtInstanceMap, afterStmtInstanceMap, useStmtInstanceMap } =
      this.collectFBInstances(statements);

    return {
      edgeStmtInstanceMap,
      afterStmtInstanceMap,
      useStmtInstanceMap,
      edgeDetectionDecls:
        this.extractEdgeDetectionDeclarations(edgeStmtInstanceMap),
      timerDecls: this.extractTimerDeclarations(afterStmtInstanceMap),
      useDecls: this.extractUseDeclarations(useStmtInstanceMap),
    };
  }

  private extractEdgeDetectionDeclarations(
    edgeStmtInstanceMap: Map<any, EdgeStmtInstanceInfo>
  ) {
    const declarations: Array<{ instanceName: string; fbType: string }> = [];

    for (const [stmt, instanceInfo] of edgeStmtInstanceMap) {
      if (isOnRisingEdgeStmt(stmt)) {
        declarations.push({
          instanceName: instanceInfo.instanceName,
          fbType: "R_TRIG",
        });
      } else if (isOnFallingEdgeStmt(stmt)) {
        declarations.push({
          instanceName: instanceInfo.instanceName,
          fbType: "F_TRIG",
        });
      }
    }

    return declarations;
  }

  private extractTimerDeclarations(
    fbAfterMap: Map<any, AfterStmtInstanceInfo>
  ): Array<AfterStmtInstanceInfo> {
    const declarations: Array<AfterStmtInstanceInfo> = [];
    for (const [, afterStmtInfo] of fbAfterMap) {
      declarations.push(afterStmtInfo);
    }

    return declarations;
  }

  private extractUseDeclarations(
    useStmtInstanceMap: Map<any, UseStmtInstanceInfo>
  ) {
    const declarations: Array<{ instanceName: string; fbType: string }> = [];

    for (const [, instanceInfo] of useStmtInstanceMap) {
      declarations.push({
        instanceName: instanceInfo.instanceName,
        fbType: instanceInfo.fbType,
      });
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
        instanceData.timerDecls,
        instanceData.useDecls
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
        ${variable.name}: ${TypeRefConverter.emit(variable.typeRef)}${
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

  private generateInstanceDeclarations(
    edgeDecls: any[],
    afterDecls: any[],
    useDecls: any[]
  ) {
    const edgeDeclarations = joinToNode(
      edgeDecls,
      (decl) =>
        expandToNode`${decl.instanceName}: ${decl.fbType}; (* Function block instance *)`,
      { appendNewLineIfNotEmpty: true }
    );

    const afterDeclarations = joinToNode(
      afterDecls,
      (decl) =>
        expandToNode`${decl.tonName}: TON := (PT := ${decl.ptValue});
${decl.triggerName}: R_TRIG;`,
      { appendNewLineIfNotEmpty: true }
    );

    const useDeclarations = joinToNode(
      useDecls,
      (decl) =>
        expandToNode`${decl.instanceName}: ${decl.fbType}; (* Function block instance *)`,
      { appendNewLineIfNotEmpty: true }
    );

    return expandToNode`${edgeDeclarations}${afterDeclarations}${useDeclarations}`;
  }

  private writeFunctionBlockImplementation(
    fbDecl: FunctionBlockDecl,
    logic: FunctionBlockLogic | undefined,
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
    const { edgeStmtInstanceMap, afterStmtInstanceMap, useStmtInstanceMap } =
      instanceData;

    return (stmt: any, indent: number): string => {
      switch (stmt.$type) {
        case "OnRisingEdgeStmt":
        case "OnFallingEdgeStmt":
          return this.convertEdgeStatement(stmt, edgeStmtInstanceMap, indent);
        case "AfterStmt":
          return this.convertAfterStatement(stmt, afterStmtInstanceMap, indent);
        case "UseStmt":
          return this.convertUseStatement(stmt, useStmtInstanceMap, indent);
        default:
          return this.statementConverter.emit(stmt, indent);
      }
    };
  }

  private convertEdgeStatement(
    stmt: any,
    edgeStmtInstanceMap: Map<any, EdgeStmtInstanceInfo>,
    indent: number
  ): string {
    const instanceInfo = edgeStmtInstanceMap.get(stmt);
    if (!instanceInfo) return "";

    const signal = this.expressionConverter.emit(stmt.signal);
    // Correctly pass down the full context for recursion
    const body = this.convertStatementBody(
      stmt.stmts,
      {
        edgeStmtInstanceMap,
        afterStmtInstanceMap: new Map(),
        useStmtInstanceMap: new Map(),
      },
      indent + 1
    );

    let out = `${this.pad(indent)}${
      instanceInfo.instanceName
    }(CLK := ${signal});\n`;
    out += `${this.pad(indent)}IF ${instanceInfo.instanceName}.Q THEN\n`;
    out += `${body}\n`;
    out += `${this.pad(indent)}END_IF;`;
    return out;
  }

  private convertAfterStatement(
    stmt: AfterStmt,
    afterStmtInstanceMap: Map<any, AfterStmtInstanceInfo>,
    indent: number
  ): string {
    const instanceInfo = afterStmtInstanceMap.get(stmt);
    if (!instanceInfo) return "";
    const { tonName, triggerName } = instanceInfo;

    const condition = this.expressionConverter.emit(stmt.condition);
    // Correctly pass down the full context for recursion
    const body = this.convertStatementBody(
      stmt.stmts,
      {
        edgeStmtInstanceMap: new Map(),
        afterStmtInstanceMap,
        useStmtInstanceMap: new Map(),
      },
      indent + 1
    );

    let out = `${this.pad(indent)}${tonName}(IN := ${condition});\n`;
    out += `${this.pad(indent)}${triggerName}(CLK := ${tonName}.Q);\n`;
    out += `${this.pad(indent)}IF ${triggerName}.Q THEN\n`;
    out += `${body}\n`;
    out += `${this.pad(indent)}END_IF;`;

    return out;
  }

  private convertUseStatement(
    stmt: any,
    useStmtInstanceMap: Map<any, UseStmtInstanceInfo>,
    indent: number
  ): string {
    throw Error("Use statements are not yet implemented in TypeGenerator");
  }

  private convertStatementBody(
    statements: any[],
    instanceData: {
      edgeStmtInstanceMap: Map<any, EdgeStmtInstanceInfo>;
      afterStmtInstanceMap: Map<any, AfterStmtInstanceInfo>;
      useStmtInstanceMap: Map<any, UseStmtInstanceInfo>;
    },
    indent: number
  ): string {
    const converter = this.createLocalStatementConverter(instanceData);
    return (statements ?? []).map((s: any) => converter(s, indent)).join("\n");
  }

  // Helper method to collect function block instances recursively
  private collectFBInstances(stmts: any[]): {
    edgeStmtInstanceMap: Map<Statement, EdgeStmtInstanceInfo>;
    afterStmtInstanceMap: Map<Statement, AfterStmtInstanceInfo>;
    useStmtInstanceMap: Map<Statement, UseStmtInstanceInfo>;
  } {
    const collector = new LocalInstanceRegistry();
    collector.collectFromStatements(stmts);
    return {
      edgeStmtInstanceMap: collector.getEdgeStmtInstanceMap(),
      afterStmtInstanceMap: collector.getAfterStmtInstanceMap(),
      useStmtInstanceMap: collector.getUseStmtInstanceMap(),
    };
  }

  private pad(level: number): string {
    return "    ".repeat(level);
  }
}
