// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
// Rising edge detection for TestEdgeDetection_sensor1
r_TRIGInstance1(CLK := TestEdgeDetection_sensor1);
IF r_TRIGInstance1.Q THEN
    TestEdgeDetection_startSignal := TRUE;
END_IF;
// Falling edge detection for TestEdgeDetection_sensor2
f_TRIGInstance4(CLK := TestEdgeDetection_sensor2);
IF f_TRIGInstance4.Q THEN
    TestEdgeDetection_stopSignal := TRUE;
END_IF;
// Rising edge detection for TestEdgeDetection_pushButton
r_TRIGInstance2(CLK := TestEdgeDetection_pushButton);
IF r_TRIGInstance2.Q THEN
    TestEdgeDetection_toggleOutput := NOT TestEdgeDetection_toggleOutput;
END_IF;
// Rising edge detection for TestEdgeDetection_sensor1
r_TRIGInstance3(CLK := TestEdgeDetection_sensor1);
IF r_TRIGInstance3.Q THEN
    TestEdgeDetection_pulseOutput := TRUE;
END_IF;
// Falling edge detection for TestEdgeDetection_sensor2
f_TRIGInstance5(CLK := TestEdgeDetection_sensor2);
IF f_TRIGInstance5.Q THEN
    TestEdgeDetection_pulseOutput := TRUE;
END_IF;
