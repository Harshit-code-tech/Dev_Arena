import React, { useState, useEffect } from 'react';

// A predefined palette of distinct colors
const MASTER_COLOR_PALETTE = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#ec4899'  // Pink
];

// Utility to shuffle an array (Fisher-Yates)
const shuffleArray = (array: string[]) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const Color2FADemo: React.FC = () => {
  const [mode, setMode] = useState<'setup' | 'verify'>('setup');
  
  // Setup State
  const [setupSequence, setSetupSequence] = useState<string[]>([]);
  const requiredLength = 3;

  // Verify State
  const [verifyGridColors, setVerifyGridColors] = useState<string[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<string[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Select your 3 colors in order.');

  // Initialize the verification grid
  const initializeVerifyGrid = (savedSequence: string[]) => {
    // Start with the user's saved colors
    const pool = [...savedSequence];
    
    // Fill the rest of the 9-grid with random colors from the master palette
    // ensuring no duplicates if possible
    const remainingColors = MASTER_COLOR_PALETTE.filter(c => !savedSequence.includes(c));
    const randomFillers = shuffleArray(remainingColors).slice(0, 9 - savedSequence.length);
    
    const finalGrid = shuffleArray([...pool, ...randomFillers]);
    setVerifyGridColors(finalGrid);
    setCurrentAttempt([]);
  };

  const handleSetupClick = (color: string) => {
    if (setupSequence.length < requiredLength) {
      const newSequence = [...setupSequence, color];
      setSetupSequence(newSequence);
      
      if (newSequence.length === requiredLength) {
        setStatusMessage('Setup Complete! Now, test your login.');
        setTimeout(() => {
          setMode('verify');
          initializeVerifyGrid(newSequence);
          setStatusMessage('Click your 3 colors in the exact order.');
        }, 1500);
      }
    }
  };

  const handleVerifyClick = (color: string) => {
    const newAttempt = [...currentAttempt, color];
    setCurrentAttempt(newAttempt);

    // Check if the current click is correct so far
    const currentIndex = newAttempt.length - 1;
    if (setupSequence[currentIndex] !== color) {
      // Failed attempt
      const newFails = failedAttempts + 1;
      setFailedAttempts(newFails);
      
      if (newFails >= 3) {
        setStatusMessage('Max attempts reached. Falling back to Email OTP...');
        // Here you would trigger the backend to send an OTP
        return;
      }

      setStatusMessage(`Incorrect sequence! Try again. (${newFails}/3 failed attempts)`);
      setTimeout(() => {
        setStatusMessage('Click your 3 colors in the exact order.');
        initializeVerifyGrid(setupSequence); // Reshuffle grid on failure
      }, 1000);
      return;
    }

    // If they reached the end successfully
    if (newAttempt.length === requiredLength) {
      setStatusMessage('SUCCESS! 2FA Passed. Logging in...');
      // Here you would normally set the device cookie and redirect
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', backgroundColor: '#1e1e2f', color: '#fff', borderRadius: '12px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>
        {mode === 'setup' ? 'Setup 2FA (Setup Mode)' : '2FA Challenge (Login Mode)'}
      </h2>
      
      <p style={{ textAlign: 'center', minHeight: '24px', color: '#a5b4fc', marginBottom: '20px' }}>
        {statusMessage}
      </p>

      {/* SETUP UI */}
      {mode === 'setup' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {MASTER_COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => handleSetupClick(color)}
                disabled={setupSequence.length >= requiredLength || setupSequence.includes(color)}
                style={{
                  backgroundColor: color,
                  height: '60px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: setupSequence.includes(color) ? 'not-allowed' : 'pointer',
                  opacity: setupSequence.includes(color) ? 0.3 : 1,
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              />
            ))}
          </div>
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p>Your Sequence: {setupSequence.length} / {requiredLength}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
              {setupSequence.map((c, i) => (
                <div key={i} style={{ width: '30px', height: '30px', backgroundColor: c, borderRadius: '50%' }} />
              ))}
            </div>
            <button 
                onClick={() => setSetupSequence([])} 
                style={{ marginTop: '15px', padding: '8px 16px', background: '#3f3f46', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
                Reset Selection
            </button>
          </div>
        </>
      )}

      {/* VERIFY UI */}
      {mode === 'verify' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', margin: '0 auto', maxWidth: '300px' }}>
            {verifyGridColors.map((color, index) => (
              <button
                key={`${color}-${index}`}
                onClick={() => handleVerifyClick(color)}
                style={{
                  backgroundColor: color,
                  height: '80px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              />
            ))}
          </div>
          
          <div style={{ marginTop: '30px', textAlign: 'center' }}>
             <p>Progress: {currentAttempt.length} / {requiredLength}</p>
             <p style={{ color: '#ef4444', fontSize: '0.9em', marginTop: '5px' }}>Failed Attempts: {failedAttempts} / 3</p>
             <button 
                onClick={() => {
                  setMode('setup');
                  setSetupSequence([]);
                  setCurrentAttempt([]);
                  setFailedAttempts(0);
                  setStatusMessage('Select your 3 colors in order.');
                }}
                style={{ marginTop: '15px', padding: '8px 16px', background: '#3f3f46', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Restart Demo
             </button>
          </div>
        </>
      )}
    </div>
  );
};
