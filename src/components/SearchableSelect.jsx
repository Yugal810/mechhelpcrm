import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export const SearchableSelect = ({ value, onChange, options, placeholder, grouped, disabled, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const wrapperRef = useRef(null);

  // Sync external value to internal search
  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        if (onChange && search !== value) {
          onChange(search);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [search, value, onChange]);

  const handleSelect = (val) => {
    setSearch(val);
    if (onChange) onChange(val);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setSearch(e.target.value);
    if (onChange) onChange(e.target.value);
    setIsOpen(true);
  };

  const renderOptions = () => {
    if (grouped) {
      let hasResults = false;
      const content = options.map(group => {
        const filtered = group.items.filter(item => item.toLowerCase().includes(search.toLowerCase()));
        if (filtered.length === 0) return null;
        hasResults = true;
        return (
          <div key={group.label}>
            <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: '#6b7280', backgroundColor: '#f9fafb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {group.label}
            </div>
            {filtered.map(item => (
              <div 
                key={item} 
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                className="searchable-option"
              >
                {item}
              </div>
            ))}
          </div>
        );
      });
      return hasResults ? content : <div style={{ padding: '8px 12px', color: '#6b7280' }}>No options found</div>;
    } else {
      const filtered = options.filter(item => item.toLowerCase().includes(search.toLowerCase()));
      if (filtered.length === 0) {
        return <div style={{ padding: '8px 12px', color: '#6b7280' }}>No options found</div>;
      }
      return filtered.map(item => (
        <div 
          key={item} 
          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
          onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
          className="searchable-option"
        >
          {item}
        </div>
      ));
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 50 : 1 }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className={className || "form-input"}
          style={{ width: '100%', paddingRight: '30px' }}
          placeholder={placeholder}
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
        />
        <ChevronDown size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
      </div>
      
      {isOpen && !disabled && (
        <div style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, 
          maxHeight: '220px', overflowY: 'auto', 
          backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', 
          borderRadius: '6px', zIndex: 1000, marginTop: '4px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
        }}>
          {renderOptions()}
        </div>
      )}
    </div>
  );
};
