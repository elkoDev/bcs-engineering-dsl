PROGRAM MAIN
VAR
    TestFunctionBlock_input: BOOL := TRUE;
    TestFunctionBlock_input2: INT := 5;
    TestFunctionBlock_input3: BOOL := FALSE;
    TestFunctionBlock_input4: INT := 10;
    TestFunctionBlock_output: BOOL;
    TestFunctionBlock_output2: BOOL;
    simpleLogicFBInstance1: SimpleLogicFB; (* Function block instance *)
    simpleLogicFBInstance2: SimpleLogicFB; (* Function block instance *)
    f_TRIGInstance3: F_TRIG; (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR