PROGRAM MAIN
VAR
    retries: INT := 0;
    daliAddress: E_DALIAddressType;
    daliPriority: E_DALICommandPriority := FALSE;
    addressList: ST_DALIChangeAddressList := (nOldAddress:=1, nNewAddress:=2, nRandomAddress:=3, nErrors:=0);
    status: BOOL;
    distance: INT := FALSE;
    heatingLogicInstance: HeatingLogic;
    fB_Tc3_DALIInstance: FB_Tc3_DALI;
    "bRunOnlyOnce": BOOL := FALSE;
END_VAR