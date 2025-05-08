import {
  ControlModel,
  isEnumDecl,
  isFunctionBlockDecl,
  isStructDecl,
  HardwareModel,
  EnumDecl,
  StructDecl,
  FunctionBlockDecl,
  VarDecl,
  Primary,
  isRef,
  isBinExpr,
  isNegExpr,
  isNotExpr,
  isPrimary,
  isArrayLiteral,
  isStructLiteral,
  isEnumMemberLiteral,
  Statement,
  isAssignmentStmt,
  isIfStmt,
  isWhileStmt,
  isForStmt,
  isSwitchStmt,
  isUseStmt,
  isWaitStmt,
  isExpressionStmt,
  isOnRisingEdgeStmt,
  isOnFallingEdgeStmt,
  Expr,
  isParenExpr,
  isControlUnit,
  isVarDecl,
  isBreakStmt,
  isContinueStmt,
  UseStmt,
  NamedElement,
  ControlUnit,
  TypeRef,
} from "../../language/generated/ast.js";
import { expandToNode, joinToNode, toString } from "langium/generate";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getInputs,
  getOutputs,
  getLocals,
  getLogic,
} from "../../language/utils/function-block-utils.js";
import { Reference } from "langium";

// Helper function to check if a node is a primitive value
function isPrimitive(expr: Primary): boolean {
  return (
    typeof expr.val === "number" ||
    typeof expr.val === "string" ||
    typeof expr.val === "boolean"
  );
}

/**
 * Helper function to extract the name from a reference with improved debugging
 * This function properly handles all types of references in our AST
 */
function getReferenceName(ref: Reference<NamedElement>): string {
  if (ref && "$refText" in ref) {
    return ref.$refText;
  }

  console.warn("Unresolved reference:", JSON.stringify(ref, null, 2));
  return "UNRESOLVED_REF";
}

/**
 * Check if a referenced element belongs to a control unit
 * This helps us determine if we need to qualify the variable name
 */
function isControlUnitVariable(
  ref: Reference<NamedElement>
): [boolean, string | null] {
  if (ref && ref.ref) {
    const container = ref.ref.$container;
    if (container && isControlUnit(container)) {
      return [true, container.name];
    }
  }
  return [false, null];
}

/**
 * Translate operators from DSL to ST format
 */
function translateOperator(op: string): string {
  switch (op) {
    case "&&":
      return "AND";
    case "||":
      return "OR";
    case "==":
      return "=";
    case "!=":
      return "<>";
    default:
      return op;
  }
}

class BeckhoffGeneratorContext {
  hardwareChannelFlatNames: Set<string>;
  usedInstanceNames: Set<string>;
  edgeDetectionInstanceMap: Map<string, string>;
  controlModel: ControlModel;
  hardwareModel: HardwareModel;
  destination: string;

  constructor(
    controlModel: ControlModel,
    hardwareModel: HardwareModel,
    destination: string
  ) {
    this.controlModel = controlModel;
    this.hardwareModel = hardwareModel;
    this.destination = destination;
    this.hardwareChannelFlatNames = new Set();
    this.usedInstanceNames = new Set();
    this.edgeDetectionInstanceMap = new Map();
  }

  getQualifiedReferenceName(ref: Reference<NamedElement>): string {
    const [isInControlUnit, unitName] = isControlUnitVariable(ref);
    if (isInControlUnit && unitName && isVarDecl(ref.ref)) {
      return `${unitName}_${getReferenceName(ref)}`;
    }
    return getReferenceName(ref);
  }

