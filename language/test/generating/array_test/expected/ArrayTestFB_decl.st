FUNCTION_BLOCK ArrayTestFB
VAR_INPUT
    iValues: ARRAY [0..9] OF INT;
    iCount: INT;
END_VAR
VAR_OUTPUT
    oSum: INT;
    oAverage: REAL;
    oMaxValue: INT;
    oProcessedValues: ARRAY [0..9] OF INT;
END_VAR
VAR
    i: INT;
    sum: INT := 0;
    maxVal: INT := -32768;
END_VAR