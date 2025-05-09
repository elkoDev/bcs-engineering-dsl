PROGRAM MAIN
VAR
    TestArrays_values: ARRAY [0..9] OF INT := [10, 20, 30, 40, 50, -5, 15, 25, 35, 45];
    TestArrays_count: INT := 8;
    TestArrays_sum: INT;
    TestArrays_average: REAL;
    TestArrays_maxValue: INT;
    TestArrays_processedValues: ARRAY [0..9] OF INT;
    TestArrays_twoDimensionalArray: ARRAY [0..1, 0..2] OF INT := [1, 2, 3, 4, 5, 6];
    TestArrays_rowCount: INT := 2;
    TestArrays_colCount: INT := 3;
    TestArrays_rowSum: ARRAY [0..1] OF INT := [0, 0];
    TestArrays_colSum: ARRAY [0..2] OF INT := [0, 0, 0];
    i: INT := 0;
    j: INT := 0;
    arrayTestFBInstance: ArrayTestFB; (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR