adjustedTemp := iTemperature * 1.05;
CASE iMode OF
    OperationMode.IDLE:
        oHeatingValue := 0;
        oCoolingValue := 0;
        oStatusMessage := 'System idle';
    OperationMode.HEATING:
        oHeatingValue := adjustedTemp;
        oCoolingValue := 0;
        oStatusMessage := 'Heating active';
    OperationMode.COOLING:
        oHeatingValue := 0;
        oCoolingValue := adjustedTemp;
        oStatusMessage := 'Cooling active';
    ELSE
        oHeatingValue := 0;
        oCoolingValue := 0;
        oStatusMessage := 'Error state';
END_CASE;