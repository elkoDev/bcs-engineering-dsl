// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
IF TestUnit_currentMode = Mode.ECO THEN
    previousMode := TestUnit_currentMode;
    TestUnit_currentMode := Mode.COMFORT;
END_IF;
