PROGRAM MAIN
VAR
    x: INT;
    y: BOOL;
    rTrig_ScheduledUnitInstance1: R_TRIG; (* Function block instance *)
    rTrig_OnceConditionalUnitInstance2: R_TRIG; (* Function block instance *)
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