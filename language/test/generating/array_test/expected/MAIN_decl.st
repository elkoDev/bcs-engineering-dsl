PROGRAM MAIN
VAR
    TestArrays_values: ARRAY [0..9] OF INT := [10, 20, 30, 40, 50, -5, 15, 25, 35, 45];
    TestArrays_count: INT := 8;
    TestArrays_sum: INT;
    TestArrays_average: REAL;
    TestArrays_maxValue: INT;
    TestArrays_processedValues: ARRAY [0..9] OF INT;
    arrayTestFBInstance: ArrayTestFB; (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR