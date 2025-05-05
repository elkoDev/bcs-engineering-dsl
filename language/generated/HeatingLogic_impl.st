// ******** Implementation of HeatingLogic
IF iMode == Mode.COMFORT && iTemp < 21.0 THEN
oHeating := true;

ELSIF iMode == Mode.ECO && iTemp < 18.0 THEN
oHeating := true;

ELSE
oHeating := false;

END_IF

