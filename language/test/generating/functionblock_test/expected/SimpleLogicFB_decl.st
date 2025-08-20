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
    r_TRIGInstance1: R_TRIG; (* Function block instance *)
    f_TRIGInstance1: F_TRIG; (* Function block instance *)
    tonAfter1: TON := (PT := T#1s);
    rTrigAfter1: R_TRIG;
END_VAR