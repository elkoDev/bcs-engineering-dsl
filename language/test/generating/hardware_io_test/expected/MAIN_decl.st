PROGRAM MAIN
VAR
    UltrasonicSensor_Distance AT %I*: INT; (* Input channel from hardware *)
    UltrasonicSensor_Error AT %I*: BOOL; (* Input channel from hardware *)
    Temperatures_Room1 AT %I*: INT; (* Input channel from hardware *)
    Temperatures_Room2 AT %I*: INT; (* Input channel from hardware *)
    Temperatures_Room3 AT %I*: INT; (* Input channel from hardware *)
    Buttons_Room1 AT %I*: BOOL; (* Input channel from hardware *)
    Buttons_Room2 AT %I*: BOOL; (* Input channel from hardware *)
    Lights_Room1 AT %Q*: BOOL; (* Output channel to hardware *)
    Lights_Room2 AT %Q*: BOOL; (* Output channel to hardware *)
    TestHardwareIOLogic_distance: INT;
    TestHardwareIOLogic_error: BOOL;
    TestHardwareIOLogic_temp1: REAL;
    TestHardwareIOLogic_temp2: REAL;
    TestHardwareIOLogic_temp3: REAL;
    TestHardwareIOLogic_temp4: REAL;
    TestHardwareIOLogic_btn1: BOOL;
    TestHardwareIOLogic_btn2: BOOL;
END_VAR