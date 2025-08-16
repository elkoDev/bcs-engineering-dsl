import {
  ControlModel,
  HardwareModel,
  Controller,
  PortGroup,
  Datapoint,
  Channel,
} from "../../../../language/generated/ast.js";
import {
  getPortGroups,
  getDatapoints,
} from "../../../../language/hardware/utils/component-utils.js";
import { getControllers } from "../../../../language/hardware/utils/hardware-definition-utils.js";
import {
  TcConfig,
  TcLibrary,
  TcBus,
  TcBox,
  TcModuleInfo,
  TcVariableMapping,
  TcNetworkSettings,
} from "../models/tc-config.js";

export class TcConfigGenerator {
  controlModel: ControlModel;
  hardwareModel: HardwareModel;

  constructor(controlModel: ControlModel, hardwareModel: HardwareModel) {
    this.controlModel = controlModel;
    this.hardwareModel = hardwareModel;
  }

  /**
   * Removes surrounding quotes from a string.
   * @param str - The string to remove quotes from
   * @returns The string without surrounding quotes
   */
  private removeQuotes(str: string): string {
    return str.replace(/^["']/, "").replace(/["']$/, "");
  }

  /**
   * Generates a JSON object for TwinCAT configuration.
   * @returns The generated TwinCAT configuration object.
   */
  generateTcConfigJson(): TcConfig {
    const libraries = this.collectLibraries();
    const buses = this.parseBuses();
    const moduleLookup = this.buildModuleLookup(buses);
    const variableMappings = this.generateVariableMappings(moduleLookup);
    const network = this.extractNetworkSettings();

    return {
      libraries,
      buses,
      variableMappings,
      ...(network ? { network } : {}),
    };
  }

  private collectLibraries(): TcLibrary[] {
    const libraries: TcLibrary[] = [];
    for (const decl of this.controlModel.importDecls ?? []) {
      if (decl.name)
        libraries.push({ name: decl.name, vendor: "Beckhoff Automation GmbH" });
    }
    return libraries;
  }

  private parseBuses(): TcBus[] {
    const buses: TcBus[] = [];
    for (const def of this.hardwareModel.hardwareDefinitions) {
      if (def.$type === "Bus") {
        const bus: TcBus = {
          type: def.busType,
          name: def.name,
          masterDeviceName: this.removeQuotes(def.master),
          boxes: [],
        };
        for (const box of def.boxes) {
          const boxObj: TcBox = {
            product: box.product,
            name: box.name,
            modules: [],
          };
          for (const mod of box.modules) {
            boxObj.modules.push({
              product: mod.product,
              name: mod.name,
              slot: mod.slot,
            });
          }
          bus.boxes.push(boxObj);
        }
        buses.push(bus);
      }
    }
    return buses;
  }

  private buildModuleLookup(buses: TcBus[]): Record<string, TcModuleInfo> {
    const moduleLookup: Record<string, TcModuleInfo> = {};
    for (const bus of buses) {
      for (const box of bus.boxes) {
        for (const mod of box.modules) {
          if (mod.name)
            moduleLookup[String(mod.name)] = { bus, box, module: mod };
        }
      }
    }
    return moduleLookup;
  }

  private generateVariableMappings(
    moduleLookup: Record<string, TcModuleInfo>
  ): TcVariableMapping[] {
    const variableMappings: TcVariableMapping[] = [];

    for (const controller of getControllers(this.hardwareModel)) {
      const portGroupMap = this.createPortGroupMap(controller);
      this.processDatapoints(
        controller,
        portGroupMap,
        moduleLookup,
        variableMappings
      );
    }

    return variableMappings;
  }

  private createPortGroupMap(controller: Controller): Map<string, PortGroup> {
    const portGroups = getPortGroups(controller);
    return new Map(portGroups.map((pg) => [pg.name, pg]));
  }

  private processDatapoints(
    controller: Controller,
    portGroupMap: Map<string, PortGroup>,
    moduleLookup: Record<string, TcModuleInfo>,
    variableMappings: TcVariableMapping[]
  ): void {
    for (const datapoint of getDatapoints(controller)) {
      const portgroup = this.getPortGroup(datapoint, portGroupMap);
      if (!portgroup) continue;

      const moduleInfo = this.getModuleInfo(portgroup, moduleLookup);
      this.processChannels(datapoint, portgroup, moduleInfo, variableMappings);
    }
  }

  private getPortGroup(
    datapoint: Datapoint,
    portGroupMap: Map<string, PortGroup>
  ): PortGroup | undefined {
    return (
      datapoint.portgroup?.ref && portGroupMap.get(datapoint.portgroup.ref.name)
    );
  }

  private getModuleInfo(
    portgroup: PortGroup,
    moduleLookup: Record<string, TcModuleInfo>
  ): TcModuleInfo | undefined {
    const moduleName = portgroup.module?.ref?.name;
    return moduleName ? moduleLookup[moduleName] : undefined;
  }

  private processChannels(
    datapoint: Datapoint,
    portgroup: PortGroup,
    moduleInfo: TcModuleInfo | undefined,
    variableMappings: TcVariableMapping[]
  ): void {
    for (const channel of datapoint.channels) {
      const variableMapping = this.createVariableMapping(
        datapoint,
        channel,
        portgroup,
        moduleInfo
      );
      variableMappings.push(variableMapping);
    }
  }

  private createVariableMapping(
    datapoint: Datapoint,
    channel: Channel,
    portgroup: PortGroup,
    moduleInfo: TcModuleInfo | undefined
  ): TcVariableMapping {
    const plcVar = `${datapoint.name}_${channel.name}`;
    const direction = portgroup.ioType.includes("INPUT") ? "Input" : "Output";

    return {
      plcVar,
      direction,
      bus: moduleInfo?.bus.type,
      box: moduleInfo?.box.product,
      moduleProduct: moduleInfo?.module.product,
      moduleSlot: moduleInfo?.module.slot,
      link: this.removeQuotes(channel.link),
    };
  }

  /**
   * Extracts the network settings from the hardware model, if present.
   */
  private extractNetworkSettings(): TcNetworkSettings | undefined {
    for (const def of this.hardwareModel.hardwareDefinitions) {
      if (def.$type === "NetworkSettings") {
        return {
          hostname: def.hostname ? this.removeQuotes(def.hostname) : undefined,
          ipAddress: def.ipAddress
            ? this.removeQuotes(def.ipAddress)
            : undefined,
        };
      }
    }
    return undefined;
  }
}
