PROGRAM MAIN
VAR
	sensor1 AT %IX0.0 : BOOL;
	sensor2 AT %IX0.1 : BOOL;
	pushButton AT %IX0.2 : BOOL;
	startSignal AT %QX0.0 : BOOL;
	stopSignal AT %QX0.1 : BOOL;
	toggleOutput AT %QX0.2 : BOOL;
	pulseOutput AT %QX0.3 : BOOL;
	R_TRIG_sensor1_instance : R_TRIG;
	R_TRIG_pushButton_instance : R_TRIG;
	F_TRIG_sensor2_instance : F_TRIG;
END_VAR