// Control Unit 'AfterUnit'
TON_AfterInstance1(IN := conditionA);
R_TRIG_AfterInstance1(CLK := TON_AfterInstance1.Q);
IF R_TRIG_AfterInstance1.Q THEN
    conditionB := TRUE;
    conditionA := FALSE;
END_IF;

TON_AfterInstance2(IN := conditionB = TRUE);
R_TRIG_AfterInstance2(CLK := TON_AfterInstance2.Q);
IF R_TRIG_AfterInstance2.Q THEN
    conditionA := TRUE;
    conditionB := FALSE;
END_IF;