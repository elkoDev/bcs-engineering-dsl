// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
ifLogicFBInstance(iValue1:=TestIfLogic_value1, iValue2:=TestIfLogic_value2, iCondition:=TestIfLogic_condition);
TestIfLogic_result := ifLogicFBInstance.oResult;
TestIfLogic_status := ifLogicFBInstance.oStatus;

