FUNCTION_BLOCK SwitchFB
VAR_INPUT
    iMode: OperationMode;
    iTemperature: REAL;
END_VAR
VAR_OUTPUT
    oHeatingValue: REAL;
    oCoolingValue: REAL;
    oStatusMessage: STRING;
END_VAR
VAR
    adjustedTemp: REAL;
END_VAR