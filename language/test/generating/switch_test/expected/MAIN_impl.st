// Initialize code - runs only once
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
             msgFmtStr := 'Program started %s', 
             strArg := 'successfully!');
    bRunOnlyOnce := TRUE;
END_IF

// Main program logic
switchFBInstance(iMode:=TestSwitch_mode, iTemperature:=TestSwitch_temperature);
TestSwitch_heatingValue := switchFBInstance.oHeatingValue;
TestSwitch_coolingValue := switchFBInstance.oCoolingValue;
TestSwitch_statusMsg := switchFBInstance.oStatusMessage;

