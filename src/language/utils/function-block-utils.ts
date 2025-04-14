import {
  FunctionBlockDecl,
  FunctionBlockLogic,
  VarDecl,
  isFunctionBlockInputs,
  isFunctionBlockLocals,
  isFunctionBlockLogic,
  isFunctionBlockOutputs,
} from "../generated/ast.js";

/**
 * Get all input variables from a function block.
 */
export function getInputs(fb: FunctionBlockDecl): VarDecl[] {
  return fb.members.flatMap((member) =>
    isFunctionBlockInputs(member) ? member.inputs : []
  );
}

/**
 * Get all output variables from a function block.
 */
export function getOutputs(fb: FunctionBlockDecl): VarDecl[] {
  return fb.members.flatMap((member) =>
    isFunctionBlockOutputs(member) ? member.outputs : []
  );
}

/**
 * Get all local variables from a function block.
 */
export function getLocals(fb: FunctionBlockDecl): VarDecl[] {
  return fb.members.flatMap((member) =>
    isFunctionBlockLocals(member) ? member.locals : []
  );
}

/**
 * Get the logic block of a function block, if defined.
 */
export function getLogic(
  fb: FunctionBlockDecl
): FunctionBlockLogic | undefined {
  return fb.members.find(isFunctionBlockLogic);
}