  convertExprToST(expr: Expr): string {
    if (isPrimary(expr)) {
      if (isRef(expr)) {
        if (expr.ref && expr.properties && expr.properties.length === 1) {
          const base = getReferenceName(expr.ref);
          const prop = getReferenceName(expr.properties[0]);
          const flat = `${base}_${prop}`;
          if (this.hardwareChannelFlatNames.has(flat)) return flat;
        }
        if (expr.ref) {
          let result = this.getQualifiedReferenceName(expr.ref);
          const propIndices = [];
          if (expr.properties && expr.properties.length > 0) {
            for (let i = 0; i < expr.properties.length; i++) {
              propIndices.push({
                type: "property",
                index: i,
                value: getReferenceName(expr.properties[i]),
              });
            }
          }
          if (expr.indices && expr.indices.length > 0) {
            for (let i = 0; i < expr.indices.length; i++) {
              propIndices.push({
                type: "index",
                index: i,
                value: this.convertExprToST(expr.indices[i]),
              });
            }
          }
          if (propIndices.length > 0) {
            if (expr.indices && expr.indices.length > 0) {
              result += `[${expr.indices
                .map((idx) => this.convertExprToST(idx))
                .join(", ")}]`;
            }
            if (expr.properties && expr.properties.length > 0) {
              const propNames = expr.properties.map((prop) =>
                getReferenceName(prop)
              );
              result += `.${propNames.join(".")}`;
            }
          }
          return result;
        }
        return "UNKNOWN_REF";
      } else if (isParenExpr(expr)) {
        return `(${this.convertExprToST(expr.expr)})`;
      } else if (isNegExpr(expr)) {
        return `-${this.convertExprToST(expr.expr)}`;
      } else if (isNotExpr(expr)) {
        return `NOT ${this.convertExprToST(expr.expr)}`;
      } else if (isArrayLiteral(expr.val)) {
        return `[${expr.val.elements
          .map((e) => this.convertExprToST(e))
          .join(", ")}]`;
      } else if (isStructLiteral(expr.val)) {
        return `(${expr.val.fields
          .map((f) => `${f.name}:=${this.convertExprToST(f.value)}`)
          .join(", ")})`;
      } else if (isPrimitive(expr)) {
        if (typeof expr.val === "string") {
          return `'${expr.val.replaceAll('"', "")}'`;
        } else if (typeof expr.val === "boolean") {
          return expr.val ? "TRUE" : "FALSE";
        } else if (expr.val !== undefined) {
          return expr.val.toString();
        }
      }
    } else if (isBinExpr(expr)) {
      const op = translateOperator(expr.op);
      return `${this.convertExprToST(expr.e1)} ${op} ${this.convertExprToST(
        expr.e2
      )}`;
    }
    return "UNKNOWN_EXPR";
  }

