'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Copy, ExternalLink, Filter, Calendar, TrendingUp, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

// Types
interface PromoData {
  videoId: string;
  videoTitle: string;
  timestamp: string;
  links: string;
  codes: string;
  percent_off: string;
  flat_discount: string;
  confidence: string;
}

interface FilterOptions {
  highConfidence: boolean;
  hasCodes: boolean;
  recent: boolean;
  search: string;
}

// Helper functions
const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.7) return 'text-green-600 bg-green-100';
  if (confidence >= 0.3) return 'text-yellow-600 bg-yellow-100';
  return 'text-gray-500 bg-gray-100';
};

const getConfidenceIcon = (confidence: number) => {
  if (confidence >= 0.7) return CheckCircle;
  if (confidence >= 0.3) return AlertCircle;
  return XCircle;
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const extractDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
};

// Filter Chip Component
const FilterChip = ({ active, onClick, children, count }: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  count?: number;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg transform scale-105' 
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    {children}
    {count !== undefined && (
      <span className={`text-xs px-2 py-1 rounded-full ${
        active ? 'bg-blue-500' : 'bg-gray-300'
      }`}>
        {count}
      </span>
    )}
  </button>
);

// Promo Card Component
const PromoCard = ({ data }: { data: PromoData }) => {
  const confidence = parseFloat(data.confidence || '0');
  const isLowConfidence = confidence < 0.2;
  const hasCode = data.codes && data.codes.trim() !== '';
  const links = data.links ? data.links.split('|').map(link => link.trim()).filter(Boolean) : [];
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const ConfidenceIcon = getConfidenceIcon(confidence);

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 p-6 transition-all duration-300 hover:shadow-xl hover:border-blue-200 ${
      isLowConfidence ? 'opacity-50 hover:opacity-75' : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate mb-2">
            {data.videoTitle}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            {formatTimestamp(data.timestamp)}
          </div>
        </div>
        
        {/* YouTube Thumbnail Placeholder */}
        <div className="w-16 h-12 bg-gray-200 rounded-lg flex items-center justify-center ml-4 flex-shrink-0">
          <div className="w-6 h-6 bg-red-500 rounded-sm flex items-center justify-center">
            <div className="w-0 h-0 border-l-[6px] border-l-white border-y-[3px] border-y-transparent ml-0.5"></div>
          </div>
        </div>
      </div>

      {/* Confidence Score */}
      <div className="flex items-center gap-2 mb-4">
        <ConfidenceIcon className="w-5 h-5" />
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(confidence)}`}>
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>

      {/* Promo Code Section */}
      {hasCode ? (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Promo Code</p>
              <p className="text-xl font-bold text-blue-600">{data.codes}</p>
            </div>
            <button
              onClick={() => copyToClipboard(data.codes)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>
          
          {/* Discount Info */}
          {(data.percent_off || data.flat_discount) && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              {data.percent_off && (
                <span className="text-green-600 font-medium">
                  {data.percent_off}% off
                </span>
              )}
              {data.flat_discount && (
                <span className="text-green-600 font-medium">
                  ${data.flat_discount} off
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-gray-500 text-center">No promo code found</p>
        </div>
      )}

      {/* Links Section */}
      {links.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Related Links</p>
          <div className="flex flex-wrap gap-2">
            {links.slice(0, 3).map((link, index) => (
              <a
                key={index}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {extractDomain(link)}
              </a>
            ))}
            {links.length > 3 && (
              <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm">
                +{links.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Main Dashboard Component
const SmartFetchDashboard = () => {
  const [data, setData] = useState<PromoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    highConfidence: false,
    hasCodes: false,
    recent: false,
    search: ''
  });
  const [sortBy, setSortBy] = useState<'confidence' | 'timestamp'>('confidence');

  // Fetch data
  useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sheet');
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();

      console.log("✅ Loaded data:", result.data); // Sanity check
      setData(result.data); // 👈 FIXED here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);


 const filteredData = useMemo(() => {
  // Ensure data is an array before spreading
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  let filtered = [...data];
  
  // Apply filters
  if (filters.highConfidence) {
    filtered = filtered.filter(item => parseFloat(item.confidence || '0') >= 0.7);
  }
  
  if (filters.hasCodes) {
    filtered = filtered.filter(item => item.codes && item.codes.trim() !== '');
  }
  
  if (filters.recent) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    filtered = filtered.filter(item => new Date(item.timestamp) > oneDayAgo);
  }
  
  if (filters.search) {
    filtered = filtered.filter(item => 
      item.videoTitle.toLowerCase().includes(filters.search.toLowerCase()) ||
      item.codes.toLowerCase().includes(filters.search.toLowerCase())
    );
  }

  // Sort data
  filtered.sort((a, b) => {
    if (sortBy === 'confidence') {
      return parseFloat(b.confidence || '0') - parseFloat(a.confidence || '0');
    } else {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
  });

  return filtered;
}, [data, filters, sortBy]);

  // Filter counts
  const filterCounts = useMemo(() => {
  // Ensure data is an array before filtering
  if (!data || !Array.isArray(data)) {
    return {
      highConfidence: 0,
      hasCodes: 0,
      recent: 0
    };
  }
  
  return {
    highConfidence: data.filter(item => parseFloat(item.confidence || '0') >= 0.7).length,
    hasCodes: data.filter(item => item.codes && item.codes.trim() !== '').length,
    recent: data.filter(item => new Date(item.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length
  };
}, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading promo codes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">SmartFetch Dashboard</h1>
              <p className="text-gray-600 mt-1">
                {data.length} videos analyzed • {filteredData.length} results shown
              </p>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search videos or codes..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-80"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Filter Chips */}
          <div className="flex flex-wrap gap-3">
            <FilterChip
              active={filters.highConfidence}
              onClick={() => setFilters(prev => ({ ...prev, highConfidence: !prev.highConfidence }))}
              count={filterCounts.highConfidence}
            >
              <TrendingUp className="w-4 h-4" />
              High Confidence
            </FilterChip>
            
            <FilterChip
              active={filters.hasCodes}
              onClick={() => setFilters(prev => ({ ...prev, hasCodes: !prev.hasCodes }))}
              count={filterCounts.hasCodes}
            >
              <CheckCircle className="w-4 h-4" />
              Has Codes
            </FilterChip>
            
            <FilterChip
              active={filters.recent}
              onClick={() => setFilters(prev => ({ ...prev, recent: !prev.recent }))}
              count={filterCounts.recent}
            >
              <Calendar className="w-4 h-4" />
              Recent
            </FilterChip>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'confidence' | 'timestamp')}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="confidence">Sort by Confidence</option>
              <option value="timestamp">Sort by Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredData.map((item) => (
              <PromoCard key={`${item.videoId}-${item.timestamp}`} data={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartFetchDashboard;