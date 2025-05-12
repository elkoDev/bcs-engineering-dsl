IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;

// Control Unit 'TestHardwareIOLogic'
TestHardwareIOLogic_distance := UltrasonicSensor_Distance;
TestHardwareIOLogic_valid := UltrasonicSensor_Valid;
TestHardwareIOLogic_temp1 := Temperatures_Room1;
TestHardwareIOLogic_temp2 := Temperatures_Room2;
TestHardwareIOLogic_temp3 := Temperatures_Room3;
TestHardwareIOLogic_temp4 := Temperatures_Room4;
TestHardwareIOLogic_btn1 := Buttons_Room1;
TestHardwareIOLogic_btn2 := Buttons_Room2;
Lights_Room1 := TRUE;
Lights_Room2 := FALSE;
Lights_Room1 := FALSE;
Lights_Room2 := TRUE;