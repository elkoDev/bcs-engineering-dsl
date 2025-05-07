FUNCTION_BLOCK NestedControlsFB
VAR_INPUT
	iState : ProcessState;
	iCount : INT;
	iThreshold : REAL;
	iValues : ARRAY[0..9] OF REAL;
END_VAR
VAR_OUTPUT
	oResult : REAL;
	oStatus : STRING;
	oProcessedItems : INT;
END_VAR
VAR
	i : INT;
	tempSum : REAL := 0.0;
	itemsProcessed : INT := 0;
	skipCount : INT := 0;
END_VAR