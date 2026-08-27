// TODO: Replace with your own seed data.
// Each file exports typed test data constants used by the corresponding spec file.
// Example:

export interface ExampleTestData {
  readonly region: 'US' | 'CA'
  readonly id: string
  readonly nonExistentId: string
}

export const EXAMPLE_DATA: readonly ExampleTestData[] = [
  {
    region: 'US',
    id: 'example-id-001',
    nonExistentId: 'example-id-999'
  }
]
