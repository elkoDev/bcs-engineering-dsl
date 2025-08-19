/**
 * Complete TwinCAT configuration
 */
export interface TcConfig {
  libraries: TcLibrary[];
  buses: TcBus[];
  variableMappings: TcVariableMapping[];
  network?: TcNetworkSettings;
}

/**
 * TwinCAT library configuration
 */
export interface TcLibrary {
  name: string;
  vendor: string;
}

/**
 * TwinCAT hardware module
 */
export interface TcModule {
  product: string;
  name: string;
  slot: number;
}

/**
 * TwinCAT hardware box containing modules
 */
export interface TcBox {
  product: string;
  name: string;
  modules: TcModule[];
}

/**
 * TwinCAT communication bus
 */
export interface TcBus {
  type: string;
  name: string;
  masterDeviceName: string;
  boxes: TcBox[];
}

/**
 * Module information for variable mapping lookup
 */
export interface TcModuleInfo {
  bus: TcBus;
  box: TcBox;
  module: TcModule;
}

/**
 * PLC variable to hardware mapping
 */
export interface TcVariableMapping {
  plcVar: string;
  direction: "Input" | "Output";
  bus?: string;
  box?: string;
  moduleProduct?: string;
  moduleSlot?: number;
  link: string;
}

/**
 * Network configuration settings
 */
export interface TcNetworkSettings {
  hostname?: string;
  ipAddress?: string;
}
