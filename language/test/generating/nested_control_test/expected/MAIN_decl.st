PROGRAM MAIN
VAR
    TestNestedControls_state: ProcessState := ProcessState.PROCESSING;
    TestNestedControls_count: INT := 5;
    TestNestedControls_threshold: REAL := 10;
    TestNestedControls_values: ARRAY [0..9] OF REAL := [5, 15, 25, 7.5, 30, 0, 0, 0, 0, 0];
    TestNestedControls_result: REAL;
    TestNestedControls_status: STRING;
    TestNestedControls_processedItems: INT;
    nestedControlsFBInstance1: NestedControlsFB; (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR