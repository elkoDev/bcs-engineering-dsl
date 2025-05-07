// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_ERROR OR ADSLOG_MSGTYPE_LOG, 
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
IF TestUnit_currentMode = Mode.ECO THEN
    TestUnit_currentMode := Mode.COMFORT;
END_IF;
