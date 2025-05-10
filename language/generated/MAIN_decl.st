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
    heatingLogicInstance: HeatingLogic; (* Function block instance *)
    fB_DALI207QueryFailureStatusInstance: FB_DALI207QueryFailureStatus; (* Function block instance *)
    fB_DALI207QueryFailureStatusInstance2: FB_DALI207QueryFailureStatus; (* Function block instance *)
    r_TRIG_Buttons_Room1_Instance: R_TRIG; (* Edge detection instance *)
    r_TRIG_Buttons_Room2_Instance2: R_TRIG; (* Edge detection instance *)
    f_TRIG_Buttons_Room2_Instance: F_TRIG; (* Edge detection instance *)
    bRunOnlyOnce: BOOL := FALSE;
END_VAR