grammar BCSControl
import "./bcs-hardware"

// ==========================================================================
// 1) Entry Rule: A control block references a hardware controller.
//     Inside, you may define Declarations (enums, variables, function blocks),
//     Units (for event‐based control), or Schedules (for time‐based control).
// ==========================================================================
entry ControlModel:
    'control' controller=[Controller] '{'
        (items+=ControlItem)*
    '}'
;

ControlItem:
      Declaration
    | ControlUnit
    | Schedule
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
        members+=ID (',' members+=ID)*
    '}'
;

fragment VarDeclCore:
    name=ID ':' type=TypeRef ('=' init=Expr)? ';'
;

VarDecl:
    'var' VarDeclCore
;

FunctionBlockDecl:
    'functionblock' name=ID '{'
        ('inputs' '{' (inputs+=VarDecl)* '}' )?
        ('outputs' '{' (outputs+=VarDecl)* '}' )?
        ('locals' '{' (locals+=VarDecl)* '}' )?
        ('logic' '{' (stmts+=Statement)* '}' )?
    '}'
;

TypeDecl:
    EnumDecl
    | FunctionBlockDecl
;

TypeRef infers TypeRef:
      {infer TypeRef} 'BOOL'
    | {infer TypeRef} 'INT'
    | {infer TypeRef} 'REAL'
    | {infer TypeRef} 'STRING'
    | {infer TypeRef} 'TIME'
    | {infer TypeRef} 'TOD'
    | {infer TypeRef} 'DT'
    | {infer TypeRef} ref=[TypeDecl]        // TODO: scope provider
;

// ==========================================================================
// 3) Control Units & Schedules
//    - A ControlUnit is for general (typically event‐driven) control logic.
//    - A Schedule is a special unit for time‐of‐day triggers.
// ==========================================================================
ControlUnit:
    'unit' name=ID ('when' condition=Expr)? '{'
        (stmts+=Statement)*
    '}'
;

Schedule:
    'schedule' name=ID 'at' time=TodLiteral '{'
        (stmts+=Statement)*
    '}'
;

// ==========================================================================
// 4) Statements: Assignment, Conditionals, Loops, Calls, Timing & Edge actions
// ==========================================================================
Statement:
      AssignmentStmt
    | IfStmt
    | WhileStmt
    | ForStmt
    | CaseStmt
    | FunctionBlockCallStmt
    | ExpressionStmt
    | LocalVarDeclStmt
    | WaitStmt
    | EdgeStmt
    | RampStmt
;

AssignmentStmt:
    target=Ref ':=' value=Expr ';'
;

IfStmt:
    ifBranch=IfBranch
    elsifBranches+=ElsifBranch*
    elseBranch=ElseBranch?
    'END_IF' ';'
;

IfBranch:
    'IF' condition=Expr 'THEN'
        (stmts+=Statement)* 
;

ElsifBranch:
    'ELSIF' condition=Expr 'THEN'
        (stmts+=Statement)* 
;

ElseBranch:
    'ELSE' (stmts+=Statement)* 
;

WhileStmt:
    'WHILE' condition=Expr 'DO'
        (stmts+=Statement)*
    'END_WHILE' ';'?
;

ForStmt:
    'FOR' loopVar=ID ':=' start=Expr 'TO' end=Expr ('BY' step=Expr)?
    'DO'
        (stmts+=Statement)*
    'END_FOR' ';'?
;

CaseStmt:
    'CASE' expr=Expr 'OF'
        (cases+=CaseOption)+
    'END_CASE' ';'?
;

CaseOption:
    (literals+=Literal (',' literals+=Literal)*) ':' '{'
        (stmts+=Statement)*
    '}'
;

FunctionBlockCallStmt:
    target=Ref '(' (args+=Argument (',' args+=Argument)*)? ')' ';'
;

Argument:
    name=ID ':=' value=Expr
;

ExpressionStmt:
    expr=Expr ';'
;

LocalVarDeclStmt infers VarDecl:
    'var' VarDeclCore
;

// --------------------------------------------------------------------------
// Timing and Edge Statements
// --------------------------------------------------------------------------
WaitStmt:
    'WAIT' duration=TimeLiteral ';'
;

EdgeStmt:
    ('ON_RISING' | 'ON_FALLING') '(' signal=Ref ')' '{'
        (stmts+=Statement)*
    '}'
;

RampStmt:
    'RAMP' '(' target=Ref ',' fromExpr=Expr ',' toExpr=Expr ',' dur=TimeLiteral ')' ';'
;

// ==========================================================================
// 5) Expressions & Literals
//     - The "now" keyword returns the current time (type TOD).
// ==========================================================================
Literal infers Literal:
      {infer Literal} NumberLiteral
    | {infer Literal} BooleanLiteral
    | {infer Literal} StringLiteral
    | {infer Literal} EnumMemberLiteral
;

EnumMemberLiteral:
    value=[EnumDecl:ID] '.' member=ID
  | member=ID // fallback: unqualified name
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
    'now'                             // built-in keyword for current time (type TOD)
  | NumberLiteral
  | BooleanLiteral
  | StringLiteral
  | TodLiteral                      // e.g., TOD#08:00:00
  | ParenExpr
  | NegExpr
  | NotExpr
  | Ref
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
    name=ID ('.' property=ID)?
;

ComparisonOperator returns string:
    '<' | '<=' | '==' | '!=' | '>=' | '>'
;

// ==========================================================================
// 6) Terminals
// --------------------------------------------------------------------------
// TIME literal: for durations (e.g., T#5s, T#10m)
// TOD literal: for time-of-day (e.g., TOD#08:00:00)
// ==========================================================================
terminal TimeLiteral returns string: /T#[0-9]+(ms|s|m|h|d)/;
terminal TodLiteral returns string: /TOD#((0\d|1\d|2[0-3]):[0-5]\d(:[0-5]\d)?)/;
terminal NumberLiteral returns number: /-?[0-9]+(\.[0-9]+)?/;
terminal BooleanLiteral returns boolean: /true|false/;
terminal StringLiteral: /"([^"\\]|\\.)*"/;
