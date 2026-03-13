/**
 * AppWrapper - Entry point that wraps App with all providers
 * 
 * This is an incremental migration step. Eventually, App.tsx internals
 * will be migrated to use useAppContext(), but for now this provides
 * the provider wrapper without breaking changes.
 * 
 * @module AppWrapper
 */

import React from 'react';
import { AppStateProvider } from './contexts/AppStateProvider';
import App from './App';

/**
 * AppWrapper Component
 * 
 * Wraps the main App component with centralized state providers.
 * This allows gradual migration of App.tsx internals to use the context.
 */
export const AppWrapper: React.FC = () => {
    return (
        <AppStateProvider>
            <App />
        </AppStateProvider>
    );
};

export default AppWrapper;
