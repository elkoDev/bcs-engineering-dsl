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
IF dNow <> ScheduledUnit_lastRunDay THEN
    ScheduledUnit_hasRun := FALSE;
END_IF;
IF (NOT ScheduledUnit_hasRun) AND (todNow >= TOD#08:00:00) THEN
    x := 1;
    ScheduledUnit_hasRun      := TRUE;
    ScheduledUnit_lastRunDay := dNow;
END_IF;

// Conditional Control Unit 'ConditionalUnit'
IF x > 0 THEN
    y := TRUE;
END_IF;

// Conditional Control Unit 'OnceConditionalUnit' (runOnce)
IF NOT (y) THEN
    OnceConditionalUnit_hasRun := FALSE;
END_IF;
IF (NOT OnceConditionalUnit_hasRun) AND (y) THEN
    x := 2;
    OnceConditionalUnit_hasRun := TRUE;
END_IF;