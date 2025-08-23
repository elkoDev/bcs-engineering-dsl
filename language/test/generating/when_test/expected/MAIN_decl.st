PROGRAM MAIN
VAR
    x: INT;
    y: BOOL;
    R_TrigInstance_ScheduledUnit_1: R_TRIG;
    R_TrigInstance_OnceConditionalUnit_2: R_TRIG;
    fbLocalTime: FB_LocalSystemTime := (bEnable := TRUE);
    timeNow: TIMESTRUCT;
    todNow: TIME_OF_DAY;
    dNow: DATE;
END_VAR