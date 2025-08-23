PROGRAM MAIN
VAR
    windowContact_value AT %I*: BOOL; (* Input channel from hardware *)
    TestStructs_rect: Rectangle := (x:=5, y:=10);
    TestStructs_area: REAL;
    TestStructs_perimeter: REAL;
    TestStructs_rects: ARRAY [0..1] OF Rectangle := [(x:=1, y:=2), (x:=3, y:=4)];
    TestStructs_area2: REAL := TestStructs_rects[0].x * TestStructs_rects[0].y;
END_VAR