IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestLoops'
loopsFBInstance1(iCount:=TestLoops_count);
TestLoops_sum := loopsFBInstance1.oSum;
TestLoops_product := loopsFBInstance1.oProduct;