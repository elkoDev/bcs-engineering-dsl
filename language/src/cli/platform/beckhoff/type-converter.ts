import {
  TypeRef,
  isPrimary,
  EnumDecl,
  StructDecl,
  FunctionBlockDecl,
  Expr,
  isOnRisingEdgeStmt,
  isOnFallingEdgeStmt,
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
  // Helper method to collect function block instances recursively
  private collectFBInstances(
    stmts: any[],
    fbInstanceMap: Map<any, string>,
    fbAfterMap: Map<any, string>,
    rTrigCounter: { value: number },
    fTrigCounter: { value: number },
    tonCounter: { value: number }
  ): void {
    for (const stmt of stmts) {
      switch (stmt.$type) {
        case "OnRisingEdgeStmt": {
          if (!fbInstanceMap.has(stmt)) {
            fbInstanceMap.set(stmt, `r_TRIGInstance${rTrigCounter.value++}`);
          }
          this.collectFBInstances(
            stmt.stmts ?? [],
            fbInstanceMap,
            fbAfterMap,
            rTrigCounter,
            fTrigCounter,
            tonCounter
          );
          break;
        }
        case "OnFallingEdgeStmt": {
          if (!fbInstanceMap.has(stmt)) {
            fbInstanceMap.set(stmt, `f_TRIGInstance${fTrigCounter.value++}`);
          }
          this.collectFBInstances(
            stmt.stmts ?? [],
            fbInstanceMap,
            fbAfterMap,
            rTrigCounter,
            fTrigCounter,
            tonCounter
          );
          break;
        }
        case "AfterStmt": {
          if (!fbAfterMap.has(stmt)) {
            fbAfterMap.set(stmt, `tonAfter${tonCounter.value++}`);
          }
          this.collectFBInstances(
            stmt.stmts ?? [],
            fbInstanceMap,
            fbAfterMap,
            rTrigCounter,
            fTrigCounter,
            tonCounter
          );
          break;
        }
        case "IfStmt": {
          this.collectFBInstances(
            stmt.stmts ?? [],
            fbInstanceMap,
            fbAfterMap,
            rTrigCounter,
            fTrigCounter,
            tonCounter
          );
          for (const elseIf of stmt.elseIfStmts ?? []) {
            this.collectFBInstances(
              elseIf.stmts ?? [],
              fbInstanceMap,
              fbAfterMap,
              rTrigCounter,
              fTrigCounter,
              tonCounter
            );
          }
          if (stmt.elseStmt) {
            this.collectFBInstances(
              stmt.elseStmt.stmts ?? [],
              fbInstanceMap,
              fbAfterMap,
              rTrigCounter,
              fTrigCounter,
              tonCounter
            );
          }
          break;
        }
        case "WhileStmt":
        case "ForStmt": {
          this.collectFBInstances(
            stmt.stmts ?? [],
            fbInstanceMap,
            fbAfterMap,
            rTrigCounter,
            fTrigCounter,
            tonCounter
          );
          break;
        }
        case "SwitchStmt": {
          for (const c of stmt.cases ?? []) {
            this.collectFBInstances(
              c.stmts ?? [],
              fbInstanceMap,
              fbAfterMap,
              rTrigCounter,
              fTrigCounter,
              tonCounter
            );
          }
          if (stmt.default) {
            this.collectFBInstances(
              stmt.default.stmts ?? [],
              fbInstanceMap,
              fbAfterMap,
              rTrigCounter,
              fTrigCounter,
              tonCounter
            );
          }
          break;
        }
        default: {
          if (stmt.stmts) {
            this.collectFBInstances(
              stmt.stmts,
              fbInstanceMap,
              fbAfterMap,
              rTrigCounter,
              fTrigCounter,
              tonCounter
            );
          }
          break;
        }
      }
    }
  }

  writeFunctionBlock(fbDecl: FunctionBlockDecl): string[] {
    const files: string[] = [];

    // Get the different parts of the function block
    const inputs = getInputs(fbDecl);
    const outputs = getOutputs(fbDecl);
    const locals = getLocals(fbDecl);
    const logic = getLogic(fbDecl);

    // Collect all loop variables from the logic block    // Collect all loop variables from the logic block
    const loopVars = new Map<string, { type: string; init?: Expr }>();
    this.collectLoopVars(logic?.stmts ?? [], loopVars);
    // Filter out loop vars already declared as locals
    const localNames = new Set(locals.map((l) => l.name));
    const loopVarsToDeclare = Array.from(loopVars.entries()).filter(
      ([name]) => !localNames.has(name)
    );
    const fbStatements = logic?.stmts ?? [];

    // Create instance mapping for this function block (isolated from global scope)
    const fbInstanceMap = new Map<any, string>();
    const fbAfterMap = new Map<any, string>();
    // Collect edge detection instances (R_TRIG, F_TRIG) and after instances (TON)
    const rTrigCounter = { value: 1 };
    const fTrigCounter = { value: 1 };
    const tonCounter = { value: 1 };

    this.collectFBInstances(
      fbStatements,
      fbInstanceMap,
      fbAfterMap,
      rTrigCounter,
      fTrigCounter,
      tonCounter
    );

    // Create arrays for declarations
    const fbInstanceDecls: Array<{ instanceName: string; fbType: string }> = [];
    const afterStmtDecls: Array<{ tonName: string; ptValue: any }> = [];

    // Process edge detection instances
    for (const [stmt, instanceName] of fbInstanceMap) {
      if (isOnRisingEdgeStmt(stmt)) {
        fbInstanceDecls.push({ instanceName, fbType: "R_TRIG" });
      } else if (isOnFallingEdgeStmt(stmt)) {
        fbInstanceDecls.push({ instanceName, fbType: "F_TRIG" });
      }
    }

    // Process after statements
    for (const [stmt, tonName] of fbAfterMap) {
      afterStmtDecls.push({ tonName, ptValue: stmt.time });
    }

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
              (local) =>
                expandToNode`${local.name}: ${convertTypeRefToST(
                  local.typeRef
                )}${
                  local.init ? ` := ${this.convertExprToST(local.init)}` : ""
                };`,
              { appendNewLineIfNotEmpty: true }
            )}${joinToNode(
        loopVarsToDeclare,
        ([name, { type, init }]) =>
          expandToNode`${name}: ${type}${
            init ? ` := ${this.convertExprToST(init)}` : ""
          };`,
        { appendNewLineIfNotEmpty: true }
      )}${joinToNode(
        fbInstanceDecls,
        (decl: { instanceName: string; fbType: string }) =>
          expandToNode`${decl.instanceName}: ${decl.fbType}; (* Function block instance *)`,
        { appendNewLineIfNotEmpty: true }
      )}${joinToNode(
        afterStmtDecls,
        (decl: { tonName: string; ptValue: any }) =>
          expandToNode`${decl.tonName}: TON := (PT := ${decl.ptValue}); (* Function block instance *)`,
        { appendNewLineIfNotEmpty: true }
      )}
        END_VAR
      `
    );
    fs.writeFileSync(declFilePath, declContent);
    files.push(declFilePath); // Write implementation file
    const implFilePath = path.join(
      this.destination,
      "FunctionBlocks",
      `${fbDecl.name}_impl.st`
    );
    // Create a custom converter function that uses the function block's instance mapping
    const convertFBStatementToST = (stmt: any, indent: number): string => {
      switch (stmt.$type) {
        case "OnRisingEdgeStmt": {
          const rTrigInstance = fbInstanceMap.get(stmt);
          if (!rTrigInstance) return "";
          const rTrigSignal = this.convertExprToST(stmt.signal);
          const rTrigBody = (stmt.stmts ?? [])
            .map((s: any) => convertFBStatementToST(s, indent + 1))
            .join("\n");
          return `${rTrigInstance}(CLK := ${rTrigSignal});\nIF ${rTrigInstance}.Q THEN\n${rTrigBody}\nEND_IF;`;
        }

        case "OnFallingEdgeStmt": {
          const fTrigInstance = fbInstanceMap.get(stmt);
          if (!fTrigInstance) return "";
          const fTrigSignal = this.convertExprToST(stmt.signal);
          const fTrigBody = (stmt.stmts ?? [])
            .map((s: any) => convertFBStatementToST(s, indent + 1))
            .join("\n");
          return `${fTrigInstance}(CLK := ${fTrigSignal});\nIF ${fTrigInstance}.Q THEN\n${fTrigBody}\nEND_IF;`;
        }

        case "AfterStmt": {
          const tonInstance = fbAfterMap.get(stmt);
          if (!tonInstance) return "";
          const condition = this.convertExprToST(stmt.condition);
          const afterBody = (stmt.stmts ?? [])
            .map((s: any) => convertFBStatementToST(s, indent + 1))
            .join("\n");
          return `${tonInstance}(IN := ${condition});\nIF ${tonInstance}.Q THEN\n${afterBody}\n    ${tonInstance}(IN := FALSE);\nEND_IF`;
        }

        default:
          // For all other statements, use the default converter
          return this.convertStatementToST(stmt, indent);
      }
    };
    const implContent = (logic?.stmts ?? [])
      .map((stmt) => convertFBStatementToST(stmt, 0).trimEnd())
      .join("\n");
    fs.writeFileSync(implFilePath, implContent);
    files.push(implFilePath);

    return files;
  }
}
