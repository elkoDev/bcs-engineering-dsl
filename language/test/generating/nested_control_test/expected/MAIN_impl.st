IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestNestedControls'
nestedControlsFBInstance1(iState:=TestNestedControls_state, iCount:=TestNestedControls_count, iThreshold:=TestNestedControls_threshold, iValues:=TestNestedControls_values);
TestNestedControls_result := nestedControlsFBInstance1.oResult;
TestNestedControls_status := nestedControlsFBInstance1.oStatus;
TestNestedControls_processedItems := nestedControlsFBInstance1.oProcessedItems;