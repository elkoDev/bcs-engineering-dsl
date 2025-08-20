PROGRAM MAIN
VAR
    conditionA: BOOL := TRUE;
    conditionB: BOOL := FALSE;
    AfterUnit_x: INT;
    tonAfter1: TON := (PT := T#5s);
    tonAfter1_hasFired: BOOL := FALSE;
    tonAfter2: TON := (PT := T#10s);
    tonAfter2_hasFired: BOOL := FALSE;
    bRunOnlyOnce: BOOL := FALSE;
END_VAR