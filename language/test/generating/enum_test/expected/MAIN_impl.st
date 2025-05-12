IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestUnit'
IF TestUnit_currentMode = Mode.ECO THEN
    previousMode := TestUnit_currentMode;
    TestUnit_currentMode := Mode.COMFORT;
END_IF;