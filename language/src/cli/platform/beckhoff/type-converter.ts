import {
  TypeRef,
  isPrimary,
  EnumDecl,
  StructDecl,
  FunctionBlockDecl,
  Expr,
} from "../../../language/generated/ast.js";
import { expandToNode, joinToNode, toString } from "langium/generate";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getInputs,
  getOutputs,
  getLocals,
  getLogic,
} from "../../../language/control/utils/function-block-utils.js";

/**
 * Converts TypeRef to Structured Text type notation
 */
export function convertTypeRefToST(typeRef: TypeRef): string {
  if (typeRef.type) {
    if (typeRef.sizes.length === 0) {
      return typeRef.type;
    } else {
      return `ARRAY [${typeRef.sizes
        .map((size) => {
          if (isPrimary(size) && typeof size.val === "number") {
            return `0..${size.val - 1}`;
          }
          return "0..?";
        })
        .join(", ")}] OF ${typeRef.type}`;
    }
  } else if (typeRef.ref) {
    const typeDecl = typeRef.ref.ref;
    const typeName = typeDecl && "name" in typeDecl ? typeDecl.name : "UNKNOWN";
    if (typeRef.sizes.length === 0) {
      return typeName as string;
    } else {
      return `ARRAY [${typeRef.sizes
        .map((size) => {
          if (isPrimary(size) && typeof size.val === "number") {
            return `0..${size.val - 1}`;
          }
          return "0..?";
        })
        .join(", ")}] OF ${typeName}`;
    }
  }
  return "UNKNOWN_TYPE";
}

/**
 * Handles generation of enums, structs, and function blocks
 */
export class TypeConverter {
  private readonly destination: string;
  private readonly convertExprToST: (expr: Expr) => string;
  private readonly collectLoopVars: (
    stmts: any[],
    found: Map<string, { type: string; init?: Expr }>
  ) => void;
  private readonly convertStatementToST: (stmt: any, indent?: number) => string;

  constructor(
    destination: string,
    convertExprToST: (expr: Expr) => string,
    collectLoopVars: (
      stmts: any[],
      found: Map<string, { type: string; init?: Expr }>
    ) => void,
    convertStatementToST: (stmt: any, indent?: number) => string
  ) {
    this.destination = destination;
    this.convertExprToST = convertExprToST;
    this.collectLoopVars = collectLoopVars;
    this.convertStatementToST = convertStatementToST;
  }

  writeEnum(enumDecl: EnumDecl): string {
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

  writeStruct(structDecl: StructDecl): string {
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
                ${field.name} : ${convertTypeRefToST(field.typeRef)}${
                field.init ? ` := ${this.convertExprToST(field.init)}` : ""
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

  writeFunctionBlock(fbDecl: FunctionBlockDecl): string[] {
    const files: string[] = [];

    // Get the different parts of the function block
    const inputs = getInputs(fbDecl);
    const outputs = getOutputs(fbDecl);
    const locals = getLocals(fbDecl);
    const logic = getLogic(fbDecl);

    // Collect all loop variables from the logic block
    const loopVars = new Map<string, { type: string; init?: Expr }>();
    this.collectLoopVars(logic?.stmts ?? [], loopVars);
    // Filter out loop vars already declared as locals
    const localNames = new Set(locals.map((l) => l.name));
    const loopVarsToDeclare = Array.from(loopVars.entries()).filter(
      ([name]) => !localNames.has(name)
    );

    // Write declaration file
    const declFilePath = path.join(
      this.destination,
      "FunctionBlocks",
      `${fbDecl.name}_decl.st`
    );
    // Ensure the FunctionBlocks directory exists
    fs.mkdirSync(path.dirname(declFilePath), { recursive: true });
    const declContent = toString(
      expandToNode`
        FUNCTION_BLOCK ${fbDecl.name}
        VAR_INPUT
            ${joinToNode(
              inputs,
              (input) => expandToNode`
                ${input.name}: ${convertTypeRefToST(input.typeRef)}${
                input.init ? ` := ${this.convertExprToST(input.init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        END_VAR
        VAR_OUTPUT
            ${joinToNode(
              outputs,
              (output) => expandToNode`
                ${output.name}: ${convertTypeRefToST(output.typeRef)}${
                output.init ? ` := ${this.convertExprToST(output.init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        END_VAR
        VAR
            ${joinToNode(
              locals,
              (local) => expandToNode`
                ${local.name}: ${convertTypeRefToST(local.typeRef)}${
                local.init ? ` := ${this.convertExprToST(local.init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              loopVarsToDeclare,
              ([name, { type, init }]) => expandToNode`
                ${name}: ${type}${
                init ? ` := ${this.convertExprToST(init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        END_VAR
      `
    );
    fs.writeFileSync(declFilePath, declContent);
    files.push(declFilePath);

    // Write implementation file
    const implFilePath = path.join(
      this.destination,
      "FunctionBlocks",
      `${fbDecl.name}_impl.st`
    );
    const implContent = (logic?.stmts || [])
      .map((stmt) => this.convertStatementToST(stmt, 0).trimEnd())
      .join("\n");
    fs.writeFileSync(implFilePath, implContent);
    files.push(implFilePath);

    return files;
  }
}
