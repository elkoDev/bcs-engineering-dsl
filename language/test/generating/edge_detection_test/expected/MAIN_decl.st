PROGRAM MAIN
VAR
    TestEdgeDetection_sensor1: BOOL;
    TestEdgeDetection_sensor2: BOOL;
    TestEdgeDetection_pushButton: BOOL;
    TestEdgeDetection_startSignal: BOOL;
    TestEdgeDetection_stopSignal: BOOL;
    TestEdgeDetection_toggleOutput: BOOL;
    TestEdgeDetection_pulseOutput: BOOL := FALSE;
    r_TRIG_TestEdgeDetection_sensor1_Instance: R_TRIG; (* Edge detection instance *)
    r_TRIG_TestEdgeDetection_pushButton_Instance2: R_TRIG; (* Edge detection instance *)
    r_TRIG_TestEdgeDetection_sensor1_Instance3: R_TRIG; (* Edge detection instance *)
    f_TRIG_TestEdgeDetection_sensor2_Instance: F_TRIG; (* Edge detection instance *)
    f_TRIG_TestEdgeDetection_sensor2_Instance2: F_TRIG; (* Edge detection instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR