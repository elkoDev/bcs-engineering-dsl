IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestDaliLight'
fB_DALI102DirectArcPowerControlInstance2(bStart:=TRUE, nAddress:=0, eAddressType:=E_DALIAddressType.Short, eCommandPriority:=E_DALICommandPriority.High, nArcPowerLevel:=100);
TestDaliLight_hasError := fB_DALI102DirectArcPowerControlInstance2.bError;
TestDaliLight_resultMessage := fB_DALI102DirectArcPowerControlInstance2.ipResultMessage;
TestDaliLight_isBusy := fB_DALI102DirectArcPowerControlInstance2.bBusy;