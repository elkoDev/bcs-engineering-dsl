// Control Unit 'TestDaliLight'
FB_DALI102DirectArcPowerControlInstance2(bStart:=TRUE, nAddress:=0, eAddressType:=E_DALIAddressType.Short, eCommandPriority:=E_DALICommandPriority.High, nArcPowerLevel:=100);
TestDaliLight_hasError := FB_DALI102DirectArcPowerControlInstance2.bError;
TestDaliLight_resultMessage := FB_DALI102DirectArcPowerControlInstance2.ipResultMessage;
TestDaliLight_isBusy := FB_DALI102DirectArcPowerControlInstance2.bBusy;