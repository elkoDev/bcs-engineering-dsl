IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'AfterUnit'
tonAfter1(IN := conditionA);
rTrigAfter1(CLK := tonAfter1.Q);
IF rTrigAfter1.Q THEN
    conditionB := TRUE;
    conditionA := FALSE;
END_IF;

tonAfter2(IN := conditionB = TRUE);
rTrigAfter2(CLK := tonAfter2.Q);
IF rTrigAfter2.Q THEN
    conditionA := TRUE;
    conditionB := FALSE;
END_IF;