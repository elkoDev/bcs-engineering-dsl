grammar BCSHardware
import "./common"

entry HardwareModel:
    hardwareDefinitions+=HardwareDefinition*
;

HardwareDefinition:
    Controller | Bus | NetworkSettings
;

// ----------------------------------------------------------------
// LOGICAL / SIGNAL VIEW
// ----------------------------------------------------------------
Controller:
    'controller' name=ID 'for' platform=Platform '{'
        (components+=Component)*
    '}';

type Platform = 'Beckhoff' | 'KNX' | 'Siemens';
Platform returns string:
    'Beckhoff' | 'KNX' | 'Siemens';  

Component:
    PortGroup | Datapoint
;

PortGroup:
    'portgroup' name=ID '{'
         'module:' module=[Module]
         'ioType:' ioType=IOType
         'channels:' channels=IntLiteral
    '}'
;

Datapoint:
    'datapoint' name=ID '{'
         'portgroup:' portgroup=[PortGroup]
         'channels:' '{' channels+=Channel (',' channels+=Channel)* '}'
    '}'
;

Channel:
    'channel' name=ID ':' dataType=PrimitiveType
    ('[' bitRange=BitRange ']')?
    'at' index=IntLiteral
;

BitRange:
    start=IntLiteral ('..' end=IntLiteral)?
;

type IOType = 'ANALOG_INPUT' | 'ANALOG_OUTPUT' |'DIGITAL_INPUT' | 'DIGITAL_OUTPUT';
IOType returns string:
    'ANALOG_INPUT' | 'ANALOG_OUTPUT' | 'DIGITAL_INPUT' | 'DIGITAL_OUTPUT';


// ----------------------------------------------------------------
//  PHYSICAL / DEPLOYMENT VIEW
// ----------------------------------------------------------------
Bus:
    'bus' name=ID 'type' busType=BusType '{'
        'masterDevice:' master=StringLiteral        // e.g. "Device 1 (EtherCAT)"
        boxes+=Box*
    '}'
;

Box:
    'box' name=ID '{'
        'product:' productCode=ID           // e.g. EK1100, CU1128
        ('revision:' rev=StringLiteral)?    // optional explicit rev
        modules+=Module*
    '}'
;

Module:
    'module' name=ID '{'
        'product:' productCode=ID           // e.g. EL1008, KL2408
        ('revision:' rev=StringLiteral)?
        'position:' slot=IntLiteral         // term slot number
    '}'
;

NetworkSettings:
    'network' '{'
        'ipAddress:' ip=StringLiteral       // TODO: IPLiteral
        'subnetMask:' mask=StringLiteral    // TODO: IPLiteral
        ('gateway:' gateway=ID)?
        ('httpPort:' httpPort=IntLiteral)?
        ('adsPort:'  adsPort=IntLiteral)?
    '}'
;

type BusType = 'EtherCAT' | 'Profinet' | 'Profibus'; 
BusType returns string:
    'EtherCAT' | 'Profinet' | 'Profibus';