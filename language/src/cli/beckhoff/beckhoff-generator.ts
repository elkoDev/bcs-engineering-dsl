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
  UseStmt,
  NamedElement,
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
 * Convert an expression to a valid ST expression
 */
function convertExprToST(expr: Expr): string {
  if (isPrimary(expr)) {
    if (isRef(expr)) {
      if (expr.ref && expr.properties && expr.properties.length > 0) {
        const baseName = getReferenceName(expr.ref);
        const propNames = expr.properties.map((prop) => getReferenceName(prop));
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
    } else if (isPrimitive(expr)) {
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
 * @param edgeMetadata Optional metadata for edge detection statements [type, counter]
 * @returns ST code representation of the statement
 */
function convertStatementToST(
  stmt: Statement,
  edgeMetadata?: [string, number]
): string {
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
  } else if (isExpressionStmt(stmt)) {
    return `${convertExprToST(stmt.expr)};`;
  } else if (isUseStmt(stmt)) {
    let useContent = "";

    // Handle function block instantiation and calling
    const fbType = stmt.functionBlockRef.ref?.name || "UNKNOWN_FB";

    // Create a proper instance name in camelCase, ensuring it's unique if needed
    let fbInstanceName =
      fbType.charAt(0).toLowerCase() + fbType.slice(1) + "Instance";

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
        stmt.useOutput.singleOutput.targetOutputVar.ref?.name ?? "output";
      // Using direct access for single output case, which returns directly from FB call
      useContent += `${fbInstanceName} := ${fbType}(${inputMappings});\n`;
      useContent += `${targetOutputVarName} := ${fbInstanceName};`;
    } else if (stmt.useOutput.mappingOutputs.length > 0) {
      // First initialize the instance with input values
      useContent += `${fbInstanceName}(${inputMappings});\n`;

      // Map outputs from instance properties
      for (const outMapping of stmt.useOutput.mappingOutputs) {
        const targetOutputVarName =
          outMapping.targetOutputVar.ref?.name || "output";
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

    // Look up the proper instance name from our pre-processed map
    let instanceName;
    if (
      edgeMetadata &&
      edgeDetectionInstanceMap.has(`${signalExpr}_rising_${edgeMetadata[1]}`)
    ) {
      instanceName = edgeDetectionInstanceMap.get(
        `${signalExpr}_rising_${edgeMetadata[1]}`
      );
    } else {
      // Fallback to existing logic if needed
      const signalPath = signalExpr.replace(/\./g, "_");
      instanceName = `R_TRIG_${signalPath}_Instance`;
    }

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

    // Look up the proper instance name from our pre-processed map
    let instanceName;
    if (
      edgeMetadata &&
      edgeDetectionInstanceMap.has(`${signalExpr}_falling_${edgeMetadata[1]}`)
    ) {
      instanceName = edgeDetectionInstanceMap.get(
        `${signalExpr}_falling_${edgeMetadata[1]}`
      );
    } else {
      // Fallback to existing logic if needed
      const signalPath = signalExpr.replace(/\./g, "_");
      instanceName = `F_TRIG_${signalPath}_Instance`;
    }

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

// Map to track edge detection instances (signal expression -> instance name)
const edgeDetectionInstanceMap = new Map<string, string>();

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
  // Reset the used instance names and edge detection maps to ensure clean tracking for this program
  usedInstanceNames.clear();
  edgeDetectionInstanceMap.clear();

  // Collect all variables that need to be declared in the MAIN program
  const mainVars: VarDecl[] = [];
  // Collect all FB instances that need to be created
  // Use Map to store instance name -> FB type
  const fbInstancesMap = new Map<string, string>();
  // Map to track FB instances by FB type and index (similar to edge detection)
  const fbInstanceTracker = new Map<string, Map<number, string>>();
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
          usedInstanceNames.add(instanceName);

          // Store for later reference in statement conversion
          fbInstanceTracker.get(fbType)?.set(index, instanceName);
        });
      }
    }
  }

  // Extract hardware datapoints
  const { inputs, outputs } = extractHardwareDatapoints(hardwareModel);

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
    const signalExpr = convertExprToST(stmt.signal);

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
    usedInstanceNames.add(instanceName);

    // Store this specific instance name for this statement
    // Use a unique key combining statement type, signal, and index
    const key = `rising_${signalExpr}_${index}`;
    edgeDetectionInstanceMap.set(key, instanceName);
  });

  // Process falling edge statements next
  fallingEdgeStatements.forEach((stmt, index) => {
    // Get the signal expression string
    const signalExpr = convertExprToST(stmt.signal);

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
    usedInstanceNames.add(instanceName);

    // Store this specific instance name for this statement
    // Use a unique key combining statement type, signal, and index
    const key = `falling_${signalExpr}_${index}`;
    edgeDetectionInstanceMap.set(key, instanceName);
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
          ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_ERROR OR ADSLOG_MSGTYPE_LOG, 
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
              return convertEdgeDetectionToST(stmt, statementIndex, "rising");
            }
          } else if (isOnFallingEdgeStmt(stmt)) {
            // Find this statement's index in the fallingEdgeStatements array
            const statementIndex = fallingEdgeStatements.indexOf(stmt);
            if (statementIndex !== -1) {
              return convertEdgeDetectionToST(stmt, statementIndex, "falling");
            }
          } else if (isUseStmt(stmt)) {
            // Handle function block use statements with consistent instance tracking
            return convertUseStmtToST(stmt, fbInstanceTracker);
          }
          return convertStatementToST(stmt);
        },
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
 * Convert an edge detection statement (rising or falling) to ST code
 * @param stmt The edge detection statement
 * @param index The index of this statement among others of the same type
 * @param type The type of edge detection ("rising" or "falling")
 * @returns ST code for the edge detection
 */
