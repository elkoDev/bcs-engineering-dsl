PROGRAM MAIN
VAR
    windowContact_value AT %I*: BOOL; (* Input channel from hardware *)
    previousMode: Mode := Mode.OFF;
    TestUnit_currentMode: Mode := Mode.OFF;
    bRunOnlyOnce: BOOL := FALSE;
    fbLocalTime: FB_LocalSystemTime := (
      sNetID := '',
      bEnable := TRUE,
      dwCycle := 5
    );
    timeNow: TIMESTRUCT;
    todNow: TIME_OF_DAY;
    dNow: DATE;
END_VAR