tempSum := 0;
tempProduct := 1;
FOR i := 0 TO 5 BY 1 DO
    tempSum := tempSum + i;
END_FOR;
FOR i := 1 TO iCount BY 1 DO
    tempSum := tempSum + i;
END_FOR;
j := 1;
WHILE j <= iCount DO
        tempProduct := tempProduct * j;
        j := j + 1;
END_WHILE;
oSum := tempSum;
oProduct := tempProduct;