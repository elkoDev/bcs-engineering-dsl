PROGRAM MAIN
VAR
    windowContact_value AT %I*: BOOL; (* Input channel from hardware *)
    previousMode: Mode := Mode.OFF;
    TestUnit_currentMode: Mode := Mode.OFF;
END_VAR