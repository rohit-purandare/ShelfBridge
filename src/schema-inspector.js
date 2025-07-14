#!/usr/bin/env node

import { HardcoverClient } from './hardcover-client.js';
import logger from './logger.js';

async function inspectSchema() {
    console.log('🔍 Inspecting Hardcover GraphQL Schema...\n');
    
    try {
        // We need a token to connect, but we'll just get the schema
        // For now, let's create a minimal client to test the schema
        const client = new HardcoverClient('dummy-token');
        
        // Get the full schema
        console.log('📋 Getting full schema...');
        const schema = await client.getSchema();
        
        if (!schema || !schema.__schema) {
            console.log('❌ Could not retrieve schema');
            return;
        }
        
        console.log('✅ Schema retrieved successfully\n');
        
        // Look for mutation type
        const mutationType = schema.__schema.types.find(type => type.name === 'mutation_root');
        
        if (!mutationType || !mutationType.fields) {
            console.log('❌ No mutation_root type found in schema');
            return;
        }
        
        console.log('🔧 Available Mutations:');
        console.log('='.repeat(50));
        
        // List all mutations
        mutationType.fields.forEach(field => {
            console.log(`📝 ${field.name}`);
            if (field.args && field.args.length > 0) {
                console.log(`   Arguments: ${field.args.map(arg => `${arg.name}: ${arg.type.name || arg.type.ofType?.name || 'unknown'}`).join(', ')}`);
            }
            console.log('');
        });
        
        // Look specifically for user book related mutations
        console.log('📚 User Book Related Mutations:');
        console.log('='.repeat(50));
        
        const userBookMutations = mutationType.fields.filter(field => 
            field.name.includes('user_book') || 
            field.name.includes('UserBook') ||
            field.name.includes('book') ||
            field.name.includes('Book')
        );
        
        userBookMutations.forEach(field => {
            console.log(`📝 ${field.name}`);
            if (field.args && field.args.length > 0) {
                console.log(`   Arguments: ${field.args.map(arg => `${arg.name}: ${arg.type.name || arg.type.ofType?.name || 'unknown'}`).join(', ')}`);
            }
            console.log('');
        });
        
        // Look for insert mutations specifically
        console.log('➕ Insert Mutations:');
        console.log('='.repeat(50));
        
        const insertMutations = mutationType.fields.filter(field => 
            field.name.includes('insert') || 
            field.name.includes('Insert') ||
            field.name.includes('add') ||
            field.name.includes('Add')
        );
        
        insertMutations.forEach(field => {
            console.log(`📝 ${field.name}`);
            if (field.args && field.args.length > 0) {
                console.log(`   Arguments: ${field.args.map(arg => `${arg.name}: ${arg.type.name || arg.type.ofType?.name || 'unknown'}`).join(', ')}`);
            }
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Error inspecting schema:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the inspection
inspectSchema().then(() => {
    console.log('✅ Schema inspection complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Schema inspection failed:', error);
    process.exit(1);
}); 