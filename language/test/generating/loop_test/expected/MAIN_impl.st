// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
loopsFBInstance(iCount:=TestLoops_count);
TestLoops_sum := loopsFBInstance.oSum;
TestLoops_product := loopsFBInstance.oProduct;

