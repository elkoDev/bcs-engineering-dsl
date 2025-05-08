// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
// Rising edge detection for TestEdgeDetection_sensor1
r_TRIG_TestEdgeDetection_sensor1_Instance(CLK := TestEdgeDetection_sensor1);
IF r_TRIG_TestEdgeDetection_sensor1_Instance.Q THEN
    TestEdgeDetection_startSignal := TRUE;
END_IF;
// Falling edge detection for TestEdgeDetection_sensor2
f_TRIG_TestEdgeDetection_sensor2_Instance(CLK := TestEdgeDetection_sensor2);
IF f_TRIG_TestEdgeDetection_sensor2_Instance.Q THEN
    TestEdgeDetection_stopSignal := TRUE;
END_IF;
// Rising edge detection for TestEdgeDetection_pushButton
r_TRIG_TestEdgeDetection_pushButton_Instance2(CLK := TestEdgeDetection_pushButton);
IF r_TRIG_TestEdgeDetection_pushButton_Instance2.Q THEN
    TestEdgeDetection_toggleOutput := NOT TestEdgeDetection_toggleOutput;
END_IF;
// Rising edge detection for TestEdgeDetection_sensor1
r_TRIG_TestEdgeDetection_sensor1_Instance3(CLK := TestEdgeDetection_sensor1);
IF r_TRIG_TestEdgeDetection_sensor1_Instance3.Q THEN
    TestEdgeDetection_pulseOutput := TRUE;
END_IF;
// Falling edge detection for TestEdgeDetection_sensor2
f_TRIG_TestEdgeDetection_sensor2_Instance2(CLK := TestEdgeDetection_sensor2);
IF f_TRIG_TestEdgeDetection_sensor2_Instance2.Q THEN
    TestEdgeDetection_pulseOutput := TRUE;
END_IF;
