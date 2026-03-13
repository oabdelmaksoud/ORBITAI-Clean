/**
 * Deployment Wizard Component
 * Guides users through deployment setup with step-by-step configuration
 */

import React, { useState } from 'react';
import { 
  Rocket, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Settings, 
  Globe, 
  Key,
  FileText,
  AlertCircle
} from 'lucide-react';

interface DeploymentWizardProps {
  projectId: string;
  projectName: string;
  onDeploy: (config: DeploymentConfig) => void;
  onCancel: () => void;
}

interface DeploymentConfig {
  platform: string;
  environment: string;
  region?: string;
  envVars: Record<string, string>;
  buildCommand?: string;
  startCommand?: string;
}

const PLATFORMS = [
  { id: 'vercel', name: 'Vercel', icon: '🚀', description: 'Best for Next.js and React apps' },
  { id: 'railway', name: 'Railway', icon: '🚂', description: 'Simple deployment with database' },
  { id: 'render', name: 'Render', icon: '🎨', description: 'Full-stack apps and services' },
  { id: 'netlify', name: 'Netlify', icon: '🌐', description: 'JAMstack and static sites' },
  { id: 'aws', name: 'AWS', icon: '☁️', description: 'Enterprise-grade cloud' },
  { id: 'gcp', name: 'Google Cloud', icon: '🔵', description: 'Scalable cloud platform' },
  { id: 'azure', name: 'Azure', icon: '🔷', description: 'Microsoft cloud services' }
];

const ENVIRONMENTS = [
  { id: 'development', name: 'Development', description: 'For testing and development' },
  { id: 'staging', name: 'Staging', description: 'Pre-production environment' },
  { id: 'production', name: 'Production', description: 'Live production environment' }
];

const DeploymentWizard: React.FC<DeploymentWizardProps> = ({
  projectId,
  projectName,
  onDeploy,
  onCancel
}) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<DeploymentConfig>({
    platform: '',
    environment: 'staging',
    envVars: {},
    buildCommand: '',
    startCommand: ''
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleDeploy = () => {
    onDeploy(config);
  };

  const updateConfig = (updates: Partial<DeploymentConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const addEnvVar = () => {
    const key = prompt('Environment variable name:');
    if (key) {
      updateConfig({
        envVars: { ...config.envVars, [key]: '' }
      });
    }
  };

  const removeEnvVar = (key: string) => {
    const newEnvVars = { ...config.envVars };
    delete newEnvVars[key];
    updateConfig({ envVars: newEnvVars });
  };

  const updateEnvVar = (key: string, value: string) => {
    updateConfig({
      envVars: { ...config.envVars, [key]: value }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Rocket className="w-6 h-6" />
                Deploy {projectName}
              </h2>
              <p className="text-blue-100 mt-1">Step {step} of {totalSteps}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:bg-white/20 rounded-full p-2 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    s <= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
                </div>
                {s < totalSteps && (
                  <div
                    className={`h-1 flex-1 ${
                      s < step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {/* Step 1: Platform Selection */}
          {step === 1 && (
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Select Platform
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => updateConfig({ platform: platform.id })}
                    className={`p-4 border-2 rounded-lg text-left transition ${
                      config.platform === platform.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{platform.icon}</div>
                    <div className="font-semibold">{platform.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {platform.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Environment Selection */}
          {step === 2 && (
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Select Environment
              </h3>
              <div className="space-y-3">
                {ENVIRONMENTS.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => updateConfig({ environment: env.id })}
                    className={`w-full p-4 border-2 rounded-lg text-left transition ${
                      config.environment === env.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">{env.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {env.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Environment Variables */}
          {step === 3 && (
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Environment Variables
              </h3>
              <div className="space-y-3">
                {Object.entries(config.envVars).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
                    />
                    <input
                      type="password"
                      value={value}
                      onChange={(e) => updateEnvVar(key, e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 border rounded-lg"
                    />
                    <button
                      onClick={() => removeEnvVar(key)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={addEnvVar}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-600 hover:text-blue-600"
                >
                  + Add Environment Variable
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Deploy */}
          {step === 4 && (
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Review Configuration
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <span className="font-semibold">Platform:</span>{' '}
                  {PLATFORMS.find(p => p.id === config.platform)?.name || config.platform}
                </div>
                <div>
                  <span className="font-semibold">Environment:</span>{' '}
                  {ENVIRONMENTS.find(e => e.id === config.environment)?.name || config.environment}
                </div>
                <div>
                  <span className="font-semibold">Environment Variables:</span>{' '}
                  {Object.keys(config.envVars).length || 'None'}
                </div>
              </div>
              {!config.platform && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="w-5 h-5" />
                  Please select a platform to continue.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={step === 1 && !config.platform}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={!config.platform}
              className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              Deploy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeploymentWizard;




