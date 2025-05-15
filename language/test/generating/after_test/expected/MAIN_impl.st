IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'AfterUnit'
condition := TRUE;
IF condition AND NOT afterBlock1_started THEN
    tonAfter1(IN := TRUE);
    afterBlock1_started := TRUE;
ELSIF NOT condition THEN
    tonAfter1(IN := FALSE);
    afterBlock1_started := FALSE;
    afterBlock1_done := FALSE;
END_IF

tonAfter1();

IF tonAfter1.Q AND NOT afterBlock1_done THEN
    y := TRUE;
    condition := FALSE;
    afterBlock1_done := TRUE;
END_IF
IF y = TRUE AND NOT afterBlock2_started THEN
    tonAfter2(IN := TRUE);
    afterBlock2_started := TRUE;
ELSIF NOT y = TRUE THEN
    tonAfter2(IN := FALSE);
    afterBlock2_started := FALSE;
    afterBlock2_done := FALSE;
END_IF

tonAfter2();

IF tonAfter2.Q AND NOT afterBlock2_done THEN
    y := FALSE;
    condition := TRUE;
    afterBlock2_done := TRUE;
END_IF