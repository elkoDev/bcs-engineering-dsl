import {
  ControlModel,
  isEnumDecl,
  isFunctionBlockDecl,
  isStructDecl,
  HardwareModel,
  EnumDecl,
  StructDecl,
  FunctionBlockDecl,
  FunctionBlockMember,
  VarDecl,
  isFunctionBlockInputs,
  isFunctionBlockOutputs,
  isFunctionBlockLocals,
  isFunctionBlockLogic,
  TypeRef,
  Primary,
  isRef,
  isBinExpr,
  BinExpr,
  isNegExpr,
  isNotExpr,
  isPrimary,
  isPrimitive,
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
  isLocalVarDeclStmt,
  isOnRisingEdgeStmt,
  isOnFallingEdgeStmt,
  Expr,
  isVarDecl,
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
    if (item.$type === "TypeDecl" && item.isExtern) continue;

    if (isEnumDecl(item)) files.push(writeEnum(item, destination));
    else if (isStructDecl(item)) files.push(writeStruct(item, destination));
    else if (isFunctionBlockDecl(item))
      files.push(...writeFunctionBlock(item, destination));
  }

  files.push(writeProgramMain(controlModel, destination));
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
        .map(
          (size, i) => `0..${typeof size.val === "number" ? size.val - 1 : "?"}`
        )
        .join(", ")}] OF ${typeRef.type}`;
    }
  } else if (typeRef.ref) {
    // User defined type
    const typeName = typeRef.ref.ref?.name || "UNKNOWN";

    if (typeRef.sizes.length === 0) {
      return typeName;
    } else {
      // Array of user defined type
      return `ARRAY [${typeRef.sizes
        .map(
          (size, i) => `0..${typeof size.val === "number" ? size.val - 1 : "?"}`
        )
        .join(", ")}] OF ${typeName}`;
    }
  }

  return "UNKNOWN_TYPE";
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
      let result = expr.ref.ref?.name || "";

      // Add indices if any
      if (expr.indices.length > 0) {
        result += `[${expr.indices
          .map((idx) => convertExprToST(idx))
          .join(", ")}]`;
      }

      // Add properties if any
      for (const prop of expr.properties) {
        result += `.${prop.ref?.name || ""}`;
      }

      return result;
    } else if (isNegExpr(expr)) {
      return `-${convertExprToST(expr.expr)}`;
    } else if (isNotExpr(expr)) {
      return `NOT ${convertExprToST(expr.expr)}`;
    }
  } else if (isBinExpr(expr)) {
    // Special handling for operators that are different in ST
    const op = translateOperator(expr.op);
    return `${convertExprToST(expr.e1)} ${op} ${convertExprToST(expr.e2)}`;
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
            return lit.val.toString();
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
    const fbName = stmt.functionBlockRef.ref?.name || "UNKNOWN_FB";

    // Map inputs
    const inputMappings = stmt.inputArgs
      .map((arg) => {
        return `${arg.inputVar.ref?.name}:=${convertExprToST(arg.value)}`;
      })
      .join(", ");

    // Handle output mapping
    if (stmt.useOutput.singleOutput) {
      const outVarName = stmt.useOutput.singleOutput.outputVar.ref?.name;
      useContent += `${outVarName} := ${fbName}(${inputMappings});\n`;
    } else if (stmt.useOutput.mappingOutputs.length > 0) {
      useContent += `${fbName}(${inputMappings});\n`;

      // Map outputs after function block call
      for (const outMapping of stmt.useOutput.mappingOutputs) {
        const outVarName = outMapping.outputVar.ref?.name;
        const fbOutName = outMapping.fbOutput.ref?.name;
        useContent += `${outVarName} := ${fbName}.${fbOutName};\n`;
      }
    } else {
      useContent += `${fbName}(${inputMappings});\n`;
    }

    return useContent;
  } else if (isOnRisingEdgeStmt(stmt)) {
    let risingContent = `// Rising edge detection\nIF ${convertExprToST(
      stmt.signal
    )} AND NOT _prev_${stmt.signal.ref.ref?.name || "signal"} THEN\n`;

    for (const subStmt of stmt.stmts) {
      risingContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    risingContent += `END_IF;\n_prev_${
      stmt.signal.ref.ref?.name || "signal"
    } := ${convertExprToST(stmt.signal)};`;
    return risingContent;
  } else if (isOnFallingEdgeStmt(stmt)) {
    let fallingContent = `// Falling edge detection\nIF NOT ${convertExprToST(
      stmt.signal
    )} AND _prev_${stmt.signal.ref.ref?.name || "signal"} THEN\n`;

    for (const subStmt of stmt.stmts) {
      fallingContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    fallingContent += `END_IF;\n_prev_${
      stmt.signal.ref.ref?.name || "signal"
    } := ${convertExprToST(stmt.signal)};`;
    return fallingContent;
  } else if (isVarDecl(stmt)) {
    return `${stmt.name}: ${convertTypeRefToST(stmt.typeRef)}${
      stmt.init ? ` := ${convertExprToST(stmt.init)}` : ""
    };`;
  }

  return `// Unsupported statement type: ${stmt.$type}`;
}

function writeProgramMain(
  controlModel: ControlModel,
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
    if (item.$type === "ControlUnit") {
      const controlUnit = item as any; // Type as any since we access it directly

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

  // Create instance variables for all used function blocks
  const fbInstanceVars = fbInstances.map((fb) => {
    const varDecl: VarDecl = {
      $type: "VarDecl",
      name: `${fb.name.charAt(0).toLowerCase() + fb.name.slice(1)}Instance`,
      typeRef: {
        $type: "TypeRef",
        ref: { ref: fb } as any,
        sizes: [],
      },
    } as any; // Type as any since we're constructing it manually

    return varDecl;
  });

  mainVars.push(...fbInstanceVars);

  // Add standard variables for the MAIN program
  const runOnceVar: VarDecl = {
    $type: "VarDecl",
    name: "bRunOnlyOnce",
    typeRef: {
      $type: "TypeRef",
      type: "BOOL",
      sizes: [],
    },
    init: {
      $type: "Primary",
      val: false,
    },
  } as any;

  mainVars.push(runOnceVar);

  // Generate declaration part
  const declContent = toString(
    expandToNode`
      PROGRAM MAIN
      VAR
          ${joinToNode(
            mainVars,
            (varDecl) => expandToNode`
              ${varDecl.name}: ${convertTypeRefToST(varDecl.typeRef)}${
              varDecl.init ? ` := ${convertExprToST(varDecl.init)}` : ""
            };
            `,
            { appendNewLineIfNotEmpty: true }
          )}
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
    if (item.$type === "TypeDecl" && item.isExtern) continue;

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
 * Helper function to check if a Primary node is a primitive value (number, string, boolean)
 */
function isPrimitive(expr: Primary): boolean {
  return (
    typeof expr.val === "number" ||
    typeof expr.val === "string" ||
    typeof expr.val === "boolean"
  );
}
