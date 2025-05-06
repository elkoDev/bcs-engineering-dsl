PROGRAM MAIN
VAR
    currentMode : Mode := Mode.OFF;
    // Hardware I/O mappings
    windowContact AT %IX0.0 : BOOL;
END_VAR