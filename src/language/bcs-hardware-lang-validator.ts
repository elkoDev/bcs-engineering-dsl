import { ValidationAcceptor, ValidationChecks } from "langium";
import {
  Actuator,
  BCSEngineeringDSLAstType,
  Controller,
  Sensor,
} from "./generated/ast.js";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";

export function registerBCSHardwareValidationChecks(
  services: BCSHardwareLangServices
) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.BCSHardwareLangValidator;
  const checks: ValidationChecks<BCSEngineeringDSLAstType> = {
    Controller: [
      validator.checkControllerHasName,
      validator.checkUniqueComponentNames,
    ],
    Sensor: [validator.checkSensorIOCompatibility],
    Actuator: [validator.checkActuatorIsValid],
  };
  registry.register(checks, validator);
}

export class BCSHardwareLangValidator {
  /**
   * Validates that the given controller has a name with a minimum length of 3 characters.
   * If the name is shorter than 3 characters, a warning is issued through the provided
   * validation acceptor.
   *
   * @param controller - The controller object to validate.
   * @param accept - The validation acceptor used to report warnings or errors.
   */
  checkControllerHasName(
    controller: Controller,
    accept: ValidationAcceptor
  ): void {
    if (controller.name.length < 3) {
      accept("warning", `Controller name must be at least 3 characters long`, {
        node: controller,
        property: "name",
      });
    }
  }

  /**
   * Validates that all components within a given controller have unique names.
   * If duplicate component names are found, an error is reported using the provided `ValidationAcceptor`.
   *
   * @param controller - The controller object containing the components to validate.
   * @param accept - A function used to report validation issues. It accepts the severity,
   *                 a message, and additional context about the validation issue.
   */
  checkUniqueComponentNames(
    controller: Controller,
    accept: ValidationAcceptor
  ) {
    const seen = new Set<string>();
    for (const comp of controller.components) {
      if (seen.has(comp.name)) {
        accept(
          "error",
          `Duplicate component name '${comp.name}' in this controller.`,
          { node: comp, property: "name" }
        );
      } else {
        seen.add(comp.name);
      }
    }
  }

  /**
   * Validates the compatibility between a sensor's IO type and its data type.
   *
   * @param sensor - The sensor object to validate. The `ioType` property specifies
   *                 the input/output type (e.g., "AI", "AO"), and the `dataType`
   *                 property specifies the data type (e.g., "REAL", "INT").
   * @param accept - A callback function used to report validation issues. It accepts
   *                 a severity level (e.g., "warning"), a message, and additional
   *                 context such as the node and property causing the issue.
   *
   * @remarks
   * This method enforces the following rule:
   * - If the sensor's `ioType` is "AI" (Analog Input) or "AO" (Analog Output),
   *   its `dataType` should be either "REAL" or "INT". If this rule is violated,
   *   a warning is reported.
   */
  checkSensorIOCompatibility(sensor: Sensor, accept: ValidationAcceptor) {
    // If sensor.ioType is ANALOG => sensor.dataType should be REAL or INT
    if (
      sensor.ioType === "ANALOG" &&
      !(sensor.dataType === "REAL" || sensor.dataType === "INT")
    ) {
      accept(
        "warning",
        `Sensor with ioType '${sensor.ioType}' usually has dataType REAL or INT.`,
        { node: sensor, property: "dataType" }
      );
    } else if (sensor.ioType === "DIGITAL" && sensor.dataType !== "BOOL") {
      accept(
        "warning",
        `Sensor with ioType '${sensor.ioType}' usually has dataType BOOL.`,
        { node: sensor, property: "dataType" }
      );
    }
  }

  checkActuatorIsValid(act: Actuator, accept: ValidationAcceptor) {
    // e.g. if you want to forbid DAMPER with dataType=STRING
    if (act.type === "DAMPER" && act.dataType === "STRING") {
      accept("error", `DAMPER cannot use dataType=STRING.`, {
        node: act,
        property: "dataType",
      });
    }
  }
}
