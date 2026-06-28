import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

interface ForgotPasswordModalProps {
  onClose: () => void;
}

type Step = 'email' | 'otp_and_reset';

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'OTP sent to your email!');
        setTempToken(data.tempToken);
        setStep('otp_and_reset');
      } else {
        toast.error(data.message || 'Failed to send OTP.');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, otp, newPassword })
      });
      const data = await res.json();

      if (res.ok) {
        toast.success('Password reset successfully! You can now log in.');
        onClose(); // Close the modal
      } else {
        toast.error(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2>Reset Password</h2>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOTP} style={formStyle}>
            <p style={subTextStyle}>
              Enter the email address associated with your DevArena account.
            </p>
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              required
            />
            <button type="submit" disabled={loading} style={primaryBtnStyle}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={formStyle}>
            <p style={subTextStyle}>
              We sent a 6-digit OTP to your email. Enter it below along with your new password.
            </p>
            
            <input 
              type="text" 
              placeholder="6-Digit OTP" 
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{...inputStyle, letterSpacing: '3px', textAlign: 'center'}}
              required
            />
            
            <input 
              type="password" 
              placeholder="New Password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
              required
            />

            <input 
              type="password" 
              placeholder="Confirm New Password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              required
            />

            <button type="submit" disabled={loading} style={primaryBtnStyle}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// Inline Styles for the Modal
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '20px'
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#0f172a', color: '#f8fafc',
  borderRadius: '12px', padding: '30px', maxWidth: '400px', width: '100%',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', border: '1px solid #1e293b'
};

const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: '20px'
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#94a3b8',
  fontSize: '24px', cursor: 'pointer'
};

const formStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '15px'
};

const subTextStyle: React.CSSProperties = {
  color: '#94a3b8', fontSize: '14px', marginBottom: '5px'
};

const inputStyle: React.CSSProperties = {
  padding: '12px', borderRadius: '6px', border: '1px solid #334155',
  background: '#1e293b', color: 'white', fontSize: '16px', outline: 'none'
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '12px', borderRadius: '6px', border: 'none',
  background: '#38bdf8', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px',
  marginTop: '10px'
};
