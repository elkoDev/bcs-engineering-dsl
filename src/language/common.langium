type DataType = 'BOOL' | 'INT' | 'REAL' | 'STRING' | 'TIME' | 'TOD' | 'DT';
DataType returns string:
    'BOOL' | 'INT' | 'REAL' | 'STRING' | 'TIME' | 'TOD' | 'DT';

// ==========================================================================
// Terminals
// --------------------------------------------------------------------------
// TIME literal: for durations (e.g., T#5s, T#10m)
// TOD literal: for time-of-day (e.g., TOD#08:00:00)
// ==========================================================================
terminal TimeLiteral returns string: /T#[0-9]+(ms|s|m|h|d)/;
terminal TodLiteral returns string: /TOD#((0\d|1\d|2[0-3]):[0-5]\d(:[0-5]\d)?)/;
terminal NumberLiteral returns number: /-?[0-9]+(\.[0-9]+)?/;
terminal IntLiteral returns number: /-?[0-9]+/;
terminal BooleanLiteral returns boolean: /true|false/;
terminal StringLiteral: /"([^"\\]|\\.)*"/;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
