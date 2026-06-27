import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { COMPANY_INFO } from '@/types';
import { getAllCounters, getLegacyInvoices, type CounterRow } from '@/lib/db';
import { formatNumber } from '@/lib/numbering';

export default function Instellingen() {
  const [counters, setCounters] = useState<CounterRow[]>([]);
  const [legacyCount, setLegacyCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setCounters(await getAllCounters());
      setLegacyCount((await getLegacyInvoices()).length);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Instellingen</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bedrijfsgegevens</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-1">
          <div className="font-semibold text-brand-blue">{COMPANY_INFO.name}</div>
          <div>{COMPANY_INFO.address}</div>
          <div>{COMPANY_INFO.phone}</div>
          <div>{COMPANY_INFO.email}</div>
          <div>KVK: {COMPANY_INFO.kvk}</div>
          <div>BTW-id: {COMPANY_INFO.vatId}</div>
          <div>{COMPANY_INFO.website}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nummerreeksen</CardTitle>
        </CardHeader>
        <CardContent>
          {counters.length === 0 ? (
            <p className="text-sm text-gray-400">Nog geen nummers uitgegeven.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {counters
                .slice()
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((c) => (
                  <div key={c.id} className="flex justify-between border rounded-lg p-3">
                    <span className="text-gray-500">
                      {c.prefix} · {c.year}
                    </span>
                    <span className="font-mono">
                      laatste: {formatNumber(c.prefix, c.year, c.value)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archief (oud systeem)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          {legacyCount === null
            ? 'Laden…'
            : `${legacyCount} oude record(s) in de 'invoices'-collectie. Deze blijven als read-only archief bewaard en tellen niet mee in het nieuwe systeem.`}
        </CardContent>
      </Card>
    </div>
  );
}
