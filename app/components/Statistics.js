'use client'
import { useState, useEffect, useCallback } from 'react';

export default function Statistics({ medications }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({
    total: 0,
    taken: 0,
    missed: 0,
    pending: 0
  });

  const calculateStats = useCallback(() => {
    const dailyStats = { total: 0, taken: 0, missed: 0, pending: 0 };
    medications.forEach(med => {
      const dayLogs = med.logs?.[selectedDate] || {};
      const statuses = Object.values(dayLogs);
      dailyStats.total += statuses.length;
      dailyStats.taken += statuses.filter(status => status === 'taken').length;
      dailyStats.missed += statuses.filter(status => status === 'missed').length;
      dailyStats.pending += statuses.filter(status => status === 'pending').length;
    });
    setStats(dailyStats);
  }, [medications, selectedDate]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  return (
    <div className="bg-white shadow-md rounded p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">Medication Statistics</h2>
      
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Select Date:
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="shadow border rounded py-2 px-3 text-gray-700"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="text-lg font-semibold text-blue-700">Total</h3>
          <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded">
          <h3 className="text-lg font-semibold text-green-700">Taken</h3>
          <p className="text-3xl font-bold text-green-900">{stats.taken}</p>
          <p className="text-sm text-green-600">
            {stats.total ? Math.round((stats.taken / stats.total) * 100) : 0}%
          </p>
        </div>

        <div className="bg-red-50 p-4 rounded">
          <h3 className="text-lg font-semibold text-red-700">Missed</h3>
          <p className="text-3xl font-bold text-red-900">{stats.missed}</p>
          <p className="text-sm text-red-600">
            {stats.total ? Math.round((stats.missed / stats.total) * 100) : 0}%
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded">
          <h3 className="text-lg font-semibold text-gray-700">Pending</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
          <p className="text-sm text-gray-600">
            {stats.total ? Math.round((stats.pending / stats.total) * 100) : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}