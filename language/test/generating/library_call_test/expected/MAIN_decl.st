PROGRAM MAIN
VAR
    commandBuffer: ST_DALIV2CommandBuffer;
    TestDaliLight_lightStatus: BOOL;
    TestDaliLight_busyStatus: BOOL;
    TestDaliLight_errorStatus: BOOL;
    TestDaliLight_errorId: UDINT;
    fB_DALIV2LightInstance: FB_DALIV2Light; (* Function block instance *)
    fB_DALIV2LightInstance2: FB_DALIV2Light; (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR