import {
  HardwareModel,
  Datapoint,
  PortGroup,
} from "../../../../language/generated/ast.js";
import {
  getDatapoints,
  getPortGroups,
} from "../../../../language/hardware/utils/component-utils.js";
import { getControllers } from "../../../../language/hardware/utils/hardware-definition-utils.js";
import {
  HardwareDatapointsResult,
  HardwareDatapoint,
} from "../models/types.js";

/**
 * Handles hardware datapoint extraction and processing
 */
export class HardwareProcessor {
  private readonly hardwareModel: HardwareModel;

  constructor(hardwareModel: HardwareModel) {
    this.hardwareModel = hardwareModel;
  }

  public extractHardwareDatapoints(): HardwareDatapointsResult {
    const inputs: HardwareDatapoint[] = [];
    const outputs: HardwareDatapoint[] = [];
    for (const controller of getControllers(this.hardwareModel)) {
      this.processDatapoints(
        getDatapoints(controller),
        getPortGroups(controller),
        inputs,
        outputs
      );
    }
    return { inputs, outputs };
  }

  private processDatapoints(
    datapoints: Datapoint[],
    portGroups: PortGroup[],
    inputs: Array<HardwareDatapoint>,
    outputs: Array<HardwareDatapoint>
  ) {
    const portGroupsMap = new Map<string, PortGroup>(
      portGroups.map((pg) => [pg.name, pg])
    );
    for (const datapoint of datapoints) {
      const portgroup =
        datapoint.portgroup?.ref &&
        portGroupsMap.get(datapoint.portgroup.ref.name);
      if (!portgroup) continue;
      const isInput =
        portgroup.ioType === "DIGITAL_INPUT" ||
        portgroup.ioType === "ANALOG_INPUT";
      this.processChannels(datapoint, isInput, inputs, outputs);
    }
  }

  private processChannels(
    datapoint: Datapoint,
    isInput: boolean,
    inputs: Array<HardwareDatapoint>,
    outputs: Array<HardwareDatapoint>
  ) {
    for (const channel of datapoint.channels) {
      const varName = `${datapoint.name}_${channel.name}`;
      let channelDataType: string;
      switch (channel.dataType) {
        case "BOOL":
          channelDataType = "BOOL";
          break;
        case "INT":
          channelDataType = "INT";
          break;
        case "REAL":
          channelDataType = "REAL";
          break;
        default:
          channelDataType = "BYTE";
      }
      if (isInput) {
        inputs.push({ name: varName, type: channelDataType });
      } else {
        outputs.push({ name: varName, type: channelDataType });
      }
    }
  }
}
