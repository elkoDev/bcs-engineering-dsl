IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestFunctionBlock'
simpleLogicFBInstance1(iInput:=TestFunctionBlock_input, iInput2:=TestFunctionBlock_input2);
TestFunctionBlock_output := simpleLogicFBInstance1.oOutput;

simpleLogicFBInstance2(iInput:=TestFunctionBlock_input3, iInput2:=TestFunctionBlock_input4);
TestFunctionBlock_output2 := simpleLogicFBInstance2.oOutput;

f_TRIGInstance3(CLK := TestFunctionBlock_input);
IF f_TRIGInstance3.Q THEN
    TestFunctionBlock_output := FALSE;
END_IF;