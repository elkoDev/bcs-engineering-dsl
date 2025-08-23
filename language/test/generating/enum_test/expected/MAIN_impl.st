// Control Unit 'TestUnit'
IF TestUnit_currentMode = Mode.ECO THEN
    previousMode := TestUnit_currentMode;
    TestUnit_currentMode := Mode.COMFORT;
END_IF;