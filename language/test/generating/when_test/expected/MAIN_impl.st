IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;
fbLocalTime();
timeNow := fbLocalTime.systemTime;
todNow := SYSTEMTIME_TO_TOD(timeNow);
dNow := DT_TO_DATE(SYSTEMTIME_TO_DT(timeNow));

// Scheduled Control Unit 'ScheduledUnit' @ TOD#08:00:00
rTrig_ScheduledUnitInstance1(CLK := todNow >= TOD#08:00:00);
IF rTrig_ScheduledUnitInstance1.Q THEN
    x := 1;
END_IF;

// Conditional Control Unit 'ConditionalUnit'
IF x > 0 THEN
    y := TRUE;
END_IF;

// Conditional Control Unit 'OnceConditionalUnit' (runOnce)
rTrig_OnceConditionalUnitInstance2(CLK := y);
IF rTrig_OnceConditionalUnitInstance2.Q THEN
    x := 2;
END_IF;