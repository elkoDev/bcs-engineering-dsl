import {
  ControlModel,
  HardwareModel,
} from "../../../language/generated/ast.js";
import {
  getPortGroups,
  getDatapoints,
} from "../../../language/hardware/utils/component-utils.js";
import { getControllers } from "../../../language/hardware/utils/hardware-definition-utils.js";

export class TcConfigGenerator {
  controlModel: ControlModel;
  hardwareModel: HardwareModel;

  constructor(controlModel: ControlModel, hardwareModel: HardwareModel) {
    this.controlModel = controlModel;
    this.hardwareModel = hardwareModel;
  }

  /**
   * Generates a JSON object for TwinCAT configuration.
   * @returns {object} The generated TwinCAT configuration object.
   */
  generateTcConfigJson() {
    const libraries = this.collectLibraries();
    const buses = this.parseBuses();
    const moduleLookup = this.buildModuleLookup(buses);
    const variableMappings = this.generateVariableMappings(moduleLookup);

    return {
      libraries,
      buses,
      variableMappings,
    };
  }

  private collectLibraries(): { name: string; vendor: string }[] {
    const libraries: { name: string; vendor: string }[] = [];
    for (const decl of this.controlModel.importDecls ?? []) {
      if (decl.name)
        libraries.push({ name: decl.name, vendor: "Beckhoff Automation GmbH" });
    }
    return libraries;
  }

  private parseBuses(): any[] {
    const buses: any[] = [];
    for (const def of this.hardwareModel.hardwareDefinitions) {
      if (def.$type === "Bus") {
        const bus: any = {
          type: def.busType,
          name: def.name,
          masterDeviceName: def.master.replace(/^"|"$/g, ""), // Remove quotes
          boxes: [] as any[],
        };
        for (const box of def.boxes) {
          const boxObj: any = {
            product: box.productCode,
            name: box.name,
            modules: [] as any[],
          };
          for (const mod of box.modules) {
            boxObj.modules.push({
              product: mod.productCode,
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

  private buildModuleLookup(
    buses: any[]
  ): Record<string, { bus: any; box: any; module: any }> {
    const moduleLookup: Record<string, { bus: any; box: any; module: any }> =
      {};
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
    moduleLookup: Record<string, { bus: any; box: any; module: any }>
  ): any[] {
    const variableMappings: any[] = [];
    for (const controller of getControllers(this.hardwareModel)) {
      const portGroups = getPortGroups(controller);
      const portGroupMap = new Map(portGroups.map((pg) => [pg.name, pg]));
      for (const datapoint of getDatapoints(controller)) {
        const portgroup =
          datapoint.portgroup?.ref &&
          portGroupMap.get(datapoint.portgroup.ref.name);
        if (!portgroup) continue;
        const moduleName = portgroup.module?.ref?.name;
        const moduleInfo = moduleName ? moduleLookup[moduleName] : undefined;
        for (const channel of datapoint.channels) {
          const plcVar = `${datapoint.name}_${channel.name}`;
          const direction = portgroup.ioType.includes("INPUT")
            ? "Input"
            : "Output";
          const channelIndex = channel.index;
          variableMappings.push({
            plcVar,
            direction,
            channelIndex,
            bus: moduleInfo?.bus.type,
            box: moduleInfo?.box.product,
            moduleProduct: moduleInfo?.module.product,
            moduleSlot: moduleInfo?.module.slot,
          });
        }
      }
    }
    return variableMappings;
  }
}
