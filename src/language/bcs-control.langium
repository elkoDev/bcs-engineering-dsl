grammar BCSControl
import "./bcs-hardware"

entry ControlModel:
    (logicBlocks+=LogicBlock)*;

LogicBlock:
    'logic' name=ID 'for' plc=[Controller] 
    Block
;

fragment Block: 
    '{' 
        (rules+=Rule)* 
    '}'
;

Rule:
    'rule' name=ID '{'
        condition=Condition
        action=Action
    '}'
;

Condition:
    'if' expression=Expr
;

Action:
    'then' commands+=Command (',' commands+=Command)* ';'
;

Command:
    actuator=[Actuator] '.' action=ID
;

Expr: OrExpr;

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
    PrimExpr ({infer BinExpr.e1=current} op=('*'|'/') e2=PrimExpr)*
;

PrimExpr:
    PNumber | Ref | Group | NegExpr
;

NegExpr:
    '-' ne=Expr
;

Group:
    '(' ge=Expr ')'
;

Ref:
    sensor=[Sensor] '.' property=ID
;

ComparisonOperator returns string:
    '<' | '>' | '<=' | '>=' | '==' | '!=';

PNumber returns number:
    P_INT | P_FLOAT
;

terminal P_FLOAT returns number: /-?[0-9]+\.[0-9]+/;
terminal P_INT returns number: /-?[0-9]+/;
