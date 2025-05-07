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
  TypeRef,
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
  isRampStmt,
  isExpressionStmt,
  isOnRisingEdgeStmt,
  isOnFallingEdgeStmt,
  Expr,
  isParenExpr,
  isControlUnit,
  NegExpr,
  NotExpr,
  ParenExpr,
  isVarDecl,
  isBreakStmt,
  isContinueStmt,
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
function getReferenceName(ref: any): string {
  // First try to check if the reference has a $refText property which contains original source text
  if (ref && "$refText" in ref) {
    return ref.$refText;
  }

  // Check if it's a resolved reference with a name on the target
  if (ref?.ref?.name) {
    return ref.ref.name;
  }

  // Direct name property
  if (ref && "name" in ref) {
    return ref.name;
  }

  // Check for a property name
  if (ref?.property?.name) {
    return ref.property.name;
  }

  // Last resort: return a descriptive comment
  console.warn("Unresolved reference:", JSON.stringify(ref, null, 2));
  return "UNRESOLVED_REF";
}

/**
 * Convert an expression to a valid ST expression
 */
function convertExprToST(expr: Expr): string {
  if (isPrimary(expr)) {
    if (isPrimitive(expr)) {
      if (typeof expr.val === "string") {
        return `'${expr.val}'`; // String literals use single quotes in ST
      } else if (typeof expr.val === "boolean") {
        return expr.val ? "TRUE" : "FALSE"; // Booleans are uppercase in ST
      } else if (expr.val !== undefined) {
        return expr.val.toString(); // Numbers as strings
      }
    } else if (isArrayLiteral(expr.val)) {
      return `[${expr.val.elements.map((e) => convertExprToST(e)).join(", ")}]`;
    } else if (isStructLiteral(expr.val)) {
      return `(${expr.val.fields
        .map((f) => `${f.name}:=${convertExprToST(f.value)}`)
        .join(", ")})`;
    } else if (isRef(expr)) {
      // Special handling for hardware references and dot notation
      if (expr.ref && expr.properties && expr.properties.length > 0) {
        // This is likely a hardware reference like Buttons.Room1
        // First get the base name (e.g., "Buttons")
        const baseName = getReferenceName(expr.ref);

        // Collect all property names (e.g., "Room1")
        const propNames = expr.properties.map((prop) => getReferenceName(prop));

        // Join them with dots to form the full reference
        return [baseName, ...propNames].join(".");
      }

      // Standard reference without properties
      let result = "";

      // Get the reference name
      if (expr.ref) {
        result = getReferenceName(expr.ref);
      } else {
        result = "UNKNOWN_REF";
      }

      // Add indices if any
      if (expr.indices && expr.indices.length > 0) {
        result += `[${expr.indices
          .map((idx) => convertExprToST(idx))
          .join(", ")}]`;
      }

      return result;
    }
  } else if (isBinExpr(expr)) {
    // Special handling for operators that are different in ST
    const op = translateOperator(expr.op);
    return `${convertExprToST(expr.e1)} ${op} ${convertExprToST(expr.e2)}`;
  } else if (isNegExpr(expr)) {
    const negExpr = expr as NegExpr;
    return `-${convertExprToST(negExpr.expr)}`;
  } else if (isNotExpr(expr)) {
    const notExpr = expr as NotExpr;
    return `NOT ${convertExprToST(notExpr.expr)}`;
  } else if (isParenExpr(expr)) {
    const parenExpr = expr as ParenExpr;
    return `(${convertExprToST(parenExpr.expr)})`;
  }

  return "UNKNOWN_EXPR";
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

export function generateBeckhoffArtifacts(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  destination: string
): string[] {
  if (!fs.existsSync(destination))
    fs.mkdirSync(destination, { recursive: true });
  const files: string[] = [];

  for (const item of controlModel.controlBlock.items) {
    // Skip items marked as extern
    if (isEnumDecl(item) || isStructDecl(item) || isFunctionBlockDecl(item)) {
      if (item.isExtern) continue;
    }

    if (isEnumDecl(item)) files.push(writeEnum(item, destination));
    else if (isStructDecl(item)) files.push(writeStruct(item, destination));
    else if (isFunctionBlockDecl(item))
      files.push(...writeFunctionBlock(item, destination));
  }

  files.push(writeProgramMain(controlModel, hardwareModel, destination));
  return files;
}

/**
 * Generate ST code for an enum declaration
 * @param enumDecl Enum declaration from AST
 * @param destination Output directory
 * @returns Path to the generated file
 */
function writeEnum(enumDecl: EnumDecl, destination: string): string {
  const filePath = path.join(destination, `${enumDecl.name}.st`);

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

/**
 * Generate ST code for a struct declaration
 * @param structDecl Struct declaration from AST
 * @param destination Output directory
 * @returns Path to the generated file
 */
function writeStruct(structDecl: StructDecl, destination: string): string {
  const filePath = path.join(destination, `${structDecl.name}.st`);

  const structContent = toString(
    expandToNode`
      TYPE ${structDecl.name} :
      STRUCT
          ${joinToNode(
            structDecl.fields,
            (field) => expandToNode`
              ${field.name} : ${convertTypeRefToST(field.typeRef)}${
              field.init ? ` := ${convertExprToST(field.init)}` : ""
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

/**
 * Convert a TypeRef to a valid ST type representation
 */
function convertTypeRefToST(typeRef: TypeRef): string {
  if (typeRef.type) {
    // Basic type
    if (typeRef.sizes.length === 0) {
      return typeRef.type;
    } else {
      // Array type
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
    // User defined type
    const typeDecl = typeRef.ref.ref;
    const typeName = typeDecl && "name" in typeDecl ? typeDecl.name : "UNKNOWN";

    if (typeRef.sizes.length === 0) {
      return typeName as string;
    } else {
      // Array of user defined type
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
 * Generate ST code for a function block
 * @param fbDecl Function block declaration from AST
 * @param destination Output directory
 * @returns Array of paths to the generated files
 */
function writeFunctionBlock(
  fbDecl: FunctionBlockDecl,
  destination: string
): string[] {
  const files: string[] = [];

  // Get the different parts of the function block
  const inputs = getInputs(fbDecl);
  const outputs = getOutputs(fbDecl);
  const locals = getLocals(fbDecl);
  const logic = getLogic(fbDecl);

  // Write declaration file
  const declFilePath = path.join(destination, `${fbDecl.name}_decl.st`);
  const declContent = toString(
    expandToNode`
      FUNCTION_BLOCK ${fbDecl.name}
      VAR_INPUT
          ${joinToNode(
            inputs,
            (input) => expandToNode`
              ${input.name}: ${convertTypeRefToST(input.typeRef)}${
              input.init ? ` := ${convertExprToST(input.init)}` : ""
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
              output.init ? ` := ${convertExprToST(output.init)}` : ""
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
              local.init ? ` := ${convertExprToST(local.init)}` : ""
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
  const implFilePath = path.join(destination, `${fbDecl.name}_impl.st`);
  const implContent = toString(
    expandToNode`
      ${joinToNode(logic?.stmts || [], (stmt) => convertStatementToST(stmt), {
        appendNewLineIfNotEmpty: true,
      })}
    `
  );
  fs.writeFileSync(implFilePath, implContent);
  files.push(implFilePath);

  return files;
}

/**
 * Convert a statement to ST code
 * @param stmt Statement to convert
 * @returns ST code representation of the statement
 */
function convertStatementToST(stmt: Statement): string {
  if (isAssignmentStmt(stmt)) {
    return `${convertExprToST(stmt.target)} := ${convertExprToST(stmt.value)};`;
  } else if (isIfStmt(stmt)) {
    let ifContent = `IF ${convertExprToST(stmt.condition)} THEN\n`;

    for (const subStmt of stmt.stmts) {
      ifContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    for (const elseIf of stmt.elseIfStmts) {
      ifContent += `ELSIF ${convertExprToST(elseIf.condition)} THEN\n`;
      for (const subStmt of elseIf.stmts) {
        ifContent += `  ${convertStatementToST(subStmt)}\n`;
      }
    }

    if (stmt.elseStmt) {
      ifContent += `ELSE\n`;
      for (const subStmt of stmt.elseStmt.stmts) {
        ifContent += `  ${convertStatementToST(subStmt)}\n`;
      }
    }

    ifContent += `END_IF;`;
    return ifContent;
  } else if (isWhileStmt(stmt)) {
    let whileContent = `WHILE ${convertExprToST(stmt.condition)} DO\n`;

    for (const subStmt of stmt.stmts) {
      whileContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    whileContent += `END_WHILE;`;
    return whileContent;
  } else if (isForStmt(stmt)) {
    let forContent = `FOR ${stmt.loopVar.name} := ${
      stmt.loopVar.init ? convertExprToST(stmt.loopVar.init) : "0"
    } TO ${convertExprToST(stmt.end)}`;

    if (stmt.step) {
      forContent += ` BY ${convertExprToST(stmt.step)}`;
    }

    forContent += ` DO\n`;

    for (const subStmt of stmt.stmts) {
      forContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    forContent += `END_FOR;`;
    return forContent;
  } else if (isSwitchStmt(stmt)) {
    let switchContent = `CASE ${convertExprToST(stmt.expr)} OF\n`;

    for (const caseOption of stmt.cases) {
      const literals = caseOption.literals
        .map((lit) => {
          if (isEnumMemberLiteral(lit.val)) {
            return `${lit.val.enumDecl.ref?.name}.${lit.val.member.ref?.name}`;
          } else {
            return String(lit.val);
          }
        })
        .join(", ");

      switchContent += `  ${literals}:\n`;

      for (const subStmt of caseOption.stmts) {
        switchContent += `    ${convertStatementToST(subStmt)}\n`;
      }
    }

    if (stmt.default) {
      switchContent += `  ELSE:\n`;

      for (const subStmt of stmt.default.stmts) {
        switchContent += `    ${convertStatementToST(subStmt)}\n`;
      }
    }

    switchContent += `END_CASE;`;
    return switchContent;
  } else if (isWaitStmt(stmt)) {
    return `// Wait statements are not directly supported in ST - using equivalent timer logic\n`;
  } else if (isBreakStmt(stmt)) {
    return `EXIT;`;
  } else if (isContinueStmt(stmt)) {
    return `CONTINUE;`;
  } else if (isRampStmt(stmt)) {
    return `// Ramp statements require custom implementation in TwinCAT\n// Target: ${convertExprToST(
      stmt.target
    )}, From: ${convertExprToST(stmt.fromExpr)}, To: ${convertExprToST(
      stmt.toExpr
    )}, Duration: ${stmt.dur}\n`;
  } else if (isExpressionStmt(stmt)) {
    return `${convertExprToST(stmt.expr)};`;
  } else if (isUseStmt(stmt)) {
    let useContent = "";

    // Handle function block instantiation and calling
    const fbType = stmt.functionBlockRef.ref?.name || "UNKNOWN_FB";
    
    // Create a proper instance name in camelCase, ensuring it's unique if needed
    let fbInstanceName = fbType.charAt(0).toLowerCase() + fbType.slice(1) + "Instance";
    
    // Check if we need to make the instance name unique
    let instanceCounter = 1;
    const baseInstanceName = fbInstanceName;
    while (usedInstanceNames.has(fbInstanceName)) {
      fbInstanceName = baseInstanceName + instanceCounter;
      instanceCounter++;
    }
    usedInstanceNames.add(fbInstanceName);

    // Map inputs
    const inputMappings = stmt.inputArgs
      .map((arg) => {
        return `${arg.inputVar.ref?.name}:=${convertExprToST(arg.value)}`;
      })
      .join(", ");

    // Handle output mapping
    if (stmt.useOutput.singleOutput) {
      const targetOutputVarName =
        stmt.useOutput.singleOutput.targetOutputVar.ref?.name || "output";
      useContent += `${fbInstanceName} := ${fbType}(${inputMappings});\n`;
      useContent += `${targetOutputVarName} := ${fbInstanceName}.${stmt.useOutput.singleOutput.fbOutputVar.ref?.name || "output"};\n`;
    } else if (stmt.useOutput.mappingOutputs.length > 0) {
      // First initialize the instance with input values
      useContent += `${fbInstanceName}(${inputMappings});\n`;

      // Map outputs from instance properties
      for (const outMapping of stmt.useOutput.mappingOutputs) {
        const targetOutputVarName = outMapping.targetOutputVar.ref?.name || "output";
        const fbOutputVarName = outMapping.fbOutputVar.ref?.name || "output";
        useContent += `${targetOutputVarName} := ${fbInstanceName}.${fbOutputVarName};\n`;
      }
    } else {
      useContent += `${fbInstanceName}(${inputMappings});\n`;
    }

    return useContent;
  } else if (isOnRisingEdgeStmt(stmt)) {
    // Get the signal name and expression
    const signalExpr = convertExprToST(stmt.signal);
    // Generate a unique instance name for the R_TRIG based on the signal
    const signalRefText =
      stmt.signal.ref && "$refText" in stmt.signal.ref
        ? (stmt.signal.ref as any).$refText
        : "signal";
    const instanceName = `R_TRIG_${signalRefText}_instance`;

    // Using Beckhoff's built-in R_TRIG function block for rising edge detection
    let risingContent = `// Rising edge detection for ${signalExpr}\n`;
    risingContent += `${instanceName}(CLK := ${signalExpr});\n`;
    risingContent += `IF ${instanceName}.Q THEN\n`;

    for (const subStmt of stmt.stmts) {
      risingContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    risingContent += `END_IF;`;
    return risingContent;
  } else if (isOnFallingEdgeStmt(stmt)) {
    // Get the signal name and expression
    const signalExpr = convertExprToST(stmt.signal);
    // Generate a unique instance name for the F_TRIG based on the signal
    const signalRefText =
      stmt.signal.ref && "$refText" in stmt.signal.ref
        ? (stmt.signal.ref as any).$refText
        : "signal";
    const instanceName = `F_TRIG_${signalRefText}_instance`;

    // Using Beckhoff's built-in F_TRIG function block for falling edge detection
    let fallingContent = `// Falling edge detection for ${signalExpr}\n`;
    fallingContent += `${instanceName}(CLK := ${signalExpr});\n`;
    fallingContent += `IF ${instanceName}.Q THEN\n`;

    for (const subStmt of stmt.stmts) {
      fallingContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    fallingContent += `END_IF;`;
    return fallingContent;
  } else if (isVarDecl(stmt)) {
    return `${stmt.name}: ${convertTypeRefToST(stmt.typeRef)}${
      stmt.init ? ` := ${convertExprToST(stmt.init)}` : ""
    };`;
  }

  return `// Unsupported statement type: ${(stmt as any).$type}`;
}

// Track used instance names to ensure uniqueness
const usedInstanceNames = new Set<string>();

/**
 * Generate ST code for the MAIN program
 * @param controlModel Control model from the DSL
 * @param destination Output directory
 * @returns Path to the generated file
 */
function writeProgramMain(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  destination: string
): string {
  // Collect all variables that need to be declared in the MAIN program
  const mainVars: VarDecl[] = [];
  // Collect all FB instances that need to be created
  const fbInstances: FunctionBlockDecl[] = [];
  // Collect all statements for the main logic
  const mainStatements: Statement[] = [];

  // Look for control units that should be included in MAIN
  for (const item of controlModel.controlBlock.items) {
    if (isControlUnit(item)) {
      const controlUnit = item;

      // Add statements from this control unit
      mainStatements.push(...controlUnit.stmts);

      // Process control unit local variables
      const varDecls = controlUnit.stmts.filter(isVarDecl);
      mainVars.push(...varDecls);

      // Find all function block references to create instances
      const useStmts = controlUnit.stmts.filter(isUseStmt);
      for (const useStmt of useStmts) {
        const fbRef = useStmt.functionBlockRef.ref;
        if (fbRef && !fbInstances.includes(fbRef)) {
          fbInstances.push(fbRef);
        }
      }
    }
  }

  // Extract hardware datapoints
  const { inputs, outputs } = extractHardwareDatapoints(hardwareModel);

  // Include R_TRIG and F_TRIG instances for edge detection
  const edgeDetectionFBs: string[] = [];

  // Look for edge detection statements and create FB instances for them
  mainStatements.forEach((stmt) => {
    if (isOnRisingEdgeStmt(stmt)) {
      const signal = stmt.signal;
      // Use $refText to get the signal name
      const signalRefText =
        signal.ref && "$refText" in signal.ref
          ? (signal.ref as any).$refText
          : "signal";
      edgeDetectionFBs.push(`R_TRIG_${signalRefText}_instance: R_TRIG;`);
    } else if (isOnFallingEdgeStmt(stmt)) {
      const signal = stmt.signal;
      // Use $refText to get the signal name
      const signalRefText =
        signal.ref && "$refText" in signal.ref
          ? (signal.ref as any).$refText
          : "signal";
      edgeDetectionFBs.push(`F_TRIG_${signalRefText}_instance: F_TRIG;`);
    }
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
            (varDecl) => expandToNode`
              ${varDecl.name}: ${convertTypeRefToST(varDecl.typeRef)}${
              varDecl.init ? ` := ${convertExprToST(varDecl.init)}` : ""
            };
            `,
            { appendNewLineIfNotEmpty: true }
          )}
          ${joinToNode(
            fbInstances,
            (fb) => expandToNode`
              ${fb.name.charAt(0).toLowerCase() + fb.name.slice(1)}Instance: ${
              fb.name
            };
            `,
            { appendNewLineIfNotEmpty: true }
          )}
          ${edgeDetectionFBs.join("\n          ")}
          bRunOnlyOnce: BOOL := FALSE;
      END_VAR
    `
  );

  // Generate implementation part
  const implContent = toString(
    expandToNode`
      // Initialize code - runs only once
      IF NOT bRunOnlyOnce THEN
          ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_ERROR OR ADSLOG_MSGTYPE_LOG, 
                   msgFmtStr := 'Program started %s', 
                   strArg := 'successfully!');
          bRunOnlyOnce := TRUE;
      END_IF

      // Main program logic
      ${joinToNode(
        mainStatements.filter((stmt) => !isVarDecl(stmt)),
        (stmt) => convertStatementToST(stmt),
        { appendNewLineIfNotEmpty: true }
      )}
    `
  );

  // Write declaration file
  const declFilePath = path.join(destination, `MAIN_decl.st`);
  fs.writeFileSync(declFilePath, declContent);

  // Write implementation file
  const implFilePath = path.join(destination, `MAIN_impl.st`);
  fs.writeFileSync(implFilePath, implContent);

  return implFilePath;
}

/**
 * Main function to generate C# compatible ST code from the DSL models
 * This creates both the individual files and combined format strings for C# integration
 */
export function generateBeckhoffCode(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  destination: string
): {
  files: string[];
  csharpStrings: Record<
    string,
    { declaration: string; implementation?: string }
  >;
} {
  // Generate individual ST files
  const files = generateBeckhoffArtifacts(
    controlModel,
    hardwareModel,
    destination
  );

  // Create C#-compatible strings for each POU
  const csharpStrings: Record<
    string,
    { declaration: string; implementation?: string }
  > = {};

  // Process each item in the control model to create C# ready strings
  for (const item of controlModel.controlBlock.items) {
    // Skip items marked as extern
    if ("isExtern" in item && item.isExtern) continue;

    if (isEnumDecl(item)) {
      const filePath = path.join(destination, `${item.name}.st`);
      csharpStrings[item.name] = {
        declaration: fs
          .readFileSync(filePath, "utf8")
          .replace(/\r\n/g, "\\r\\n"),
      };
    } else if (isStructDecl(item)) {
      const filePath = path.join(destination, `${item.name}.st`);
      csharpStrings[item.name] = {
        declaration: fs
          .readFileSync(filePath, "utf8")
          .replace(/\r\n/g, "\\r\\n"),
      };
    } else if (isFunctionBlockDecl(item)) {
      const declFilePath = path.join(destination, `${item.name}_decl.st`);
      const implFilePath = path.join(destination, `${item.name}_impl.st`);

      csharpStrings[item.name] = {
        declaration: fs
          .readFileSync(declFilePath, "utf8")
          .replace(/\r\n/g, "\\r\\n"),
        implementation: fs
          .readFileSync(implFilePath, "utf8")
          .replace(/\r\n/g, "\\r\\n"),
      };
    }
  }

  // Add MAIN program
  const mainDeclFilePath = path.join(destination, `MAIN_decl.st`);
  const mainImplFilePath = path.join(destination, `MAIN_impl.st`);

  csharpStrings["MAIN"] = {
    declaration: fs
      .readFileSync(mainDeclFilePath, "utf8")
      .replace(/\r\n/g, "\\r\\n"),
    implementation: fs
      .readFileSync(mainImplFilePath, "utf8")
      .replace(/\r\n/g, "\\r\\n"),
  };

  return { files, csharpStrings };
}

/**
 * Extract hardware datapoints from the hardware model
 * These will be used to create I/O variables in the PLC program
 */
function extractHardwareDatapoints(hardwareModel: HardwareModel): {
  inputs: Array<{ name: string; type: string; ioBinding: string }>;
  outputs: Array<{ name: string; type: string; ioBinding: string }>;
} {
  const inputs: Array<{ name: string; type: string; ioBinding: string }> = [];
  const outputs: Array<{ name: string; type: string; ioBinding: string }> = [];

  // Process each controller in the hardware model
  for (const controller of hardwareModel.controllers) {
    // We only process Beckhoff hardware components
    if (controller.platform !== "Beckhoff") continue;

    // Map to hold port groups for reference
    const portGroups = new Map();

    // First pass: collect all port groups
    for (const component of controller.components) {
      if ("moduleType" in component) {
        // PortGroup
        portGroups.set(component.name, component);
      }
    }

    // Second pass: process all datapoints
    for (const component of controller.components) {
      if ("portgroup" in component) {
        // Datapoint
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
          const ioType = addrMatch[2] || getDefaultIOType(plcType); // X, B, W, D, L if specified
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

/**
 * Get the default IO type suffix based on the data type
 */
function getDefaultIOType(plcType: string): string {
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
