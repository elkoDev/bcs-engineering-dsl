// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
fB_DALI102DirectArcPowerControlInstance(bStart:=TRUE, nAddress:=0, eAddressType:=E_DALIAddressType.Short, eCommandPriority:=E_DALICommandPriority.High, nArcPowerLevel:=100);
TestDaliLight_hasError := fB_DALI102DirectArcPowerControlInstance.bError;
TestDaliLight_resultMessage := fB_DALI102DirectArcPowerControlInstance.ipResultMessage;
TestDaliLight_isBusy := fB_DALI102DirectArcPowerControlInstance.bBusy;

