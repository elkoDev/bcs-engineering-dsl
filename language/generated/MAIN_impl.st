// --- System code --- 
IF NOT bRunOnlyOnce THEN
    ADSLOGSTR(
      msgCtrlMask := ADSLOG_MSGTYPE_LOG,
      msgFmtStr   := 'Program started %s',
      strArg      := 'successfully!'
    );
    bRunOnlyOnce := TRUE;
END_IF;
fbLocalTime();
timeNow   := fbLocalTime.systemTime;
todNow    := SYSTEMTIME_TO_TOD(timeNow);
dateToday := SYSTEMTIME_TO_DATE(timeNow);

// --- User code ---
// Regular unit 'ToggleLightsOnButtonPress'
r_TRIGInstance5(CLK := Buttons_Room1);
IF r_TRIGInstance5.Q THEN
    Lights_Room1 := NOT Lights_Room1;
END_IF;
r_TRIGInstance6(CLK := Buttons_Room2);
IF r_TRIGInstance6.Q THEN
    Lights_Room2 := NOT Lights_Room2;
END_IF;
// Scheduled unit 'TurnOnLightsScheduled' @ TOD#06:30:00
IF dateToday <> TurnOnLightsScheduled_lastRunDay THEN
    TurnOnLightsScheduled_hasRun := FALSE;
END_IF;
IF (NOT TurnOnLightsScheduled_hasRun) AND (todNow >= TOD#06:30:00) THEN
    Lights_Room1 := TRUE;
    arrayOfLights[0] := TRUE;
    arrayOfLights[1] := TRUE;
    arrayOfLights[2] := TRUE;
    temperaturesArray[0].Room1 := 20.5;
    temperaturesArray[1].Room2 := 22;
    TurnOnLightsScheduled_hasRun      := TRUE;
    TurnOnLightsScheduled_lastRunDay := dateToday;
END_IF;
// Conditional unit 'RetryHeaterStartup'
IF mode <> OperatingMode.OFF THEN
    WHILE RetryHeaterStartup_retries < 3 DO
    heater := TRUE;
    RetryHeaterStartup_retries := RetryHeaterStartup_retries + 1;
    // Wait statements are not directly supported in ST - using equivalent timer logic
    IF RetryHeaterStartup_retries = 2 THEN
        EXIT;
    END_IF;
END_WHILE;
END_IF;
// Regular unit 'DimLightsGradually'
FOR i := 0 TO 5 BY 1 DO
    lightLevel := i * 20;
    IF i = 2 THEN
        CONTINUE;
    END_IF;
    // Wait statements are not directly supported in ST - using equivalent timer logic
END_FOR;
// Regular unit 'ControlHeating'
heatingLogicInstance2 := HeatingLogic(iTemp:=Temperatures_Room1, iMode:=mode);
heatingEnabled := heatingLogicInstance2;
heater := heatingEnabled;
// Regular unit 'AdjustLightLevelByMode'
CASE mode OF
    OperatingMode.COMFORT:
        lightLevel := 100;
    OperatingMode.ECO:
        lightLevel := 50;
    ELSE
        lightLevel := 0;
END_CASE;
// Regular unit 'MorningPresenceCheck'
IF todNow >= 'TOD#07:00:00' THEN
    Lights_Room2 := TRUE;
END_IF;
// Conditional unit 'DelayedStartup' (runOnce)
IF NOT todNow >= 'TOD#07:05:00' THEN
    DelayedStartup_hasRun := FALSE;
END_IF;
IF (NOT DelayedStartup_hasRun) AND (todNow >= 'TOD#07:05:00') THEN
    // Wait statements are not directly supported in ST - using equivalent timer logic
    heater := TRUE;
    Lights_Room1 := FALSE;
    DelayedStartup_hasRun := TRUE;
END_IF;
// Regular unit 'UseDaliLibrary'
fB_DALI207QueryFailureStatusInstance3(bStart:=TRUE, nAddress:=1, eAddressType:=UseDaliLibrary_daliAddress, eCommandPriority:=UseDaliLibrary_daliPriority);
UseDaliLibrary_status := fB_DALI207QueryFailureStatusInstance3.bBusy;
UseDaliLibrary_status := fB_DALI207QueryFailureStatusInstance3.bError;
UseDaliLibrary_failureStatus := fB_DALI207QueryFailureStatusInstance3.nFailureStatus;
UseDaliLibrary_resultMessage := fB_DALI207QueryFailureStatusInstance3.ipResultMessage;

fB_DALI207QueryFailureStatusInstance4(bStart:=FALSE, nAddress:=2, eAddressType:=UseDaliLibrary_daliAddress, eCommandPriority:=UseDaliLibrary_daliPriority);
UseDaliLibrary_status := fB_DALI207QueryFailureStatusInstance4.bBusy;
UseDaliLibrary_status := fB_DALI207QueryFailureStatusInstance4.bError;
UseDaliLibrary_failureStatus := fB_DALI207QueryFailureStatusInstance4.nFailureStatus;
UseDaliLibrary_resultMessage := fB_DALI207QueryFailureStatusInstance4.ipResultMessage;

// Regular unit 'ButtonReleaseHandler'
f_TRIGInstance7(CLK := Buttons_Room2);
IF f_TRIGInstance7.Q THEN
    Lights_Room2 := FALSE;
END_IF;
// Regular unit 'ValidateSensorDistance'
IF UltrasonicSensor_Valid THEN
    lightLevel := ValidateSensorDistance_distance;
END_IF;
