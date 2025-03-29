grammar BCSControl
import "./bcs-hardware"

// ==========================================================================
// 1) Entry Rule: A control block referencing a hardware controller.
//    Inside, you may define Declarations (enums, variables, function blocks)
//    and ControlUnits. ControlUnits are the primary construct for all control logic, whether
//    time‐based (using TOD expressions) or event‐driven.
// ==========================================================================
entry ControlModel:
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
        ('logic' Block)?
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
// 3) ControlUnits (Control Logic)
//    A unit is a named block of control logic that may be triggered by any
//    expression – for example, a time-of-day comparison using now or a TOD literal.
// ==========================================================================
ControlUnit:
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
    | FunctionBlockCallStmt
    | ExpressionStmt
    | LocalVarDeclStmt
    | WaitStmt
    | EdgeStmt
    | RampStmt
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
    'for' '(' loopVar=ID '=' start=Expr 'to' end=Expr ( 'by' step=Expr )? ')' Block
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

FunctionBlockCallStmt:
    target=Ref '(' (args+=Argument (',' args+=Argument)*)? ')' ';'
;

Argument:
    name=ID ':' value=Expr
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
WaitStmt infers WaitStmt:
    'wait' time=TimeLiteral ';'
;

EdgeStmt:
    ( 'on_rising' | 'on_falling' ) '(' signal=Ref ')' Block
;

RampStmt:
    'ramp' '(' target=Ref ',' fromExpr=Expr ',' toExpr=Expr ',' dur=TimeLiteral ')' ';'
;

// ==========================================================================
// 5) Expressions & Literals
//    The "now" keyword returns the current time-of-day (type TOD), and TOD
//    literals (e.g. TOD#08:00:00) are supported.
// ==========================================================================
CaseLiteral infers CaseLiteral:
      {infer CaseLiteral} NumberLiteral
    | {infer CaseLiteral} BooleanLiteral
    | {infer CaseLiteral} StringLiteral
    | {infer CaseLiteral} EnumMemberLiteral
;

EnumMemberLiteral:
    value=[EnumDecl:ID] '.' member=ID
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
    'now'                             // returns the current time (TOD)
  | NumberLiteral
  | BooleanLiteral
  | StringLiteral
  | EnumMemberLiteral
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


Ref infers Ref:
    ({infer Ref} varRef=[VarDecl] | sensorRef=[Sensor]) ('.' property=ID)?;


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