  convertStatementToST(
    stmt: Statement,
    edgeMetadata?: [string, number],
    indent: number = 0
  ): string {
    const pad = (level: number) => "    ".repeat(level);

    if (isAssignmentStmt(stmt)) {
      return (
        pad(indent) +
        `${this.convertExprToST(stmt.target)} := ${this.convertExprToST(
          stmt.value
        )};`
      );
    } else if (isIfStmt(stmt)) {
      let result =
        pad(indent) + `IF ${this.convertExprToST(stmt.condition)} THEN\n`;
      for (const subStmt of stmt.stmts) {
        result +=
          this.convertStatementToST(subStmt, undefined, indent + 1) + "\n";
      }
      for (const elseIfStmt of stmt.elseIfStmts) {
        result +=
          pad(indent) +
          `ELSIF ${this.convertExprToST(elseIfStmt.condition)} THEN\n`;
        for (const subStmt of elseIfStmt.stmts) {
          result +=
            this.convertStatementToST(subStmt, undefined, indent + 1) + "\n";
        }
      }
      if (stmt.elseStmt) {
        result += pad(indent) + `ELSE\n`;
        for (const subStmt of stmt.elseStmt.stmts || []) {
          result +=
            this.convertStatementToST(subStmt, undefined, indent + 1) + "\n";
        }
      }
      result += pad(indent) + `END_IF;`;
      return result;
    } else if (isWhileStmt(stmt)) {
      return toString(
        expandToNode`
          ${pad(indent)}WHILE ${this.convertExprToST(stmt.condition)} DO
              ${joinToNode(
                stmt.stmts,
                (subStmt) =>
                  this.convertStatementToST(subStmt, undefined, indent + 1),
                {
                  appendNewLineIfNotEmpty: true,
                }
              )}
          ${pad(indent)}END_WHILE;
        `
      );
    } else if (isForStmt(stmt)) {
      let result = `${pad(indent)}FOR ${stmt.loopVar.name} := ${
        stmt.loopVar.init ? this.convertExprToST(stmt.loopVar.init) : "0"
      } TO ${this.convertExprToST(stmt.end)}${
        stmt.step ? ` BY ${this.convertExprToST(stmt.step)}` : ""
      } DO\n`;
      for (const subStmt of stmt.stmts) {
        result +=
          this.convertStatementToST(subStmt, undefined, indent + 1) + "\n";
      }
      result += `${pad(indent)}END_FOR;`;
      return result;
    } else if (isSwitchStmt(stmt)) {
      return toString(
        expandToNode`
          ${pad(indent)}CASE ${this.convertExprToST(stmt.expr)} OF
              ${joinToNode(
                stmt.cases,
                (caseOption) => {
                  const literals = caseOption.literals
                    .map((lit) => {
                      if (isEnumMemberLiteral(lit.val)) {
                        return `${lit.val.enumDecl.ref?.name}.${lit.val.member.ref?.name}`;
                      } else {
                        return String(lit.val);
                      }
                    })
                    .join(", ");
                  return expandToNode`
                    ${pad(indent + 1)}${literals}:
                        ${joinToNode(
                          caseOption.stmts,
                          (subStmt) =>
                            this.convertStatementToST(
                              subStmt,
                              undefined,
                              indent + 2
                            ),
                          {
                            appendNewLineIfNotEmpty: true,
                          }
                        )}
                  `;
                },
                { appendNewLineIfNotEmpty: true }
              )}
              ${
                stmt.default
                  ? expandToNode`
                  ${pad(indent + 1)}ELSE:
                      ${joinToNode(
                        stmt.default.stmts,
                        (subStmt) =>
                          this.convertStatementToST(
                            subStmt,
                            undefined,
                            indent + 2
                          ),
                        {
                          appendNewLineIfNotEmpty: true,
                        }
                      )}
              `
                  : ""
              }
          ${pad(indent)}END_CASE;
        `
      );
    } else if (isWaitStmt(stmt)) {
      return (
        pad(indent) +
        `// Wait statements are not directly supported in ST - using equivalent timer logic`
      );
    } else if (isBreakStmt(stmt)) {
      return pad(indent) + `EXIT;`;
    } else if (isContinueStmt(stmt)) {
      return pad(indent) + `CONTINUE;`;
    } else if (isExpressionStmt(stmt)) {
      return pad(indent) + `${this.convertExprToST(stmt.expr)};`;
    } else if (isUseStmt(stmt)) {
      // Handle function block instantiation and calling
      const fbType = stmt.functionBlockRef.ref?.name || "UNKNOWN_FB";

      // Create a proper instance name in camelCase, ensuring it's unique if needed
      let fbInstanceName =
        fbType.charAt(0).toLowerCase() + fbType.slice(1) + "Instance";

      // Check if we need to make the instance name unique
      let instanceCounter = 1;
      const baseInstanceName = fbInstanceName;
      while (this.usedInstanceNames.has(fbInstanceName)) {
        fbInstanceName = baseInstanceName + instanceCounter;
        instanceCounter++;
      }
      this.usedInstanceNames.add(fbInstanceName);

      // Map inputs
      const inputMappings = stmt.inputArgs
        .map((arg) => {
          return `${arg.inputVar.ref?.name}:=${this.convertExprToST(
            arg.value
          )}`;
        })
        .join(", ");

      // Handle output mapping with consistent formatting
      if (stmt.useOutput.singleOutput) {
        const targetOutputVarName =
          stmt.useOutput.singleOutput.targetOutputVar.ref?.name ?? "output";
        // Using direct access for single output case, which returns directly from FB call
        return toString(
          expandToNode`
            ${pad(indent)}${fbInstanceName} := ${fbType}(${inputMappings});
            ${pad(indent)}${targetOutputVarName} := ${fbInstanceName};
          `
        );
      } else if (stmt.useOutput.mappingOutputs.length > 0) {
        return toString(
          expandToNode`
            ${pad(indent)}${fbInstanceName}(${inputMappings});
            ${joinToNode(
              stmt.useOutput.mappingOutputs,
              (outMapping) => {
                const targetOutputVarName =
                  outMapping.targetOutputVar.ref?.name ?? "output";
                const fbOutputVarName =
                  outMapping.fbOutputVar.ref?.name ?? "output";
                return `${pad(
                  indent
                )}${targetOutputVarName} := ${fbInstanceName}.${fbOutputVarName};`;
              },
              { appendNewLineIfNotEmpty: true }
            )}
          `
        );
      } else {
        return pad(indent) + `${fbInstanceName}(${inputMappings});`;
      }
    } else if (isOnRisingEdgeStmt(stmt)) {
      // Get the signal name and expression
      const signalExpr = this.convertExprToST(stmt.signal);

      // Look up the proper instance name from our pre-processed map
      let instanceName;
      if (
        edgeMetadata &&
        this.edgeDetectionInstanceMap.has(
          `${signalExpr}_rising_${edgeMetadata[1]}`
        )
      ) {
        instanceName = this.edgeDetectionInstanceMap.get(
          `${signalExpr}_rising_${edgeMetadata[1]}`
        );
      } else {
        // Fallback to existing logic if needed
        const signalPath = signalExpr.replace(/\./g, "_");
        instanceName = `R_TRIG_${signalPath}_Instance`;
      }

      // Using Beckhoff's built-in R_TRIG function block for rising edge detection
      return toString(
        expandToNode`
          ${pad(indent)}// Rising edge detection for ${signalExpr}
          ${pad(indent)}${instanceName}(CLK := ${signalExpr});
          ${pad(indent)}IF ${instanceName}.Q THEN
              ${joinToNode(
                stmt.stmts,
                (subStmt) =>
                  this.convertStatementToST(subStmt, undefined, indent + 1),
                {
                  appendNewLineIfNotEmpty: true,
                }
              )}
          ${pad(indent)}END_IF;
        `
      );
    } else if (isOnFallingEdgeStmt(stmt)) {
      // Get the signal name and expression
      const signalExpr = this.convertExprToST(stmt.signal);

      // Look up the proper instance name from our pre-processed map
      let instanceName;
      if (
        edgeMetadata &&
        this.edgeDetectionInstanceMap.has(
          `${signalExpr}_falling_${edgeMetadata[1]}`
        )
      ) {
        instanceName = this.edgeDetectionInstanceMap.get(
          `${signalExpr}_falling_${edgeMetadata[1]}`
        );
      } else {
        // Fallback to existing logic if needed
        const signalPath = signalExpr.replace(/\./g, "_");
        instanceName = `F_TRIG_${signalPath}_Instance`;
      }

      // Using Beckhoff's built-in F_TRIG function block for falling edge detection
      return toString(
        expandToNode`
          ${pad(indent)}// Falling edge detection for ${signalExpr}
          ${pad(indent)}${instanceName}(CLK := ${signalExpr});
          ${pad(indent)}IF ${instanceName}.Q THEN
              ${joinToNode(
                stmt.stmts,
                (subStmt) =>
                  this.convertStatementToST(subStmt, undefined, indent + 1),
                {
                  appendNewLineIfNotEmpty: true,
                }
              )}
          ${pad(indent)}END_IF;
        `
      );
    } else if (isVarDecl(stmt)) {
      return (
        pad(indent) +
        `${stmt.name}: ${convertTypeRefToST(stmt.typeRef)}${
          stmt.init ? ` := ${this.convertExprToST(stmt.init)}` : ""
        };`
      );
    }

    return (
      pad(indent) + `// Unsupported statement type: ${(stmt as any).$type}`
    );
  }

