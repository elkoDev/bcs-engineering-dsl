grammar BCSHardware
import "./common"

entry HardwareModel:
    (controllers+=Controller)*
;

Controller:
    'controller' name=ID '{'
        (components+=Component)*
    '}';

Component:
    Sensor | Actuator
;

Sensor:
    'sensor' name=ID '{'
        'type:' type=SensorType
        'ioType:' ioType=IOType
        'dataType:' dataType=DataType
    '}'
;

Actuator:
    'actuator' name=ID '{'
        'type:' type=ActuatorType
        'ioType:' ioType=IOType
        'dataType:' dataType=DataType
    '}'
;


type SensorType = 
    'TEMPERATURE' | 'HUMIDITY' | 'MOTION' | 'CO2' | 'PRESSURE' | 'LIGHT' | 'CONTACT' | 'OCCUPANCY';
SensorType returns string:
    'TEMPERATURE' | 'HUMIDITY' | 'MOTION' | 'CO2' | 'PRESSURE' | 'LIGHT' | 'CONTACT' | 'OCCUPANCY';

type ActuatorType = 
    'VALVE' | 'FAN' | 'HEATER' | 'COOLING_UNIT' | 'DAMPER' | 'LIGHT' | 'BLINDS' | 'SWITCH';
ActuatorType returns string:
    'VALVE' | 'FAN' | 'HEATER' | 'COOLING_UNIT' | 'DAMPER' | 'LIGHT' | 'BLINDS' | 'SWITCH';


type IOType = 'AI' | 'AO' | 'DI' | 'DO';
IOType returns string:
    'AI' | 'AO' | 'DI' | 'DO';

type DataType = 'BOOL' | 'REAL' | 'INT' | 'STRING';
DataType returns string:
    'BOOL' | 'REAL' | 'INT' | 'STRING';
