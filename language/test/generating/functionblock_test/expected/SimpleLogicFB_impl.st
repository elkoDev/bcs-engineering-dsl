oOutput := iInput;
TON_AfterInstance1(IN := oOutput = TRUE);
R_TRIG_AfterInstance1(CLK := TON_AfterInstance1.Q);
IF R_TRIG_AfterInstance1.Q THEN
    oOutput := FALSE;
END_IF;
R_TRIG_Instance1(CLK := iInput);
IF R_TRIG_Instance1.Q THEN
    oOutput := TRUE;
END_IF;
F_TRIG_Instance1(CLK := iInput);
IF F_TRIG_Instance1.Q THEN
    oOutput := FALSE;
END_IF;