import { BaseCommand } from '../BaseCommand.js';
import { HardcoverClient } from '../../hardcover-client.js';

/**
 * Schema command - checks Hardcover GraphQL schema
 */
export class SchemaCommand extends BaseCommand {
  constructor() {
    super('schema', 'Check Hardcover GraphQL schema');
  }

  async execute(options) {
    const { config, users } = this.getConfiguration();

    if (users.length === 0) {
      console.error('No users configured');
      this.exitError();
    }

    const user = users[0]; // Use first user
    console.log(`\n=== Checking schema for user: ${user.id} ===`);

    const hardcover = new HardcoverClient(user.hardcover_token);
    const schema = await hardcover.getSchema();

    if (schema && schema.__schema && schema.__schema.mutationType) {
      console.log('Available mutations:');
      schema.__schema.mutationType.fields.forEach(field => {
        console.log(`- ${field.name}`);
        if (field.args && field.args.length > 0) {
          console.log(
            `  Args: ${field.args.map(arg => arg.name).join(', ')}`
          );
        }
      });
    } else {
      console.log('No schema information available');
    }
  }
}

/**
 * Schema Detail command - gets detailed schema information
 */
export class SchemaDetailCommand extends BaseCommand {
  constructor() {
    super('schema-detail', 'Get detailed schema information for update_user_book_read');
  }

  async execute(options) {
    const { config, users } = this.getConfiguration();

    if (users.length === 0) {
      console.error('No users configured');
      this.exitError();
    }

    const user = users[0]; // Use first user
    console.log(`\n=== Getting detailed schema for user: ${user.id} ===`);

    const hardcover = new HardcoverClient(user.hardcover_token);
    const schema = await hardcover.getDetailedSchema();

    if (schema && schema.__schema && schema.__schema.types) {
      // Find the update_user_book_read mutation
      const mutationType = schema.__schema.types.find(
        type => type.name === 'mutation_root'
      );
      if (mutationType && mutationType.fields) {
        const updateMutation = mutationType.fields.find(
          field => field.name === 'update_user_book_read'
        );
        if (updateMutation) {
          console.log('update_user_book_read mutation found:');
          if (updateMutation.args && updateMutation.args.length > 0) {
            console.log(
              'Arguments:',
              updateMutation.args.map(arg => arg.name).join(', ')
            );

            // Find the input type for the object argument
            const objectArg = updateMutation.args.find(
              arg => arg.name === 'object'
            );
            if (objectArg && objectArg.type && objectArg.type.ofType) {
              const inputTypeName = objectArg.type.ofType.name;
              console.log(`Object argument type: ${inputTypeName}`);

              // Find the input type definition
              const inputType = schema.__schema.types.find(
                type => type.name === inputTypeName
              );
              if (
                inputType &&
                inputType.inputFields &&
                inputType.inputFields.length > 0
              ) {
                console.log('Available fields in object:');
                inputType.inputFields.forEach(field => {
                  const fieldType =
                    field.type.name ||
                    (field.type.ofType ? field.type.ofType.name : 'Unknown');
                  console.log(`  - ${field.name}: ${fieldType}`);
                });
              } else {
                console.log('No input fields found for object type');
              }
            } else {
              console.log('Object argument type not found');
            }
          } else {
            console.log('No arguments found for update_user_book_read');
          }
        } else {
          console.log('update_user_book_read mutation not found');
        }
      } else {
        console.log('mutation_root type not found or has no fields');
      }
    } else {
      console.log('No detailed schema information available');
    }
  }
}

/**
 * Schema Inputs command - prints all input types and their fields
 */
export class SchemaInputsCommand extends BaseCommand {
  constructor() {
    super('schema-inputs', 'Print all input types and their fields from the schema');
  }

  async execute(options) {
    const { config, users } = this.getConfiguration();

    if (users.length === 0) {
      console.error('No users configured');
      this.exitError();
    }

    const user = users[0];
    console.log(`\n=== Printing all input types for user: ${user.id} ===`);

    const hardcover = new HardcoverClient(user.hardcover_token);
    const schema = await hardcover.getDetailedSchema();

    if (schema && schema.__schema && schema.__schema.types) {
      const inputTypes = schema.__schema.types.filter(
        type => type.kind === 'INPUT_OBJECT'
      );
      inputTypes.forEach(type => {
        console.log(`\nInput type: ${type.name}`);
        if (type.inputFields && type.inputFields.length > 0) {
          type.inputFields.forEach(field => {
            const fieldType =
              field.type.name ||
              (field.type.ofType ? field.type.ofType.name : 'Unknown');
            console.log(`  - ${field.name}: ${fieldType}`);
          });
        } else {
          console.log('  (No fields)');
        }
      });
    } else {
      console.log('No detailed schema information available');
    }
  }
}
