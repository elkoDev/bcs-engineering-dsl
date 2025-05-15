PROGRAM MAIN
VAR
    condition: BOOL;
    x: INT;
    y: BOOL := FALSE;
    afterBlock1_started: BOOL := FALSE;
    afterBlock1_done: BOOL := FALSE;
    tonAfter1: TON := (PT := T#5s);
    afterBlock2_started: BOOL := FALSE;
    afterBlock2_done: BOOL := FALSE;
    tonAfter2: TON := (PT := T#10s);
    bRunOnlyOnce: BOOL := FALSE;
END_VAR