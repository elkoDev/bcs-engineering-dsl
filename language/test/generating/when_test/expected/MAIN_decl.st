PROGRAM MAIN
VAR
    x: INT;
    y: BOOL;
    ScheduledUnit_hasRun: BOOL := FALSE;
    ScheduledUnit_lastRunDay: DATE;
    OnceConditionalUnit_hasRun: BOOL := FALSE;
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