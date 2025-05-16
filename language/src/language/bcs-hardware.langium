grammar BCSHardware
import "./common"

entry HardwareModel:
    hardwareDefinitions+=HardwareDefinition*
;

HardwareDefinition:
    Controller | Bus | NetworkSettings
;

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
         'startAddress:' startAddress=IOBinding
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


terminal IOBinding: /%[IQ][XBWDL]?([0-9]+(\.[0-9]+)?)?/;


// ----------------------------------------------------------------
//  PHYSICAL / DEPLOYMENT VIEW
// ----------------------------------------------------------------
Bus:
    'bus' name=ID 'type' busType=BusType '{'
        'masterDevice:' master=ID        // e.g. "Device 1 (EtherCAT)"
        boxes+=Box*
    '}'
;

Box:
    'box' name=ID '{'
        'product:' productCode=ID            // e.g. EK1100, CU1128
        ('revision:' rev=ID)?               // optional explicit rev
        ('branch:' port=ID)?                 // for CU1128 A/B branch
        modules+=Module*
    '}'
;

Module:
    'module' name=ID '{'
        'product:' productCode=ID            // e.g. EL1008, KL2408
        ('revision:' rev=ID)?
        'position:' slot=IntLiteral         // term slot number
    '}'
;

NetworkSettings:
    'network' '{'
        'ipAddress:' ip=ID
        'subnetMask:' mask=ID
        ('gateway:' gateway=ID)?
        ('httpPort:' httpPort=IntLiteral)?
        ('adsPort:'  adsPort=IntLiteral)?
    '}'
;

type BusType = 'ETHERCAT' | 'PROFINET' | 'PROFIBUS'; 
BusType returns string:
    'ETHERCAT' | 'PROFINET' | 'PROFIBUS';