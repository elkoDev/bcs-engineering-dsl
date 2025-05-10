PROGRAM MAIN
VAR
    TestDaliLight_hasError: BOOL;
    TestDaliLight_resultMessage: I_TcMessage;
    TestDaliLight_isBusy: BOOL;
	fbCom: FB_KL6821Communication; (* DALI Communication *)
    fB_DALI102DirectArcPowerControlInstance: FB_DALI102DirectArcPowerControl(fbCom); (* Function block instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR