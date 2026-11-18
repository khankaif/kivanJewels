import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/page-header';
import { MastersNav } from '@/features/masters/components/masters-nav';
import { getGradeLists, LISTS, type ListName } from '@/features/masters/grades/queries';
import { GradeSheet } from '@/features/masters/grades/components/grade-sheet';
import { currentUser, isAdmin } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function GradesPage() {
  const [lists, user] = await Promise.all([getGradeLists(), currentUser()]);
  const admin = await isAdmin(user);

  return (
    <div className="space-y-4">
      <PageHeader title="Masters" tabs={<MastersNav />} />
      {(Object.keys(LISTS) as ListName[]).map((list) => {
        const { label, hint } = LISTS[list];
        const rows = lists[list];
        return (
          <Card key={list}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardDescription>{hint}</CardDescription>
              {admin && (
                <CardAction>
                  <GradeSheet list={list} label={label}
                              nextOrder={Math.max(0, ...rows.map((r) => r.sort_order)) + 1} />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">In use</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.name} className={r.active ? undefined : 'text-muted-foreground'}>
                      <TableCell className="font-medium">
                        {r.name} {!r.active && <Badge variant="outline">Retired</Badge>}
                      </TableCell>
                      <TableCell className="font-mono">{r.code ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.used || '—'}</TableCell>
                      <TableCell className="text-right">
                        {admin && <GradeSheet list={list} label={label} row={r} />}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No values yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
