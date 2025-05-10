// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
arrayTestFBInstance1(iValues:=TestArrays_values, iCount:=TestArrays_count);
TestArrays_sum := arrayTestFBInstance1.oSum;
TestArrays_average := arrayTestFBInstance1.oAverage;
TestArrays_maxValue := arrayTestFBInstance1.oMaxValue;
TestArrays_processedValues := arrayTestFBInstance1.oProcessedValues;

FOR i := 0 TO TestArrays_rowCount - 1 DO
    FOR j := 0 TO TestArrays_colCount - 1 DO
        TestArrays_rowSum[i] := TestArrays_rowSum[i] + TestArrays_twoDimensionalArray[i, j];
        TestArrays_colSum[j] := TestArrays_colSum[j] + TestArrays_twoDimensionalArray[i, j];
    END_FOR;
END_FOR;
FOR i := 0 TO 4 DO
    TestArrayOperations_resultArray[i] := TestArrayOperations_array1[i] + TestArrayOperations_array2[i];
END_FOR;
FOR i := 0 TO 4 DO
    TestArrayOperations_resultArray2[i] := TestArrayOperations_array1[i] * TestArrayOperations_array2[i];
END_FOR;
