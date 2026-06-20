import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import api from '../api/axios';
import ProductCard from '../components/ProductCard';

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest First' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating',     label: 'Top Rated' },
  { value: 'popularity', label: 'Most Popular' },
];

const GENDER_OPTIONS = ['men', 'women', 'unisex'];

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts]       = useState([]);
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // URL-synced params
  const categoryParam = searchParams.get('category') || '';
  const searchParam   = searchParams.get('search')   || '';
  const sortParam     = searchParams.get('sort')     || 'newest';
  const genderParam   = searchParams.get('gender')   || '';
  const minParam      = searchParams.get('min_price') || '';
  const maxParam      = searchParams.get('max_price') || '';
  const colorParam    = searchParams.get('color')    || '';

  // Local input states (not reflected in URL until submitted)
  const [searchTerm, setSearchTerm] = useState(searchParam);
  const [minPrice, setMinPrice]     = useState(minParam);
  const [maxPrice, setMaxPrice]     = useState(maxParam);
  const [colorInput, setColorInput] = useState(colorParam);

  // Sync inputs when URL changes (browser back/forward)
  useEffect(() => { setSearchTerm(searchParam); }, [searchParam]);
  useEffect(() => { setMinPrice(minParam); },     [minParam]);
  useEffect(() => { setMaxPrice(maxParam); },     [maxParam]);
  useEffect(() => { setColorInput(colorParam); }, [colorParam]);

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (categories.length === 0 && categoryParam) return;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: 50, sort: sortParam });

        if (categoryParam) {
          const cat = categories.find(c => c.name === categoryParam);
          if (cat) params.set('category', cat.id);
        }
        if (searchParam)   params.set('search',    searchParam);
        if (genderParam)   params.set('gender',    genderParam);
        if (minParam)      params.set('min_price', minParam);
        if (maxParam)      params.set('max_price', maxParam);
        if (colorParam)    params.set('color',     colorParam);

        const res = await api.get(`/products?${params.toString()}`);
        setProducts(res.data.products || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        console.error('Error fetching products', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [categoryParam, searchParam, sortParam, genderParam, minParam, maxParam, colorParam, categories]);

  const updateParam = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) { next.set(key, value); } else { next.delete(key); }
      return next;
    });
  }, [setSearchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    updateParam('search', searchTerm);
  };

  const handlePriceFilter = (e) => {
    e.preventDefault();
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (minPrice) { next.set('min_price', minPrice); } else { next.delete('min_price'); }
      if (maxPrice) { next.set('max_price', maxPrice); } else { next.delete('max_price'); }
      if (colorInput) { next.set('color', colorInput); } else { next.delete('color'); }
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchParams({});
    setSearchTerm('');
    setMinPrice('');
    setMaxPrice('');
    setColorInput('');
  };

  const hasActiveFilters = categoryParam || searchParam || genderParam || minParam || maxParam || colorParam;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Header row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gray-900">
            {categoryParam || 'All Products'}
          </h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-1">
              {total} product{total !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <form onSubmit={handleSearch} className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by name, material, style…"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </form>

          {/* Sort */}
          <select
            value={sortParam}
            onChange={e => updateParam('sort', e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Toggle filters panel (mobile) */}
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 text-sm hover:bg-gray-50 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 bg-brand-accent text-brand-dark text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">!</span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ─── Sidebar Filters ─── */}
        <aside className={`w-full lg:w-64 flex-shrink-0 ${filtersOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-6">

            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
              >
                <X className="h-3 w-3" /> Clear all filters
              </button>
            )}

            {/* Categories */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Category</h3>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => updateParam('category', '')}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${!categoryParam ? 'bg-brand-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    All Categories
                  </button>
                </li>
                {categories.map(cat => (
                  <li key={cat.id}>
                    <button
                      onClick={() => updateParam('category', cat.name)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${categoryParam === cat.name ? 'bg-brand-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Gender */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Gender</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateParam('gender', '')}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${!genderParam ? 'bg-brand-dark text-white border-brand-dark' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
                >
                  All
                </button>
                {GENDER_OPTIONS.map(g => (
                  <button
                    key={g}
                    onClick={() => updateParam('gender', genderParam === g ? '' : g)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${genderParam === g ? 'bg-brand-dark text-white border-brand-dark' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range + Color */}
            <form onSubmit={handlePriceFilter}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Price (₹)</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      min="0"
                      value={minPrice}
                      onChange={e => setMinPrice(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    />
                    <span className="text-gray-400 text-sm">–</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min="0"
                      value={maxPrice}
                      onChange={e => setMaxPrice(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Color</h3>
                  <input
                    type="text"
                    placeholder="e.g. Black, Blue…"
                    value={colorInput}
                    onChange={e => setColorInput(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-accent hover:bg-yellow-500 text-brand-dark font-medium py-2 rounded text-sm transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </form>

            {/* Quick price filters */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Quick Price</h3>
              <div className="space-y-1">
                {[
                  { label: 'Under ₹1,000',       min: '',     max: '1000' },
                  { label: '₹1,000 – ₹2,000',    min: '1000', max: '2000' },
                  { label: '₹2,000 – ₹5,000',    min: '2000', max: '5000' },
                  { label: 'Above ₹5,000',        min: '5000', max: ''     },
                ].map(range => {
                  const active = minParam === range.min && maxParam === range.max;
                  return (
                    <button
                      key={range.label}
                      onClick={() => {
                        setMinPrice(range.min);
                        setMaxPrice(range.max);
                        setSearchParams(prev => {
                          const next = new URLSearchParams(prev);
                          if (range.min) { next.set('min_price', range.min); } else { next.delete('min_price'); }
                          if (range.max) { next.set('max_price', range.max); } else { next.delete('max_price'); }
                          return next;
                        });
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${active ? 'bg-brand-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {range.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* ─── Product Grid ─── */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-lg overflow-hidden animate-pulse">
                  <div className="aspect-[4/5] bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-5 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <p className="text-gray-500 text-lg mb-2">No products found matching your criteria.</p>
              <p className="text-gray-400 text-sm mb-6">Try adjusting your filters or search terms.</p>
              <button
                onClick={clearAllFilters}
                className="text-brand-accent hover:underline text-sm font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;
