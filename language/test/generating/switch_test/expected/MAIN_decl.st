PROGRAM MAIN
VAR
    TestSwitch_mode: OperationMode := OperationMode.HEATING;
    TestSwitch_temperature: REAL := 22.5;
    TestSwitch_heatingValue: REAL;
    TestSwitch_coolingValue: REAL;
    TestSwitch_statusMsg: STRING;
    SwitchFBInstance1: SwitchFB;
END_VAR