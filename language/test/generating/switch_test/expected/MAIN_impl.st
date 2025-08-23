// Control Unit 'TestSwitch'
SwitchFBInstance1(iMode:=TestSwitch_mode, iTemperature:=TestSwitch_temperature);
TestSwitch_heatingValue := SwitchFBInstance1.oHeatingValue;
TestSwitch_coolingValue := SwitchFBInstance1.oCoolingValue;
TestSwitch_statusMsg := SwitchFBInstance1.oStatusMessage;