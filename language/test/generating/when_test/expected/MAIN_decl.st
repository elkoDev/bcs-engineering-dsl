PROGRAM MAIN
VAR
    x: INT;
    y: BOOL;
    R_TRIG_UnitInstance_ScheduledUnit1: R_TRIG;
    R_TRIG_UnitInstance_OnceConditionalUnit2: R_TRIG;
    fbLocalTime: FB_LocalSystemTime := (bEnable := TRUE);
    timeNow: TIMESTRUCT;
    todNow: TIME_OF_DAY;
    dNow: DATE;
END_VAR