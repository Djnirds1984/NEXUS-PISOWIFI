import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Edit3, Save, X } from 'lucide-react';

interface Rate {
  pesos: number;
  minutes: number;
}

interface RatesSettings {
  timePerPeso: number;
  rates: Rate[];
}

const RatesTab: React.FC = () => {
  const [ratesSettings, setRatesSettings] = useState<RatesSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingRates, setEditingRates] = useState<RatesSettings | null>(null);
  const [newRate, setNewRate] = useState({ pesos: '', minutes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await fetch('/api/admin/rates');
      if (!response.ok) {
        throw new Error('Failed to fetch rates');
      }
      const result = await response.json();
      setRatesSettings(result.data);
      setEditingRates(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRates = async () => {
    if (!editingRates) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingRates),
      });

      if (!response.ok) {
        throw new Error('Failed to save rates');
      }

      await fetchRates();
      setEditing(false);
      alert('Rates updated successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save rates');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRate = () => {
    if (!newRate.pesos || !newRate.minutes) {
      alert('Please enter both pesos and minutes');
      return;
    }

    const pesos = parseFloat(newRate.pesos);
    const minutes = parseInt(newRate.minutes);

    if (isNaN(pesos) || isNaN(minutes) || pesos <= 0 || minutes <= 0) {
      alert('Please enter valid positive numbers');
      return;
    }

    if (editingRates?.rates.some(rate => rate.pesos === pesos)) {
      alert('A rate with this peso amount already exists');
      return;
    }

    setEditingRates({
      ...editingRates!,
      rates: [...editingRates!.rates, { pesos, minutes }].sort((a, b) => a.pesos - b.pesos)
    });
    setNewRate({ pesos: '', minutes: '' });
  };

  const handleRemoveRate = (index: number) => {
    if (!editingRates) return;
    
    const newRates = editingRates.rates.filter((_, i) => i !== index);
    setEditingRates({
      ...editingRates,
      rates: newRates
    });
  };

  const handleEditRate = (index: number, field: 'pesos' | 'minutes', value: string) => {
    if (!editingRates) return;

    const newRates = [...editingRates.rates];
    const numValue = field === 'pesos' ? parseFloat(value) : parseInt(value);
    
    if (isNaN(numValue) || numValue <= 0) {
      return;
    }

    newRates[index] = { ...newRates[index], [field]: numValue };
    setEditingRates({
      ...editingRates,
      rates: newRates
    });
  };

  const handleTimePerPesoChange = (value: string) => {
    if (!editingRates) return;

    const timePerPeso = parseInt(value);
    if (isNaN(timePerPeso) || timePerPeso <= 0) {
      return;
    }

    setEditingRates({
      ...editingRates,
      timePerPeso
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-400">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ratesSettings) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Time Per Peso Setting */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-blue-600" />
          Default Rate Configuration
        </h3>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            Time per Peso (minutes):
          </label>
          {editing ? (
            <input
              type="number"
              value={editingRates?.timePerPeso || 0}
              onChange={(e) => handleTimePerPesoChange(e.target.value)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          ) : (
            <span className="text-lg font-semibold text-gray-900">
              {ratesSettings.timePerPeso} minutes per peso
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          This is the default rate used when no specific rate is configured for a peso amount.
        </p>
      </div>

      {/* Rate Plans */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-blue-600" />
            Rate Plans
          </h3>
          <div className="flex items-center space-x-2">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditingRates(ratesSettings);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSaveRates}
                  disabled={saving}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>

        {editing && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Rate</h4>
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Pesos</label>
                <input
                  type="number"
                  value={newRate.pesos}
                  onChange={(e) => setNewRate({ ...newRate, pesos: e.target.value })}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Amount"
                  min="1"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Minutes</label>
                <input
                  type="number"
                  value={newRate.minutes}
                  onChange={(e) => setNewRate({ ...newRate, minutes: e.target.value })}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Time"
                  min="1"
                />
              </div>
              <button
                onClick={handleAddRate}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {(editing ? editingRates?.rates : ratesSettings.rates)?.map((rate, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(rate.pesos)}
                </div>
                <div className="text-gray-500">=</div>
                {editing ? (
                  <input
                    type="number"
                    value={rate.minutes}
                    onChange={(e) => handleEditRate(index, 'minutes', e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                ) : (
                  <div className="text-lg font-semibold text-gray-900">
                    {rate.minutes} minutes
                  </div>
                )}
              </div>
              {editing && (
                <button
                  onClick={() => handleRemoveRate(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {(!editing && ratesSettings.rates.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            No rate plans configured. Click Edit to add rates.
          </div>
        )}
      </div>

      {/* Rate Calculator */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Calculator</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Amount (Pesos)
            </label>
            <input
              type="number"
              placeholder="Enter peso amount"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => {
                const amount = parseFloat(e.target.value);
                if (!isNaN(amount) && amount > 0) {
                  const time = calculateTime(amount);
                  const resultDiv = document.getElementById('calculator-result');
                  if (resultDiv) {
                    resultDiv.textContent = `${formatCurrency(amount)} = ${time} minutes`;
                  }
                } else {
                  const resultDiv = document.getElementById('calculator-result');
                  if (resultDiv) {
                    resultDiv.textContent = 'Enter a valid amount';
                  }
                }
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Time
            </label>
            <div id="calculator-result" className="text-lg font-semibold text-gray-900 py-2">
              Enter an amount to see the estimated time
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function calculateTime(pesos: number): number {
    if (!ratesSettings) return 0;
    
    // Check if there's a specific rate for this amount
    const specificRate = ratesSettings.rates.find(rate => rate.pesos === pesos);
    if (specificRate) {
      return specificRate.minutes;
    }
    
    // Use default rate calculation
    return Math.floor(pesos * ratesSettings.timePerPeso);
  }
};

export default RatesTab;