// Implementation of IfLogicFB
// Auto-generated from BCS Engineering DSL

// Simple if statement
IF (iCondition) THEN
    tempValue := iValue1 + iValue2;
ELSE
    tempValue := iValue1 - iValue2;
END_IF;

// Nested if statements
IF (tempValue > 100) THEN
    oResult := 100;
    oStatus := 'Value clamped to maximum';
ELSIF (tempValue < 0) THEN
    oResult := 0;
    oStatus := 'Value clamped to minimum';
ELSE
    oResult := tempValue;
    oStatus := 'Value in range';
END_IF;