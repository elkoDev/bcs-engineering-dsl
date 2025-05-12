PROGRAM MAIN
VAR
    TestDaliLight_hasError: BOOL;
    TestDaliLight_resultMessage: I_TcMessage;
    TestDaliLight_isBusy: BOOL;
    fB_KL6821CommunicationInstance1: FB_KL6821Communication; (* Function block instance *)
    fB_DALI102DirectArcPowerControlInstance2: FB_DALI102DirectArcPowerControl(fB_KL6821CommunicationInstance1); (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR