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
    retries: INT := 0;
    daliAddress: E_DALIAddressType;
    daliPriority: E_DALICommandPriority := FALSE;
    addressList: ST_DALIChangeAddressList := (nOldAddress:=1, nNewAddress:=2, nRandomAddress:=3, nErrors:=0);
    status: BOOL;
    resultMessage: I_TcMessage;
    failureStatus: INT;
    distance: INT := FALSE;
    heatingLogicInstance: HeatingLogic;
          fB_DALI207QueryFailureStatusInstance: FB_DALI207QueryFailureStatus;
          fB_DALI207QueryFailureStatusInstance2: FB_DALI207QueryFailureStatus;
    R_TRIG_FALSE_Instance: R_TRIG;
          R_TRIG_FALSE_Instance2: R_TRIG;
          F_TRIG_FALSE_Instance: F_TRIG;
    bRunOnlyOnce: BOOL := FALSE;
END_VAR