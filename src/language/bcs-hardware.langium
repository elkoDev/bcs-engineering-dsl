grammar BCSHardware
import "./common"

entry HardwareModel:
    (controllers+=Controller)*
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
         'moduleType:' moduleType=ID
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