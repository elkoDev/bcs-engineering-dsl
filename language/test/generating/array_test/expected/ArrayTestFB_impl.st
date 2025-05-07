// Implementation of ArrayTestFB
// Auto-generated from BCS Engineering DSL

// Reset calculations
sum := 0;
maxVal := -32768;

// Process array elements
FOR i := 0 TO MIN(iCount - 1, 9) BY 1 DO
    // Calculate sum
    sum := sum + iValues[i];
    
    // Find maximum value
    IF (iValues[i] > maxVal) THEN
        maxVal := iValues[i];
    END_IF;
    
    // Process and store values (multiply by 2)
    oProcessedValues[i] := iValues[i] * 2;
END_FOR;

// Zero out remaining array elements
FOR i := iCount TO 9 BY 1 DO
    oProcessedValues[i] := 0;
END_FOR;

// Set outputs
oSum := sum;
oMaxValue := maxVal;

// Calculate average (avoid division by zero)
IF (iCount > 0) THEN
    oAverage := REAL_TO_REAL(sum) / REAL_TO_REAL(iCount);
ELSE
    oAverage := 0.0;
END_IF;