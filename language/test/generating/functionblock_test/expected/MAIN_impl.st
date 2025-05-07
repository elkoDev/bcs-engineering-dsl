// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_ERROR OR ADSLOG_MSGTYPE_LOG, 
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
simpleLogicFBInstance(iInput:=TestFunctionBlock_input, iInput2:=TestFunctionBlock_input2);
TestFunctionBlock_output := simpleLogicFBInstance.oOutput;

simpleLogicFBInstance2(iInput:=TestFunctionBlock_input3, iInput2:=TestFunctionBlock_input4);
TestFunctionBlock_output2 := simpleLogicFBInstance2.oOutput;

