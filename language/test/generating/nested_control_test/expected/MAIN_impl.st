// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
nestedControlsFBInstance(iState:=TestNestedControls_state, iCount:=TestNestedControls_count, iThreshold:=TestNestedControls_threshold, iValues:=TestNestedControls_values);
TestNestedControls_result := nestedControlsFBInstance.oResult;
TestNestedControls_status := nestedControlsFBInstance.oStatus;
TestNestedControls_processedItems := nestedControlsFBInstance.oProcessedItems;