  convertEdgeDetectionToST(
    stmt: Statement,
    index: number,
    type: "rising" | "falling",
    indent: number = 0
  ): string {
    const pad = (level: number) => "    ".repeat(level);
    if (type === "rising" && isOnRisingEdgeStmt(stmt)) {
      const signalExpr = this.convertExprToST(stmt.signal);
      const key = `${type}_${signalExpr}_${index}`;
      const instanceName = this.edgeDetectionInstanceMap.get(key);
      if (!instanceName) {
        console.warn(`Could not find instance name for rising edge: ${key}`);
        return "// ERROR: Missing edge detection instance";
      }
      let risingContent = `${pad(
        indent
      )}// Rising edge detection for ${signalExpr}\n`;
      risingContent += `${pad(indent)}${instanceName}(CLK := ${signalExpr});\n`;
      risingContent += `${pad(indent)}IF ${instanceName}.Q THEN\n`;
      for (const subStmt of stmt.stmts) {
        risingContent +=
          this.convertStatementToST(subStmt, undefined, indent + 1) + "\n";
      }
      risingContent += `${pad(indent)}END_IF;`;
      return risingContent;
    } else if (type === "falling" && isOnFallingEdgeStmt(stmt)) {
      const signalExpr = this.convertExprToST(stmt.signal);
      const key = `${type}_${signalExpr}_${index}`;
      const instanceName = this.edgeDetectionInstanceMap.get(key);
      if (!instanceName) {
        console.warn(`Could not find instance name for falling edge: ${key}`);
        return "// ERROR: Missing edge detection instance";
      }
      let fallingContent = `${pad(
        indent
      )}// Falling edge detection for ${signalExpr}\n`;
      fallingContent += `${pad(
        indent
      )}${instanceName}(CLK := ${signalExpr});\n`;
      fallingContent += `${pad(indent)}IF ${instanceName}.Q THEN\n`;
      for (const subStmt of stmt.stmts) {
        fallingContent +=
          this.convertStatementToST(subStmt, undefined, indent + 1) + "\n";
      }
      fallingContent += `${pad(indent)}END_IF;`;
      return fallingContent;
    }
    return "// Error: Invalid edge detection statement";
  }

