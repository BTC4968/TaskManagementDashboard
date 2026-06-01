import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../server/src/schema.graphql',
  documents: ['src/app/graphql/**/*.graphql'],
  generates: {
    'src/app/graphql/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-apollo-angular'],
      config: {
        addExplicitOverride: true,
        sdkClass: false,
        strictScalars: true,
        scalars: {
          ID: 'string',
        },
      },
    },
  },
  ignoreNoDocuments: false,
};

export default config;
