// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
arrayTestFBInstance(iValues:=TestArrays_values, iCount:=TestArrays_count);
TestArrays_sum := arrayTestFBInstance.oSum;
TestArrays_average := arrayTestFBInstance.oAverage;
TestArrays_maxValue := arrayTestFBInstance.oMaxValue;
TestArrays_processedValues := arrayTestFBInstance.oProcessedValues;

