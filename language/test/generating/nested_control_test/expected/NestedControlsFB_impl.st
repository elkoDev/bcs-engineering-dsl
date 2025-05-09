tempSum := 0;
itemsProcessed := 0;
skipCount := 0;
IF iState = ProcessState.INIT OR iState = ProcessState.PROCESSING THEN
    FOR i := 0 TO 9 BY 1 DO
        IF iValues[i] < iThreshold THEN
            skipCount := skipCount + 1;
            CONTINUE;
        END_IF;
        CASE iState OF
            ProcessState.INIT:
                tempSum := tempSum + iValues[i] * 0.8;
            ProcessState.PROCESSING:
                IF iValues[i] > iThreshold * 2 THEN
                    tempSum := tempSum + iValues[i] * 1.5;
                ELSE
                    tempSum := tempSum + iValues[i];
                END_IF;
            ELSE
                tempSum := tempSum + iValues[i] * 0.5;
        END_CASE;
        itemsProcessed := itemsProcessed + 1;
    END_FOR;
ELSIF iState = ProcessState.FINALIZING THEN
    tempSum := 0;
    i := 0;
    WHILE i < iCount AND i < 10 DO
        tempSum := tempSum + iValues[i] * 1.2;
        i := i + 1;
    END_WHILE;
    itemsProcessed := i;
ELSE
    tempSum := -1;
    itemsProcessed := 0;
END_IF;
oResult := tempSum;
oProcessedItems := itemsProcessed;
IF itemsProcessed = 0 THEN
    oStatus := 'No items processed';
ELSIF skipCount > 0 THEN
    oStatus := 'Processed with skips';
ELSE
    oStatus := 'All items processed';
END_IF;