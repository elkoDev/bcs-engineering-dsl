PROGRAM MAIN
VAR
	mode : OperationMode := OperationMode.HEATING;
	temperature : REAL := 22.5;
	heatingValue : REAL;
	coolingValue : REAL;
	statusMsg : STRING;
	SwitchFB_inst : SwitchFB;
END_VAR