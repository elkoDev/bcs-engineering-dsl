PROGRAM MAIN
VAR_INPUT
    UltrasonicSensor_Distance: INT AT %IW0; (* Input channel from hardware *)
    UltrasonicSensor_Valid: BOOL AT %IW0; (* Input channel from hardware *)
    Temperatures_Room1: REAL AT %IW0; (* Input channel from hardware *)
    Temperatures_Room2: REAL AT %IW1; (* Input channel from hardware *)
    Temperatures_Room3: REAL AT %IW2; (* Input channel from hardware *)
    Temperatures_Room4: REAL AT %IW3; (* Input channel from hardware *)
    Buttons_Room1: BOOL AT %IX8; (* Input channel from hardware *)
    Buttons_Room2: BOOL AT %IX9; (* Input channel from hardware *)
END_VAR
VAR_OUTPUT
    Lights_Room1: BOOL AT %QX0; (* Output channel to hardware *)
    Lights_Room2: BOOL AT %QX1; (* Output channel to hardware *)
END_VAR
VAR
    retries: INT := 0;
    daliAddress: E_DALIAddressType;
    daliPriority: E_DALICommandPriority := FALSE;
    addressList: ST_DALIChangeAddressList := (nOldAddress:=1, nNewAddress:=2, nRandomAddress:=3, nErrors:=0);
    status: BOOL;
    distance: INT := FALSE;
    heatingLogicInstance: HeatingLogic;
    fB_Tc3_DALIInstance: FB_Tc3_DALI;
    R_TRIG_Buttons_instance: R_TRIG;
          F_TRIG_Buttons_instance: F_TRIG;
    bRunOnlyOnce: BOOL := FALSE;
END_VAR