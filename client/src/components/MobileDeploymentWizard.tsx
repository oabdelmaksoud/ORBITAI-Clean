/**
 * Mobile Deployment Wizard Component
 * UI for deploying apps to iOS App Store and Google Play Store
 */

import React, { useState, useEffect } from 'react';
import { 
  Smartphone, Apple, Play, Loader2, CheckCircle2, XCircle, 
  AlertTriangle, ChevronRight, ChevronLeft, Upload, Key, Settings,
  Package, Rocket, FileText, Shield, Eye, EyeOff, RefreshCw,
  ExternalLink, Copy, Check, Info, Lock, Bot
} from 'lucide-react';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface MobileDeploymentConfig {
  platform: 'ios' | 'android' | 'both';
  appType: 'react-native' | 'flutter' | 'native-ios' | 'native-android';
  appStoreConfig: {
    bundleId: string;
    appName: string;
    version: string;
    buildNumber: string;
  };
  environment: 'development' | 'staging' | 'production';
}

interface DeploymentStatus {
  ios?: {
    buildId?: string;
    testflightUrl?: string;
    appStoreUrl?: string;
    status: string;
  };
  android?: {
    buildId?: string;
    playConsoleUrl?: string;
    status: string;
  };
}

interface MobileDeploymentWizardProps {
  projectId: string;
  projectName?: string;
  token?: string;
  userRole?: string;
  onClose?: () => void;
  // Agent-recommended mobile app configuration (from architecture analysis)
  agentRecommendedFramework?: 'react-native' | 'flutter' | 'native-ios' | 'native-android';
  agentRecommendedPlatform?: 'ios' | 'android' | 'both';
  agentReasoning?: string; // Why agents chose this framework
}

