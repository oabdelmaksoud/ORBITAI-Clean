import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { authApi } from '@src/services/api';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processOAuth = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      
      // Determine provider from a state param or local storage if needed. 
      // For simplicity, we can pass `provider` in the state parameter during the redirect
      // Example: state=github or state=discord
      const state = searchParams.get('state');

      if (errorParam) {
        setError(`OAuth Error: ${errorParam}`);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code || !state) {
        setError('Missing OAuth authentication code or provider state.');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // We need an endpoint in api.ts to handle this, or we can just fetch directly
        const API_URL = ((import.meta as any)?.env?.VITE_API_URL) || 'http://localhost:3002';
        
        const response = await fetch(`${API_URL}/api/auth/oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: state,
            credential: code
          })
        });

        const data = await response.json();

        if (data.success && data.data?.token) {
          // Success! Save token and redirect
          localStorage.setItem('token', data.data.token);
          
          // Let the app know login succeeded by dispatching an event
          window.dispatchEvent(new CustomEvent('orbitai:login_success', { 
            detail: { ...data.data.user, token: data.data.token } 
          }));
          
          navigate('/dashboard'); // Or wherever appropriate
        } else {
          throw new Error(data.message || 'Failed to authenticate with provider');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred during authentication.');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    processOAuth();
  }, [searchParams, navigate]);

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center">
        {error ? (
          <>
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Authentication Failed</h2>
            <p className="text-slate-400">{error}</p>
            <p className="text-sm text-slate-500 mt-4">Redirecting back...</p>
          </>
        ) : (
          <>
            <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Authenticating...</h2>
            <p className="text-slate-400">Please wait while we log you in securely.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