function convertEdgeDetectionToST(
  stmt: Statement,
  index: number,
  type: "rising" | "falling"
): string {
  if (type === "rising" && isOnRisingEdgeStmt(stmt)) {
    // Get the signal name and expression
    const signalExpr = convertExprToST(stmt.signal);

    // Get the instance name from our mapping using the unique key
    const key = `${type}_${signalExpr}_${index}`;
    const instanceName = edgeDetectionInstanceMap.get(key);

    if (!instanceName) {
      console.warn(`Could not find instance name for rising edge: ${key}`);
      return "// ERROR: Missing edge detection instance";
    }

    // Using Beckhoff's built-in R_TRIG function block for rising edge detection
    let risingContent = `// Rising edge detection for ${signalExpr}\n`;
    risingContent += `${instanceName}(CLK := ${signalExpr});\n`;
    risingContent += `IF ${instanceName}.Q THEN\n`;

    for (const subStmt of stmt.stmts) {
      risingContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    risingContent += `END_IF;`;
    return risingContent;
  } else if (type === "falling" && isOnFallingEdgeStmt(stmt)) {
    // Get the signal name and expression
    const signalExpr = convertExprToST(stmt.signal);

    // Get the instance name from our mapping using the unique key
    const key = `${type}_${signalExpr}_${index}`;
    const instanceName = edgeDetectionInstanceMap.get(key);

    if (!instanceName) {
      console.warn(`Could not find instance name for falling edge: ${key}`);
      return "// ERROR: Missing edge detection instance";
    }

    // Using Beckhoff's built-in F_TRIG function block for falling edge detection
    let fallingContent = `// Falling edge detection for ${signalExpr}\n`;
    fallingContent += `${instanceName}(CLK := ${signalExpr});\n`;
    fallingContent += `IF ${instanceName}.Q THEN\n`;

    for (const subStmt of stmt.stmts) {
      fallingContent += `  ${convertStatementToST(subStmt)}\n`;
    }

    fallingContent += `END_IF;`;
    return fallingContent;
  }

  return "// Error: Invalid edge detection statement";
}

/**
 * Convert a UseStmt to ST code using the consistent instance tracking system
 * @param stmt The UseStmt to convert
 * @param fbInstanceTracker The map tracking function block instances
 * @returns ST code for the function block use
 */
function convertUseStmtToST(
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
    if (!usedInstanceNames.has(`used_${fbType}_${name}`)) {
      fbInstanceName = name;
      // Mark this specific instance as used
      usedInstanceNames.add(`used_${fbType}_${name}`);
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
      return `${arg.inputVar.ref?.name}:=${convertExprToST(arg.value)}`;
    })
    .join(", ");

  // Handle output mapping
  if (stmt.useOutput.singleOutput) {
    const targetOutputVarName =
      stmt.useOutput.singleOutput.targetOutputVar.ref?.name ?? "output";
    // Using direct access for single output case, which returns directly from FB call
    useContent += `${fbInstanceName} := ${fbType}(${inputMappings});\n`;
    useContent += `${targetOutputVarName} := ${fbInstanceName};`;
  } else if (stmt.useOutput.mappingOutputs.length > 0) {
    // First initialize the instance with input values
    useContent += `${fbInstanceName}(${inputMappings});\n`;

    // Map outputs from instance properties
    for (const outMapping of stmt.useOutput.mappingOutputs) {
      const targetOutputVarName =
        outMapping.targetOutputVar.ref?.name ?? "output";
      const fbOutputVarName = outMapping.fbOutputVar.ref?.name ?? "output";
      useContent += `${targetOutputVarName} := ${fbInstanceName}.${fbOutputVarName};\n`;
    }
  } else {
    useContent += `${fbInstanceName}(${inputMappings});\n`;
  }

  return useContent;
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
  const files = generateBeckhoffArtifacts(
    controlModel,
    hardwareModel,
    destination
  );

  function createCSharpString(filePath: string): string {
    return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\\r\\n");
  }

  // Create C#-compatible strings for each POU
  const csharpStrings: Record<
    string,
    { declaration: string; implementation?: string }
  > = {};

  // Process each item in the control model to create C# ready strings
  for (const item of controlModel.controlBlock.items) {
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
        declaration: createCSharpString(filePath),
      };
    } else if (isFunctionBlockDecl(item)) {
      const declFilePath = path.join(destination, `${item.name}_decl.st`);
      const implFilePath = path.join(destination, `${item.name}_impl.st`);

      csharpStrings[item.name] = {
        declaration: createCSharpString(declFilePath),
        implementation: createCSharpString(implFilePath),
      };
    }
  }

  // Add MAIN program
  const mainDeclFilePath = path.join(destination, `MAIN_decl.st`);
  const mainImplFilePath = path.join(destination, `MAIN_impl.st`);

  csharpStrings["MAIN"] = {
    declaration: createCSharpString(mainDeclFilePath),
    implementation: createCSharpString(mainImplFilePath),
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
