PROGRAM MAIN
VAR
    UltrasonicSensor_Distance AT %I*: INT; (* Input channel from hardware *)
    UltrasonicSensor_Valid AT %I*: BOOL; (* Input channel from hardware *)
    Temperatures_Room1 AT %I*: REAL; (* Input channel from hardware *)
    Temperatures_Room2 AT %I*: REAL; (* Input channel from hardware *)
    Temperatures_Room3 AT %I*: REAL; (* Input channel from hardware *)
    Temperatures_Room4 AT %I*: REAL; (* Input channel from hardware *)
    Buttons_Room1 AT %I*: BOOL; (* Input channel from hardware *)
    Buttons_Room2 AT %I*: BOOL; (* Input channel from hardware *)
    Lights_Room1 AT %Q*: BOOL; (* Output channel to hardware *)
    Lights_Room2 AT %Q*: BOOL; (* Output channel to hardware *)
    mode: OperatingMode := OperatingMode.OFF;
    lightLevel: INT := 0;
    heater: BOOL;
    lightsOn: BOOL;
    heatingEnabled: BOOL;
    arrayOfLights: ARRAY [0..9] OF BOOL;
    temperaturesArray: ARRAY [0..9] OF Temperatures;
    RetryHeaterStartup_retries: INT := 0;
    UseDaliLibrary_daliAddress: E_DALIAddressType;
    UseDaliLibrary_daliPriority: E_DALICommandPriority := E_DALICommandPriority.High;
    UseDaliLibrary_addressList: ST_DALIChangeAddressList := (nOldAddress:=1, nNewAddress:=2, nRandomAddress:=3, nErrors:=0);
    UseDaliLibrary_status: BOOL;
    UseDaliLibrary_resultMessage: I_TcMessage;
    UseDaliLibrary_failureStatus: BYTE;
    ValidateSensorDistance_distance: INT := UltrasonicSensor_Distance;
    i: INT := 0;
    fB_KL6811CommunicationInstance1: FB_KL6811Communication; (* Function block instance *)
    heatingLogicInstance2: HeatingLogic; (* Function block instance *)
    fB_DALI207QueryFailureStatusInstance3: FB_DALI207QueryFailureStatus(fB_KL6811CommunicationInstance1); (* Function block instance *)
    fB_DALI207QueryFailureStatusInstance4: FB_DALI207QueryFailureStatus(fB_KL6811CommunicationInstance1); (* Function block instance *)
    r_TRIGInstance5: R_TRIG; (* Function block instance *)
    r_TRIGInstance6: R_TRIG; (* Function block instance *)
    f_TRIGInstance7: F_TRIG; (* Function block instance *)
    TurnOnLightsScheduled_hasRun: BOOL := FALSE;
    TurnOnLightsScheduled_lastRunDay: DATE;
    bRunOnlyOnce: BOOL := FALSE;
    fbLocalTime: FB_LocalSystemTime := (
      sNetID := '',
      bEnable := TRUE,
      dwCycle := 5
    );
    timeNow: TIMESTRUCT;
    todNow: TIME_OF_DAY;
    dNow: DATE;
END_VAR