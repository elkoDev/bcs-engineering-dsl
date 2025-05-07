PROGRAM MAIN
VAR
    windowContact_value AT %I*: BOOL; (* Input channel from hardware *)
    TestUnit_currentMode: Mode := Mode.OFF;
    bRunOnlyOnce: BOOL := FALSE;
END_VAR