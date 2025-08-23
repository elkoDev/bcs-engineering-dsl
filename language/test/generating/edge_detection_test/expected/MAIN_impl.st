// Control Unit 'TestEdgeDetection'
R_TRIG_Instance1(CLK := TestEdgeDetection_sensor1);
IF R_TRIG_Instance1.Q THEN
    TestEdgeDetection_startSignal := TRUE;
END_IF;
F_TRIG_Instance2(CLK := TestEdgeDetection_sensor2);
IF F_TRIG_Instance2.Q THEN
    TestEdgeDetection_stopSignal := TRUE;
END_IF;
R_TRIG_Instance3(CLK := TestEdgeDetection_pushButton);
IF R_TRIG_Instance3.Q THEN
    TestEdgeDetection_toggleOutput := NOT TestEdgeDetection_toggleOutput;
END_IF;
R_TRIG_Instance4(CLK := TestEdgeDetection_sensor1);
IF R_TRIG_Instance4.Q THEN
    TestEdgeDetection_pulseOutput := TRUE;
END_IF;
F_TRIG_Instance5(CLK := TestEdgeDetection_sensor2);
IF F_TRIG_Instance5.Q THEN
    TestEdgeDetection_pulseOutput := TRUE;
END_IF;