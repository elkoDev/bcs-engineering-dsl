import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { BcsEngineeringAstType, Person } from './generated/ast.js';
import type { BcsEngineeringServices } from './bcs-engineering-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: BcsEngineeringServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.BcsEngineeringValidator;
    const checks: ValidationChecks<BcsEngineeringAstType> = {
        Person: validator.checkPersonStartsWithCapital
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class BcsEngineeringValidator {

    checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
        if (person.name) {
            const firstChar = person.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
            }
        }
    }

}
