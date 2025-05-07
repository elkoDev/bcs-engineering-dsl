PROGRAM MAIN
VAR
	inputSwitch1 AT %IX0.0 : BOOL;
	inputSwitch2 AT %IX0.1 : BOOL;
	analogInput AT %IW0 : REAL;
	outputLight1 AT %QX0.0 : BOOL;
	outputLight2 AT %QX0.1 : BOOL;
	analogOutput AT %QW0 : REAL;
END_VAR