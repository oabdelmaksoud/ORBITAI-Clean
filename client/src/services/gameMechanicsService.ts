/**
 * Frontend Client for Game Mechanics API
 * React service for mechanics generation
 */

import axios from 'axios';
import type { MechanicsRequest, GeneratedMechanics, MechanicsTemplate } from '../../../shared/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

class GameMechanicsClientService {
    private getAuthHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Generate game mechanics from description
     */
    async generateMechanics(request: MechanicsRequest): Promise<GeneratedMechanics> {
        const response = await axios.post(
            `${API_BASE_URL}/api/game-mechanics/generate`,
            request,
            { headers: this.getAuthHeaders() }
        );
        return response.data.data;
    }

    /**
     * List available templates
     */
    async listTemplates(): Promise<MechanicsTemplate[]> {
        const response = await axios.get(
            `${API_BASE_URL}/api/game-mechanics/templates`,
            { headers: this.getAuthHeaders() }
        );
        return response.data.data.templates;
    }

    /**
     * Get specific template details
     */
    async getTemplate(templateId: string): Promise<MechanicsTemplate> {
        const response = await axios.get(
            `${API_BASE_URL}/api/game-mechanics/templates/${templateId}`,
            { headers: this.getAuthHeaders() }
        );
        return response.data.data.template;
    }

    /**
     * Download generated code file
     */
    downloadFile(filename: string, content: string) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const gameMechanicsClientService = new GameMechanicsClientService();
export default gameMechanicsClientService;
