PROGRAM MAIN
VAR
    TestDaliLight_hasError: BOOL;
    TestDaliLight_resultMessage: I_TcMessage;
    TestDaliLight_isBusy: BOOL;
    FB_EL6821CommunicationInstance1: FB_EL6821Communication;
    FB_DALI102DirectArcPowerControlInstance2: FB_DALI102DirectArcPowerControl(FB_EL6821CommunicationInstance1);
END_VAR