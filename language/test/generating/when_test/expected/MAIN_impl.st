fbLocalTime();
timeNow := fbLocalTime.systemTime;
todNow := SYSTEMTIME_TO_TOD(timeNow);
dNow := DT_TO_DATE(SYSTEMTIME_TO_DT(timeNow));

// Scheduled Control Unit 'ScheduledUnit' @ TOD#08:00:00
R_TrigInstance_ScheduledUnit_1(CLK := todNow >= TOD#08:00:00);
IF R_TrigInstance_ScheduledUnit_1.Q THEN
    x := 1;
END_IF;

// Conditional Control Unit 'ConditionalUnit'
IF x > 0 THEN
    y := TRUE;
END_IF;

// Conditional Control Unit 'OnceConditionalUnit' (runOnce)
R_TrigInstance_OnceConditionalUnit_2(CLK := y);
IF R_TrigInstance_OnceConditionalUnit_2.Q THEN
    x := 2;
END_IF;