// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
fB_DALIV2LightInstance(bOn:=TRUE, bOff:=FALSE, bToggle:=FALSE, nAddr:=1, eAddrType:=E_DALIV2AddrType.eDALIV2AddrTypeShort, nMasterDevAddr:=0, tCycleActualLevelMasterDev:='T#1s');
TestDaliLight_lightStatus := fB_DALIV2LightInstance.bLight;
TestDaliLight_busyStatus := fB_DALIV2LightInstance.bBusy;
TestDaliLight_errorStatus := fB_DALIV2LightInstance.bError;
TestDaliLight_errorId := fB_DALIV2LightInstance.nErrorId;

fB_DALIV2LightInstance2(bOn:=FALSE, bOff:=TRUE, bToggle:=FALSE, nAddr:=1, eAddrType:=E_DALIV2AddrType.eDALIV2AddrTypeShort, nMasterDevAddr:=0, tCycleActualLevelMasterDev:='T#1s');
TestDaliLight_lightStatus := fB_DALIV2LightInstance2.bLight;
TestDaliLight_busyStatus := fB_DALIV2LightInstance2.bBusy;
TestDaliLight_errorStatus := fB_DALIV2LightInstance2.bError;
TestDaliLight_errorId := fB_DALIV2LightInstance2.nErrorId;

