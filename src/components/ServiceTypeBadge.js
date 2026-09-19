import React from 'react';



export const ServiceTypeBadge = ({ serviceType, compact = false }) => {
  if (!serviceType || serviceType.length === 0) return null;

  const hasService = serviceType.includes('Service');
  const hasPainting = serviceType.includes('Painting/Denting');

  if (hasService && hasPainting) {
    return (
      <span
        className="badge badge-purple"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: compact ? '0.7rem' : '0.75rem',
          padding: compact ? '0.15rem 0.45rem' : '0.2rem 0.6rem',
          fontWeight: 600
        }}
        title="Service + Painting/Denting"
      >
        <span>🛠️ Service + 🎨 Painting/Denting</span>
      </span>
    );
  }

  if (hasService) {
    return (
      <span
        className="badge badge-teal"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: compact ? '0.7rem' : '0.75rem',
          padding: compact ? '0.15rem 0.45rem' : '0.2rem 0.6rem',
          fontWeight: 600
        }}
        title="Service"
      >
        <span>🛠️ Service</span>
      </span>
    );
  }

  if (hasPainting) {
    return (
      <span
        className="badge badge-purple"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: compact ? '0.7rem' : '0.75rem',
          padding: compact ? '0.15rem 0.45rem' : '0.2rem 0.6rem',
          fontWeight: 600
        }}
        title="Painting/Denting"
      >
        <span>🎨 Painting/Denting</span>
      </span>
    );
  }

  return null;
};