  convertUseStmtToST(
    stmt: UseStmt,
    fbInstanceTracker: Map<string, Map<number, string>>
  ): string {
    let useContent = "";

    // Get the function block type
    const fbType = stmt.functionBlockRef.ref?.name ?? "UNKNOWN_FB";

    // Find the instances map for this FB type
    const instanceMap = fbInstanceTracker.get(fbType);

    if (!instanceMap) {
      console.warn(`No instance map found for FB type: ${fbType}`);
      return "// ERROR: Missing function block instance tracking";
    }

    // Find all existing use statements of this type to determine the index
    const fbTypeInstances = Array.from(instanceMap.entries());

    // Find the appropriate instance - use the pre-assigned instance name
    // We're finding the first instance that hasn't been used yet
    let fbInstanceName = "";
    for (const [_, name] of fbTypeInstances) {
      if (!this.usedInstanceNames.has(`used_${fbType}_${name}`)) {
        fbInstanceName = name;
        // Mark this specific instance as used
        this.usedInstanceNames.add(`used_${fbType}_${name}`);
        break;
      }
    }

    // If no unused instance found, use the first one (fallback)
    if (!fbInstanceName && fbTypeInstances.length > 0) {
      fbInstanceName = fbTypeInstances[0][1];
    }

    // If still no instance, create a new one (emergency fallback)
    if (!fbInstanceName) {
      fbInstanceName = `${fbType.charAt(0).toLowerCase()}${fbType.slice(
        1
      )}Instance`;
      console.warn(`Using emergency fallback instance: ${fbInstanceName}`);
    }

    // Map inputs
    const inputMappings = stmt.inputArgs
      .map((arg) => {
        return `${arg.inputVar.ref?.name}:=${this.convertExprToST(arg.value)}`;
      })
      .join(", ");

    // Handle output mapping
    if (stmt.useOutput.singleOutput) {
      const targetOutputVarRef = stmt.useOutput.singleOutput.targetOutputVar;
      const targetOutputVarName =
        this.getQualifiedReferenceName(targetOutputVarRef);

      // Using direct access for single output case, which returns directly from FB call
      useContent += `${fbInstanceName} := ${fbType}(${inputMappings});\n`;
      useContent += `${targetOutputVarName} := ${fbInstanceName};`;
    } else if (stmt.useOutput.mappingOutputs.length > 0) {
      // First initialize the instance with input values
      useContent += `${fbInstanceName}(${inputMappings});\n`;

      // Map outputs from instance properties
      for (const outMapping of stmt.useOutput.mappingOutputs) {
        const targetOutputVarRef = outMapping.targetOutputVar;
        const targetOutputVarName =
          this.getQualifiedReferenceName(targetOutputVarRef);

        const fbOutputVarName = outMapping.fbOutputVar.ref?.name ?? "output";
        useContent += `${targetOutputVarName} := ${fbInstanceName}.${fbOutputVarName};\n`;
      }
    } else {
      useContent += `${fbInstanceName}(${inputMappings});\n`;
    }

    return useContent;
  }

  generateBeckhoffArtifacts(): string[] {
    if (!fs.existsSync(this.destination))
      fs.mkdirSync(this.destination, { recursive: true });
    const files: string[] = [];

    for (const item of this.controlModel.controlBlock.items) {
      // Skip items marked as extern
      if (isEnumDecl(item) || isStructDecl(item) || isFunctionBlockDecl(item)) {
        if (item.isExtern) continue;
      }

      if (isEnumDecl(item)) files.push(this.writeEnum(item));
      else if (isStructDecl(item)) files.push(this.writeStruct(item));
      else if (isFunctionBlockDecl(item))
        files.push(...this.writeFunctionBlock(item));
    }

    files.push(this.writeProgramMain());
    return files;
  }

