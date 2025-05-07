PROGRAM MAIN
VAR
	state : ProcessState := ProcessState.PROCESSING;
	count : INT := 5;
	threshold : REAL := 10.0;
	values : ARRAY[0..9] OF REAL := [5.0, 15.0, 25.0, 7.5, 30.0, 0.0, 0.0, 0.0, 0.0, 0.0];
	result : REAL;
	status : STRING;
	processedItems : INT;
	NestedControlsFB_inst : NestedControlsFB;
END_VAR