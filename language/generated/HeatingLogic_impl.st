IF iMode = Mode.COMFORT AND iTemp < 21 THEN
  oHeating := TRUE;
ELSIF iMode = Mode.ECO AND iTemp < 18 THEN
  oHeating := TRUE;
ELSE
  oHeating := FALSE;
END_IF;
