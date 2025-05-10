PROGRAM MAIN
VAR
    TestIfLogic_value1: INT := 75;
    TestIfLogic_value2: INT := 50;
    TestIfLogic_condition: BOOL := TRUE;
    TestIfLogic_result: INT;
    TestIfLogic_status: STRING;
    ifLogicFBInstance1: IfLogicFB; (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR