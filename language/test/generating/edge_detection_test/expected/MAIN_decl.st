PROGRAM MAIN
VAR
    TestEdgeDetection_sensor1: BOOL;
    TestEdgeDetection_sensor2: BOOL;
    TestEdgeDetection_pushButton: BOOL;
    TestEdgeDetection_startSignal: BOOL;
    TestEdgeDetection_stopSignal: BOOL;
    TestEdgeDetection_toggleOutput: BOOL;
    TestEdgeDetection_pulseOutput: BOOL := FALSE;
    r_TRIGInstance1: R_TRIG; (* Function block instance *)
    r_TRIGInstance2: R_TRIG; (* Function block instance *)
    r_TRIGInstance3: R_TRIG; (* Function block instance *)
    f_TRIGInstance4: F_TRIG; (* Function block instance *)
    f_TRIGInstance5: F_TRIG; (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR