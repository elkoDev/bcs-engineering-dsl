type DataType = 'BOOL' | 'INT' | 'REAL' | 'STRING' | 'TIME' | 'TOD' | 'DT';
DataType returns string:
    'BOOL' | 'INT' | 'REAL' | 'STRING' | 'TIME' | 'TOD' | 'DT';

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
