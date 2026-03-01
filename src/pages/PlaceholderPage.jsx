import React from 'react'

function PlaceholderPage({ appName }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, color: '#7a8099', gap: '1rem'
    }}>
      <div style={{ fontSize: '48px' }}>🚧</div>
      <h2 style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.5rem',
        fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px',
        color: '#e8eaf0', margin: 0
      }}>
        {appName}
      </h2>
      <p style={{ fontSize: '0.9rem' }}>Coming soon</p>
    </div>
  )
}

export default PlaceholderPage