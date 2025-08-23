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
    TestArrayOperations_array1: ARRAY [0..4] OF INT := [1, 2, 3, 4, 5];
    TestArrayOperations_array2: ARRAY [0..4] OF INT := [6, 7, 8, 9, 10];
    TestArrayOperations_resultArray: ARRAY [0..4] OF INT;
    TestArrayOperations_resultArray2: ARRAY [0..4] OF INT;
    i: INT := 0;
    j: INT := 0;
    ArrayTestFBInstance1: ArrayTestFB;
END_VAR