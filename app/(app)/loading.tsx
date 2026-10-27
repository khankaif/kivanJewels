import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** The shape of a desk page, so content settles into place instead of jumping. */
export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} size="sm">
            <CardContent className="space-y-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </CardContent>
      </Card>
    </div>
  );
}
