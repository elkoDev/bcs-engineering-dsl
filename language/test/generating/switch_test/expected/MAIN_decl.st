PROGRAM MAIN
VAR
    TestSwitch_mode: OperationMode := OperationMode.HEATING;
    TestSwitch_temperature: REAL := 22.5;
    TestSwitch_heatingValue: REAL;
    TestSwitch_coolingValue: REAL;
    TestSwitch_statusMsg: STRING;
    switchFBInstance1: SwitchFB; (* Function block instance *)
    fbLocalTime: FB_LocalSystemTime := (
      sNetID := '',
      bEnable := TRUE,
      dwCycle := 5
    );
    timeNow: TIMESTRUCT;
    todNow: TIME_OF_DAY;
    dNow: DATE;
    bRunOnlyOnce: BOOL := FALSE;
END_VAR