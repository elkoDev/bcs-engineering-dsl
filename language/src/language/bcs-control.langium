grammar BCSControl
import "./bcs-hardware"

// ==========================================================================
// 1) Entry Rule
// ==========================================================================
entry ControlModel: 
    (importDecls+=ImportDecl)*
    (externTypeDecls+=TypeDecl)*
    controlBlock=ControlBlock 
;

ImportDecl:
    'import' 'library' name=ID ';'
;


// ==========================================================================
// 2) Control block and items
// ==========================================================================
ControlBlock:
    'control' controller=[Controller] '{'
        (items+=ControlItem)*
    '}'
;

ControlItem:
    Declaration | ControlUnit
;

// ==========================================================================
// 3) Declarations (types, vars, function blocks)
// ==========================================================================
Declaration:
      EnumDecl
    | StructDecl
    | VarDecl
    | FunctionBlockDecl
    | TypeAlias
;

TypeDecl:
    (isExtern='extern')? (EnumDecl | StructDecl | FunctionBlockDecl | TypeAlias)
;

TypeAlias:
    'type' name=ID 'as' primitive=PrimitiveType ';'
;

// ---------- ENUM ----------
EnumDecl:
    'enum' name=ID '{'
        members+=EnumMemberDecl (',' members+=EnumMemberDecl)*
    '}'
;

EnumMemberDecl:
    name=ID
;

// ---------- STRUCT ----------
StructDecl:
    'struct' name=ID '{'
        fields+=StructFieldDecl (',' fields+=StructFieldDecl)*
    '}'
;

StructFieldDecl:
    name=ID ':' typeRef=TypeRef ('=' init=Expr)? // allow default value
;

// ---------- FUNCTION BLOCK ----------
FunctionBlockDecl:
    'functionblock' name=ID ('from' libRef=[ImportDecl:ID])?  '{'
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

// ---------- VARIABLE ----------
fragment VarDeclCore:
    name=ID ':' typeRef=TypeRef ('=' init=Expr)? ';'
;

VarDecl:
    'var' VarDeclCore
;


// ==========================================================================
TypeRef:
    (type=PrimitiveType | ref=[TypeDecl]) ('[' (sizes+=Expr)? ']')*
;


// ==========================================================================
// 4) Control Units
// ==========================================================================
ControlUnit:
    // Future Note: Support on `event` and raise `event` stmt
    'unit' name=ID (((isOnce='once')? 'when' '(' condition=Expr ')') | ('at' time=TodLiteral))? Block
;


// ==========================================================================
// 5) Blocks and Statements
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
    | AfterStmt
    | EdgeStmt
    | UseStmt
    | ContinueStmt
    | BreakStmt
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
    'for' '(' loopVar=LoopVarDecl 'to' toExpr=Expr ( 'by' step=Expr )? ')' Block
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
    targetOutputVar=[VarDecl]
;

MappingUseResult:
    fbOutputVar=[VarDecl] ':' targetOutputVar=[VarDecl]
;


// --------------------------------------------------------------------------
// Timing and Edge Statements
// --------------------------------------------------------------------------
AfterStmt:
    'after' time=TimeLiteral 'if' '(' condition=Expr ')' Block
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

// --------------------------------------------------------------------------
// Loop Control Statements
// --------------------------------------------------------------------------
type LoopControlStmt = ContinueStmt | BreakStmt;

ContinueStmt returns LoopControlStmt:
    {infer ContinueStmt}
    'continue' ';'
;

BreakStmt returns LoopControlStmt:
    {infer BreakStmt}
    'break' ';'
;


// ==========================================================================
// 6) Expressions and Literals
// ==========================================================================
CaseLiteral:
       val=(NumberLiteral | BooleanLiteral | StringLiteral | EnumMemberLiteral)
;


EnumMemberLiteral:
    enumDecl=[EnumDecl:ID] op='.' member=[EnumMemberDecl:ID]  
;

ArrayLiteral:
    '[' (elements+=Expr (',' elements+=Expr)*)? ']'
;

StructLiteral:
    '{' (fields+=StructFieldInit (',' fields+=StructFieldInit)*)? '}'
;

StructFieldInit:
    name=ID ':' value=Expr
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
    isNow='now'   
  | ParenExpr
  | NegExpr
  | NotExpr
  | Ref                          
  | val=NumberLiteral
  | val=BooleanLiteral
  | val=StringLiteral
  | val=TodLiteral   
  | val=TimeLiteral 
  | val=ArrayLiteral
  | val=StructLiteral                 
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
    ref=[NamedElement] ('.' properties+=[NamedElement] | '[' indices+=Expr ']')*;

type NamedElement = VarDecl | EnumDecl | StructDecl | Datapoint;

ComparisonOperator returns string:
    '<' | '<=' | '==' | '!=' | '>=' | '>'
;