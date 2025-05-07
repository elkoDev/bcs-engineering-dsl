// Implementation of LoopsFB
// Auto-generated from BCS Engineering DSL

// For loop test
FOR i := 1 TO iCount BY 1 DO
    tempSum := tempSum + i;
END_FOR;

// While loop test
j := 1;
WHILE j <= iCount DO
    tempProduct := tempProduct * j;
    j := j + 1;
END_WHILE;

oSum := tempSum;
oProduct := tempProduct;