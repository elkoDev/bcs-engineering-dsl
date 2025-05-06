PROGRAM MAIN
VAR
    // For struct initialization and field access
    rect : Rectangle := (x := 5.0, y := 10.0);
    area : REAL;
    perimeter : REAL;
    
    // For array of structs
    rects : ARRAY[0..1] OF Rectangle := [(x := 1.0, y := 2.0), (x := 3.0, y := 4.0)];
    area2 : REAL := 2.0;
    
    // Hardware I/O mappings
    windowContact AT %IX0.0 : BOOL;
END_VAR