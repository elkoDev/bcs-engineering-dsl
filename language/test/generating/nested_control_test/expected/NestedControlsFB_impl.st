// Implementation of NestedControlsFB
// Auto-generated from BCS Engineering DSL

// Reset variables
tempSum := 0.0;
itemsProcessed := 0;
skipCount := 0;

// Complex nested control structures
IF (iState = ProcessState.INIT OR iState = ProcessState.PROCESSING) THEN
    // Process the array using nested loops and conditions
    FOR i := 0 TO MIN(iCount - 1, 9) BY 1 DO
        // Skip processing if value is below threshold
        IF (iValues[i] < iThreshold) THEN
            skipCount := skipCount + 1;
            CONTINUE;
        END_IF;
        
        // Different processing based on state
        CASE iState OF
            ProcessState.INIT:
                // Initialization processing
                tempSum := tempSum + iValues[i] * 0.8;
            ProcessState.PROCESSING:
                // Normal processing - with nested if
                IF (iValues[i] > iThreshold * 2.0) THEN
                    tempSum := tempSum + iValues[i] * 1.5;
                ELSE
                    tempSum := tempSum + iValues[i];
                END_IF;
            ELSE
                // Should not happen, but handle anyway
                tempSum := tempSum + iValues[i] * 0.5;
        END_CASE;
        
        itemsProcessed := itemsProcessed + 1;
    END_FOR;
ELSIF (iState = ProcessState.FINALIZING) THEN
    // Final processing
    tempSum := 0.0;
    i := 0;
    WHILE (i < iCount AND i < 10) DO
        tempSum := tempSum + iValues[i] * 1.2;
        i := i + 1;
    END_WHILE;
    itemsProcessed := i;
ELSE
    // Complete state
    tempSum := -1.0;
    itemsProcessed := 0;
END_IF;

// Set outputs
oResult := tempSum;
oProcessedItems := itemsProcessed;

// Set status message based on processed items
IF (itemsProcessed = 0) THEN
    oStatus := 'No items processed';
ELSIF (skipCount > 0) THEN
    oStatus := 'Processed with skips';
ELSE
    oStatus := 'All items processed';
END_IF;