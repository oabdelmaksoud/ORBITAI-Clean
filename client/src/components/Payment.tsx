import React, { useState } from 'react';
import { PublicPackage } from '../services/publicPackagesApi';
import { CreditCard, Lock, CheckCircle2, Loader2, X, AlertCircle, ArrowLeft } from 'lucide-react';

interface PaymentProps {
  selectedPackage: PublicPackage;
  userEmail: string;
  userName: string;
  onPaymentSuccess: (paymentData: any) => void;
  onBack: () => void;
  onClose?: () => void;
}

const Payment: React.FC<PaymentProps> = ({ 
  selectedPackage, 
  userEmail, 
  userName,
  onPaymentSuccess, 
  onBack,
  onClose 
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState(userName);
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('US');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    setExpiryDate(formatted);
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length <= 4) {
      setCvv(v);
    }
  };

  const validateForm = () => {
    if (cardNumber.replace(/\s/g, '').length < 13) {
      setError('Please enter a valid card number');
      return false;
    }
    if (!expiryDate.match(/^\d{2}\/\d{2}$/)) {
      setError('Please enter a valid expiry date (MM/YY)');
      return false;
    }
    if (cvv.length < 3) {
      setError('Please enter a valid CVV');
      return false;
    }
    if (!cardholderName.trim()) {
      setError('Please enter cardholder name');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Simulate payment processing
      // In production, this would call your payment API (Stripe, PayPal, etc.)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock payment success
      const paymentData = {
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        amount: selectedPackage.price,
        billingCycle: selectedPackage.billingCycle,
        transactionId: 'txn_' + Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        cardLast4: cardNumber.slice(-4),
      };

      setPaymentSuccess(true);
      
      // Call success handler after showing success message
      setTimeout(() => {
        onPaymentSuccess(paymentData);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Payment processing failed. Please try again.');
      setLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 max-w-md w-full text-center animate-in zoom-in-95 duration-500">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
          <p className="text-slate-600 mb-6">Your {selectedPackage.displayName || selectedPackage.name} plan is now active.</p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="text-sm text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Plan:</span>
                <span className="font-semibold">{selectedPackage.displayName || selectedPackage.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-semibold">${selectedPackage.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Billing:</span>
                <span className="font-semibold capitalize">{selectedPackage.billingCycle}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            <span>Setting up your account...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
      <div className="w-full max-w-2xl relative my-8" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors z-10 p-2 hover:bg-white/10 rounded-lg backdrop-blur-sm"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        {/* Payment Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors group"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium">Back to packages</span>
              </button>
              <div className="flex items-center gap-2 text-slate-400">
                <Lock size={18} />
                <span className="text-sm">Secure</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Complete Payment</h1>
              <p className="text-slate-600">Secure payment powered by Stripe</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 p-8">
            {/* Payment Form */}
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Payment Details</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50/80 border border-red-200/50 rounded-xl p-3 flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                {/* Card Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Card Number
                  </label>
                  <div className="relative">
                    <CreditCard size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Expiry and CVV */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={expiryDate}
                      onChange={handleExpiryChange}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      CVV
                    </label>
                    <input
                      type="text"
                      value={cvv}
                      onChange={handleCvvChange}
                      placeholder="123"
                      maxLength={4}
                      className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Cardholder Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                    required
                  />
                </div>

                {/* Billing Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="123 Main St"
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                    required
                  />
                </div>

                {/* City, Zip, Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="New York"
                      className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="10001"
                      className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                    required
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      <span>Pay ${selectedPackage.price.toFixed(2)}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Order Summary */}
            <div className="bg-slate-50/80 rounded-xl p-6 h-fit">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-slate-700 font-medium">Plan</span>
                    <span className="text-slate-900 font-semibold">{selectedPackage.displayName || selectedPackage.name}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-slate-700 font-medium">Billing Cycle</span>
                    <span className="text-slate-900 font-semibold capitalize">{selectedPackage.billingCycle}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold text-slate-900">Total</span>
                    <span className="text-2xl font-bold text-slate-900">${selectedPackage.price.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">What's included:</h3>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• {selectedPackage.limits.maxProjects === -1 ? 'Unlimited' : selectedPackage.limits.maxProjects} Projects</li>
                    <li>• {selectedPackage.limits.maxAgents === -1 ? 'Unlimited' : selectedPackage.limits.maxAgents} Agents</li>
                    <li>• {selectedPackage.limits.maxStorageGB === -1 ? 'Unlimited' : `${selectedPackage.limits.maxStorageGB}GB`} Storage</li>
                    <li>• {selectedPackage.limits.maxAPICalls === -1 ? 'Unlimited' : selectedPackage.limits.maxAPICalls} API Calls</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;

