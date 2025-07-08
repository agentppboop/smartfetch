// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';

type PromoEntry = {
  videoId: string;
  videoTitle: string;
  code: string;
  link: string;
  confidence: string;
  status: string;
};

export default function Dashboard() {
  const [data, setData] = useState<PromoEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Replace this with your actual API fetch later
    const fetchData = async () => {
      const dummyData: PromoEntry[] = [
        {
          videoId: 'Uwmp16aSgdk',
          videoTitle: 'M4 Macbook Air Review',
          code: '—',
          link: 'https://youtu.be/Uwmp16aSgdk',
          confidence: '0.08',
          status: 'Rejected',
        },
      ];
      setData(dummyData);
      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-4">SmartFetch Dashboard</h1>

      {loading ? (
        <p>Loading data...</p>
      ) : (
        <table className="w-full table-auto border-collapse border border-gray-500 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-2">Video</th>
              <th className="border border-gray-400 p-2">Promo Code</th>
              <th className="border border-gray-400 p-2">Link</th>
              <th className="border border-gray-400 p-2">Confidence</th>
              <th className="border border-gray-400 p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, i) => (
              <tr key={i}>
                <td className="border p-2">{entry.videoTitle}</td>
                <td className="border p-2 text-center">{entry.code}</td>
                <td className="border p-2">
                  <a
                    href={entry.link}
                    target="_blank"
                    className="text-blue-500 underline"
                  >
                    Watch
                  </a>
                </td>
                <td className="border p-2 text-center">{entry.confidence}</td>
                <td
                  className={`border p-2 text-center font-medium ${
                    entry.status === 'Rejected'
                      ? 'text-red-600'
                      : entry.status === 'Accepted'
                      ? 'text-green-600'
                      : 'text-yellow-600'
                  }`}
                >
                  {entry.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
