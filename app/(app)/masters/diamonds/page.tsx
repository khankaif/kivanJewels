import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
    <div className="space-y-4">
      <PageHeader
        title="Masters"
        tabs={<MastersNav />}
      />

      {mismatches.length > 0 && (
        <Card size="sm">
          <Collapsible className="flex flex-col gap-3">
            <CardHeader>
              <CardTitle>
                {mismatches.length} stored value{mismatches.length === 1 ? '' : 's'} don&apos;t match the master
              </CardTitle>
              <CardDescription>
                Adopt each one, or map it onto the value it really means, so the book keeps one
                spelling of every grade.
              </CardDescription>
              <CardAction>
                <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>Review</CollapsibleTrigger>
              </CardAction>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <MismatchList mismatches={mismatches} valuesByBucket={valuesByBucket} />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

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
          {/* Columns, not a grid: lists differ wildly in length, and a grid row
              would stretch every short list to match the longest one. */}
          <div className="gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
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
