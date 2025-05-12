IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestIfLogic'
ifLogicFBInstance1(iValue1:=TestIfLogic_value1, iValue2:=TestIfLogic_value2, iCondition:=TestIfLogic_condition);
TestIfLogic_result := ifLogicFBInstance1.oResult;
TestIfLogic_status := ifLogicFBInstance1.oStatus;