  writeEnum(enumDecl: EnumDecl): string {
    const filePath = path.join(this.destination, `${enumDecl.name}.st`);

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
    const filePath = path.join(this.destination, `${structDecl.name}.st`);

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

    // Write declaration file
    const declFilePath = path.join(this.destination, `${fbDecl.name}_decl.st`);
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
        END_VAR
      `
    );
    fs.writeFileSync(declFilePath, declContent);
    files.push(declFilePath);

    // Write implementation file
    const implFilePath = path.join(this.destination, `${fbDecl.name}_impl.st`);
    const implContent = (logic?.stmts || [])
      .map((stmt) => this.convertStatementToST(stmt, undefined, 0).trimEnd())
      .join("\n");
    fs.writeFileSync(implFilePath, implContent);
    files.push(implFilePath);

    return files;
  }

  writeProgramMain(): string {
    // Reset the used instance names and edge detection maps to ensure clean tracking for this program
    this.usedInstanceNames.clear();
    this.edgeDetectionInstanceMap.clear();

    // Collect all variables that need to be declared in the MAIN program
    const mainVars: EmittedVarDecl[] = [];
    // Collect all FB instances that need to be created
    // Use Map to store instance name -> FB type
    const fbInstancesMap = new Map<string, string>();
    // Map to track FB instances by FB type and index (similar to edge detection)
    const fbInstanceTracker = new Map<string, Map<number, string>>();
    // Collect all statements for the main logic
    const mainStatements: Statement[] = [];

    // Look for control units that should be included in MAIN
    for (const item of this.controlModel.controlBlock.items) {
      if (isControlUnit(item)) {
        const controlUnit = item;

        // Add statements from this control unit
        mainStatements.push(...controlUnit.stmts);

        // Process control unit local variables
        const varDecls = controlUnit.stmts.filter(isVarDecl);
        mainVars.push(
          ...varDecls.map((varDecl) => new EmittedVarDecl(controlUnit, varDecl))
        );

        // Find all function block references to create instances
        const useStmts = controlUnit.stmts.filter(isUseStmt);

        // Group use statements by FB type to assign consistent indices
        const fbTypeToUseStmts = new Map<string, UseStmt[]>();
        for (const useStmt of useStmts) {
          const fbType = useStmt.functionBlockRef.ref?.name ?? "UNKNOWN_FB";
          if (!fbTypeToUseStmts.has(fbType)) {
            fbTypeToUseStmts.set(fbType, []);
          }
          fbTypeToUseStmts.get(fbType)?.push(useStmt);
        }

        // Now process all FB types and assign instances with consistent indices
        for (const [fbType, stmts] of fbTypeToUseStmts.entries()) {
          // For each FB type, create a map to track instances by index
          if (!fbInstanceTracker.has(fbType)) {
            fbInstanceTracker.set(fbType, new Map());
          }

          // Process each use statement of this type
          stmts.forEach((useStmt, index) => {
            // Create a proper instance name in camelCase
            let baseInstanceName =
              fbType.charAt(0).toLowerCase() + fbType.slice(1) + "Instance";
            let instanceName = baseInstanceName;

            // If not the first instance of this type, add a numeric suffix
            if (index > 0) {
              // Start from 1 for the suffix (reserve base name for first instance)
              instanceName = `${baseInstanceName}${index + 1}`;
            }

            // Add to instance maps and track used names
            fbInstancesMap.set(instanceName, fbType);
            this.usedInstanceNames.add(instanceName);

            // Store for later reference in statement conversion
            fbInstanceTracker.get(fbType)?.set(index, instanceName);
          });
        }
      }
    }

    // Extract hardware datapoints
    const { inputs, outputs } = this.extractHardwareDatapoints();

    // Fill the set of flat hardware channel names
    this.hardwareChannelFlatNames = new Set([
      ...inputs.map((i) => i.name),
      ...outputs.map((o) => o.name),
    ]);

    // Handle edge detection trigger instances (R_TRIG and F_TRIG)
    // Use a Map to ensure unique instance names
    const edgeDetectionFBMap = new Map<string, string>();

    // First pass: Pre-process all edge detection statements to assign unique instance names
    // This ensures consistent naming when we actually process the statements in convertStatementToST
    const risingEdgeStatements = mainStatements.filter(isOnRisingEdgeStmt);
    const fallingEdgeStatements = mainStatements.filter(isOnFallingEdgeStmt);

    // Process rising edge statements first
    risingEdgeStatements.forEach((stmt, index) => {
      // Get the signal expression string
      const signalExpr = this.convertExprToST(stmt.signal);

      // Create a more specific instance name based on the full signal path
      const signalPath = signalExpr.replace(/\./g, "_");
      let baseInstanceName = `r_TRIG_${signalPath}_Instance`;
      let instanceName = baseInstanceName;

      // If not the first instance with this base name, add a numeric suffix
      if (
        index > 0 ||
        Array.from(edgeDetectionFBMap.keys()).some(
          (key) => key === baseInstanceName
        )
      ) {
        instanceName = `${baseInstanceName}${index + 1}`;
      }

      // Add to maps and track used names
      edgeDetectionFBMap.set(instanceName, "R_TRIG");
      this.usedInstanceNames.add(instanceName);

      // Store this specific instance name for this statement
      // Use a unique key combining statement type, signal, and index
      const key = `rising_${signalExpr}_${index}`;
      this.edgeDetectionInstanceMap.set(key, instanceName);
    });

    // Process falling edge statements next
    fallingEdgeStatements.forEach((stmt, index) => {
      // Get the signal expression string
      const signalExpr = this.convertExprToST(stmt.signal);

      // Create a more specific instance name based on the full signal path
      const signalPath = signalExpr.replace(/\./g, "_");
      let baseInstanceName = `f_TRIG_${signalPath}_Instance`;
      let instanceName = baseInstanceName;

      // If not the first instance with this base name, add a numeric suffix
      if (
        index > 0 ||
        Array.from(edgeDetectionFBMap.keys()).some(
          (key) => key === baseInstanceName
        )
      ) {
        instanceName = `${baseInstanceName}${index + 1}`;
      }

      // Add to maps and track used names
      edgeDetectionFBMap.set(instanceName, "F_TRIG");
      this.usedInstanceNames.add(instanceName);

      // Store this specific instance name for this statement
      // Use a unique key combining statement type, signal, and index
      const key = `falling_${signalExpr}_${index}`;
      this.edgeDetectionInstanceMap.set(key, instanceName);
    });

    // Generate declaration part
    const declContent = toString(
      expandToNode`
        PROGRAM MAIN
        VAR
            ${joinToNode(
              inputs,
              (input) => expandToNode`
                ${input.name} AT ${input.ioBinding.substring(0, 2)}*: ${
                input.type
              }; (* Input channel from hardware *)
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              outputs,
              (output) => expandToNode`
                ${output.name} AT ${output.ioBinding.substring(0, 2)}*: ${
                output.type
              }; (* Output channel to hardware *)
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              mainVars,
              (v) => expandToNode`
                ${v.name}: ${convertTypeRefToST(v.varDecl.typeRef)}${
                v.varDecl.init
                  ? ` := ${this.convertExprToST(v.varDecl.init)}`
                  : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              Array.from(fbInstancesMap.entries()),
              ([instanceName, fbType]) => expandToNode`
                ${instanceName}: ${fbType}; (* Function block instance *)
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              Array.from(edgeDetectionFBMap.entries()),
              ([instanceName, fbType]) => expandToNode`
                ${instanceName}: ${fbType}; (* Edge detection instance *)
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            bRunOnlyOnce: BOOL := FALSE;
        END_VAR
      `
    );

    // Generate implementation part
    const implContent = toString(
      expandToNode`
        // Initialize code - runs only once
        IF NOT bRunOnlyOnce THEN
            ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
                     msgFmtStr := 'Program started %s', 
                     strArg := 'successfully!');
            bRunOnlyOnce := TRUE;
        END_IF

        // Main program logic
        ${joinToNode(
          mainStatements.filter((stmt) => !isVarDecl(stmt)),
          (stmt, index) => {
            if (isOnRisingEdgeStmt(stmt)) {
              // Find this statement's index in the risingEdgeStatements array
              const statementIndex = risingEdgeStatements.indexOf(stmt);
              if (statementIndex !== -1) {
                return this.convertEdgeDetectionToST(
                  stmt,
                  statementIndex,
                  "rising"
                );
              }
            } else if (isOnFallingEdgeStmt(stmt)) {
              // Find this statement's index in the fallingEdgeStatements array
              const statementIndex = fallingEdgeStatements.indexOf(stmt);
              if (statementIndex !== -1) {
                return this.convertEdgeDetectionToST(
                  stmt,
                  statementIndex,
                  "falling"
                );
              }
            } else if (isUseStmt(stmt)) {
              // Handle function block use statements with consistent instance tracking
              return this.convertUseStmtToST(stmt, fbInstanceTracker);
            }
            return this.convertStatementToST(stmt);
          },
          { appendNewLineIfNotEmpty: true }
        )}
      `
    );

    // Write declaration file
    const declFilePath = path.join(this.destination, `MAIN_decl.st`);
    fs.writeFileSync(declFilePath, declContent);

    // Write implementation file
    const implFilePath = path.join(this.destination, `MAIN_impl.st`);
    fs.writeFileSync(implFilePath, implContent);

    return implFilePath;
  }

  extractHardwareDatapoints(): {
    inputs: Array<{ name: string; type: string; ioBinding: string }>;
    outputs: Array<{ name: string; type: string; ioBinding: string }>;
  } {
    const inputs: Array<{ name: string; type: string; ioBinding: string }> = [];
    const outputs: Array<{ name: string; type: string; ioBinding: string }> =
      [];

    // Process each controller in the this.hardwareModel
    for (const controller of this.hardwareModel.controllers) {
      // We only process Beckhoff hardware components
      if (controller.platform !== "Beckhoff") continue;

      // Map to hold port groups for reference
      const portGroups = new Map();

      // First pass: collect all port groups
      for (const component of controller.components) {
        if ("moduleType" in component) {
          portGroups.set(component.name, component);
        }
      }

      // Second pass: process all datapoints
      for (const component of controller.components) {
        if ("portgroup" in component) {
          const datapoint = component;
          const portgroup = portGroups.get(datapoint.portgroup.ref?.name);

          if (!portgroup) continue;

          // Determine if this is an input or output based on the port group
          const isInput =
            portgroup.ioType === "DIGITAL_INPUT" ||
            portgroup.ioType === "ANALOG_INPUT";

          // Process each channel in the datapoint
          for (const channel of datapoint.channels) {
            // Create variable name: [DatapointName]_[ChannelName]
            const varName = `${datapoint.name}_${channel.name}`;

            // Determine PLC data type from channel type
            let plcType: string;
            switch (channel.dataType) {
              case "BOOL":
                plcType = "BOOL";
                break;
              case "INT":
                plcType = "INT";
                break;
              case "REAL":
                plcType = "REAL";
                break;
              default:
                plcType = "BYTE"; // Default to BYTE for unknown types
            }

            // Calculate the IO binding address
            // Parse the start address from the IOBinding format: %I* or %Q*
            const addrMatch = portgroup.startAddress?.match(
              /%([IQ])([XBWDL])?([0-9]+(\.[0-9]+)?)?/
            );
            if (!addrMatch) continue;

            const ioPrefix = addrMatch[1]; // I or Q
            const ioType = addrMatch[2] || this.getDefaultIOType(plcType); // X, B, W, D, L if specified
            const ioBaseAddr = addrMatch[3] ? parseInt(addrMatch[3]) : 0;

            // Calculate the offset based on channel index
            const offsetAddr = ioBaseAddr + channel.index;

            // Construct the IO binding
            const ioBinding = `%${ioPrefix}${ioType}${offsetAddr}`;

            // Add to the appropriate array
            if (isInput) {
              inputs.push({ name: varName, type: plcType, ioBinding });
            } else {
              outputs.push({ name: varName, type: plcType, ioBinding });
            }
          }
        }
      }
    }

    return { inputs, outputs };
  }

  getDefaultIOType(plcType: string): string {
    switch (plcType) {
      case "BOOL":
        return "X"; // Single bit
      case "BYTE":
        return "B"; // 8 bits
      case "WORD":
      case "INT":
        return "W"; // 16 bits
      case "DWORD":
      case "DINT":
      case "REAL":
        return "D"; // 32 bits
      case "LWORD":
      case "LINT":
      case "LREAL":
        return "L"; // 64 bits
      default:
        return "B"; // Default to byte
    }
  }

  generate(): {
    files: string[];
    csharpStrings: Record<
      string,
      { declaration: string; implementation?: string }
    >;
  } {
    const files = this.generateBeckhoffArtifacts();

    function createCSharpString(filePath: string): string {
      return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\\r\\n");
    }

    // Create C#-compatible strings for each POU
    const csharpStrings: Record<
      string,
      { declaration: string; implementation?: string }
    > = {};

    // Process each item in the control model to create C# ready strings
    for (const item of this.controlModel.controlBlock.items) {
      if ("isExtern" in item && item.isExtern) continue;

      if (isEnumDecl(item)) {
        const filePath = path.join(this.destination, `${item.name}.st`);
        csharpStrings[item.name] = {
          declaration: createCSharpString(filePath),
        };
      } else if (isStructDecl(item)) {
        const filePath = path.join(this.destination, `${item.name}.st`);
        csharpStrings[item.name] = {
          declaration: createCSharpString(filePath),
        };
      } else if (isFunctionBlockDecl(item)) {
        const declFilePath = path.join(
          this.destination,
          `${item.name}_decl.st`
        );
        const implFilePath = path.join(
          this.destination,
          `${item.name}_impl.st`
        );

        csharpStrings[item.name] = {
          declaration: createCSharpString(declFilePath),
          implementation: createCSharpString(implFilePath),
        };
      }
    }

    // Add MAIN program
    const mainDeclFilePath = path.join(this.destination, `MAIN_decl.st`);
    const mainImplFilePath = path.join(this.destination, `MAIN_impl.st`);

    csharpStrings["MAIN"] = {
      declaration: createCSharpString(mainDeclFilePath),
      implementation: createCSharpString(mainImplFilePath),
    };

    return { files, csharpStrings };
  }
}

export function generateBeckhoffCode(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  destination: string
) {
  const ctx = new BeckhoffGeneratorContext(
    controlModel,
    hardwareModel,
    destination
  );
  return ctx.generate();
}

class EmittedVarDecl {
  controlUnit: ControlUnit;
  varDecl: VarDecl;

  constructor(controlUnit: ControlUnit, varDecl: VarDecl) {
    this.controlUnit = controlUnit;
    this.varDecl = varDecl;
  }

  get name(): string {
    return `${this.controlUnit.name}_${this.varDecl.name}`;
  }
}

function convertTypeRefToST(typeRef: TypeRef): string {
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
