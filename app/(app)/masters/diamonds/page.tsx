import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDiamondAttributes, ATTRIBUTE_TYPES } from '@/features/masters/diamonds/queries';
import { AttributeList } from '@/features/masters/diamonds/components/attribute-list';

export const dynamic = 'force-dynamic';

export default async function DiamondMasterPage() {
  const grouped = await getDiamondAttributes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Diamond master</h1>
        <p className="text-sm text-muted-foreground">
          The values a purchase or memo can pick from. Sieve and MM aren&apos;t here — those are
          measurements, not a fixed list, and get normalized automatically on stock.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attribute values</CardTitle>
          <CardDescription>Removing a value only stops it being offered next time — it doesn&apos;t touch existing stock.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {ATTRIBUTE_TYPES.map((t) => (
            <AttributeList key={t} type={t} values={grouped[t]} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
