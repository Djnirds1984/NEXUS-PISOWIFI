import React, { useState, useEffect } from 'react';
import { Settings, Image, Type, Palette, Eye, Upload } from 'lucide-react';

interface PortalSettings {
  title: string;
  backgroundImage: string;
  welcomeMessage: string;
}

const PortalTab: React.FC = () => {
  const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingSettings, setEditingSettings] = useState<PortalSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchPortalSettings();
  }, []);

  const fetchPortalSettings = async () => {
    try {
      const response = await fetch('/api/admin/portal');
      if (!response.ok) {
        throw new Error('Failed to fetch portal settings');
      }
      const result = await response.json();
      setPortalSettings(result.data);
      setEditingSettings(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!editingSettings) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to save portal settings');
      }

      await fetchPortalSettings();
      setEditing(false);
      alert('Portal settings updated successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save portal settings');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('Image file must be smaller than 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      // In a real application, you would upload the image to your server
      // For this demo, we'll create a local URL
      const imageUrl = URL.createObjectURL(file);
      
      if (editingSettings) {
        setEditingSettings({
          ...editingSettings,
          backgroundImage: imageUrl
        });
      }

      alert('Image uploaded successfully! (Note: This is a local preview only)');
    } catch (err) {
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const resetToDefaults = () => {
    if (!editingSettings) return;

    setEditingSettings({
      title: 'Welcome to PisoWiFi',
      backgroundImage: '/assets/default-bg.jpg',
      welcomeMessage: 'Insert coin to start browsing'
    });
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

  if (!portalSettings) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Settings Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Settings className="h-5 w-5 mr-2 text-blue-600" />
            Portal Settings
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <Eye className="h-4 w-4" />
              <span>{previewMode ? 'Hide Preview' : 'Preview'}</span>
            </button>
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditingSettings(portalSettings);
                  }}
                  className="px-3 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Type className="h-4 w-4 mr-2" />
              Portal Title
            </label>
            {editing ? (
              <input
                type="text"
                value={editingSettings?.title || ''}
                onChange={(e) => setEditingSettings({
                  ...editingSettings!,
                  title: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter portal title"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                {portalSettings.title}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-1">This appears at the top of the user portal.</p>
          </div>

          {/* Welcome Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Type className="h-4 w-4 mr-2" />
              Welcome Message
            </label>
            {editing ? (
              <textarea
                value={editingSettings?.welcomeMessage || ''}
                onChange={(e) => setEditingSettings({
                  ...editingSettings!,
                  welcomeMessage: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Enter welcome message"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                {portalSettings.welcomeMessage}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-1">This appears in the main content area.</p>
          </div>

          {/* Background Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Image className="h-4 w-4 mr-2" />
              Background Image
            </label>
            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editingSettings?.backgroundImage || ''}
                  onChange={(e) => setEditingSettings({
                    ...editingSettings!,
                    backgroundImage: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter image URL or path"
                />
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={resetToDefaults}
                    className="px-3 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                {portalSettings.backgroundImage}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-1">URL or path to the background image.</p>
          </div>
        </div>

        {editing && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-yellow-400">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Changes will take effect immediately after saving.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      {previewMode && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2 text-blue-600" />
            Portal Preview
          </h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="max-w-md mx-auto text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {editing ? editingSettings?.title : portalSettings.title}
              </h1>
              <p className="text-lg text-gray-700 mb-6">
                {editing ? editingSettings?.welcomeMessage : portalSettings.welcomeMessage}
              </p>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-gray-600 mb-2">Available Rates:</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">₱1</span>
                      <span className="text-sm text-gray-600">= 30 minutes</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">₱5</span>
                      <span className="text-sm text-gray-600">= 4 hours</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">₱10</span>
                      <span className="text-sm text-gray-600">= 10 hours</span>
                    </div>
                  </div>
                </div>
                <button className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Connect to WiFi
                </button>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4 text-center">
            This is a preview of how your portal will look to users.
          </p>
        </div>
      )}

      {/* Theme Options */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Palette className="h-5 w-5 mr-2 text-blue-600" />
          Quick Themes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'Default Blue',
              title: 'Welcome to PisoWiFi',
              welcomeMessage: 'Insert coin to start browsing',
              bgColor: 'bg-blue-100'
            },
            {
              name: 'Green Nature',
              title: '🌿 PisoWiFi',
              welcomeMessage: 'Connect with nature, connect with WiFi',
              bgColor: 'bg-green-100'
            },
            {
              name: 'Purple Tech',
              title: '⚡ Tech WiFi',
              welcomeMessage: 'High-speed internet for tech enthusiasts',
              bgColor: 'bg-purple-100'
            }
          ].map((theme, index) => (
            <button
              key={index}
              onClick={() => {
                if (editing && editingSettings) {
                  setEditingSettings({
                    ...editingSettings,
                    title: theme.title,
                    welcomeMessage: theme.welcomeMessage
                  });
                }
              }}
              disabled={!editing}
              className={`p-4 rounded-lg border-2 transition-all ${
                editing 
                  ? 'hover:border-blue-500 cursor-pointer' 
                  : 'cursor-not-allowed opacity-50'
              } ${theme.bgColor}`}
            >
              <div className="text-center">
                <h4 className="font-medium text-gray-900 mb-2">{theme.name}</h4>
                <p className="text-sm text-gray-600 mb-1">{theme.title}</p>
                <p className="text-xs text-gray-500">{theme.welcomeMessage}</p>
              </div>
            </button>
          ))}
        </div>
        {editing && (
          <p className="text-sm text-gray-500 mt-4">
            Click on a theme to apply it to your portal.
          </p>
        )}
      </div>
    </div>
  );
};

export default PortalTab;