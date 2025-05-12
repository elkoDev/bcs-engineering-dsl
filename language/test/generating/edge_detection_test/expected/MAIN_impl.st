IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestEdgeDetection'
r_TRIGInstance1(CLK := TestEdgeDetection_sensor1);
IF r_TRIGInstance1.Q THEN
    TestEdgeDetection_startSignal := TRUE;
END_IF;
f_TRIGInstance2(CLK := TestEdgeDetection_sensor2);
IF f_TRIGInstance2.Q THEN
    TestEdgeDetection_stopSignal := TRUE;
END_IF;
r_TRIGInstance3(CLK := TestEdgeDetection_pushButton);
IF r_TRIGInstance3.Q THEN
    TestEdgeDetection_toggleOutput := NOT TestEdgeDetection_toggleOutput;
END_IF;
r_TRIGInstance4(CLK := TestEdgeDetection_sensor1);
IF r_TRIGInstance4.Q THEN
    TestEdgeDetection_pulseOutput := TRUE;
END_IF;
f_TRIGInstance5(CLK := TestEdgeDetection_sensor2);
IF f_TRIGInstance5.Q THEN
    TestEdgeDetection_pulseOutput := TRUE;
END_IF;