const MobileDeploymentWizard: React.FC<MobileDeploymentWizardProps> = ({
  projectId,
  projectName = 'My App',
  token,
  userRole = 'user',
  onClose,
  agentRecommendedFramework,
  agentRecommendedPlatform,
  agentReasoning
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [validationResult, setValidationResult] = useState<any>(null);

  // Use agent recommendations if provided, otherwise use defaults
  const isAgentRecommended = !!agentRecommendedFramework;
  const [config, setConfig] = useState<MobileDeploymentConfig>({
    platform: agentRecommendedPlatform || 'both',
    appType: agentRecommendedFramework || 'react-native',
    appStoreConfig: {
      bundleId: `com.company.${projectName.toLowerCase().replace(/\s+/g, '')}`,
      appName: projectName,
      version: '1.0.0',
      buildNumber: '1'
    },
    environment: 'production'
  });

  const [credentials, setCredentials] = useState({
    ios: {
      appleId: '',
      teamId: '',
      expoToken: ''
    },
    android: {
      packageName: '',
      keystorePassword: '',
      serviceAccountJson: ''
    }
  });

  const canDeploy = useFeatureAccess('deployment', userRole);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  const authToken = token || localStorage.getItem('authToken');

  const platforms = [
    { id: 'ios', name: 'iOS Only', icon: Apple, color: 'text-gray-300' },
    { id: 'android', name: 'Android Only', icon: Play, color: 'text-green-500' },
    { id: 'both', name: 'iOS & Android', icon: Smartphone, color: 'text-purple-400' }
  ];

  const appTypes = [
    { id: 'react-native', name: 'React Native', description: 'Cross-platform with Expo or bare RN' },
    { id: 'flutter', name: 'Flutter', description: 'Cross-platform with Dart' },
    { id: 'native-ios', name: 'Native iOS', description: 'Swift or Objective-C' },
    { id: 'native-android', name: 'Native Android', description: 'Kotlin or Java' }
  ];

  const environments = [
    { id: 'development', name: 'Development', description: 'Internal testing' },
    { id: 'staging', name: 'Staging', description: 'Beta/TestFlight' },
    { id: 'production', name: 'Production', description: 'App Store/Play Store' }
  ];

  const steps = [
    { id: 1, title: 'Platform', icon: Smartphone },
    { id: 2, title: 'App Info', icon: Package },
    { id: 3, title: 'Credentials', icon: Key },
    { id: 4, title: 'Review', icon: Eye },
    { id: 5, title: 'Deploy', icon: Rocket }
  ];

  const validateConfig = async () => {
    setValidating(true);
    try {
      const response = await fetch(`${apiUrl}/api/mobile-deployment/validate-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: config.platform,
          appType: config.appType,
          appStoreConfig: config.appStoreConfig,
          credentials
        })
      });

      const data = await response.json();
      setValidationResult(data.data);
      return data.data?.valid;
    } catch (err) {
      console.error('Validation failed:', err);
      return false;
    } finally {
      setValidating(false);
    }
  };

  const startDeployment = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/mobile-deployment/deploy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          platform: config.platform,
          appType: config.appType,
          appStoreConfig: config.appStoreConfig,
          credentials,
          environment: config.environment
        })
      });

      const data = await response.json();

      if (data.success) {
        setDeploymentId(data.data.deploymentId);
        setDeploymentStatus({
          ios: data.data.ios,
          android: data.data.android
        });
        setStep(5);
      } else {
        setError(data.error || 'Deployment failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start deployment');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!deploymentId) return;

    try {
      const response = await fetch(`${apiUrl}/api/mobile-deployment/status/${deploymentId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await response.json();
      if (data.success) {
        setDeploymentStatus({
          ios: data.data.ios,
          android: data.data.android
        });
      }
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'ready':
      case 'completed':
        return 'text-green-500';
      case 'building':
      case 'pending':
      case 'processing':
        return 'text-yellow-500';
      case 'failed':
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  if (!canDeploy.enabled) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg text-center">
        <Lock className="w-12 h-12 mx-auto text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Mobile Deployment Locked</h3>
        <p className="text-gray-400">Upgrade your plan to access mobile deployment features.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Smartphone className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Mobile Deployment</h2>
              <p className="text-sm text-gray-400">Deploy to iOS App Store & Google Play</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mt-6">
          {steps.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    step >= s.id
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'border-gray-600 text-gray-500'
                  }`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <span className={`text-xs mt-1 ${step >= s.id ? 'text-purple-400' : 'text-gray-500'}`}>
                  {s.title}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > s.id ? 'bg-purple-600' : 'bg-gray-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6">
        {/* Step 1: Platform Selection */}
        {step === 1 && (
          <div className="space-y-6">
            {isAgentRecommended && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Bot className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-400 mb-1">Agent Recommendation</h4>
                    <p className="text-xs text-gray-300 mb-2">
                      Our AI agents analyzed your project and recommend <strong className="text-white">{appTypes.find(t => t.id === config.appType)?.name}</strong> for <strong className="text-white">{config.platform === 'both' ? 'iOS & Android' : config.platform.toUpperCase()}</strong>.
                    </p>
                    {agentReasoning && (
                      <p className="text-xs text-gray-400 italic">"{agentReasoning}"</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <h3 className="text-lg font-medium text-white">
              {isAgentRecommended ? 'Target Platform (Agent Recommended)' : 'Select Target Platform'}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {platforms.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => !isAgentRecommended ? setConfig(c => ({ ...c, platform: platform.id as any })) : undefined}
                  disabled={isAgentRecommended}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    config.platform === platform.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : isAgentRecommended
                      ? 'border-gray-700 opacity-50 cursor-not-allowed'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <platform.icon className={`w-8 h-8 mx-auto mb-2 ${platform.color}`} />
                  <div className="text-white font-medium">{platform.name}</div>
                  {isAgentRecommended && config.platform === platform.id && (
                    <div className="text-xs text-purple-400 mt-1">Agent Selected</div>
                  )}
                </button>
              ))}
            </div>

            <h3 className="text-lg font-medium text-white mt-8">
              {isAgentRecommended ? 'App Framework (Agent Recommended)' : 'App Framework'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {appTypes.filter(t => {
                if (config.platform === 'ios') return t.id !== 'native-android';
                if (config.platform === 'android') return t.id !== 'native-ios';
                return true;
              }).map(type => {
                const isSelected = config.appType === type.id;
                const isDisabled = isAgentRecommended && !isSelected;
                return (
                  <button
                    key={type.id}
                    onClick={() => !isAgentRecommended ? setConfig(c => ({ ...c, appType: type.id as any })) : undefined}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10'
                        : isDisabled
                        ? 'border-gray-700 opacity-50 cursor-not-allowed'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-white font-medium">{type.name}</div>
                      {isAgentRecommended && isSelected && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Agent Selected</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">{type.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: App Info */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white">App Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Bundle ID / Package Name</label>
                <input
                  type="text"
                  value={config.appStoreConfig.bundleId}
                  onChange={(e) => setConfig(c => ({
                    ...c,
                    appStoreConfig: { ...c.appStoreConfig, bundleId: e.target.value }
                  }))}
                  placeholder="com.company.appname"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">App Name</label>
                <input
                  type="text"
                  value={config.appStoreConfig.appName}
                  onChange={(e) => setConfig(c => ({
                    ...c,
                    appStoreConfig: { ...c.appStoreConfig, appName: e.target.value }
                  }))}
                  placeholder="My App"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Version</label>
                <input
                  type="text"
                  value={config.appStoreConfig.version}
                  onChange={(e) => setConfig(c => ({
                    ...c,
                    appStoreConfig: { ...c.appStoreConfig, version: e.target.value }
                  }))}
                  placeholder="1.0.0"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Build Number</label>
                <input
                  type="text"
                  value={config.appStoreConfig.buildNumber}
                  onChange={(e) => setConfig(c => ({
                    ...c,
                    appStoreConfig: { ...c.appStoreConfig, buildNumber: e.target.value }
                  }))}
                  placeholder="1"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <h3 className="text-lg font-medium text-white mt-6">Environment</h3>
            <div className="grid grid-cols-3 gap-4">
              {environments.map(env => (
                <button
                  key={env.id}
                  onClick={() => setConfig(c => ({ ...c, environment: env.id as any }))}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    config.environment === env.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-white font-medium">{env.name}</div>
                  <div className="text-xs text-gray-400">{env.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Credentials */}
        {step === 3 && (
          <div className="space-y-6">
            {(config.platform === 'ios' || config.platform === 'both') && (
              <div>
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Apple className="w-5 h-5" /> iOS Credentials
                </h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Apple ID Email</label>
                    <input
                      type="email"
                      value={credentials.ios.appleId}
                      onChange={(e) => setCredentials(c => ({
                        ...c,
                        ios: { ...c.ios, appleId: e.target.value }
                      }))}
                      placeholder="developer@example.com"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Team ID</label>
                    <input
                      type="text"
                      value={credentials.ios.teamId}
                      onChange={(e) => setCredentials(c => ({
                        ...c,
                        ios: { ...c.ios, teamId: e.target.value }
                      }))}
                      placeholder="ABCDEF1234"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  {config.appType === 'react-native' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Expo EAS Token</label>
                      <div className="relative">
                        <input
                          type={showSecrets['expoToken'] ? 'text' : 'password'}
                          value={credentials.ios.expoToken}
                          onChange={(e) => setCredentials(c => ({
                            ...c,
                            ios: { ...c.ios, expoToken: e.target.value }
                          }))}
                          placeholder="expo_eas_xxx"
                          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 pr-10 text-white focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecrets(s => ({ ...s, expoToken: !s.expoToken }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showSecrets['expoToken'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(config.platform === 'android' || config.platform === 'both') && (
              <div>
                <h3 className="text-lg font-medium text-white flex items-center gap-2 mt-6">
                  <Play className="w-5 h-5 text-green-500" /> Android Credentials
                </h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Package Name</label>
                    <input
                      type="text"
                      value={credentials.android.packageName || config.appStoreConfig.bundleId}
                      onChange={(e) => setCredentials(c => ({
                        ...c,
                        android: { ...c.android, packageName: e.target.value }
                      }))}
                      placeholder="com.company.appname"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Keystore Password</label>
                    <div className="relative">
                      <input
                        type={showSecrets['keystore'] ? 'text' : 'password'}
                        value={credentials.android.keystorePassword}
                        onChange={(e) => setCredentials(c => ({
                          ...c,
                          android: { ...c.android, keystorePassword: e.target.value }
                        }))}
                        placeholder="••••••••"
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 pr-10 text-white focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets(s => ({ ...s, keystore: !s.keystore }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showSecrets['keystore'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Google Play Service Account JSON
                    </label>
                    <textarea
                      value={credentials.android.serviceAccountJson}
                      onChange={(e) => setCredentials(c => ({
                        ...c,
                        android: { ...c.android, serviceAccountJson: e.target.value }
                      }))}
                      placeholder='{"type": "service_account", ...}'
                      rows={4}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white">Review Configuration</h3>
            
            <div className="bg-gray-800 rounded-lg p-4 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Platform</span>
                <span className="text-white font-medium">{config.platform.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">App Type</span>
                <span className="text-white font-medium">{config.appType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bundle ID</span>
                <span className="text-white font-mono text-sm">{config.appStoreConfig.bundleId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Version</span>
                <span className="text-white">{config.appStoreConfig.version} ({config.appStoreConfig.buildNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Environment</span>
                <span className="text-white">{config.environment}</span>
              </div>
            </div>

            {validationResult && (
              <div className={`p-4 rounded-lg border ${
                validationResult.valid 
                  ? 'bg-green-500/10 border-green-500/20' 
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex items-center gap-2">
                  {validationResult.valid ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className={validationResult.valid ? 'text-green-400' : 'text-red-400'}>
                    {validationResult.valid ? 'Configuration valid' : 'Configuration has issues'}
                  </span>
                </div>
                {!validationResult.valid && (
                  <ul className="mt-2 space-y-1 text-sm text-gray-300">
                    {validationResult.ios?.missing?.map((m: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        iOS: {m}
                      </li>
                    ))}
                    {validationResult.android?.missing?.map((m: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        Android: {m}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              onClick={validateConfig}
              disabled={validating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {validating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              Validate Configuration
            </button>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-5 h-5" />
                  {error}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Deployment Status */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Deployment Status</h3>
              <button
                onClick={refreshStatus}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {deploymentId && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Deployment ID:</span>
                <code className="bg-gray-800 px-2 py-0.5 rounded">{deploymentId}</code>
                <button
                  onClick={() => copyToClipboard(deploymentId, 'deploymentId')}
                  className="p-1 hover:text-white transition-colors"
                >
                  {copied === 'deploymentId' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            {(config.platform === 'ios' || config.platform === 'both') && deploymentStatus?.ios && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Apple className="w-6 h-6 text-gray-300" />
                  <span className="text-white font-medium">iOS Deployment</span>
                  <span className={`ml-auto ${getStatusColor(deploymentStatus.ios.status)}`}>
                    {deploymentStatus.ios.status}
                  </span>
                </div>
                {deploymentStatus.ios.buildId && (
                  <div className="text-sm text-gray-400 mb-2">
                    Build ID: <code className="text-purple-400">{deploymentStatus.ios.buildId}</code>
                  </div>
                )}
                {deploymentStatus.ios.testflightUrl && (
                  <a
                    href={deploymentStatus.ios.testflightUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in TestFlight
                  </a>
                )}
              </div>
            )}

            {(config.platform === 'android' || config.platform === 'both') && deploymentStatus?.android && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Play className="w-6 h-6 text-green-500" />
                  <span className="text-white font-medium">Android Deployment</span>
                  <span className={`ml-auto ${getStatusColor(deploymentStatus.android.status)}`}>
                    {deploymentStatus.android.status}
                  </span>
                </div>
                {deploymentStatus.android.buildId && (
                  <div className="text-sm text-gray-400 mb-2">
                    Build ID: <code className="text-purple-400">{deploymentStatus.android.buildId}</code>
                  </div>
                )}
                {deploymentStatus.android.playConsoleUrl && (
                  <a
                    href={deploymentStatus.android.playConsoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Play Console
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-between">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1 || step === 5}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {step < 4 && (
          <button
            onClick={() => setStep(s => s + 1)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {step === 4 && (
          <button
            onClick={startDeployment}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            Deploy Now
          </button>
        )}

        {step === 5 && (
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

export default MobileDeploymentWizard;
