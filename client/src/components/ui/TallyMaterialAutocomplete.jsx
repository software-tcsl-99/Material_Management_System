import { useEffect, useRef, useState } from 'react';
import api from '../../lib/axios';

const TallyMaterialAutocomplete = ({ value, onChange, placeholder, className, disabled, label, required }) => {
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load all materials from Tally Prime on component mount
  useEffect(() => {
    const loadAllMaterials = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const response = await api.get('/tally/inventory');
        if (response.data.success) {
          const list = response.data.materials || [];
          setMaterials(list);
          setFilteredMaterials(list);
        } else {
          setErrorMsg(response.data.message || 'Failed to fetch inventory.');
        }
      } catch (err) {
        console.error('Tally inventory fetch error:', err);
        setErrorMsg('Tally server unreachable.');
      } finally {
        setLoading(false);
      }
    };
    loadAllMaterials();
  }, []);

  // Filter materials local search inside dropdown
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMaterials(materials);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredMaterials(
        materials.filter((m) => m.name.toLowerCase().includes(q))
      );
    }
  }, [searchQuery, materials]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus the search input inside dropdown when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelect = (name, unit) => {
    onChange(name, unit);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wider block mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Dropdown Toggle Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center text-xs text-left bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900 dark:text-white dark:border-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
      >
        <span className={value ? 'text-slate-900 dark:text-white' : 'text-slate-450 dark:text-slate-500'}>
          {value || placeholder || 'Select Tally Material...'}
        </span>
        <span className="text-slate-400 shrink-0 ml-2">▼</span>
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-64 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Search box inside dropdown */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials..."
              className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg px-2.5 py-2 font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* List of items */}
          <div className="overflow-y-auto flex-1 max-h-48 py-1">
            {loading && (
              <div className="p-3 text-xs text-slate-400 font-bold text-center flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent"></span>
                Loading Tally inventory...
              </div>
            )}

            {!loading && filteredMaterials.length > 0 && (
              filteredMaterials.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(item.name, item.unit)}
                  className={`w-full flex justify-between items-center text-left px-3.5 py-2.5 text-xs font-bold transition hover:bg-blue-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 ${
                    value === item.name ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="truncate mr-2">{item.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap ${
                    item.stock > 0
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                  }`}>
                    {item.stock} {item.unit}
                  </span>
                </button>
              ))
            )}

            {/* Custom option when search does not match any Tally item */}
            {!loading && searchQuery.trim() && !materials.some(m => m.name.toLowerCase() === searchQuery.toLowerCase()) && (
              <button
                type="button"
                onClick={() => handleSelect(searchQuery.trim(), 'Nos')}
                className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800 block"
              >
                Use custom name: <span className="underline font-mono">"{searchQuery.trim()}"</span>
              </button>
            )}

            {!loading && filteredMaterials.length === 0 && !searchQuery.trim() && (
              <div className="p-3.5 text-xs text-slate-400 font-bold text-center">
                {errorMsg || 'No items available in Tally'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TallyMaterialAutocomplete;
