import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  sendTwoFactorOtp,
  setupColor2FA,
  verifyColor2FA,
  verifyTwoFactorOtp,
} from '../api/TwoFactorAuthService';
import {
  COLOR_2FA_MAX_FAILED_ATTEMPTS,
  COLOR_2FA_REQUIRED_SEQUENCE_LENGTH,
  COLOR_2FA_SETUP_PALETTE,
} from '../api/AuthConstants';
import type { Color2FAProps, Color2FAViewMode } from '../api/AuthTypes';

export const Color2FA: React.FC<Color2FAProps> = ({ 
  isSetup = false, 
  onSetupComplete,
  tempToken, 
  verifyGrid = [], 
  onVerifySuccess 
}) => {
  
  // State for Color Grid
  const [sequence, setSequence] = useState<string[]>([]);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    isSetup ? 'Select your 3 colors in order.' : 'Click your 3 colors in the exact order.'
  );

  // State for OTP Fallback
  const [viewMode, setViewMode] = useState<Color2FAViewMode>('grid');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handleColorClick = async (color: string) => {
    if (loading) return;

    const newSequence = [...sequence, color];
    setSequence(newSequence);

    // If still selecting...
    if (newSequence.length < COLOR_2FA_REQUIRED_SEQUENCE_LENGTH) {
      return;
    }

    // Sequence complete, process it
    setLoading(true);

    if (isSetup) {
      try {
        await setupColor2FA(newSequence);
        toast.success("2FA Setup Complete!");
        if (onSetupComplete) onSetupComplete();
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to setup 2FA"));
        setSequence([]);
      } finally {
        setLoading(false);
      }
    } else {
      // VERIFY MODE
      try {
        const data = await verifyColor2FA(tempToken, newSequence);
        toast.success("2FA Passed!");
        if (onVerifySuccess) onVerifySuccess(data.token, data.deviceToken);
      } catch (error) {
        if (isNetworkError(error)) {
          toast.error("Network error");
          setSequence([]);
          return;
        }

        const newFails = failedAttempts + 1;
        setFailedAttempts(newFails);
        
        if (newFails >= COLOR_2FA_MAX_FAILED_ATTEMPTS) {
          toast.error("Max attempts reached. Switching to Email OTP.");
          setViewMode('otp_confirm');
        } else {
          toast.error(`Incorrect sequence. (${newFails}/${COLOR_2FA_MAX_FAILED_ATTEMPTS} fails)`);
          setStatusMessage(`Incorrect sequence! Try again. (${newFails}/${COLOR_2FA_MAX_FAILED_ATTEMPTS} fails)`);
          setSequence([]);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmEmail.trim()) {
        toast.error("Please enter your email");
        return;
    }

    setLoading(true);
    try {
      await sendTwoFactorOtp(tempToken, confirmEmail);
      toast.success("OTP sent to your email!");
      setViewMode('otp_verify');
    } catch (error) {
      toast.error(getErrorMessage(error, "Network error"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;

    setLoading(true);
    try {
      const data = await verifyTwoFactorOtp(tempToken, otpCode);
      toast.success("OTP Verified!");
      if (onVerifySuccess) onVerifySuccess(data.token, data.deviceToken);
    } catch (error) {
      toast.error(getErrorMessage(error, "Network error"));
    } finally {
      setLoading(false);
    }
  };

  // UI rendering based on mode
  if (viewMode === 'otp_confirm') {
    return (
      <div style={containerStyle}>
        <h2>Email Verification Fallback</h2>
        <p style={{color: '#a5b4fc', fontSize: '14px', marginBottom: '20px'}}>
          Please confirm your account email address. We will send a 6-digit OTP to verify your identity.
        </p>
        <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" 
            placeholder="Enter your email address" 
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
        <button onClick={() => setViewMode('grid')} style={linkBtnStyle}>Back to Color Grid</button>
      </div>
    );
  }

  if (viewMode === 'otp_verify') {
    return (
      <div style={containerStyle}>
        <h2>Enter OTP</h2>
        <p style={{color: '#a5b4fc', fontSize: '14px', marginBottom: '20px'}}>
          Enter the 6-digit code sent to your email.
        </p>
        <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="text" 
            placeholder="000000" 
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            style={{...inputStyle, textAlign: 'center', letterSpacing: '5px', fontSize: '24px'}}
          />
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Verifying...' : 'Verify & Login'}
          </button>
        </form>
      </div>
    );
  }

  // Default: Grid View
  const displayColors = isSetup ? COLOR_2FA_SETUP_PALETTE : verifyGrid;
  const columns = isSetup ? 4 : 3;

  return (
    <div style={containerStyle}>
      <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>
        {isSetup ? 'Setup Color 2FA' : '2FA Challenge'}
      </h2>
      
      <p style={{ textAlign: 'center', minHeight: '24px', color: '#a5b4fc', marginBottom: '20px', fontSize: '14px' }}>
        {statusMessage}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '10px' }}>
        {displayColors.map((color, idx) => {
          const isSelected = sequence.includes(color);
          return (
            <button
              key={`${color}-${idx}`}
              onClick={() => handleColorClick(color)}
              disabled={loading || (isSetup && isSelected)}
              style={{
                backgroundColor: color,
                height: isSetup ? '60px' : '80px',
                border: isSelected && !isSetup ? '3px solid white' : 'none',
                borderRadius: '8px',
                cursor: (isSetup && isSelected) ? 'not-allowed' : 'pointer',
                opacity: (isSetup && isSelected) || loading ? 0.4 : 1,
                transition: 'transform 0.1s, opacity 0.2s',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              }}
              onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(0.95)'; }}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            />
          );
        })}
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px' }}>Progress: {sequence.length} / {COLOR_2FA_REQUIRED_SEQUENCE_LENGTH}</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '10px 0' }}>
            {sequence.map((c, i) => (
            <div key={i} style={{ width: '20px', height: '20px', backgroundColor: isSetup ? c : 'white', borderRadius: '50%' }} />
            ))}
        </div>

        {!isSetup && (
          <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '10px' }}>
            Failed Attempts: {failedAttempts} / {COLOR_2FA_MAX_FAILED_ATTEMPTS}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
            <button 
                onClick={() => setSequence([])} 
                disabled={loading}
                style={{ padding: '8px 16px', background: '#3f3f46', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
            >
                Reset Selection
            </button>
            
            {!isSetup && (
                <button 
                    onClick={() => setViewMode('otp_confirm')} 
                    disabled={loading}
                    style={linkBtnStyle}
                >
                    Use Email OTP
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

// Common inline styles
const containerStyle: React.CSSProperties = {
  maxWidth: '400px', margin: '0 auto', padding: '20px', 
  backgroundColor: '#0f172a', color: '#f8fafc', 
  borderRadius: '12px', border: '1px solid #1e293b'
};
const inputStyle: React.CSSProperties = {
  padding: '12px', borderRadius: '6px', border: '1px solid #334155',
  background: '#1e293b', color: 'white', fontSize: '16px', outline: 'none'
};
const btnStyle: React.CSSProperties = {
  padding: '12px', borderRadius: '6px', border: 'none',
  background: '#38bdf8', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px'
};
const linkBtnStyle: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', color: '#38bdf8', 
  border: '1px solid #38bdf8', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError;
}
