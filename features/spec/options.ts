import { getGrades } from '@/features/masters/grades/queries';
import { getSizeOptions } from '@/features/masters/sizes/queries';
import type { SpecOptions } from './components/spec-fields';

/** Everything a spec form's pickers offer: the size chart and the grade master. */
export async function getSpecOptions(): Promise<SpecOptions> {
  const [sizes, grades] = await Promise.all([getSizeOptions(), getGrades()]);
  return { sizes, grades };
}
