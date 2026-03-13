/**
 * Premium Themes for OrbGraph Brainstorming
 * Different visual themes for the mind map/bubble visualization
 */

export interface OrbGraphTheme {
  id: string;
  name: string;
  description: string;
  isPremium: boolean;
  colors: {
    centerNode: string;
    ideaNode: string;
    ideaNodeHover: string;
    ideaNodeActive: string;
    link: string;
    background: string;
    text: string;
    textSecondary: string;
    focusRing: string;
    particle: string;
    gradient?: {
      from: string;
      to: string;
    };
  };
  typography: {
    fontFamily: string;
    fontSize: {
      center: string;
      idea: string;
    };
    fontWeight: {
      center: number;
      idea: number;
    };
  };
  effects: {
    shadow: boolean;
    glow: boolean;
    particles: boolean;
    animation: 'smooth' | 'bouncy' | 'subtle';
  };
}

export const ORB_GRAPH_THEMES: OrbGraphTheme[] = [
  // Free themes
  {
    id: 'default',
    name: 'Default',
    description: 'Clean and minimal',
    isPremium: false,
    colors: {
      centerNode: '#6366f1',
      ideaNode: '#8b5cf6',
      ideaNodeHover: '#a78bfa',
      ideaNodeActive: '#c4b5fd',
      link: '#cbd5e1',
      background: '#ffffff',
      text: '#1e293b',
      textSecondary: '#64748b',
      focusRing: '#6366f1',
      particle: '#8b5cf6'
    },
    typography: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: {
        center: '20px',
        idea: '14px'
      },
      fontWeight: {
        center: 600,
        idea: 500
      }
    },
    effects: {
      shadow: true,
      glow: false,
      particles: false,
      animation: 'smooth'
    }
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Easy on the eyes',
    isPremium: false,
    colors: {
      centerNode: '#818cf8',
      ideaNode: '#a78bfa',
      ideaNodeHover: '#c4b5fd',
      ideaNodeActive: '#ddd6fe',
      link: '#475569',
      background: '#0f172a',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      focusRing: '#818cf8',
      particle: '#a78bfa'
    },
    typography: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: {
        center: '20px',
        idea: '14px'
      },
      fontWeight: {
        center: 600,
        idea: 500
      }
    },
    effects: {
      shadow: true,
      glow: true,
      particles: true,
      animation: 'smooth'
    }
  },
  
  // Premium themes
  {
    id: 'ocean',
    name: 'Ocean Breeze',
    description: 'Calming blue tones',
    isPremium: true,
    colors: {
      centerNode: '#0ea5e9',
      ideaNode: '#38bdf8',
      ideaNodeHover: '#7dd3fc',
      ideaNodeActive: '#bae6fd',
      link: '#7dd3fc',
      background: '#f0f9ff',
      text: '#0c4a6e',
      textSecondary: '#075985',
      focusRing: '#0ea5e9',
      particle: '#38bdf8',
      gradient: {
        from: '#0ea5e9',
        to: '#38bdf8'
      }
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: {
        center: '22px',
        idea: '15px'
      },
      fontWeight: {
        center: 700,
        idea: 600
      }
    },
    effects: {
      shadow: true,
      glow: true,
      particles: true,
      animation: 'smooth'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Warm and energetic',
    isPremium: true,
    colors: {
      centerNode: '#f97316',
      ideaNode: '#fb923c',
      ideaNodeHover: '#fdba74',
      ideaNodeActive: '#fed7aa',
      link: '#fdba74',
      background: '#fff7ed',
      text: '#9a3412',
      textSecondary: '#c2410c',
      focusRing: '#f97316',
      particle: '#fb923c',
      gradient: {
        from: '#f97316',
        to: '#fb923c'
      }
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: {
        center: '22px',
        idea: '15px'
      },
      fontWeight: {
        center: 700,
        idea: 600
      }
    },
    effects: {
      shadow: true,
      glow: true,
      particles: true,
      animation: 'bouncy'
    }
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Natural and fresh',
    isPremium: true,
    colors: {
      centerNode: '#10b981',
      ideaNode: '#34d399',
      ideaNodeHover: '#6ee7b7',
      ideaNodeActive: '#a7f3d0',
      link: '#6ee7b7',
      background: '#f0fdf4',
      text: '#065f46',
      textSecondary: '#047857',
      focusRing: '#10b981',
      particle: '#34d399',
      gradient: {
        from: '#10b981',
        to: '#34d399'
      }
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: {
        center: '22px',
        idea: '15px'
      },
      fontWeight: {
        center: 700,
        idea: 600
      }
    },
    effects: {
      shadow: true,
      glow: true,
      particles: true,
      animation: 'smooth'
    }
  },
  {
    id: 'purple-dream',
    name: 'Purple Dream',
    description: 'Creative and inspiring',
    isPremium: true,
    colors: {
      centerNode: '#a855f7',
      ideaNode: '#c084fc',
      ideaNodeHover: '#d8b4fe',
      ideaNodeActive: '#e9d5ff',
      link: '#d8b4fe',
      background: '#faf5ff',
      text: '#6b21a8',
      textSecondary: '#7c3aed',
      focusRing: '#a855f7',
      particle: '#c084fc',
      gradient: {
        from: '#a855f7',
        to: '#c084fc'
      }
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: {
        center: '22px',
        idea: '15px'
      },
      fontWeight: {
        center: 700,
        idea: 600
      }
    },
    effects: {
      shadow: true,
      glow: true,
      particles: true,
      animation: 'bouncy'
    }
  },
  {
    id: 'cosmic',
    name: 'Cosmic Night',
    description: 'Dark and mysterious',
    isPremium: true,
    colors: {
      centerNode: '#8b5cf6',
      ideaNode: '#a78bfa',
      ideaNodeHover: '#c4b5fd',
      ideaNodeActive: '#ddd6fe',
      link: '#6366f1',
      background: '#0f0b1e',
      text: '#e9d5ff',
      textSecondary: '#c4b5fd',
      focusRing: '#8b5cf6',
      particle: '#a78bfa',
      gradient: {
        from: '#8b5cf6',
        to: '#a78bfa'
      }
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: {
        center: '24px',
        idea: '16px'
      },
      fontWeight: {
        center: 700,
        idea: 600
      }
    },
    effects: {
      shadow: true,
      glow: true,
      particles: true,
      animation: 'subtle'
    }
  },
  {
    id: 'neon',
    name: 'Neon Lights',
    description: 'Cyberpunk vibes',
    isPremium: true,
    colors: {
      centerNode: '#00f5ff',
      ideaNode: '#ff00ff',
      ideaNodeHover: '#ff66ff',
      ideaNodeActive: '#ff99ff',
      link: '#ff00ff',
      background: '#0a0a0a',
      text: '#00f5ff',
      textSecondary: '#ff00ff',
      focusRing: '#00f5ff',
      particle: '#ff00ff',
      gradient: {
        from: '#00f5ff',
        to: '#ff00ff'
      }
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: {
        center: '24px',
        idea: '16px'
      },
      fontWeight: {
        center: 700,
        idea: 600
      }
    },
    effects: {
      shadow: true,
      glow: true,
      particles: true,
      animation: 'bouncy'
    }
  }
];

export const getThemeById = (id: string): OrbGraphTheme | undefined => {
  return ORB_GRAPH_THEMES.find(theme => theme.id === id);
};

export const getFreeThemes = (): OrbGraphTheme[] => {
  return ORB_GRAPH_THEMES.filter(theme => !theme.isPremium);
};

export const getPremiumThemes = (): OrbGraphTheme[] => {
  return ORB_GRAPH_THEMES.filter(theme => theme.isPremium);
};

