// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
TestStructs_area := TestStructs_rect.x * TestStructs_rect.y;
TestStructs_perimeter := 2 * (TestStructs_rect.x + TestStructs_rect.y);
