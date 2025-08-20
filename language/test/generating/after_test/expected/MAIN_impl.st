IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'AfterUnit'
IF NOT (conditionA) THEN
    tonAfter1_hasFired := FALSE;
END_IF;

tonAfter1(IN := conditionA AND NOT tonAfter1_hasFired);
IF tonAfter1.Q THEN
    conditionB := TRUE;
    conditionA := FALSE;
    tonAfter1_hasFired := TRUE;
END_IF;

IF NOT (conditionB = TRUE) THEN
    tonAfter2_hasFired := FALSE;
END_IF;

tonAfter2(IN := conditionB = TRUE AND NOT tonAfter2_hasFired);
IF tonAfter2.Q THEN
    conditionA := TRUE;
    conditionB := FALSE;
    tonAfter2_hasFired := TRUE;
END_IF;