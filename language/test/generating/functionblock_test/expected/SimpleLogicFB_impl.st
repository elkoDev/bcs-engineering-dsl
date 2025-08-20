oOutput := iInput;
tonAfter1(IN := oOutput = TRUE);
rTrigAfter1(CLK := tonAfter1.Q);
IF rTrigAfter1.Q THEN
    oOutput := FALSE;
END_IF;
r_TRIGInstance1(CLK := iInput);
IF r_TRIGInstance1.Q THEN
    oOutput := TRUE;
END_IF;
f_TRIGInstance1(CLK := iInput);
IF f_TRIGInstance1.Q THEN
    oOutput := FALSE;
END_IF;