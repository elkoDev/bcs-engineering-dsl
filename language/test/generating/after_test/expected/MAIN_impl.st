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
IF tonAfter1.Q THEN
    conditionB := TRUE;
    conditionA := FALSE;
    tonAfter1(IN := FALSE);
END_IF

tonAfter2(IN := conditionB = TRUE);
IF tonAfter2.Q THEN
    conditionA := TRUE;
    conditionB := FALSE;
    tonAfter2(IN := FALSE);
END_IF