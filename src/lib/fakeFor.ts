// lib/fakeFor.ts
import { faker } from '@faker-js/faker';

export function fakeFor(
  columnName: string,
  columnType: 'TEXT' | 'NUMBER',
  seed?: number
) {
  if (seed !== undefined) faker.seed(seed);

  const lower = columnName.toLowerCase();
  if (lower.includes('name') || lower.includes('title')) return faker.person.fullName();
  if (lower.includes('email')) return faker.internet.email();
  if (lower.includes('note') || lower.includes('description') || lower.includes('comment')) return faker.lorem.words(2);
  if (lower.includes('assignee') || lower.includes('owner') || lower.includes('user')) return faker.person.firstName();
  if (lower.includes('status')) return faker.helpers.arrayElement(['In Progress', 'Complete', 'Pending', 'Review', 'Blocked']);
  if (lower.includes('priority')) return faker.helpers.arrayElement(['High', 'Medium', 'Low', 'Critical']);
  if (lower.includes('attachment') || lower.includes('file')) return faker.helpers.arrayElement(['', 'document.pdf', 'image.jpg', 'spreadsheet.xlsx']);
  if (columnType === 'NUMBER') return String(faker.number.int({ min: 0, max: 100 }));
  return faker.lorem.words(2);
}
