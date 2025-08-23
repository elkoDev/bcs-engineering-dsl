// Control Unit 'TestArrays'
ArrayTestFBInstance1(iValues:=TestArrays_values, iCount:=TestArrays_count);
TestArrays_sum := ArrayTestFBInstance1.oSum;
TestArrays_average := ArrayTestFBInstance1.oAverage;
TestArrays_maxValue := ArrayTestFBInstance1.oMaxValue;
TestArrays_processedValues := ArrayTestFBInstance1.oProcessedValues;

FOR i := 0 TO TestArrays_rowCount - 1 DO
    FOR j := 0 TO TestArrays_colCount - 1 DO
        TestArrays_rowSum[i] := TestArrays_rowSum[i] + TestArrays_twoDimensionalArray[i, j];
        TestArrays_colSum[j] := TestArrays_colSum[j] + TestArrays_twoDimensionalArray[i, j];
    END_FOR;
END_FOR;
// Control Unit 'TestArrayOperations'
FOR i := 0 TO 4 DO
    TestArrayOperations_resultArray[i] := TestArrayOperations_array1[i] + TestArrayOperations_array2[i];
END_FOR;
FOR i := 0 TO 4 DO
    TestArrayOperations_resultArray2[i] := TestArrayOperations_array1[i] * TestArrayOperations_array2[i];
END_FOR;