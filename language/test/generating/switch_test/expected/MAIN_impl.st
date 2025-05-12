IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestSwitch'
switchFBInstance1(iMode:=TestSwitch_mode, iTemperature:=TestSwitch_temperature);
TestSwitch_heatingValue := switchFBInstance1.oHeatingValue;
TestSwitch_coolingValue := switchFBInstance1.oCoolingValue;
TestSwitch_statusMsg := switchFBInstance1.oStatusMessage;