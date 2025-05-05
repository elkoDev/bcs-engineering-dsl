PROGRAM MAIN
VAR
retries : INT := 0;
daliAddress : E_DALIAddressType;
daliPriority : E_DALICommandPriority := E_DALICommandPriority.High;
addressList : ST_DALIChangeAddressList := {
            nOldAddress: 1,
            nNewAddress: 2,
            nRandomAddress: 3,
            nErrors: 0
        };
status : BOOL;
distance : INT := UltrasonicSensor.Distance;
END_VAR
// ---- Unit ToggleLightsOnButtonPress ----
R_TRIG(rTrigInst)(CLK := Buttons.Room1);
IF rTrigInst.Q THEN
Lights.Room1 := !Lights.Room1;
END_IF
// ---- Unit TurnOnLightsScheduled ----
Lights.Room1 := true;
// ---- Unit RetryHeaterStartup ----
retries : INT := 0;
WHILE retries < 3 DO
heater := true;
retries := retries + 1;
(* wait T#1s *)
END_WHILE
// ---- Unit DimLightsGradually ----
FOR i := 0 TO 5 BY 1 DO
lightLevel := i * 20;
(* wait T#1s *)
END_FOR
// ---- Unit ControlHeating ----
heatingEnabled := HeatingLogic(iTemp := Temperatures.Room1, iMode := mode);
heater := heatingEnabled;
// ---- Unit AdjustLightLevelByMode ----
CASE mode OF
    Mode.COMFORT:
        lightLevel := 100;
        
    Mode.ECO:
        lightLevel := 50;
        
    ELSE:
        lightLevel := 0;
        
END_CASE
// ---- Unit FadeOutLights ----
RampFB(IN := 100, OUT := lightLevel, RAMP_TIME := T#10s);
// ---- Unit MorningPresenceCheck ----
IF now >= TOD#07:00:00 THEN
Lights.Room2 := true;

END_IF
// ---- Unit DelayedStartup ----
(* wait T#5s *)
heater := true;
Lights.Room1 := false;
// ---- Unit UseDaliLibrary ----
daliAddress : E_DALIAddressType;
daliPriority : E_DALICommandPriority := E_DALICommandPriority.High;
addressList : ST_DALIChangeAddressList := {
            nOldAddress: 1,
            nNewAddress: 2,
            nRandomAddress: 3,
            nErrors: 0
        };
status : BOOL;
status := FB_Tc3_DALI(iDALIAddress := daliAddress, iDALICommandPriority := daliPriority, iAddressList := addressList);
// ---- Unit ButtonReleaseHandler ----
F_TRIG(fTrigInst)(CLK := Buttons.Room2);
IF fTrigInst.Q THEN
Lights.Room2 := false;
END_IF
// ---- Unit ValidateSensorDistance ----
distance : INT := UltrasonicSensor.Distance;
IF UltrasonicSensor.Valid THEN
lightLevel := distance;

END_IF
END_PROGRAM

