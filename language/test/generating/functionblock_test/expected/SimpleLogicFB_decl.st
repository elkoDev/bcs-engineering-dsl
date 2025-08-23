FUNCTION_BLOCK SimpleLogicFB
VAR_INPUT
    iInput: BOOL;
    iInput2: INT;
END_VAR
VAR_OUTPUT
    oOutput: BOOL;
END_VAR
VAR
    iInputNegated: BOOL;
    R_TRIG_Instance1: R_TRIG;
    F_TRIG_Instance1: F_TRIG;
    TON_AfterInstance1: TON := (PT := T#1s);
    R_TRIG_AfterInstance1: R_TRIG;
END_VAR