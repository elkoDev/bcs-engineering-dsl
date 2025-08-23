// Control Unit 'TestFunctionBlock'
SimpleLogicFBInstance1(iInput:=TestFunctionBlock_input, iInput2:=TestFunctionBlock_input2);
TestFunctionBlock_output := SimpleLogicFBInstance1.oOutput;

SimpleLogicFBInstance2(iInput:=TestFunctionBlock_input3, iInput2:=TestFunctionBlock_input4);
TestFunctionBlock_output2 := SimpleLogicFBInstance2.oOutput;

F_TRIG_Instance3(CLK := TestFunctionBlock_input);
IF F_TRIG_Instance3.Q THEN
    TestFunctionBlock_output := FALSE;
END_IF;