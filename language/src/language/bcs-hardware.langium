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
    'controller' name=ID '{'
        (components+=ControllerComponent)*
    '}';

ControllerComponent:
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
  'channel' name=ID ':' dataType=PrimitiveType 'link' link=StringLiteral
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
        'product:' product=ID               // e.g. EK1100, CU1128
        ('revision:' rev=StringLiteral)?    // optional explicit rev
        modules+=Module*
    '}'
;

Module:
    'module' name=ID '{'
        'product:' product=ID           // e.g. EL1008, KL2408
        ('revision:' rev=StringLiteral)?
        'slot:' slot=IntLiteral         // term slot number
    '}'
;

NetworkSettings:
    'network' '{'        
        'hostname:' hostname=StringLiteral      // e.g. "CX-301714"
        'ipAddress:' ipAddress=StringLiteral    // e.g. "192.168.1.100" TODO: IPLiteral
    '}'
;

type BusType = 'EtherCAT' | 'Profinet' | 'Profibus' | 'KBus'
BusType returns string:
    'EtherCAT' | 'Profinet' | 'Profibus' | 'KBus';