grammar BCSControl
import "./bcs-hardware"

// ==========================================================================
// 1) Entry Rule: A control block referencing a hardware controller.
//    Inside, you may define Declarations (enums, variables, function blocks)
//    and ControlUnits. ControlUnits are the primary construct for all control logic, whether
//    time‐based (using TOD expressions) or event‐driven.
// ==========================================================================
entry ControlModel: 
    (importDecls+=ImportDecl)*
    (externTypeDecls+=ExternTypeDecl)*
    controlBlock=ControlBlock 
;

ImportDecl:
    'import' 'library' libName=ID ';'
;


ControlBlock:
    'control' controller=[Controller] '{'
        (items+=ControlItem)*
    '}'
;   

ControlItem:
      Declaration
    | ControlUnit
;

// ==========================================================================
// 2) Declarations: Enums, Variables, Function Blocks
// ==========================================================================
Declaration:
      EnumDecl
    | VarDecl
    | FunctionBlockDecl
;

EnumDecl:
    'enum' name=ID '{'
        members+=EnumMemberDecl (',' members+=EnumMemberDecl)*
    '}'
;

EnumMemberDecl:
    name=ID;

fragment VarDeclCore:
    name=ID ':' typeRef=TypeRef ('=' init=Expr)? ';'
;

VarDecl:
    'var' VarDeclCore
;

FunctionBlockDecl:
    isExtern?='extern'? 'functionblock' name=ID '{'
        members+=FunctionBlockMember*
    '}'
;

FunctionBlockMember:
      FunctionBlockInputs
    | FunctionBlockOutputs
    | FunctionBlockLocals
    | FunctionBlockLogic
;

FunctionBlockInputs:
    'inputs' '{' (inputs+=VarDecl)* '}'
;

FunctionBlockOutputs:
    'outputs' '{' (outputs+=VarDecl)* '}'
;

FunctionBlockLocals:
    'locals' '{' (locals+=VarDecl)* '}'
;

FunctionBlockLogic:
    'logic' Block
;

ExternTypeDecl:
    'extern' 'type' name=ID ';'
;


TypeDecl:
    EnumDecl
    | FunctionBlockDecl
    | ExternTypeDecl
;

TypeRef:
      type=PrimitiveType
    | ref=[TypeDecl]
;

// ==========================================================================
// 3) ControlUnits (Control Logic)
//    A unit is a named block of control logic that may be triggered by any
//    expression – for example, a time-of-day comparison using now or a TOD literal.
// ==========================================================================
ControlUnit:
    // Future Note: Support on `event` and raise `event` stmt
    'unit' name=ID (('once'? 'when' '(' condition=Expr ')') | ('at' time=TodLiteral))? Block;


// ==========================================================================
// 4) Block and Statements: Assignment, Conditionals, Loops, Calls, Timing & Edge actions
// ==========================================================================
fragment Block:
    '{' (stmts+=Statement)* '}'
;

Statement:
      AssignmentStmt
    | IfStmt
    | WhileStmt
    | ForStmt
    | SwitchStmt
    | ExpressionStmt
    | LocalVarDeclStmt
    | WaitStmt
    | EdgeStmt
    | RampStmt
    | UseStmt
;

AssignmentStmt:
    target=Ref '=' value=Expr ';'
;

IfStmt:
    'if' '(' condition=Expr ')' Block ( elseIfStmts+=ElseIfStmt )* ( elseStmt=ElseStmt )?
;

ElseIfStmt:
    'else' 'if' '(' condition=Expr ')' Block
;

ElseStmt:
    'else' Block
;

WhileStmt:
    'while' '(' condition=Expr ')' Block
;

ForStmt:
    'for' '(' loopVar=LoopVarDecl 'to' end=Expr ( 'by' step=Expr )? ')' Block
;

LoopVarDecl infers VarDecl:
    'var' name=ID ':' typeRef=TypeRef '=' init=Expr
;

SwitchStmt:
    'switch' '(' expr=Expr ')' '{'
         cases+=CaseOption+
         (default=DefaultOption)?
    '}'
;

CaseOption:
    'case' (literals+=CaseLiteral (',' literals+=CaseLiteral)*) ':' Block
;

DefaultOption:
    'default' ':' Block
;

ExpressionStmt:
    expr=Expr ';'
;

LocalVarDeclStmt infers VarDecl:
    'var' VarDeclCore
;

UseStmt:
    'use' functionBlockRef=[FunctionBlockDecl]
    '(' inputArgs+=InputMapping (',' inputArgs+=InputMapping)* ')'
    '->' useOutput=UseOutput ';'
;

InputMapping:
    inputVar=[VarDecl] ':' value=Expr
;

UseOutput:
    singleOutput=SimpleUseResult
    | '{' mappingOutputs+=MappingUseResult (',' mappingOutputs+=MappingUseResult)* '}'
;

SimpleUseResult:
    outputVar=[VarDecl]
;

MappingUseResult:
    outputVar=[VarDecl] ':' fbOutput=[VarDecl]
;


// --------------------------------------------------------------------------
// Timing and Edge Statements
// --------------------------------------------------------------------------
WaitStmt:
    'wait' time=TimeLiteral ';'
;

EdgeStmt:
     OnRisingEdgeStmt
    | OnFallingEdgeStmt
;

fragment EdgeStatementCore:
    '(' signal=Ref ')'
;

OnRisingEdgeStmt:
    'on_rising' EdgeStatementCore Block
;    

OnFallingEdgeStmt:
    'on_falling' EdgeStatementCore Block
;

RampStmt:
    'ramp' '(' target=Ref ',' fromExpr=Expr ',' toExpr=Expr ',' dur=TimeLiteral ')' ';'
;

// ==========================================================================
// 5) Expressions & Literals
//    Expressions are the core of the control logic, allowing for complex evaluations and assignments.
//    Literals are the basic building blocks of expressions, including numbers, booleans, strings, and enums.
// ==========================================================================
CaseLiteral:
       val=(NumberLiteral | BooleanLiteral | StringLiteral | EnumMemberLiteral)
;


EnumMemberLiteral:
    value=[EnumDecl:ID] op='.' member=[EnumMemberDecl:ID]  
;

Expr:
    OrExpr
;

OrExpr infers Expr:
    AndExpr ({infer BinExpr.e1=current} op='||' e2=AndExpr)*
;

AndExpr infers Expr:
    Comparison ({infer BinExpr.e1=current} op='&&' e2=Comparison)*
;

Comparison infers Expr:
    Add ({infer BinExpr.e1=current} op=ComparisonOperator e2=Add)?
;

Add infers Expr:
    Mult ({infer BinExpr.e1=current} op=('+'|'-') e2=Mult)*
;

Mult infers Expr:
    Primary ({infer BinExpr.e1=current} op=('*'|'/') e2=Primary)*
;

Primary:
    'now'   
  | ParenExpr
  | NegExpr
  | NotExpr
  | Ref                          
  | val=NumberLiteral
  | val=BooleanLiteral
  | val=StringLiteral
  | val=TodLiteral   
  | val=TimeLiteral                  
;

NegExpr:
    '-' expr=Expr
;

NotExpr:
    '!' expr=Expr
;    

ParenExpr:
    '(' expr=Expr ')'
;

Ref:
    ref=[NamedElement] ('.' property=[NamedElement])?;

NamedElement: VarDecl | EnumDecl | Datapoint;

ComparisonOperator returns string:
    '<' | '<=' | '==' | '!=' | '>=' | '>'
;