grammar BCSHardware
import "./common"

entry HardwareModel:
    (controllers+=Controller)*;

Controller:
    'controller' name=ID '{'
        (components+=Component)*
    '}';

Component:
    Sensor | Actuator;

Sensor:
    'sensor' name=ID '{'
        'type:' type=SensorType
        'ioType:' ioType=IOType
        'dataType:' dataType=DataType
    '}';

Actuator:
    'actuator' name=ID '{'
        'type:' type=ActuatorType
        'ioType:' ioType=IOType
        'dataType:' dataType=DataType
    '}';


type SensorType = 
    'TEMPERATURE' | 'HUMIDITY' | 'MOTION' | 'CO2' | 'PRESSURE' | 'LIGHT' | 'CONTACT' | 'OCCUPANCY';
SensorType returns SensorType:
    SensorType_TEMPERATURE | SensorType_HUMIDITY | SensorType_MOTION | SensorType_CO2 |
    SensorType_PRESSURE | SensorType_LIGHT | SensorType_CONTACT | SensorType_OCCUPANCY;
SensorType_TEMPERATURE returns string: 'TEMPERATURE';
SensorType_HUMIDITY returns string: 'HUMIDITY';
SensorType_MOTION returns string: 'MOTION';
SensorType_CO2 returns string: 'CO2';
SensorType_PRESSURE returns string: 'PRESSURE';
SensorType_LIGHT returns string: 'LIGHT';
SensorType_CONTACT returns string: 'CONTACT';
SensorType_OCCUPANCY returns string: 'OCCUPANCY';

type ActuatorType = 
    'VALVE' | 'FAN' | 'HEATER' | 'COOLING_UNIT' | 'DAMPER' | 'LIGHT' | 'BLINDS' | 'SWITCH';
ActuatorType returns ActuatorType:
    ActuatorType_VALVE | ActuatorType_FAN | ActuatorType_HEATER | ActuatorType_COOLING_UNIT |
    ActuatorType_DAMPER | ActuatorType_LIGHT | ActuatorType_BLINDS | ActuatorType_SWITCH;
ActuatorType_VALVE returns string: 'VALVE';
ActuatorType_FAN returns string: 'FAN';
ActuatorType_HEATER returns string: 'HEATER';
ActuatorType_COOLING_UNIT returns string: 'COOLING_UNIT';
ActuatorType_DAMPER returns string: 'DAMPER';
ActuatorType_LIGHT returns string: 'LIGHT';
ActuatorType_BLINDS returns string: 'BLINDS';
ActuatorType_SWITCH returns string: 'SWITCH';

type IOType = 'AI' | 'AO' | 'DI' | 'DO';
IOType returns IOType:
    IOType_AI | IOType_AO | IOType_DI | IOType_DO;
IOType_AI returns string: 'AI';
IOType_AO returns string: 'AO';
IOType_DI returns string: 'DI';
IOType_DO returns string: 'DO';

type DataType = 'BOOL' | 'REAL' | 'INT' | 'STRING';
DataType returns DataType:
    DataType_BOOL | DataType_REAL | DataType_INT | DataType_STRING;
DataType_BOOL returns string: 'BOOL';
DataType_REAL returns string: 'REAL';
DataType_INT returns string: 'INT';
DataType_STRING returns string: 'STRING';
