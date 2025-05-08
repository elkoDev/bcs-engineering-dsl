sum := 0;
maxVal := -32768;
FOR i := 0 TO 10 BY i DO
    sum := sum + iValues[i];
    IF iValues[i] > maxVal THEN
        maxVal := iValues[i];
    END_IF;
    oProcessedValues[i] := iValues[i] * 2;
END_FOR;
FOR i := iCount TO 10 BY i DO
    oProcessedValues[i] := 0;
END_FOR;
oSum := sum;
oMaxValue := maxVal;
IF iCount > 0 THEN
    oAverage := sum / iCount;
ELSE
    oAverage := 0;
END_IF;