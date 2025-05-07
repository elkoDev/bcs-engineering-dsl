IF iCondition THEN
    tempValue := iValue1 + iValue2;
ELSE
    tempValue := iValue1 - iValue2;
END_IF;
IF tempValue > 100 THEN
    IF iValue1 > 50 THEN
    oResult := 100;
    ELSE
        tempValue := -100;
    END_IF;
    oStatus := 'Value clamped to maximum';
ELSIF tempValue < 0 THEN
    oResult := 0;
    oStatus := 'Value clamped to minimum';
ELSE
    oResult := tempValue;
    oStatus := 'Value in range';
END_IF;
