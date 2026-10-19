import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAttributeBuckets, getDiamondAttributes, getMasterMismatches,
} from '@/features/masters/diamonds/queries';
import { AttributeList, AddBucket } from '@/features/masters/diamonds/components/attribute-list';
import { MismatchList } from '@/features/masters/diamonds/components/mismatch-list';
import { addBucketAction } from '@/features/masters/diamonds/actions';
import { MastersNav } from '@/features/masters/components/masters-nav';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

export default async function DiamondMasterPage() {
  const [buckets, grouped, mismatches] = await Promise.all([
    getAttributeBuckets(), getDiamondAttributes(), getMasterMismatches(),
  ]);
  const valuesByBucket = Object.fromEntries(
    Object.entries(grouped).map(([k, v]) => [k, v.map((a) => a.value)]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Diamond master"
        description="Control the values and rules used by transaction forms. Sieve and MM stay free measurements and are normalized automatically."
      />

      <MastersNav />

      <Card>
        <CardHeader>
          <CardTitle>
            Values the master doesn&apos;t know
            {mismatches.length > 0 && (
              <span className="ml-2 text-sm font-normal text-warning">{mismatches.length}</span>
            )}
          </CardTitle>
          <CardDescription>
            Every stone field is filled from these lists — nothing is typed free-hand, so the book
            can&apos;t grow a seventh spelling of &quot;Lab Grown&quot;. Anything already stored that
            the master can&apos;t resolve is listed here: adopt it, or map it onto the value it
            really means.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MismatchList mismatches={mismatches} valuesByBucket={valuesByBucket} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attribute values</CardTitle>
          <CardDescription>
            Removing a value only stops it being offered next time — it doesn&apos;t touch existing
            stock. New lists you add are managed here; the preset ones are wired to form fields
            and can&apos;t be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {buckets.map((b) => (
              <AttributeList key={b.key} bucket={b} values={grouped[b.key] ?? []} />
            ))}
          </div>
          <AddBucket action={addBucketAction} />
        </CardContent>
      </Card>
    </div>
  );
}
